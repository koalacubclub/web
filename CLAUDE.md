# Koala Cub Club

pnpm monorepo: `client/` (Vite + React 19 + TS SPA — a canvas mini-game + Instagram feed landing page), `server/` (Cloudflare Worker + Durable Object multiplayer), `shared/` (wire protocol imported by both).

Commands (root, run across workspaces via filters — see `package.json`): `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`. `pnpm build` runs `tsc -b && vite build`, so a type error fails the build.

## Images & assets — read before adding an image

The pipeline is easy to get wrong. The rules:

- **Photos / raster images rendered at real display sizes** → put the pristine source under `client/src/assets/` and pull it through **vite-imagetools**, not a plain `<img src>`. Follow the existing patterns: `client/src/data/reelPosters.ts` (the reel feed) and `client/src/data/heroPhoto.ts` (the Koala photo). Import via `import.meta.glob('../assets/…', { query: '?w=…&format=webp&quality=…&as=srcset', import: 'default', eager: true }) as Record<string, string>` — **not** a static `import x from './f.webp?query'`, which breaks `tsc -b` (vite/client's `*.webp` ambient type doesn't match a `?query` suffix).

- **vite-imagetools only transforms files under `src/`** (the module graph). Anything in `client/public/` is copied verbatim and never optimized — so an image placed there gets zero resizing/format work.

- **If an image ALSO needs a stable, unhashed public URL** — e.g. `og:image`/`twitter:image` in `client/index.html`, or a canvas/lightbox that references a fixed path — do **not** hand-copy it into `public/` alongside the `src/assets/` source. That creates two files to keep in sync (and someone will forget). Instead keep the single source in `src/assets/` and **emit the public copy from it via an inline Vite plugin** — see `heroOgImage()` in `client/vite.config.ts`, which emits `/hero.webp` at build (`generateBundle` + `emitFile`) and serves it in dev (`configureServer` middleware). One source of truth, nothing to hand-sync.

- **Small pixel-art game sprites** drawn on the canvas intentionally live in `client/public/game/…` unoptimized — imagetools is for responsive photos, not sprites. Don't route those through it.

## Conventions

- Build-time data shared between the app and `vite.config.ts` (reels, followers → the crawlable `<noscript>` mirror) lives in `client/src/data/*`, imported by both so the two never drift. Add new shared feed data there, not inline in the config.
