# Koala Cub Club — web

The landing site for **Koala Cub Club**, a tabby cat's corner of the internet.
Live at **https://www.koalacub.club**.

It's a single-page, client-rendered SPA: a canvas **mini-game** hero you can play,
a **feed** of Instagram reels, and a **wall of followers** — all wrapped in a
cozy, animated, dark-and-gold theme.

Built with **Vite 8 · React 19 · TypeScript**, styled with **Tailwind CSS v4**,
animated with **framer-motion**. Icons from **lucide-react**; responsive images
via **vite-imagetools**; linting with **oxlint**.

> **New here (human or AI)? Read [`docs/`](./docs) first** — especially
> [`docs/decisions.md`](./docs/decisions.md). It captures the _why_ behind the
> non-obvious choices so you don't accidentally undo them.

## Quick start

```bash
pnpm install
pnpm dev          # dev server at http://localhost:5173
pnpm build        # type-check + production build
pnpm preview      # serve the production build
```

Requires **Node.js 24+** and **pnpm 10+** (`corepack enable`).

## Project map

```
src/pages/Home.tsx        # the whole page (hero game + feed + club + footer)
src/components/ParkGame.tsx# canvas mini-game hero
src/data/reels.ts          # feed content — single source of truth
src/data/followers.ts      # club content — single source of truth
src/assets/reels/          # pristine poster sources (optimized at build)
public/game/food/          # drop-in food sprites for the game
vite.config.ts             # react, tailwind, imagetools + build-time <noscript> for crawlers
```

The `@/` import alias maps to `src/`. See [`docs/architecture.md`](./docs/architecture.md).

## Scripts

| Script                                       | What it does                                   |
| -------------------------------------------- | ---------------------------------------------- |
| `pnpm dev` / `preview`                       | Dev server (HMR) / serve the production build  |
| `pnpm build`                                 | `tsc -b` + `vite build`                        |
| `pnpm typecheck`                             | Types only, no emit                            |
| `pnpm lint` / `lint:fix`                     | oxlint                                         |
| `pnpm format` / `format:check`               | Prettier                                       |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest unit tests                              |
| `pnpm test:e2e` / `test:e2e:ui`              | Playwright (self-contained; builds + previews) |

## Documentation

| Doc                                                      |                                                         |
| -------------------------------------------------------- | ------------------------------------------------------- |
| [docs/decisions.md](./docs/decisions.md)                 | **Why** the key choices were made (read first)          |
| [docs/architecture.md](./docs/architecture.md)           | Stack, structure, data-source-of-truth + build pipeline |
| [docs/content-workflows.md](./docs/content-workflows.md) | Refreshing the reel feed & followers wall               |
| [docs/game.md](./docs/game.md)                           | The `ParkGame` mini-game & food-collectible system      |
| [docs/food-icons.md](./docs/food-icons.md)               | Food sprite art spec + generation prompts               |

## Conventions & CI

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/),
  enforced by commitlint. Husky hooks run lint-staged (pre-commit) and
  typecheck + tests (pre-push).
- **CI:** GitHub Actions runs lint, typecheck, format-check, unit tests, build,
  and Playwright e2e on every push/PR to `main` (Node 24). `main` is often busy —
  rebase before pushing, or use a feature branch + PR.
- **Deploy:** Vercel (Vite SPA, catch-all rewrite to `index.html`; apex→www
  redirect is set in the Vercel dashboard).
