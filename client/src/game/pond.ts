// The pond's REFLECTION machinery: which objects reflect, where a cat mirrors
// to, and the baked static-environment sprite (cached per pond). The pond's own
// art — water, bank, rim stones, planting — lives in game/props; this file is
// only what needs live game state or the background canvas.
//
// `pondGeom` stays as the reflection's frame of reference: the mirror line and
// the gating are about where the water SITS, which is still the tile's centre,
// while the water's outline is now a wobbled shape the props module owns.
import { PIXEL, HORIZON } from './constants'
import { isVisibleX, type VisibleRange } from './culling'

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

/**
 * Drop every cached reflection. The sprites are cut from the baked background
 * at its resolution, so they go stale the moment that bake is re-rendered at a
 * different one (a resize that moves RS).
 */
export function clearPondReflections(): void {
  reflCache.clear()
}

export function getPondReflection(
  bg: HTMLCanvasElement,
  x: number,
  y: number,
  /**
   * Device pixels per logical px in `bg` — the RS the background was baked at.
   * The source rect below is in LOGICAL coords, so it has to be scaled up to
   * address the bitmap; the sprite is cut at the same scale so the reflection
   * is as sharp as the sky it mirrors.
   */
  bgScale = 1,
): HTMLCanvasElement | null {
  const key = `${x},${y}@${bgScale}`
  const cached = reflCache.get(key)
  if (cached !== undefined) return cached
  if (typeof document === 'undefined') {
    reflCache.set(key, null)
    return null
  }
  const { cx, rx, ry } = pondGeom(x, y)
  const rh = ry * 2
  const spr = document.createElement('canvas')
  spr.width = Math.ceil(rx * 2 * bgScale)
  spr.height = Math.ceil(rh * bgScale)
  const sc = spr.getContext('2d')
  if (!sc) {
    reflCache.set(key, null)
    return null
  }
  sc.scale(bgScale, bgScale)
  // Flip the slice vertically: sprite row 0 (far waterline) samples the highest
  // point of the band; deeper rows sample lower toward the horizon. Anchored
  // REFLECT_LIFT above HORIZON (not the pond), so it's always sky — never the
  // ground the pond sits on.
  const bandBottom = HORIZON - REFLECT_LIFT
  sc.translate(0, rh)
  sc.scale(1, -1)
  sc.drawImage(
    bg,
    (cx - rx) * bgScale,
    (bandBottom - rh) * bgScale,
    rx * 2 * bgScale,
    rh * bgScale,
    0,
    0,
    rx * 2,
    rh,
  )
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
 * Mirror the scenery near the pond at tile (x, y) into the water. Each object is
 * flipped about its OWN ground-contact line (the bottom of its footprint) — the
 * same way cats flip about their feet — so the reflection sits directly under the
 * object instead of detaching. An object standing at the pond's rim folds down
 * into the water; the pond clip keeps it in-bounds (so an object set back on the
 * grass reflects onto grass and is hidden, just like a cat away from the water).
 * `drawObject` draws one object's art at its own position (the caller owns the
 * type→art dispatch). Reflected far-to-near so nearer objects layer on top.
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
 * the water. Cats mirror about their feet (not the water plane like scenery) so
 * the reflection stays attached under the cat instead of detaching.
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
