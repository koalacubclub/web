# Main-thread performance — investigation & fix plan

_Generated from a deep-research pass (code read + web research + adversarial verification) on the Koala Cub Club site. Date: 2026-07-03._

## TL;DR

- The profile that started this was the **Vite dev server + React StrictMode double-render + React/Relay/Meta DevTools extensions**. That inflates `[unattributed]` (~2,555 ms) and much of Scripting. **None of it ships to production.**
- **Do Step 0 (measure prod) before changing code** — it will re-rank everything below.
- The real sustained cost is the **full-viewport `<canvas>` painted + composited (upscaled) every frame at 60fps** — inherent to the design, not a bug. The per-frame micro-opts below trim Scripting/GC and some paint but are not a step-change.
- Real correctness bug found: the game is **frame-based → runs 2× speed on 120 Hz displays** (P12).

### Profile that prompted this (DEV build + extensions, ~6.35s window)

Rendering 1,302 ms · Scripting 839 ms · Painting 516 ms · System 404 ms · Idle ~52%.
By party: `[unattributed]` 2,555 ms; `koalacub.club` (all our JS incl. game loop) ~501 ms; extensions negligible each.

### Already optimized (do NOT re-propose)

- Static sky+ground baked to an offscreen canvas, blitted with `drawImage` each frame.
- Loop pauses when tab hidden (`visibilitychange`) or hero scrolled out of view (scroll listener; hero is `position:fixed` so IntersectionObserver won't fire on it).
- Camera pan reads cached viewport/canvas sizes (no per-frame `offsetWidth` reflow); transform written only when changed.
- Canvas uses `box-shadow` (not a per-frame `drop-shadow` filter).
- `content-visibility:auto` on the below-fold wave strip and color-shift content area.
- The back wave is static (only mid+front animate their path `d`).

---

## Step 0 — Measure production first (P1) · CONFIRMED · impact: high · risk: low · effort: S

The dev/extension/StrictMode overhead is not shippable. Establish the real baseline:

```
pnpm build && pnpm preview     # note the preview URL
```

- Open the preview URL in a fresh Chrome **`--guest`/incognito** window (no extensions).
- DevTools → Performance: record ~5s idle on the hero. Read the **Summary donut** (Scripting/Rendering/Painting) and the **Frames track** (green & <16.7ms = already 60fps, aggregates are just steady state).
- **Rendering tab → Paint flashing ON**, scroll the hero out of view: if the wave strip / content panel keep flashing green while idle, that confirms the continuous non-composited CSS paints (P2/P3).
- **Layer borders + Frame Rendering Stats**: confirm the canvas is its own composited layer and the camera pan is composite-only.
- Optional differential A/B to isolate the canvas's marginal cost: record steady state with (a) loop running, (b) draw body early-returned but element mounted, (c) element unmounted. `(a)-(b)` = draw JS + its paint/composite; `(b)-(c)` = static compositing of the big upscaled layer. Wrap draw sub-phases in `performance.measure()` and run under 4–6× CPU throttle.
- Optional: add `web-vitals` (attribution) to log INP (<200ms target); `rollup-plugin-visualizer` for bundle sizes.

Caveats: `vite preview` isn't identical to real static hosting (no gzip/brotli/CDN by default; the PROD-only noscript plugin/SW become active — profile steady-state idle-hero, not cold start). Use the same CPU-throttle when comparing to the dev profile.

---

## Tier 1 — safe, verified, keep 60fps (batch these)

Each is low-risk; collectively they cut per-frame allocations/paint.

### P5 — `alpha:false` + `imageSmoothingEnabled=false` · CONFIRMED · impact: low (corrected) · risk: low · effort: S

`src/components/ParkGame.tsx` (getContext, ~line 305). Canvas is fully opaque every frame (bg blit covers all 960×816), so default `alpha:true` wastes per-pixel alpha blending.

```js
const ctx = canvas.getContext('2d', { alpha: false })
if (!ctx) return
ctx.imageSmoothingEnabled = false // crisp pixel-art + skips bilinear filter; re-set if context is recreated
```

- The `clearRect` at ~line 1548 becomes redundant (bg blit covers everything) — can delete.
- Tradeoff: nothing behind the canvas (FixedHero ambient gradients) can show through; fine since the game covers its box. On extreme aspect ratios a letterbox gap would show black instead of the gradient.

### P7 — pre-render food glow sprites + hoist stars array + drop dead emoji branch · CONFIRMED · impact: low (corrected) · risk: low · effort: M

`src/components/ParkGame.tsx` (drawFoods ~1268–1335, drawStarsAndMoon ~498–526).

- `drawFoods` allocates `createRadialGradient` + 2 `addColorStop` + template-literal rgba strings **per active food per frame** (~180 gradient allocs/sec at 3 foods). Pre-render the 2 glow variants (cream `255,240,190`, gold `255,215,80`) to ~64×64 offscreen canvases once; each frame `ctx.drawImage(sprite, cx-size, cy-size, size*2, size*2)`.
- `drawStarsAndMoon` rebuilds a 20-object star array literal every frame — hoist to a closure const (positions static; only twinkle alpha varies).
- All 8 food PNGs exist in `public/game/food`, so the emoji fallback branch is dead in prod — keep behind the `img.complete` check as a safety net.
- Note: keep default smoothing when blitting the glow sprite (don't make it blocky); tune sprite resolution for identical falloff under the multiply tint.

### P8 — pre-sort `g.objects` once · verified correct · impact: low · risk: low · effort: S

`src/components/ParkGame.tsx` (drawObjects ~1147, initObjects ~202–280). `g.objects` is static (12 items, y never mutated), yet `drawObjects` does `[...g.objects].sort((a,b)=>a.y-b.y)` every frame.

```js
// end of initObjects:
g.objects.sort((a, b) => a.y - b.y)
// drawObjects: iterate g.objects with a plain for-loop; no clone, no sort, no closure
```

Sub-millisecond; batch it with the rest.

### P3 (cheap variant) — make the middle wave static · PLAUSIBLE · impact: low (corrected) · risk: low · effort: S

`src/pages/Home.tsx` (~390–393), `src/index.css` (114–148). Animating SVG path `d` re-tessellates on the main thread every frame (not composited).

- Delete the `className="animate-[wave-mid_6s...]"` on the wave-mid `<path>` so only the front wave morphs (halves the wave paint).
- Delete the dead `wave-back` keyframes (`index.css:150`, referenced nowhere).
- Gated by `content-visibility` already, so only matters while the fold transition is on screen.
- (Bigger, optional: convert to a `transform: translateX` scroll of a ~2× viewport-wide tileable wave = fully composited, zero main-thread paint — needs a seamless path.)

### P9 — popups guard + cache measureText + frameCount cooldown · (not separately verified) · impact: low · risk: low · effort: S

`src/components/ParkGame.tsx` (drawPopups ~1178–1204; updateCat cooldown ~1466–1477).

- `drawPopups`: `if (!g.popups.length) return;` and only run the `filter` when something expired.
- Cache each popup's measured width (`p._w`) at creation (set font first).
- Replace `setTimeout(()=>{obj._shown=false}, 3000)` with a frame gate: `obj._nextShowAt = g.frameCount + 180` checked in the loop (removes timer+closure allocs; deterministic).

### P6 — cache the HUD to an offscreen bitmap · PLAUSIBLE · impact: low (corrected) · risk: low · effort: M

`src/components/ParkGame.tsx` (drawHUD ~1337–1368). Runs every frame: 4× `ctx.font`, 2× `measureText`, `roundRect`+fill, 4× `fillText` — but score/best change only on pickup, hudShift only on camera pan.

- Add `hudCanvas` + `hudDirty` closure state; set `hudDirty=true` when `g.score`/`g.best` change (in updateFoods). `renderHUDBitmap()` draws the pill+text once into `hudCanvas`; each frame `ctx.drawImage(hudCanvas, g.hudShift|0, 0)`.
- Size to `pad+pillW` (not fixed); invalidate on `document.fonts.ready` to avoid caching fallback font.

### P10 — drop backdrop-blur over the live canvas · (not separately verified) · impact: medium · risk: low · effort: S

`src/pages/Home.tsx` (hero icons ~318/327, scroll hint ~356; 12 reel buttons ~128). `backdrop-filter: blur` re-samples the pixels behind it whenever they change — the 3 elements over the 60fps canvas recompute their blur 60×/s.

- Hero icons: `bg-white/10 backdrop-blur-md` → `bg-white/15` (drop blur). Scroll hint: `bg-black/30 backdrop-blur-sm` → `bg-black/45`. Reel buttons (lower priority, mostly static once P2 done): `bg-white/15 backdrop-blur-md` → `bg-white/20`.
- Priority: the 3 over-canvas ones first.

---

## Tier 2 — bigger / judgment calls

### P12 — fixed-timestep / delta-time (REAL CORRECTNESS BUG) · impact: medium · risk: medium · effort: L

`src/components/ParkGame.tsx` (gameLoop ~1545–1584, updateCat, drawButterflies). The loop couples update+render with **frame-based** deltas (cat `speed=0.035/frame`; butterfly/food/twinkle by `frameCount`). On a **120 Hz display the sim runs 2× speed**; on slow devices it's slow. Also, physics mutations live inside draw fns (butterflies ~807–809, popups ~1182–1183).

```js
let acc = 0,
  last = performance.now(),
  SUB = 1 / 60
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000)
  last = now
  while (acc >= SUB) {
    update(SUB)
    acc -= SUB
  }
  render()
  if (active()) animId = requestAnimationFrame(frame)
}
```

Convert per-frame constants to `*dt` (preserve feel: `speed*dt*60`). Move butterfly/popup mutation into `update()`. Optionally run decorative subsystems at 30 Hz (every 2nd fixed step) while cat+render stay 60 Hz. **Do after the cheap wins**, and only if prod profile shows loop scripting is material — but the 120 Hz fix is worth it regardless.

### P2 — stop animating `background-color` (bg-shift) · CONFIRMED · impact: medium (corrected) · risk: low · effort: M

`src/pages/Home.tsx:426`, `src/index.css:169–188`. `background-color` is not compositor-accelerated → repaints the panel every frame for 20s while visible. **But** `content-visibility` pauses it off-screen, so it only costs while the user is **reading content** (hero scrolled away, game loop paused) — hence "medium," not the top-of-page cost.

- Option A (recommended): drop the animation, use a static background gradient.
- Option B (keep effect, composited): two stacked fixed-gradient sibling layers, animate only `opacity` to cross-fade (`@keyframes hue-fade`). Note: 2-color cross-fade ≠ the original 6-hue cycle; more layers needed for fidelity. Watch GPU memory (tall panel → large promoted layer).
- Reel cards already use `transform-gpu isolate` so they're not re-rastered by the bg change.

### P4 — bake the per-frame full-canvas `multiply` tint · PLAUSIBLE · impact: low (corrected) · risk: medium · effort: L

`src/components/ParkGame.tsx` (overlay ~1564–1568). Every frame: `save` + `globalCompositeOperation='multiply'` + `fillRect(0,0,960,816)` + `restore` — a 783k-px blend. **The overlay sits BETWEEN the world layer (objects+cat) and the post-overlay layer (stars/moon/food/popups/HUD)**, so you can NOT simply bake it into `bgCanvas` (would stop tinting cat/objects and start tinting stars/food).
Correct fix: bake tint into the static bg once (pre-tint sky/ground) AND build a separate pre-multiplied `COLORS_TINTED` palette for the world draws; leave post-overlay draws bright; delete the per-frame overlay.

- **Pitfalls:** `COLORS` is shared between world (tint) and post-overlay (bright) — don't mutate in place; make `COLORS_TINTED` and rewire world call sites. Many world draws use inline hex literals (`#E8D5A8`, `#DCC89A`, `#F0E2B8`, `#D4A574`, `#FF6B6B`, `#F5F5DC`, `#8B9B2A`, `#FFE4D6`) — each must be pre-multiplied or you get visible drift. Butterfly colors are seeded from `COLORS` at init. Pixel-diff first frame to tune. Recommend deprioritizing given effort/reward.

### P13 — gate the rAF loop on `prefers-reduced-motion` · impact: low · risk: low · effort: S

`src/components/ParkGame.tsx` (active()/ensureRunning ~1540–1611). CSS + framer-motion already respect reduced-motion, but the canvas loop doesn't. Add `matchMedia('(prefers-reduced-motion: reduce)')`: if set, draw one static frame and never start rAF; subscribe to `change`. Accessibility + battery win for that subset.

### P11 — MemberAvatar: useInView + don't remount all 20 on pagination · impact: medium · risk: low · effort: M

`src/pages/Home.tsx` (MemberAvatar ~161–174; grid keyed by `page` inside `AnimatePresence mode='wait'` ~236–252). All 20 avatars run their entrance on mount (no `useInView`), and every page click unmounts+remounts all 20 (a burst of ~21 springs + full reconciliation → INP hazard). Add `useInView({once:true})`; animate the container once instead of 20 children, or don't re-key the whole grid on page change.

### P14 — IntersectionObserver on a non-fixed sentinel · impact: low · risk: low · effort: M

Replace the per-scroll listener with a zero-size sentinel div in normal flow at the hero's bottom, observed via IO (runs off main thread, coalesces). Current scroll handler is already cheap, so low priority.

### P15 — code-split below-fold + LazyMotion · impact: medium (load-time) · risk: medium · effort: L

`src/pages/Home.tsx`, `vite.config.ts`, `src/main.tsx`. No `manualChunks`, nothing lazy — hero + framer-motion-heavy feed ship as one eager chunk. (1) `React.lazy` the below-fold content behind Suspense (trigger from the scroll signal / `requestIdleCallback`). (2) `motion.*` → `m.*` wrapped in `<LazyMotion features={()=>import('framer-motion').then(m=>m.domAnimation)}>` (drops framer-motion base to ~5–6kb). Reduces initial JS/parse, not steady-state 60fps — judge on the prod profile. `LazyMotion strict` throws if any `motion.*` remains; migrate fully.

### P16 — non-blocking / self-hosted fonts · impact: medium (load-time) · risk: low · effort: M

`index.html:47–52`. Cormorant Garamond + Inter load via a synchronous render-blocking cross-origin `<link rel=stylesheet>`. Quick win: `media=print onload="this.media='all'"` + `<noscript>` fallback. Better: self-host subset woff2, `@font-face`, `<link rel=preload as=font>`, trim unused weights. Load-time/LCP win, not steady-state.

---

## Tier 3 — high-ceiling last resorts (only if prod profile still shows the canvas dominating)

- **OffscreenCanvas + Web Worker**: move the whole game render off the main thread. High effort; check browser support and input plumbing.
- **Layered canvases**: separate static/dynamic layers so you don't full-canvas redraw+composite each frame.
- Do **not** raise the backing store by devicePixelRatio — the pixelated upscale of a small backing canvas is already the cheap choice; increasing it would raise composite cost.

---

## Suggested order of execution

1. **Step 0** — prod profile in a guest window (decides whether anything below is worth it).
2. **Tier 1 batch** (P5, P7, P8, P3-cheap, P9, P6, P10) — one low-risk PR, re-measure.
3. **P12** — fix the 120 Hz double-speed bug (correctness).
4. Reassess P2 / P4 / P11 / P15 / P16 against the prod numbers.
5. Tier 3 only if the canvas still dominates in prod.

_Verdicts (P1–P8 were adversarially verified): P1 CONFIRMED, P2 CONFIRMED (impact→medium), P3 PLAUSIBLE (→low), P4 PLAUSIBLE (→low), P5 CONFIRMED (→low), P6 PLAUSIBLE (→low), P7 CONFIRMED (→low), P8 verified-correct (→low). P9–P16 are proposals not individually re-verified._
