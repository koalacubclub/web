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
  grass: '#94D584',
  grassDark: '#63B85E',
  grassLight: '#ACE89E',
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

// Night grade. Each below-wash object carries its own night colour via `night(c)`,
// so there is NO global purple wash drawn on top of the scene — the grade lives in
// the colours themselves. Three parts, tuned to keep the park's cohesive dusky-purple
// mood while letting bright/white things read bright:
//
//   1. MULTIPLY by NIGHT_F — a flat per-channel darken (green knocked down more than
//      red, blue kept highest). Because it's a multiply it PRESERVES each colour's
//      own hue, so grass stays dusky sage and sand stays mauve (a hue-rotation here
//      turned everything magenta — rejected).
//   2. SHADOW VIOLET (NIGHT_AMB) — added in proportion to darkness (weight (1−L)^2.2,
//      so it's concentrated in the deep shadows and ~0 by the mid-tones): +R, −G, +B
//      pushes darks toward violet and lifts true black off pure #000, without making
//      mid/bright surfaces milky.
//   3. WHITENESS RECOVERY — near-WHITE (high lightness AND low saturation) blends back
//      toward its original colour, so white reads white. Keyed on saturation, not
//      plain luminance, so bright *coloured* surfaces (sand, grass) don't snap back
//      to daylight — only true whites/greys recover.
//
// Tune: NIGHT_F (overall darkness/hue lean), NIGHT_AMB (how violet the shadows get),
// or the whiteness-gate bounds. Non-hex inputs (oklch sky, rgba shadows) pass through
// unchanged. Memoised (runs once per unique colour).
const NIGHT_F = [0.79, 0.7, 0.93] // dusky multiply, leaning more blue-purple
const NIGHT_AMB = [18, -12, 48] // saturated shadow violet: +R −G +B, deep shadows only
function grade(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn)
  const L = (max + min) / 2
  const S = max - min === 0 ? 0 : (max - min) / (1 - Math.abs(2 * L - 1))

  // Whiteness gate: high L AND low S only → near-white recovers to original.
  const w = Math.min(
    1,
    Math.max(0, (L - 0.8) / 0.2) * Math.max(0, (0.2 - S) / 0.2),
  )
  const amb = Math.pow(1 - L, 2.2) // tightly concentrated in the deep shadows

  let rr = NIGHT_F[0] * r + NIGHT_AMB[0] * amb
  let gg = NIGHT_F[1] * g + NIGHT_AMB[1] * amb
  let bb = NIGHT_F[2] * b + NIGHT_AMB[2] * amb

  // Recover near-white toward the ORIGINAL colour.
  rr = rr * (1 - w) + r * w
  gg = gg * (1 - w) + g * w
  bb = bb * (1 - w) + b * w

  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return [c(rr), c(gg), c(bb)]
}

const _nightCache = new Map<string, string>()
export function night(color: string): string {
  if (color[0] !== '#' || (color.length !== 7 && color.length !== 4))
    return color
  const hit = _nightCache.get(color)
  if (hit) return hit
  let h = color.slice(1)
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  const [r, g, b] = grade((n >> 16) & 255, (n >> 8) & 255, n & 255)
  const res = `rgb(${r}, ${g}, ${b})`
  _nightCache.set(color, res)
  return res
}

// Night-baked clone of COLORS for below-wash draws (ground/objects/cat/decor).
// Above-wash draws (moon, stars, food, billboards, HUD) keep bright COLORS.
export const NIGHT = Object.fromEntries(
  Object.entries(COLORS).map(([k, v]) => [k, night(v)]),
) as typeof COLORS
