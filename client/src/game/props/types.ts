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
  /**
   * Seeds the basin's proportions and its outline wobble, separately from the
   * `rng` that scatters planting — so the shape is a function of tile and form
   * alone. Passing a seed rather than a generator means it can be re-rolled from
   * scratch whenever the same outline is needed again (the bank, and ParkGame
   * clipping reflections to the water once this is wired in).
   */
  shapeSeed: number
}

/** A point on a pond's outline. */
export interface Pt {
  x: number
  y: number
}

/** The base ellipse for one lobe of a pond, before its outline is wobbled. */
export interface Lobe {
  cx: number
  cy: number
  rx: number
  ry: number
}
