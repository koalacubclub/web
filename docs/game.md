# ParkGame — the hero mini-game

`src/components/ParkGame.tsx` is a self-contained **canvas 2D** mini-game that
serves as the site hero: Koala walks around a nighttime park and catches food
that spawns for points. It's a Neko-Atsume-style, cozy flat-cartoon look — all art
is drawn **procedurally** with `ctx` shapes (no spritesheet), except the drop-in
food PNGs.

## How it's built

- **One `useEffect`** sets up the canvas, input listeners, and a
  `requestAnimationFrame` loop. All mutable state lives in a `useRef`
  (`gameRef.current`) — the game never triggers React re-renders (perf).
- **Coordinate system:** tiles of `PIXEL = 16 * SCALE` (48px). The map is
  `MAP_COLS=20` × `MAP_ROWS = GROUND_ROWS(13) + SKY_ROWS(4)`. The playable park is
  the ground rows; the world is drawn shifted down by `WORLD_OFFSET` so there's sky
  above it. Positions are tile coords; cat/food centers are `tile + 0.5`.
- **Render order:** ground/objects/cat are drawn, then a purple `multiply` night
  wash over everything, then stars/moon/**food**/popups/HUD on top (true colors,
  above the wash).
- **Controls (desktop):** arrow keys / WASD, or mouse press-and-drag to walk Koala
  toward the pointer (release to stop). Mouse/pen engage immediately.
- **Controls (touch):** gesture-disambiguated so the full-screen hero doesn't
  hijack the page scroll — a **quick swipe scrolls the page**, while a **~150ms
  hold** (finger still, moved < ~10px) "grabs" Koala and the subsequent drag steers
  her, calling `preventDefault` so the page won't scroll. There is **no on-screen
  D-pad**. During a drag a `kcc-dragging` class on `<body>` disables text selection
  / the iOS long-press callout (the rest of the page stays selectable).
- **Camera:** on viewports narrower than the (scaled) canvas, a **horizontal
  camera** pans the canvas via CSS `transform` to keep Koala centered; the score
  HUD is offset by `g.hudShift` so it stays pinned to the viewport instead of
  sliding with the pan. Details of `updateCamera()`:
  - **Fit gate:** panning is a no-op unless the canvas is actually wider than the
    viewport (`displayW - viewportW > 0.5`) — when the whole map fits, the
    transform stays at `0` and `g.hudShift = 0`.
  - **Clamped follow:** the canvas is laid out centered, so its left edge sits at
    `centeredLeft = (viewportW - displayW) / 2`. The camera picks a target left
    edge that puts Koala at viewport-center (`viewportW/2 - catDisplayX`),
    **clamped to `[viewportW - displayW, 0]`** so it never scrolls past the map's
    left (`> 0`) or right (`< viewportW - displayW`) edge:
    `desiredLeft = min(0, max(viewportW - displayW, viewportW/2 - catDisplayX))`.
    The applied transform is the delta from the centered layout,
    `tx = desiredLeft - centeredLeft`, and it's written to
    `canvas.style.transform` **only when `tx` actually changes** (`lastTx`).
  - **HUD counter-pan:** `g.hudShift = -desiredLeft * (CANVAS_WIDTH / displayW)`
    converts the pan back into logical canvas px so `drawHUD()` can offset the
    score pill and keep it pinned to the viewport's left.
  - **No per-frame reflow:** `viewportW` / `displayW` are cached, read from a
    `measure()` helper on setup and refreshed by a **`ResizeObserver`** on the
    canvas (plus the window `resize` handler) — the loop never reads `offsetWidth`.
  - **Measurement gotcha:** `viewportW` is measured from
    `canvas.parentElement.clientWidth`, **not `window.innerWidth`** — the latter
    includes the vertical scrollbar, but the canvas is centered in the
    scrollbar-excluded content box. Using `innerWidth` made the right clamp
    overshoot by the scrollbar width, so the camera stopped short of the right
    edge and Koala could slide off-screen going right. The `ResizeObserver` also
    matters here: a scrollbar appearing or a DPR / mobile `svh` change resizes the
    canvas **without** firing window `resize`, which would otherwise leave a stale
    `displayW`.
- **Cat idle states:** standing → **lying** after ~10s idle → **sleeping** after
  ~20s (with a "Zzz" dream bubble); any input resets it. Idle time is counted in
  frame-rate-independent units (see Rendering & performance).
- **Reduced motion:** the page respects `prefers-reduced-motion` for framer-motion
  and CSS, but the canvas loop itself keeps animating (it's the hero centerpiece).

## Food-collectible system

Config lives at the top of the file:

```ts
FOODS = [{ key, label, emoji, points, weight, tier }, …]
```

- **Spawning:** every ~4–9s, up to 3 on screen at once, on a random free ground
  tile (weighted by `weight`, avoiding objects/other food/the cat). Each has a
  ~15s lifespan (blinks before despawning).
- **Collecting:** walk within ~0.85 tile → score `+= points`, a `+N Label` popup
  pops, and Koala shows hearts. Rarer/higher-point items (goldfish = 50) spawn
  less often.
- **Score:** shown in an on-canvas HUD pill that sits just above the ground line
  (pinned against the camera pan via `g.hudShift`); the **best score persists** in
  `localStorage` under `kcc-park-best`.
- **Art:** each food renders its **emoji as a fallback**, and automatically uses
  `public/game/food/<key>.png` (256px, transparent) once that file exists — images
  are preloaded into `g.foodImages`. To add real art, drop the PNGs in; no code
  change. Full sprite spec + generation prompts: [food-icons.md](./food-icons.md).

## Rendering & performance

- **Device-resolution canvas.** The backing store is sized to ~device pixels —
  `RS = min(2, cssWidth × devicePixelRatio / CANVAS_WIDTH)` — and the game draws in
  logical coords via `ctx.setTransform(RS, …)`, scaled **smoothly** (there is
  **no `image-rendering: pixelated`**). Rendering at the small backing size and
  nearest-neighbor upscaling used to make everything blocky and made motion
  "crawl". The canvas uses a static `box-shadow`, not a per-frame `drop-shadow`
  filter.
- **Static background is baked once.** The sky gradient + ground (grass blobs,
  sand, dirt) never change, so they're rendered a single time into an **offscreen
  canvas** and blitted with one `drawImage` per frame instead of recomputing all
  the bézier/gradient work every frame.
- **The loop pauses when it can't be seen.** `requestAnimationFrame` stops when the
  tab is hidden (`visibilitychange`) or the hero is scrolled out of view. The hero
  is `position: fixed` (always intersecting the viewport), so this uses a scroll
  check (`scrollY < innerHeight`), not an IntersectionObserver.
- **Frame-rate independent.** Everything is time-based, so it runs at the same real
  speed regardless of FPS (mobile often runs below 60). Each frame computes `dt`
  (clamped to 100ms so a tab-resume can't teleport anything): the cat moves at
  `0.0021 tiles/ms × dt`, `frameCount` advances as a real-time clock
  (`+= dt × 0.06`, i.e. 60fps-frame units) so every `sin(frameCount·k)` animation
  keeps pace, and per-frame integrations (butterflies, popups, the idle timer)
  scale by the same factor.

See [perf-main-thread-plan.md](./perf-main-thread-plan.md) for the broader
main-thread analysis — this canvas is the dominant animated surface.

## Tuning

Spawn cadence, max on screen, lifespan, collect radius, and the `FOODS` table
(items/points/weights) are all constants near the top of `ParkGame.tsx`. The unit
test (`src/pages/Home.test.tsx`) asserts the game canvas renders with its
`aria-label`; keep that label containing "Koala's Park".
