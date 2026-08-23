// Shared types for the park's built props — the pond and the bench.
//
// Same shape as ../trees, ../flowers and ../rocks: art only, drawn with `ctx`
// primitives, colours declared as BRIGHT literals and re-inked for the park
// through `parkInk.ts`. Nothing here is wired into the scene.

export type Ctx = CanvasRenderingContext2D

/**
 * Which build of the pond to draw.
 *
 * `0` — pool: one broad basin, stones all the way round.
 * `1` — inlet: two lobes pinched in the middle, a pebble shore at one end.
 *
 * The bench has no forms: a park's benches are municipal, and a row of them
 * differing from each other reads as a mistake rather than as variety.
 */
export type PondForm = 0 | 1

/** Colour pass-through — `parkInk` in the park, identity for bright previews. */
export type Ink = (color: string) => string

/** A tile position in the game's tile grid (the prop's footprint origin). */
export interface PropTile {
  x: number
  y: number
}

export interface DrawArgs {
  /** Seeded PRNG — deterministic per tile, so a prop never flickers. */
  rng: () => number
  ink: Ink
}

export interface PondDrawArgs extends DrawArgs {
  form: PondForm
}

/** Ellipse geometry (logical px) for one lobe of a pond. */
export interface Lobe {
  cx: number
  cy: number
  rx: number
  ry: number
}
