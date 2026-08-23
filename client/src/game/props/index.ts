// The park's built props — the pond and the bench.
//
// The pond comes in two builds, rolled from its tile like every other piece of
// scenery in game/trees, game/flowers and game/rocks. The bench has none on
// purpose: benches are municipal, and a row of them differing reads as a
// mistake. Its rim stones come from ../rocks, so a pond's stones are the same
// stones as the rest of the park.
//
// Nothing here is wired into the scene: ParkGame still draws its own pond and
// bench, and the wired pond's geometry and reflection caching live in
// ../pond.ts. `pondPath` is exported so that wiring can clip reflections to the
// real outline rather than to an ellipse that happens to be close.

import { PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
import { drawBench as drawBenchArt } from './bench'
import {
  drawPond as drawPondArt,
  drawPondSurface as drawPondSurfaceArt,
  drawPondWater as drawPondWaterArt,
  pondRings,
} from './pond'
import type { Ctx, Ink, PondForm, PropTile } from './types'

export type { Ctx, Ink, Lobe, PondForm, PropTile } from './types'
export type { Jitter } from './variance'
export { parkInk } from './parkInk'
export { BENCH_TONES } from './bench'
export { POND_TONES, pondLobes, pondPath, pondRings } from './pond'

// Distinct salts, so the pond's form roll and its art jitter are independent.
const SEED_FORM = 811
const SEED_ART = 13
const SEED_SHAPE = 907

const seedAt = (x: number, y: number, salt: number) =>
  makeRng(x * 73856093 + y * 19349663 + salt)

/** Which of the pond's two builds sits on tile (x, y). Stable for that tile. */
export function pondFormAt(x: number, y: number): PondForm {
  return seedAt(x, y, SEED_FORM)() < 0.5 ? 0 : 1
}

const shapeSeedFor = (tile: PropTile) =>
  tile.x * 73856093 + tile.y * 19349663 + SEED_SHAPE

/**
 * The pond's outline on `tile`, as one ring of points per lobe. Rebuildable from
 * the tile alone, so whatever needs the same shape later — clipping reflections
 * to the water — traces exactly what was drawn. Feed it to `pondPath`.
 */
export function pondOutline(tile: PropTile, form?: PondForm) {
  return pondRings(
    tile.x * PIXEL,
    tile.y * PIXEL,
    form ?? pondFormAt(tile.x, tile.y),
    makeRng(shapeSeedFor(tile)),
  )
}

export interface DrawPondOptions {
  /** Override the tile's form roll. */
  form?: PondForm
  /** `parkInk` in the park, identity (the default) for bright previews. */
  ink?: Ink
}

/**
 * Draw the pond on `tile`, with the top-left of its 3×2 footprint at
 * (tile.x · PIXEL, tile.y · PIXEL).
 */
export function drawPond(
  ctx: Ctx,
  tile: PropTile,
  opts: DrawPondOptions = {},
): void {
  drawPondArt(ctx, tile.x * PIXEL, tile.y * PIXEL, {
    rng: seedAt(tile.x, tile.y, SEED_ART),
    shapeSeed: shapeSeedFor(tile),
    form: opts.form ?? pondFormAt(tile.x, tile.y),
    ink: opts.ink ?? ((c) => c),
  })
}

/**
 * Draw the bench on `tile`, with the top-left of its 2×1 footprint at
 * (tile.x · PIXEL, tile.y · PIXEL). No form and no jitter — every bench in the
 * park is the same bench.
 */
export function drawBench(
  ctx: Ctx,
  tile: PropTile,
  opts: { ink?: Ink } = {},
): void {
  drawBenchArt(ctx, tile.x * PIXEL, tile.y * PIXEL, {
    rng: seedAt(tile.x, tile.y, SEED_ART),
    ink: opts.ink ?? ((c) => c),
  })
}

/**
 * The pond in two passes, for a caller that needs to put something BETWEEN them
 * — which in practice means ParkGame sliding reflections into the water before
 * the glints, stones and planting go over the top. `drawPondWater` returns the
 * outline it filled, so the reflections can be clipped to exactly that shape.
 *
 * Anything with nothing to reflect (the catalog, the shop preview) should call
 * `drawPond` instead and not think about passes at all.
 */
export function drawPondWater(
  ctx: Ctx,
  tile: PropTile,
  opts: DrawPondOptions = {},
) {
  return drawPondWaterArt(ctx, tile.x * PIXEL, tile.y * PIXEL, {
    shapeSeed: shapeSeedFor(tile),
    form: opts.form ?? pondFormAt(tile.x, tile.y),
    ink: opts.ink ?? ((c) => c),
  })
}

export function drawPondSurface(
  ctx: Ctx,
  tile: PropTile,
  opts: DrawPondOptions = {},
): void {
  drawPondSurfaceArt(ctx, tile.x * PIXEL, tile.y * PIXEL, {
    rng: seedAt(tile.x, tile.y, SEED_ART),
    shapeSeed: shapeSeedFor(tile),
    form: opts.form ?? pondFormAt(tile.x, tile.y),
    ink: opts.ink ?? ((c) => c),
  })
}

/**
 * Bounding box of the pond's outline, in logical px. The park needs it to size
 * the baked sky reflection and the water wash — both of which used to be sized
 * off a fixed ellipse, and now have to follow whatever shape the tile rolled.
 */
export function pondBounds(tile: PropTile, form?: PondForm) {
  const pts = pondOutline(tile, form).flat()
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  }
}

/** Convenience for the park itself: the same draws, park-inked. */
export function drawParkPond(
  ctx: Ctx,
  tile: PropTile,
  opts: Omit<DrawPondOptions, 'ink'> = {},
): void {
  drawPond(ctx, tile, { ...opts, ink: parkInk })
}

export function drawParkBench(ctx: Ctx, tile: PropTile): void {
  drawBench(ctx, tile, { ink: parkInk })
}
