// Build-time responsive reel posters. vite-imagetools generates optimized WebP
// variants (240/480/640-wide) at build from the pristine JPEG sources in
// src/assets/reels — the raw sources are never shipped. Keyed by reel shortcode
// (the source filename). Kept separate from src/data/reels.ts because that file
// is also imported by vite.config.ts (Node), where import.meta.glob is unavailable.

const srcsets = import.meta.glob('../assets/reels/*.jpg', {
  query: '?w=240;480;640&format=webp&quality=70&as=srcset',
  import: 'default',
  eager: true,
}) as Record<string, string>

const fallbacks = import.meta.glob('../assets/reels/*.jpg', {
  query: '?w=480&format=webp&quality=70',
  import: 'default',
  eager: true,
}) as Record<string, string>

const codeFromPath = (p: string) =>
  p.slice(p.lastIndexOf('/') + 1).replace(/\.jpg$/, '')

export const reelSrcSet: Record<string, string> = {}
export const reelSrc: Record<string, string> = {}
for (const p in srcsets) reelSrcSet[codeFromPath(p)] = srcsets[p]
for (const p in fallbacks) reelSrc[codeFromPath(p)] = fallbacks[p]
