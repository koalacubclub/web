// Shared layout + palette constants for the ParkGame canvas. Extracted from
// ParkGame so both the game loop (src/components/ParkGame.tsx) and the shop's
// item previews (src/components/ItemPreview.tsx) can draw the same procedural
// art at the same scale, from a single source of truth. Node-safe (no DOM), so
// it can also be imported by tests.

export const SCALE = 3
export const MAP_COLS = 20
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
  white: '#FFFFFF',
  heart: '#FF6B9D',
  fishBowl: '#FFD93D',
  butterfly: '#C9B1FF',
  stone: '#9E9E9E',
  stoneDark: '#757575',
  charcoal: '#4A4A4A',
}
