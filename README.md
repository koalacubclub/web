# Koala Cub Club — web

Front-end for Koala Cub Club — a single-page landing site for the tabby.
Built with **Vite + React + TypeScript**, styled with **Tailwind CSS v4**,
animated with **framer-motion**, icons from **lucide-react**. The page lives in
`src/pages/Home.tsx`; the `@/` import alias maps to `src/`.

Motion respects `prefers-reduced-motion` (via `MotionConfig` + a CSS fallback).

## Requirements

- Node.js 22+
- [pnpm](https://pnpm.io/) 10+ (`corepack enable` or `npm i -g pnpm`)

## Getting started

```bash
pnpm install
pnpm dev          # start the dev server (http://localhost:5173)
```

## Scripts

| Script               | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `pnpm dev`           | Start the Vite dev server with HMR             |
| `pnpm build`         | Type-check (`tsc -b`) and build for production |
| `pnpm preview`       | Serve the production build locally             |
| `pnpm typecheck`     | Type-check without emitting                    |
| `pnpm lint`          | Lint with oxlint                               |
| `pnpm lint:fix`      | Lint and auto-fix                              |
| `pnpm format`        | Format with Prettier                           |
| `pnpm format:check`  | Check formatting (used in CI)                  |
| `pnpm test`          | Run unit tests once (Vitest)                   |
| `pnpm test:watch`    | Run unit tests in watch mode                   |
| `pnpm test:coverage` | Run unit tests with coverage                   |
| `pnpm test:e2e`      | Run Playwright end-to-end tests                |
| `pnpm test:e2e:ui`   | Run Playwright in UI mode                      |

## Testing

- **Unit / component** tests use [Vitest](https://vitest.dev/) +
  [Testing Library](https://testing-library.com/) with a jsdom environment.
  Files live next to the code as `*.test.tsx`.
- **End-to-end** tests use [Playwright](https://playwright.dev/) and live in
  `e2e/`. The Playwright config builds the app and serves the production
  bundle before running, so `pnpm test:e2e` is self-contained (run
  `pnpm exec playwright install chromium` once first).

## Updating the reel feed

The "feed" section shows Instagram reels from
[@koalacubclub](https://www.instagram.com/koalacubclub/). Each card is a **local
poster image** (`public/reels/<shortcode>.jpg`) that links out to the reel on
instagram.com — no third-party embed scripts, so it stays fast. The list is a
point-in-time snapshot defined by the `REELS` array in `src/pages/Home.tsx`.

Refreshing is a **semi-manual, agent-assisted process** — deliberately not an
automated script. Instagram blocks headless / logged-out scraping, so it needs a
real, logged-in browser session driven interactively (the same browser-automation
tooling used to seed the feed originally). Steps:

1. Open [the profile](https://www.instagram.com/koalacubclub/) in a logged-in
   browser and run this in the DevTools console (or via the browser-automation
   tool's eval) to dump every reel's shortcode, cover URL, and caption:

   ```js
   JSON.stringify(
     [...document.querySelectorAll('a[href*="/reel/"]')]
       .map((a) => {
         const img = a.querySelector('img')
         return { href: a.getAttribute('href'), img: img?.src, alt: img?.alt }
       })
       .filter((x) => x.img),
   )
   ```

2. For each entry, save the cover to `public/reels/<shortcode>.jpg` — the
   shortcode is the `…/reel/<shortcode>/` segment (portrait 9:16 works best).
   Instagram cover URLs are signed and expire, so download them promptly.
3. Add/replace entries in the `REELS` array (`{ code, caption }`) in
   `src/pages/Home.tsx`, newest first. Keep captions short (they truncate to one
   line); strip the hashtags.

> Note: the header/footer still link to both Instagram and TikTok. TikTok
> currently lags behind on uploads, so the feed is sourced from Instagram.

## Git hooks

Managed by [husky](https://typicode.github.io/husky/):

- **pre-commit** — runs `lint-staged` (oxlint + Prettier on staged files)
- **commit-msg** — enforces [Conventional Commits](https://www.conventionalcommits.org/) via commitlint
- **pre-push** — runs `pnpm typecheck` and `pnpm test`

## CI / Deploy

- **CI** — GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck,
  format check, unit tests, build, and Playwright e2e on every push/PR to `main`.
- **Deploy** — [Vercel](https://vercel.com/) (`vercel.json`), auto-detected as a
  Vite SPA with a catch-all rewrite to `index.html` for client-side routing.
