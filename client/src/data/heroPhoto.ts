// Small responsive variants of the Koala photo for the in-game polaroid + its
// hover preview (src/components/ParkGame.tsx), generated at build by
// vite-imagetools. The full-res image is served verbatim at /hero.webp (the
// rooted source doubles as the og:image and the lightbox master).
//
// Uses import.meta.glob + cast, not `import x from './f.webp?query'` — a query
// suffix defeats vite/client's `*.webp` ambient type and breaks `tsc -b`.

const one = (m: Record<string, string>): string => Object.values(m)[0]

// Canvas polaroid (drawn cover-fit into ~64 device px). The only hero image on
// the initial-load path (~1.8 KB vs the old ~290 KB).
export const heroCanvasSrc = one(
  import.meta.glob('../assets/rooted/hero.webp', {
    query: '?w=128&format=webp&quality=72',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)

// Hover preview (w-40 / sm:w-52); browser picks 320/480/640 by DPR.
export const heroHoverSrcSet = one(
  import.meta.glob('../assets/rooted/hero.webp', {
    query: '?w=320;480;640&format=webp&quality=72&as=srcset',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)

export const heroHoverSrc = one(
  import.meta.glob('../assets/rooted/hero.webp', {
    query: '?w=640&format=webp&quality=72',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)
