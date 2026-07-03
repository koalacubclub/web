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

To refresh when new reels are posted:

1. Open the profile and collect each reel's shortcode (the `…/reel/<shortcode>/`
   segment) and its cover image.
2. Save each cover as `public/reels/<shortcode>.jpg` (portrait 9:16 works best).
3. Add/replace entries in the `REELS` array (`{ code, caption }`) in
   `src/pages/Home.tsx`, newest first.

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
