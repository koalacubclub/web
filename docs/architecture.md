# Architecture

## What this is

A single-page marketing/landing site for **Koala Cub Club** (a tabby cat's
Instagram/TikTok presence). Live at **https://www.koalacub.club**. It is a
client-rendered SPA — one page (`client/src/pages/Home.tsx`), no router — with a
canvas mini-game as the hero, a feed of Instagram reels, and a wall of
followers. The hero game is **multiplayer**, backed by a Cloudflare Worker +
Durable Object (see below and [decisions.md](./decisions.md) #14).

The repo is a **pnpm workspace** with three packages: `client` (the Vite site,
on Vercel), `server` (the Cloudflare Worker + Durable Object, at
`game.koalacub.club`), and `shared` (`@koala/shared`, the multiplayer wire
protocol imported by both).

## Stack (and notable version choices)

- **Vite 8 + React 19 + TypeScript 6** (the modern `react-ts` template — it ships
  **oxlint**, not ESLint; we kept oxlint).
- **Tailwind CSS v4** via `@tailwindcss/vite` (confirmed working on Vite 8).
- **framer-motion** for animation; **lucide-react pinned to `^0.453`** — the 1.x
  major dropped brand icons (Instagram, Github) that we use.
- **vite-imagetools** (+ sharp) for build-time responsive images.
- **Node 24**, **pnpm 10** (pinned via the `packageManager` field so
  `pnpm/action-setup` and Vercel resolve the right version). **pnpm workspace**
  (`client` / `server` / `shared`).
- **Backend:** Cloudflare **Workers + Durable Objects** (`server/`) for the
  multiplayer park; tested in real `workerd` via `@cloudflare/vitest-pool-workers`.

## Directory map

```
pnpm-workspace.yaml     # workspace: client + server + shared
client/                 # the Vite SPA (deployed to Vercel; Root Directory = client)
  index.html            # SPA shell; SEO/OG/PWA meta; fonts. <noscript> injected at build.
  vite.config.ts        # plugins: react, tailwind, imagetools, + crawlableContent() (noscript)
  vercel.json           # framework/build + git.deploymentEnabled.main=false (CI deploys)
  src/
    pages/Home.tsx      # the entire page: hero(game) + feed + club + footer
    components/
      ParkGame.tsx      # canvas 2D mini-game (see game.md); remote koalas + server food/shop
      parkCamera.ts     # camera pan math (extracted, unit-tested)
      Shop.tsx          # shop bottom-sheet UI (reads parkStore, sends buys)
      TikTokIcon.tsx
    multiplayer/
      connection.ts     # WebSocket client: session, reconnect, roster + food + placed + wallet
    game/
      parkStore.ts      # economy bridge: server-fed in MP, localStorage in solo (see game.md)
      shopItems.ts      # re-exports the shared SHOP_ITEMS catalog
      sprites.ts        # procedural shop/decor sprites (drawShopSprite)
    data/
      reels.ts          # REELS = [{code, caption}] — SINGLE SOURCE OF TRUTH for the feed
      reelPosters.ts    # import.meta.glob → responsive WebP srcset (APP-ONLY, see below)
      followers.ts      # FOLLOWERS = [username] + MEMBERS_PER_PAGE — source of truth for the club
    assets/reels/*.jpg  # pristine poster sources (NOT shipped raw; imagetools optimizes them)
    index.css           # Tailwind v4 theme (@theme), keyframes, base layer
    test/setup.ts       # jsdom stubs (IntersectionObserver, matchMedia)
  public/
    followers/*.jpg      # follower avatars (small; served as-is)  (food is procedural now)
    robots.txt sitemap.xml manifest.webmanifest sw.js  # SEO + PWA
    favicon-*.png apple-touch-icon.png pwa-*.png maskable-512.png  # icons
    hero.webp           # OG/social preview image
server/                 # Cloudflare Worker + Durable Object (deployed to game.koalacub.club)
  src/worker.ts         # routes: POST /session (signed cookie), /world/main (WS upgrade)
  src/GameWorld.ts      # the Durable Object: presence/movement relay + server-owned
                        #   economy (food, likes/coins, shop purchases + placed items in SQLite)
  src/session.ts        # HMAC-signed anonymous session cookie
  wrangler.jsonc        # Worker config (name, custom domain, DO migration, account_id)
  test/world.test.ts    # DO tests in real workerd (vitest-pool-workers)
shared/
  protocol.ts           # wire protocol + world bounds + FOODS/SHOP_ITEMS catalogs +
                        #   messages — imported by client AND server (single source of truth)
```

## Two patterns worth internalizing

### 1. Data modules are the single source of truth

`src/data/reels.ts` and `src/data/followers.ts` are plain data, imported by
**both** the React app **and** `vite.config.ts`. At build, a small Vite plugin
(`crawlableContent()` in `vite.config.ts`) generates a `<noscript>` mirror of the
feed + club from that same data, so the crawlable markup can never drift from what
the app renders. Edit the data in one place; the UI and the `<noscript>`
regenerate together.

**Gotcha:** `reelPosters.ts` (which uses `import.meta.glob`) is kept **separate**
from `reels.ts` on purpose — `vite.config.ts` runs in Node, where
`import.meta.glob` doesn't exist. Anything imported by `vite.config.ts` must stay
Node-safe. Keep glob/asset imports out of `reels.ts`/`followers.ts`.

### 2. Media is local + optimized at build; the page links out

Reels and followers are **not** third-party embeds. Posters/avatars are local
files that link out to Instagram. Reel posters live pristine in
`src/assets/reels/` and `vite-imagetools` emits right-sized **WebP** variants
(240/480/640-wide `srcset`, quality 70) at build — raw sources never ship, and
each client downloads only the size it needs. See
[decisions.md](./decisions.md) for the why and
[content-workflows.md](./content-workflows.md) for how to refresh.

## Rendering & delivery

- **SPA, JS-rendered.** The visible content is React; crawlers that don't run JS
  get the build-time `<noscript>` (see [decisions.md](./decisions.md), SEO).
- **PWA:** installable via `public/manifest.webmanifest` + `public/sw.js`
  (network-first for navigations, cache-first for assets).
- **Deploy:** both halves ship from `main` via GitHub Actions, not Vercel's git
  auto-deploy (disabled in `client/vercel.json`). The `deploy` job builds +
  deploys the client to Vercel (Root Directory = `client`); the `deploy-server`
  job runs `wrangler deploy` for the Worker (`CLOUDFLARE_API_TOKEN` secret +
  `account_id` in `wrangler.jsonc`). Both are gated on the checks below.
  Canonical/OG/sitemap use `https://www.koalacub.club`; the apex→www redirect and
  the two `VITE_GAME_*` env vars are configured in the Vercel dashboard.
- **CI:** GitHub Actions runs lint, typecheck, format-check, unit tests
  (client + the `workerd` server suite), build, and Playwright e2e on push/PR to
  `main` (Node 24), then the two deploy jobs on `main`.
