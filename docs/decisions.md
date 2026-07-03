# Key decisions (and why)

Short, ADR-style notes on choices that aren't obvious from the code. If you're
about to change one of these, read the "why" first — most were deliberate.

## 1. Client-rendered SPA + build-time `<noscript>` for crawlers (not SSR)

The site is a JS-rendered SPA. AI crawlers (GPTBot, ClaudeBot, PerplexityBot, …)
and some search bots **don't execute JavaScript**, so without help they'd see an
empty `<div id="root">`. Instead of adopting SSR/prerendering (heavy, and the
canvas game touches `window`), a Vite plugin injects a `<noscript>` mirror of the
real content at build time (`crawlableContent()` in `vite.config.ts`), generated
from the shared data modules.

**Why not SSR/prerender:** needs a headless browser at build (fragile on
CI/Vercel), and risks the `window`-dependent `<canvas>` game. The `<noscript>`
gives crawlers the full feed + follower list + links with none of that cost.

## 2. `src/data/*.ts` are the single source of truth

`reels.ts` and `followers.ts` feed both the React UI and the build-time
`<noscript>`. One edit updates both, so the crawlable text never drifts from the
rendered page. **Keep these files Node-safe** — `vite.config.ts` imports them, and
it runs in Node. (That's why `reelPosters.ts`, which uses `import.meta.glob`, is a
separate app-only module.)

## 3. Local media that links out — no third-party embeds

The reel feed and the followers wall use **local images that link to Instagram**,
not Instagram/TikTok embed iframes. Reasons: embeds are slow (third-party scripts
on first paint), leak users to trackers, and their CDN URLs are signed and expire.
Local posters/avatars stay fast, private, and stable. Trade-off: content is a
**point-in-time snapshot** and must be refreshed manually (see
[content-workflows.md](./content-workflows.md)).

## 4. Build-time responsive images (vite-imagetools), pristine sources

Reel poster sources live untouched in `src/assets/reels/`. `vite-imagetools`
generates responsive **WebP** (240/480/640-wide `srcset`, q70) at build; the raw
JPEGs are never shipped and the browser downloads only the width it needs (a phone
pulls ~10–30 KB instead of a 50–300 KB JPEG).

**Why a pipeline, not hand-optimizing:** recompressing sources in place is
destructive and doesn't adapt to the layout's actual sizes. Keep sources pristine;
let the build produce the right variants. Followers avatars are tiny (~7 KB) and
served as-is — not worth the pipeline.

## 5. The hero is a canvas mini-game

The landing hero is `ParkGame` — a Neko-Atsume-style canvas 2D mini-game (walk
Koala around, catch spawning food for points). It replaced an earlier static
"She sees you." photo hero. It's playful and on-brand; the cost is that hero
"content" is a `<canvas>` (no crawlable text — hence decision #1 matters). See
[game.md](./game.md).

## 6. `lucide-react` pinned to `^0.453`

lucide 1.x removed brand icons (Instagram, Github). We use those, so we stay on
the 0.x line. Don't bump to 1.x without replacing those icons.

## 7. oxlint, not ESLint

The Vite react-ts template now ships **oxlint** (Rust, fast). We kept it. Config
is `.oxlintrc.json`; `public/sw.js` is ignored there (service-worker globals like
`self`/`caches` would otherwise trip no-undef).

## 8. Motion respects `prefers-reduced-motion`; zoom is disabled

The page is animation-heavy, so it honors reduced-motion via
`<MotionConfig reducedMotion="user">` **and** a CSS `@media (prefers-reduced-motion)`
fallback (for the CSS keyframe waves/bg). Separately, the viewport sets
`user-scalable=no` for an app/game-like feel — this is a **known accessibility
trade-off** (Lighthouse flags it, −10 a11y weight). It's intentional; flip it in
`index.html` if accessibility is prioritized over the app feel.

## 9. Installable PWA

`manifest.webmanifest` + `sw.js` (registered in `src/main.tsx`, production only)
make it installable, with a maskable icon (safe-zone padded) and Apple meta tags.
The service worker is network-first for navigations (fresh HTML) and cache-first
for assets.

## 10. `www` canonical + AI-crawler-friendly robots

Canonical/OG/Twitter/sitemap all use `https://www.koalacub.club`. `robots.txt`
explicitly `Allow`s the major AI/search bots. The apex→www redirect lives in the
**Vercel dashboard**, not the repo — if the canonical host ever changes, update
`index.html`, `robots.txt`, and `sitemap.xml` together.

## 11. Food sprites are drop-in with an emoji fallback

The game's collectible food renders each item's **emoji** until a real sprite
exists at `public/game/food/<key>.png` (256px, transparent). Drop the PNGs in and
they're picked up automatically — no code change. Spec + prompts in
[food-icons.md](./food-icons.md).

## Testing notes

- Unit: Vitest + Testing Library (jsdom). `src/test/setup.ts` stubs
  `IntersectionObserver` (framer-motion `useInView` needs it — the stub reports
  in-view so reveal/animate paths run) and `matchMedia`.
- e2e: Playwright; its `webServer` builds + previews the production bundle, so
  `pnpm test:e2e` is self-contained.
