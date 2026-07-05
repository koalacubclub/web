// Procedural pond art for ParkGame: geometry, the baked static-environment
// reflection sprite (cached per pond), and the irregular rim stones. Extracted
// from ParkGame so the pure parts (geometry + stone layout) can be unit-tested
// and reused. The reflection *compositing* (mirroring cats/objects + the water
// wash) stays in ParkGame since it needs live game state.
import { PIXEL, SCALE, HORIZON, NIGHT, makeRng } from './constants'
import { isVisibleX, type VisibleRange } from './culling'

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

// How far above the HORIZON the reflection samples: raise this to pull in more
// open sky (and less of the hill ridge), lower it toward 0 to include the hills.
const REFLECT_LIFT = PIXEL * 1.2

// Baked environment reflection, cached per pond (keyed by tile position). The
// mirrored static background never changes, so it's baked once into a sprite the
// size of the pond's bounding box. We sample a sky band anchored above the
// HORIZON — NOT the ground directly above the pond — so the water reflects the
// open sky (and a hint of the distant hills), not the sand/grass it sits on
// (objects and cats reflect live, separately). Returns null without a DOM.
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
  const { cx, rx, ry } = pondGeom(x, y)
  const rh = ry * 2
  const spr = document.createElement('canvas')
  spr.width = Math.ceil(rx * 2)
  spr.height = Math.ceil(rh)
  const sc = spr.getContext('2d')
  if (!sc) {
    reflCache.set(key, null)
    return null
  }
  // Flip the slice vertically: sprite row 0 (far waterline) samples the highest
  // point of the band; deeper rows sample lower toward the horizon. Anchored
  // REFLECT_LIFT above HORIZON (not the pond), so it's always sky — never the
  // ground the pond sits on.
  const bandBottom = HORIZON - REFLECT_LIFT
  sc.translate(0, rh)
  sc.scale(1, -1)
  sc.drawImage(bg, cx - rx, bandBottom - rh, rx * 2, rh, 0, 0, rx * 2, rh)
  reflCache.set(key, spr)
  return spr
}

// ── Live reflections (cats + scenery) ───────────────────────────────────────
// The mirroring geometry/gating lives here (pure + testable); the caller passes
// a draw callback for the actual sprite, since those need live game state.

const REFLECT_UP = PIXEL * 3 // how far above the waterline scenery still reflects

/** An object's tile footprint, as needed to decide if it reflects in a pond. */
export interface ReflectBox {
  type: string
  x: number
  y: number
  w: number
  h: number
}

/** Mirror `draw` about a horizontal axis (logical px) — the core water flip. */
function mirrorY(
  ctx: CanvasRenderingContext2D,
  axisY: number,
  draw: () => void,
): void {
  ctx.save()
  ctx.translate(0, 2 * axisY)
  ctx.scale(1, -1)
  draw()
  ctx.restore()
}

/**
 * Whether an object reflects in the pond at tile (x, y): not a pond, horizontally
 * over the water, within REFLECT_UP above the waterline, and on screen (`vis`).
 */
export function objectReflectsInPond(
  o: ReflectBox,
  x: number,
  y: number,
  vis: VisibleRange,
): boolean {
  if (o.type === 'pond') return false // don't reflect ponds
  const { cx, cy, rx, ry } = pondGeom(x, y)
  const oL = o.x * PIXEL
  const oR = (o.x + o.w) * PIXEL
  if (oR < cx - rx - PIXEL || oL > cx + rx + PIXEL) return false // off water
  if (!isVisibleX(oL, oR, vis)) return false // off screen
  const oBase = (o.y + o.h) * PIXEL
  return oBase <= cy + ry && oBase >= cy - ry - REFLECT_UP // above & near
}

/**
 * Mirror the scenery above the pond at tile (x, y) into the water. Each object is
 * flipped about its OWN base (ground-contact line) — like cats flip about their
 * feet — so the reflection stays attached to the object and the whole thing
 * (incl. a tall lighttree's glow) folds down into the water instead of being
 * pushed below the shallow pond and clipped. `drawObject(o)` draws one object's
 * art at its own position (the caller owns the type→art dispatch). Reflected
 * far-to-near so nearer objects layer on top; the pond clip keeps it in-bounds.
 */
export function reflectObjects<T extends ReflectBox>(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  objects: readonly T[],
  vis: VisibleRange,
  drawObject: (o: T) => void,
): void {
  const near = objects
    .filter((o) => objectReflectsInPond(o, x, y, vis))
    .sort((a, b) => a.y - b.y) // far (higher up) first, nearer on top
  for (const o of near) mirrorY(ctx, (o.y + o.h) * PIXEL, () => drawObject(o))
}

/**
 * The Y axis (logical px) to mirror a cat at tile (catX, catY) about if it
 * reflects in the pond at tile (x, y) — its feet-line — or null if it's not over
 * the water.
 */
export function catReflectAxis(
  catX: number,
  catY: number,
  x: number,
  y: number,
): number | null {
  const { cx, cy, rx, ry } = pondGeom(x, y)
  const ccx = (catX + 0.5) * PIXEL
  const feetY = (catY + 0.95) * PIXEL
  if (Math.abs(ccx - cx) > rx + PIXEL) return null // not over the pond
  if (feetY < cy - ry - PIXEL * 2 || feetY > cy + ry) return null
  return feetY
}

/**
 * Mirror a cat across its feet-line into the pond at tile (x, y), if it's over
 * the water. `draw()` renders the cat at its own position (opaque; the caller's
 * water wash submerges it).
 */
export function reflectCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  catX: number,
  catY: number,
  draw: () => void,
): void {
  const axis = catReflectAxis(catX, catY, x, y)
  if (axis == null) return
  mirrorY(ctx, axis, draw)
}
