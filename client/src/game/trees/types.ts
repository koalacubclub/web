// Shared types for the park's tree art. Each species lives in its own file in
// this folder and exports a `SpeciesDraw`; `index.ts` picks a species/form for a
// tile and dispatches. Node-safe apart from the canvas context itself, so the
// pure parts (seeding, species choice, jitter) can be unit-tested.

export type Ctx = CanvasRenderingContext2D

/** The tree species the park can grow. */
export type TreeSpecies =
  'broadleaf' | 'pine' | 'crabapple' | 'maple' | 'willow'

/**
 * Which build of a species to draw. Every species comes in two: `0` is the
 * upright/tall one, `1` the spreading/shorter one. Continuous jitter (see
 * `variance.ts`) then varies each individual on top, so two trees of the same
 * form still differ in width, height, density and lean.
 */
export type TreeForm = 0 | 1

/**
 * Colour pass-through. Pass `parkInk` (from `./parkInk`) for trees drawn in the
 * park, or leave it as the identity for bright shop previews — every colour a
 * species uses goes through it, so a species file only ever declares its bright
 * palette and the park counterpart is looked up, never computed.
 */
export type Ink = (color: string) => string

/** A tile position in the game's tile grid (the tree's 2×2 footprint origin). */
export interface TreeTile {
  x: number
  y: number
}

/** What a species draw function is handed, beyond its pixel origin. */
export interface DrawArgs {
  /** Seeded PRNG — deterministic per tile, so art never flickers. */
  rng: () => number
  form: TreeForm
  ink: Ink
  /**
   * Multiplies this one tree's size roll (see `jitter`). Defaults to 1; the map
   * raises it for a specimen tree it wants bigger than its roll came out.
   */
  sizeBoost?: number
}

/**
 * Draws one tree with the top-left of its 2×2 footprint at (px, py) in logical
 * px; the trunk's foot sits on the footprint's bottom edge. Canopies overhang
 * the footprint, as the park's existing tree art already does.
 */
export type SpeciesDraw = (
  ctx: Ctx,
  px: number,
  py: number,
  args: DrawArgs,
) => void
