// Shared layout + palette constants for the ParkGame canvas. Extracted from
// ParkGame so both the game loop (src/components/ParkGame.tsx) and the shop's
// item previews (src/components/ItemPreview.tsx) can draw the same procedural
// art at the same scale, from a single source of truth. Node-safe (no DOM), so
// it can also be imported by tests.

export const SCALE = 3
export const MAP_COLS = 58
// columns added on the LEFT to balance the map around the social hub; existing
// content is shifted right by this at build/draw time.
export const LEFT_PAD = 18
// columns visible across the viewport width = the zoom level; independent of
// MAP_COLS so widening the map pans the camera instead of shrinking sprites.
export const VIEW_COLS = 20
export const GROUND_ROWS = 14 // the playable park (a touch taller — more room at the bottom)
export const SKY_ROWS = 2 // extra sky rows on top; the world is shifted down by these
export const MAP_ROWS = GROUND_ROWS + SKY_ROWS
export const PIXEL = 16 * SCALE
export const CANVAS_WIDTH = MAP_COLS * PIXEL
export const CANVAS_HEIGHT = MAP_ROWS * PIXEL
export const GROUND_HEIGHT = GROUND_ROWS * PIXEL
export const WORLD_OFFSET = SKY_ROWS * PIXEL // px the park is pushed down for more sky
// Where the sky gradient ends and the ground begins (the hills ridge blends
// across it). Ponds reflect the sky/hills band anchored here, not the ground.
export const HORIZON = WORLD_OFFSET + PIXEL * 1.8

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
  catLight: '#FFBD72',
  catOrange: '#D47027',
  catDark: '#8B3E09',
  catStripe: '#521F03',
  catCream: '#FDF4E3', // chest, muzzle and paws
  catNose: '#D87972',
  catEar: '#FFC9D9', // light pink inner ear
  white: '#FFFFFF',
  heart: '#FF6B9D',
  fishBowl: '#FFD93D',
  stone: '#9E9E9E',
  stoneDark: '#757575',
  charcoal: '#4A4A4A',
}

// The park palette — what the below-wash world (ground/objects/cat/decor) actually
// draws with. Above-wash draws (moon, stars, food, billboards, HUD) keep the bright
// COLORS above so they glow against it.
//
// These are HAND-PICKED literals, one per surface. There is deliberately no grading
// function: colours used to be derived by running COLORS through a night() filter,
// which meant every surface inherited whatever hue that filter leaned toward and no
// single colour could be adjusted on its own. Pick and tune each entry directly.
// Keys mirror COLORS so the two are swappable (see sprites.ts's PAL).
export const NIGHT: typeof COLORS = {
  // Sky tones are already dark and are shared verbatim with COLORS — the old grade
  // passed non-hex (oklch) values straight through, so they never differed.
  sky: 'oklch(0.1 0.008 60)',
  skyLight: 'oklch(0.11 0.008 60)',
  grass: '#7BAC6E',
  // Grass pair used by props, not by the lawn itself (that has its own ramps in
  // ParkGame): grassDark draws the flower stems in the shop sprites, and both are
  // leaf tones in the koala-shaped imprint — grassDark as one of its dark greens,
  // grassLight as its occasional highlight. Keep grassLight clearly the lighter of
  // the two or that sparkle disappears into the bed.
  grassDark: '#517F60',
  grassLight: '#89A295',
  dirt: '#AF8661',
  dirtLight: '#BFA184',
  // Tree — a warm mid-brown trunk under two cool, blue-leaning greens. The canopy
  // pair must keep that split: leaves darker and greener, leavesLight lighter and
  // further round toward teal, or the two blob layers stop reading as separate.
  treeTrunk: '#764428',
  treeLeaves: '#407855',
  treeLeavesLight: '#53816A',
  flower1: '#D25782',
  // Amber — the blossom eyes in the koala imprint, and the second flower's petals.
  // `fishBowl` below is a separate key that used to carry the same hex; it now sits
  // a little yellower. They are independent on purpose — move one without the other.
  flower2: '#CC963E',
  flower3: '#A58ED1',
  // Bench — dusty mauve, not brown. benchLight is the lit edge: keep it lighter and
  // a touch pinker than bench so the slats stay legible against the seat.
  bench: '#744A68',
  benchLight: '#825D7E',
  // Periwinkle blue, the same family as the park pond (POND_WATER in ParkGame).
  // Nothing draws with these today; they're kept in the family so a future water
  // surface picking them up lands in the right place.
  water: '#507EE9',
  waterLight: '#728DE9',
  // The koala is the one thing on screen that must never sink into it. Every
  // large surface in the park sits between okL 55 and 78 at chroma under 0.08
  // (ground 70.5/0.044, grass 60-70/0.05, speckles 62-78/0.07), so fur pitched
  // anywhere in that band reads as more park. These five leave it on both axes:
  // the body clears the ground by 9 okL and carries 3x its chroma, catDark
  // draws a line 39 okL below the dirt around the whole silhouette, and the
  // spots go deeper still. Keep the SPREAD if you retune the hue -- it's the
  // spread, not the orange, that stops her blending.
  catLight: '#F9A551', // okL 79, C 0.140, H 63 -- lit body
  catOrange: '#BB5C0C', // okL 58, C 0.145, H 52 -- dorsal band, ears, tail
  catDark: '#753000', // okL 40, C 0.110, H 47 -- silhouette line
  catStripe: '#411400', // okL 26, C 0.077, H 43 -- spots
  catCream: '#F4EAD5', // okL 94, C 0.030, H 86
  catNose: '#C06A64', // okL 62, C 0.111, H 25
  catEar: '#D1A1B2',
  white: '#FFFFFF',
  heart: '#D25782',
  fishBowl: '#D3B034',
  stone: '#838083',
  stoneDark: '#646264',
  charcoal: '#444344',
}

// Tiny deterministic PRNG (mulberry32) so procedural art can vary per instance
// (seeded by tile position) yet stay identical frame-to-frame — no flicker.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
