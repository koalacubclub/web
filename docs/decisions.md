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

## 11. Food is procedural basic-shape art (no PNG pipeline)

The game's collectible food is drawn **procedurally with `ctx` primitives**
(`drawFoodShape()` in `ParkGame.tsx`) so it matches the park's other
basic-shape objects rather than looking like pasted-in emoji or raster stickers.
The item's emoji is only a last-resort fallback for an unknown key.

An earlier version supported a **drop-in PNG override** (`public/game/food/<key>.png`,
256px, preloaded into `g.foodImages`), but the shipped PNGs clashed with the
game's flat-shape art, so the loader and the PNGs were **removed** in favour of
procedural drawing. The art spec is kept as a legacy reference in
[food-icons.md](./food-icons.md); reintroducing raster art would mean re-adding
the loader + override branch.

## 12. Render the game canvas at device resolution (no pixelated upscale)

The `ParkGame` canvas draws in logical coords but sizes its backing store to
~device pixels (`RS = min(2, cssWidth·dpr / CANVAS_WIDTH)`, applied via
`ctx.setTransform`) and scales **smoothly** — `image-rendering: pixelated` was
removed. Drawing at a small backing store and nearest-neighbor upscaling made
everything blocky and made moving sprites shimmer / "crawl". **Trade-off:** a
higher backing store is more paint per frame, so `RS` is capped at 2× to bound the
cost on mobile. Details in [game.md](./game.md) and
[perf-main-thread-plan.md](./perf-main-thread-plan.md).

## 13. Time-based, frame-rate-independent game loop

Movement and animation are driven by elapsed time (`dt`), not raw frame count, so
the game runs at the same real speed regardless of FPS — mobile frequently runs
below 60 (and decision #12's device-resolution canvas makes each frame heavier).
`frameCount` is advanced as a real-time clock (`dt × 0.06` = 60fps-frame units) so
every `frameCount`-based animation keeps pace; `dt` is clamped to 100ms so a
backgrounded tab can't teleport the cat on resume. The loop also **pauses** when the
tab is hidden or the hero is scrolled out of view (a scroll check, since the fixed
hero always intersects the viewport). See [game.md](./game.md).

## 14. Multiplayer on Cloudflare (Worker + Durable Object), frontend stays on Vercel

The park is a shared world: every visitor is a koala and sees the others move in
real time. The backend is a **Cloudflare Worker + one Durable Object**
(`server/`, at `game.koalacub.club`); the site stays a Vite SPA on Vercel
(`client/`). The repo is a pnpm workspace: `client` + `server` +
`shared` (the wire protocol, imported by both).

**Why a Durable Object, not a Node server or a plain Worker.** A Worker is
stateless and can be evicted between requests, so it can't hold "who's in the
park". A Durable Object is a single addressable, stateful instance — all players
route to `world-main`, one authority coordinates presence and relays movement.
It keeps long-lived (hibernatable) WebSockets, so it costs nothing while the park
is empty yet doesn't drop connections. A always-on Node box (Railway/Colyseus)
would work too but adds a process + DB to run and pay for; the DO needs neither
for v1. See [multiplayer-deploy.md](./multiplayer-deploy.md).

**No game tick.** The DO is event-driven (relay on message), never a
`setInterval`/`alarm` loop — that's what lets it hibernate when idle. Positions
are ephemeral (broadcast, not stored); only a player's last-known position rides
in the socket attachment so a hibernation wake doesn't snap idle koalas to spawn.

**Identity + anti-cheat are best-effort.** An anonymous, HMAC-signed session
cookie (`POST /session`) is the identity — no accounts. The Worker gates the
WebSocket on Origin + a valid session and passes the _verified_ id to the DO
(clients can't spoof it). Inbound is rate-limited **per session** (not per
socket, so extra tabs can't multiply the budget) and positions are clamped
server-side. Sessions are freely mintable, so this bounds abuse rather than
preventing it.

**Fails soft.** The client only enables multiplayer when `VITE_GAME_HTTP_URL` /
`VITE_GAME_WS_URL` are set; otherwise (and if the backend is unreachable) the
game runs solo. A backend outage never breaks the site.

**The economy is server-owned too (#15).** Coins == likes: the DO awards them on
its authoritative food-collect and owns the shop — a `buy` is validated (price,
bounds, no overlap), likes are deducted, and placed items are **shared across
players** + persisted in SQLite with a server TTL. Food and placed items spawn/
expire via lazy top-up on player traffic (still no tick). The client never
reports points or spends locally — it renders server state and sends actions.

**Deploy.** Both halves ship from `main` via CI (Vercel git auto-deploy is off —
see the `deploy` and `deploy-server` jobs). `wrangler deploy` uses
`account_id` from `wrangler.jsonc` + the `CLOUDFLARE_API_TOKEN` repo secret;
`SESSION_SECRET` is a Worker secret that persists across deploys.

## 15. Score is a coin wallet spent in a shop, bridged by a store singleton

The game score doubles as a **spendable coin wallet**: catching food earns coins
and a shop spends them to place decorations at Koala's tile (`best` stays the
all-time peak). The bridge between the **imperative canvas** (which must not
re-render 60×/s) and the **React shop UI** is a framework-agnostic module
singleton, `client/src/game/parkStore.ts` — NOT React Context / lifted
`useState`, which would re-render ParkGame on every coin earned. React subscribes
with `useSyncExternalStore` (a stable cached snapshot); the game reads/writes via
plain imperative getters. This also keeps the economy + placement pure and
unit-testable without React.

> **Update (#14): the economy is now server-authoritative in multiplayer.** The
> DO owns coins (== likes), purchases and the shared placed items; `parkStore` is
> a **server-fed mirror** (`setServerBuyer`/`applyServerWallet`/`applyServerPlaced`)
> whose `purchase()` routes a `buy` to the server. The store-singleton bridge and
> the no-React-Context rationale below still hold — only the source of truth moved
> from localStorage to the server. localStorage remains the **solo** (no-backend)
> fallback.

Supporting choices:

- **Shared shop sprites.** `client/src/game/sprites.ts` (`drawShopSprite`) draws
  shop items with `ctx` primitives so the shop renders the **real item art** (not
  emoji) at real relative size (`ItemPreview`), and placed decor matches the
  park's base-object look.
- **Wall-clock TTL.** Placed items expire `PLACED_TTL_MS` (7 days) after purchase using `Date.now()`
  (`expiresAt`), NOT `frameCount` — the loop pauses off-screen/hidden, so a
  frame-count TTL would freeze. In multiplayer the **server owns `expiresAt`** and
  sweeps expired items (broadcasting `unplaced`); solo keeps the local sweep.
- **Non-solid, collision-aware placement.** Bought items never block Koala. The
  **client** picks the spot (spirals out from her tile, avoiding base objects +
  placed items; a full ground returns `'no-room'` and charges nothing); in
  multiplayer the **server** independently validates price, bounds and overlap
  before it places + charges (client-chosen tile, server-owned decision).
- **Server-authoritative (multiplayer), local-first (solo).** The `sync` seam is
  now realized: when connected, `parkStore` is fed by the DO
  (`applyServerWallet`/`applyServerPlaced`) and purchases route to it via
  `setServerBuyer` — no localStorage writes. With no backend it falls back to
  localStorage (`kcc-park-coins`/`-best`/`-placed`). The catalog lives in
  `shared/protocol.ts` (`SHOP_ITEMS`) so client and server price identically;
  `client/src/game/shopItems.ts` just re-exports it.

## Testing notes

- Unit: Vitest + Testing Library (jsdom). `src/test/setup.ts` stubs
  `IntersectionObserver` (framer-motion `useInView` needs it — the stub reports
  in-view so reveal/animate paths run) and `matchMedia`. The multiplayer client
  (`src/multiplayer/connection.test.ts`) mocks `WebSocket`/`fetch` to test roster
  handling, self-filtering, throttling and reconnect.
- Server: the Durable Object is tested in real `workerd` via
  `@cloudflare/vitest-pool-workers` (`server/test/world.test.ts`) — auth, origin
  gate, relay, position clamp, per-session rate limit, food collect (award /
  persist / dedupe / out-of-range) and the shop (buy / insufficient / invalid /
  occupied / shared broadcast / persists across reconnect).
- e2e: Playwright; its `webServer` builds + previews the production bundle, so
  `pnpm test:e2e` is self-contained.
