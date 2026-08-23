// Shared types for the park's flower art. Each species lives in its own file in
// this folder and exports a `SpeciesDraw`; `index.ts` picks a species/form for a
// tile and dispatches — the same shape as `../trees`.
//
// A flower patch occupies ONE tile (the park's `flowers` object is 1×1), with
// blooms rising above it. Stems and leaves go through `ink`; petals are drawn in
// raw bright colour, because the park treats blooms as vivid accents that should
// pop against the dark (see `drawFlowers` in ParkGame).

export type Ctx = CanvasRenderingContext2D

/** The flower species a patch can grow. */
export type FlowerSpecies =
  'daisy' | 'tulip' | 'poppy' | 'lavender' | 'bluebell'

/**
 * Which build of a species to draw. `0` is the taller, sparser patch; `1` the
 * lower, denser one. Continuous jitter (see `variance.ts`) then varies each
 * patch on top.
 */
export type FlowerForm = 0 | 1

/** Colour pass-through for stems and foliage — `parkInk` in the park. */
export type Ink = (color: string) => string

/** A tile position in the game's tile grid (the patch's 1×1 footprint origin). */
export interface FlowerTile {
  x: number
  y: number
}

export interface DrawArgs {
  /** Seeded PRNG — deterministic per tile, so a patch never flickers. */
  rng: () => number
  form: FlowerForm
  ink: Ink
  /** Game frame counter, for the same gentle bob the park's blooms have. */
  frameCount: number
}

/**
 * Draws one patch with the top-left of its 1×1 footprint at (px, py) in logical
 * px; the stems' feet sit on the footprint's bottom edge.
 */
export type SpeciesDraw = (
  ctx: Ctx,
  px: number,
  py: number,
  args: DrawArgs,
) => void
