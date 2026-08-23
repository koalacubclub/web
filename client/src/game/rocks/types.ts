// Shared types for the park's rock art. Each species lives in its own file in
// this folder and exports a `SpeciesDraw`; `index.ts` picks a species/form for a
// tile and dispatches — the same shape as `../trees` and `../flowers`.
//
// Rocks are built from FACETS, not ellipses: an angular silhouette with a lit
// top plane and a shaded side, so they catch the park's flat light the way the
// benches and the house do.

export type Ctx = CanvasRenderingContext2D

/** The rock arrangements a tile can grow. */
export type RockSpecies = 'boulder' | 'stack' | 'cluster' | 'slab'

/**
 * Which build of a species to draw. `0` is the simpler arrangement, `1` the
 * busier one — for `stack` that is two stones versus a three-stone cairn.
 */
export type RockForm = 0 | 1

/** Colour pass-through — `parkInk` in the park, identity for bright previews. */
export type Ink = (color: string) => string

/** A tile position in the game's tile grid (the rock's 1×1 footprint origin). */
export interface RockTile {
  x: number
  y: number
}

export interface DrawArgs {
  /** Seeded PRNG — deterministic per tile, so a rock never flickers. */
  rng: () => number
  form: RockForm
  ink: Ink
}

/**
 * Draws one rock (or arrangement) with the top-left of its 1×1 footprint at
 * (px, py) in logical px; the rock sits ON the footprint's bottom edge.
 */
export type SpeciesDraw = (
  ctx: Ctx,
  px: number,
  py: number,
  args: DrawArgs,
) => void
