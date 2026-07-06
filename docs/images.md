# Images & assets

How raster images get into the client. The pipeline has a couple of non-obvious
edges — get these right and there's nothing to hand-maintain.

## The two paths

**1. Responsive photos → `client/src/assets/` + vite-imagetools.**
Any photo shown at real display sizes goes through [vite-imagetools][it], which
emits downscaled, content-hashed WebP variants at build. Don't ship a full-res
photo to a `<img>` or a canvas draw.

- Reference patterns: `src/data/reelPosters.ts` (the reel feed) and
  `src/data/heroPhoto.ts` (the Koala photo).
- Import with `import.meta.glob(path, { query, import: 'default', eager: true }) as Record<string, string>`.
  Use `?…&as=srcset` for a `srcSet` string, or no `as=` for a single URL.
- **Do not** use a static `import x from './f.webp?w=…'`. The `?query` suffix
  means the specifier no longer ends in `.webp`, so vite/client's `*.webp`
  ambient type doesn't match and **`tsc -b` fails** (`pnpm build` runs `tsc`
  first). The glob-with-cast form sidesteps this.
- Match sizes to actual need. A canvas thumbnail drawn at ~64 device px only
  needs a ~128w source; a lightbox needs full res. Over-sizing is the whole
  problem you're avoiding.

**2. Verbatim static files → `client/public/`.**
Files here are copied to the build root untouched — **imagetools never sees
`public/`**. Use it for things that shouldn't be optimized: pixel-art game
sprites drawn on the canvas (`public/game/…`), `favicon`, `manifest`, `sw.js`,
`robots.txt`.

## The edge case: an image needs BOTH

Some assets need a **stable, unhashed public URL** _and_ want imagetools
variants from the same source — e.g. a photo that is both an `og:image`
(referenced by absolute URL in `index.html`, so it can't be a hashed bundle
asset) and drawn in-app at small sizes. `public/` can't feed imagetools, and
`src/assets/` doesn't produce a stable URL — so the naive fix is to keep a copy
in each and hand-sync them. Don't.

**Use `client/src/assets/rooted/` instead.** The `rootedAssets()` plugin in
`vite.config.ts` serves every file there at `/<name>` in dev and emits it
verbatim to the build root, while imagetools can still import it for variants.
One source of truth, nothing to sync — just drop the file in.

Example: `src/assets/rooted/hero.webp` is the `og:image`/`twitter:image` target
and the lightbox's full-res master (served at `/hero.webp`), and is _also_ the
source `heroPhoto.ts` reads to generate the tiny polaroid + hover variants.

## Quick decision

| Need                                                                | Put it in            | How it's used                                |
| ------------------------------------------------------------------- | -------------------- | -------------------------------------------- |
| Responsive photo, in-bundle only                                    | `src/assets/`        | imagetools import                            |
| Photo that also needs a fixed public URL (OG, canvas/lightbox path) | `src/assets/rooted/` | imagetools import + auto-served at `/<name>` |
| Unoptimized static (sprites, favicon, manifest)                     | `public/`            | referenced by path                           |

[it]: https://github.com/JonasKruckenberg/imagetools
