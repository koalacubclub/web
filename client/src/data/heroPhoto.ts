// Build-time responsive variants of the Koala photo used by the in-game
// polaroid (src/components/ParkGame.tsx): the tiny on-grass polaroid drawn on
// the canvas, and its hover preview. vite-imagetools emits optimized WebP from
// the pristine source in src/assets/hero.webp; the raw source is never shipped.
//
// The full-res *lightbox* image is intentionally NOT generated here — it stays
// the static public /hero.webp (see ParkGame's HERO_PHOTO const) so it doubles
// as the stable og:image / twitter:image URL and avoids a second lossy transcode
// of an already-lossy source. NOTE: if the photo is ever updated, re-sync BOTH
// public/hero.webp (OG + lightbox master) and src/assets/hero.webp (this source).
//
// Mirrors src/data/reelPosters.ts: we use import.meta.glob with an explicit cast
// rather than a static `import x from './f.webp?query'`, because the query suffix
// defeats vite/client's `*.webp` ambient type and would break `tsc -b`.

const one = (m: Record<string, string>): string => Object.values(m)[0]

// Canvas polaroid source. The polaroid is drawn cover-fit into a ~64-device-px
// box (the canvas backing store is clamped to 2× DPR), so 128w is a crisp 2×
// margin — anything larger is wasted. This is the ONLY hero image eagerly
// fetched on initial load (~1.8 KB vs the old 290 KB).
export const heroCanvasSrc = one(
  import.meta.glob('../assets/hero.webp', {
    query: '?w=128&format=webp&quality=72',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)

// Hover preview: rendered at w-40 / sm:w-52 (160 / 208 CSS px). The srcset lets
// the browser pick 320/480/640 by DPR; fetched only on pointer-enter.
export const heroHoverSrcSet = one(
  import.meta.glob('../assets/hero.webp', {
    query: '?w=320;480;640&format=webp&quality=72&as=srcset',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)

// Single-URL fallback for the hover <img>'s `src` (no-srcset browsers).
export const heroHoverSrc = one(
  import.meta.glob('../assets/hero.webp', {
    query: '?w=640&format=webp&quality=72',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)
