// Procedural pond art for ParkGame: geometry, the baked static-environment
// reflection sprite (cached per pond), and the irregular rim stones. Extracted
// from ParkGame so the pure parts (geometry + stone layout) can be unit-tested
// and reused. The reflection *compositing* (mirroring cats/objects + the water
// wash) stays in ParkGame since it needs live game state.
import { PIXEL, SCALE, WORLD_OFFSET, NIGHT, makeRng } from './constants'

const TAU = Math.PI * 2

export interface PondGeom {
  cx: number
  cy: number
  rx: number
  ry: number
}

/** Ellipse geometry (logical px) for a pond at tile (x, y). */
export function pondGeom(x: number, y: number): PondGeom {
  return {
    cx: x * PIXEL + PIXEL * 1.5,
    cy: y * PIXEL + PIXEL,
    rx: PIXEL * 1.4,
    ry: PIXEL * 0.8,
  }
}

export interface RimStone {
  x: number
  y: number
  rx: number
  ry: number
  dark: boolean
}

/**
 * Deterministic rim-stone layout for a pond at tile (x, y). Seeded by tile
 * position so it's stable frame-to-frame. 8–11 stones walked around the rim in
 * uneven angular steps (squared random → mostly tight gaps that bunch into
 * clusters, with the occasional wide gap), each a jittered size/aspect so no two
 * neighbours match, hugging the waterline.
 */
export function pondStones(x: number, y: number): RimStone[] {
  const { cx, cy, rx, ry } = pondGeom(x, y)
  const rng = makeRng(x * 73856093 + y * 19349663 + 7)
  const count = 8 + Math.floor(rng() * 4) // 8–11 stones
  const gaps: number[] = []
  let gapTotal = 0
  for (let i = 0; i < count; i++) {
    const gp = 0.2 + rng() ** 2 * 2
    gaps.push(gp)
    gapTotal += gp
  }
  const base = rng() * TAU // rotate the whole ring per pond
  const stones: RimStone[] = []
  let acc = 0
  for (let i = 0; i < count; i++) {
    acc += gaps[i]
    const angle = base + (acc / gapTotal) * TAU
    const spread = 0.82 + rng() * 0.16 // sit right on/just inside the rim
    const r = SCALE * (1.3 + rng() * 1.7) // mix of small + chunky stones
    stones.push({
      x: cx + Math.cos(angle) * rx * spread,
      y: cy + Math.sin(angle) * ry * spread,
      rx: r,
      ry: r * (0.75 + rng() * 0.35),
      dark: rng() < 0.5,
    })
  }
  return stones
}

/** Draw the rim stones for a pond at tile (x, y). */
export function drawPondStones(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  for (const s of pondStones(x, y)) {
    ctx.fillStyle = s.dark ? NIGHT.stoneDark : NIGHT.stone
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, TAU)
    ctx.fill()
  }
}

// Baked environment reflection, cached per pond (keyed by tile position). The
// mirrored static background above a pond never changes, so it's baked once into
// a sprite the size of the pond's bounding box: a vertically-flipped slice of
// `bg` from directly above the water (bg is logical-size incl. the sky rows, so
// its pixel-Y = local-Y + WORLD_OFFSET). Returns null without a DOM (SSR/tests).
const reflCache = new Map<string, HTMLCanvasElement | null>()
export function getPondReflection(
  bg: HTMLCanvasElement,
  x: number,
  y: number,
): HTMLCanvasElement | null {
  const key = `${x},${y}`
  const cached = reflCache.get(key)
  if (cached !== undefined) return cached
  if (typeof document === 'undefined') {
    reflCache.set(key, null)
    return null
  }
  const { cx, cy, rx, ry } = pondGeom(x, y)
  const rh = ry * 2
  const spr = document.createElement('canvas')
  spr.width = Math.ceil(rx * 2)
  spr.height = Math.ceil(rh)
  const sc = spr.getContext('2d')
  if (!sc) {
    reflCache.set(key, null)
    return null
  }
  // Flip the slice vertically: sprite row 0 (waterline) samples the bg just
  // above the water; deeper rows sample higher-up scenery.
  const axisBg = cy - ry + WORLD_OFFSET // far waterline in bg pixels
  sc.translate(0, rh)
  sc.scale(1, -1)
  sc.drawImage(bg, cx - rx, axisBg - rh, rx * 2, rh, 0, 0, rx * 2, rh)
  reflCache.set(key, spr)
  return spr
}
