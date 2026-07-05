// Shared layout + palette constants for the ParkGame canvas. Extracted from
// ParkGame so both the game loop (src/components/ParkGame.tsx) and the shop's
// item previews (src/components/ItemPreview.tsx) can draw the same procedural
// art at the same scale, from a single source of truth. Node-safe (no DOM), so
// it can also be imported by tests.

export const SCALE = 3
export const MAP_COLS = 40
// columns visible across the viewport width = the zoom level; independent of
// MAP_COLS so widening the map pans the camera instead of shrinking sprites.
export const VIEW_COLS = 20
export const GROUND_ROWS = 13 // the playable park (unchanged game logic)
export const SKY_ROWS = 2 // extra sky rows on top; the world is shifted down by these
export const MAP_ROWS = GROUND_ROWS + SKY_ROWS
export const PIXEL = 16 * SCALE
export const CANVAS_WIDTH = MAP_COLS * PIXEL
export const CANVAS_HEIGHT = MAP_ROWS * PIXEL
export const GROUND_HEIGHT = GROUND_ROWS * PIXEL
export const WORLD_OFFSET = SKY_ROWS * PIXEL // px the park is pushed down for more sky

export const COLORS = {
  // Near-black night sky matched to the site background (--background token)
  sky: 'oklch(0.1 0.008 60)',
  skyLight: 'oklch(0.11 0.008 60)',
  grass: '#A8D5A2',
  grassDark: '#7CB87A',
  grassLight: '#C4E8BF',
  dirt: '#D4A574',
  dirtLight: '#E8C9A0',
  treeTrunk: '#8B6914',
  treeLeaves: '#4CAF50',
  treeLeavesLight: '#66BB6A',
  flower1: '#FF6B9D',
  flower2: '#FFD93D',
  flower3: '#C9B1FF',
  bench: '#8D6E63',
  benchLight: '#A1887F',
  water: '#64B5F6',
  waterLight: '#90CAF9',
  catLight: '#C4A882',
  catOrange: '#A07850',
  catDark: '#8B5E3C',
  catStripe: '#6D4C2A',
  catEar: '#FFC9D9', // light pink inner ear
  white: '#FFFFFF',
  heart: '#FF6B9D',
  fishBowl: '#FFD93D',
  butterfly: '#C9B1FF',
  stone: '#9E9E9E',
  stoneDark: '#757575',
  charcoal: '#4A4A4A',
}

// Bake the old night wash into a colour. The park used to get its night look from
// a per-frame `multiply` overlay of rgba(120,80,180,0.5) over the world; that made
// every below-wash pixel `out = 0.5·c·(s/255 + 1)` per channel (s = 120,80,180).
// `night()` reproduces that exactly so we can drop the overlay and let each object
// carry its own night colour. Non-hex inputs (e.g. the oklch sky, rgba shadows)
// pass through unchanged. Memoised.
const NIGHT_S = [120, 80, 180]
const _nightCache = new Map<string, string>()
export function night(color: string): string {
  if (color[0] !== '#' || (color.length !== 7 && color.length !== 4))
    return color
  const hit = _nightCache.get(color)
  if (hit) return hit
  let h = color.slice(1)
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const o = ch.map((c, i) => Math.round(0.5 * c * (NIGHT_S[i] / 255 + 1)))
  const res = `rgb(${o[0]}, ${o[1]}, ${o[2]})`
  _nightCache.set(color, res)
  return res
}

// Night-baked clone of COLORS for below-wash draws (ground/objects/cat/decor).
// Above-wash draws (moon, stars, food, billboards, HUD) keep bright COLORS.
export const NIGHT = Object.fromEntries(
  Object.entries(COLORS).map(([k, v]) => [k, night(v)]),
) as typeof COLORS
