# Architecture

## What this is

A single-page marketing/landing site for **Koala Cub Club** (a tabby cat's
Instagram/TikTok presence). Live at **https://www.koalacub.club**. It is a
client-rendered SPA — one page (`src/pages/Home.tsx`), no router — with a
canvas mini-game as the hero, a feed of Instagram reels, and a wall of
followers.

## Stack (and notable version choices)

- **Vite 8 + React 19 + TypeScript 6** (the modern `react-ts` template — it ships
  **oxlint**, not ESLint; we kept oxlint).
- **Tailwind CSS v4** via `@tailwindcss/vite` (confirmed working on Vite 8).
- **framer-motion** for animation; **lucide-react pinned to `^0.453`** — the 1.x
  major dropped brand icons (Instagram, Github) that we use.
- **vite-imagetools** (+ sharp) for build-time responsive images.
- **Node 24**, **pnpm 10** (pinned via the `packageManager` field so
  `pnpm/action-setup` and Vercel resolve the right version).

## Directory map

```
index.html              # SPA shell; SEO/OG/PWA meta; fonts. <noscript> injected at build.
vite.config.ts          # plugins: react, tailwind, imagetools, + crawlableContent() (noscript)
src/
  pages/Home.tsx        # the entire page: hero(game) + feed + club + footer
  components/
    ParkGame.tsx        # canvas 2D mini-game (see game.md)
    TikTokIcon.tsx
  data/
    reels.ts            # REELS = [{code, caption}] — SINGLE SOURCE OF TRUTH for the feed
    reelPosters.ts      # import.meta.glob → responsive WebP srcset (APP-ONLY, see below)
    followers.ts        # FOLLOWERS = [username] + MEMBERS_PER_PAGE — source of truth for the club
  assets/reels/*.jpg    # pristine poster sources (NOT shipped raw; imagetools optimizes them)
  index.css             # Tailwind v4 theme (@theme), keyframes, base layer
  test/setup.ts         # jsdom stubs (IntersectionObserver, matchMedia)
public/
  game/food/*.png       # drop-in food sprites (emoji fallback until present) — see food-icons.md
  followers/*.jpg        # follower avatars (small; served as-is)
  robots.txt sitemap.xml manifest.webmanifest sw.js  # SEO + PWA
  favicon-*.png apple-touch-icon.png pwa-*.png maskable-512.png  # icons (cropped from a kitten photo)
  hero.webp             # OG/social preview image
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
- **Deploy:** Vercel, auto-detected Vite SPA with a catch-all rewrite to
  `index.html`. Canonical/OG/sitemap use `https://www.koalacub.club`; the
  apex→www redirect is configured in the Vercel dashboard (not in the repo).
- **CI:** GitHub Actions runs lint, typecheck, format-check, unit tests, build,
  and Playwright e2e on push/PR to `main` (Node 24).
