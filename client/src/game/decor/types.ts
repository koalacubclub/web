// Shared types for the park's decor — the ball, and the six things the shop
// sells that aren't scenery: a mushroom, a snow-cat, a cardboard box, a
// cottage, a light tree and a boombox.
//
// Two of them come in more than one build: the mushroom's cap and the
// snow-cat's stack, rolled from the tile the piece stands on.
//
// Same shape as ../trees, ../flowers, ../rocks and ../props: art only, drawn
// with `ctx` primitives, every colour declared BRIGHT and re-inked for the park
// through `parkInk.ts`. That is the whole reason these moved out of
// ../sprites.ts, where the same job was done by three mutable module-level
// variables (PAL, INK, IS_PARK) that every draw silently read.

export type Ctx = CanvasRenderingContext2D

/** Colour pass-through — `parkInk` in the park, identity for bright previews. */
export type Ink = (color: string) => string

/** A decor item's footprint: tile position, and size in tiles. */
export interface DecorTile {
  x: number
  y: number
  w: number
  h: number
}

export interface DrawArgs {
  /** Footprint width and height in logical px. */
  w: number
  h: number
  ink: Ink
}

/** For the pieces that move: the ball's bounce, the snowcat's bob, twinkles. */
export interface AnimatedDrawArgs extends DrawArgs {
  frameCount: number
}

/** Which build of a mushroom to draw — see `mushroom.ts` for the four. */
export type MushroomForm = 0 | 1 | 2 | 3

/** Which build of a snow-cat to draw — see `snowcat.ts` for the three. */
export type SnowcatForm = 0 | 1 | 2

/**
 * For the two pieces whose shape varies: both the build and the jitter on top
 * of it are rolled from the tile, so a piece never flickers and never moves.
 */
export interface MushroomDrawArgs extends DrawArgs {
  /** Seeded PRNG — deterministic per tile. */
  rng: () => number
  form: MushroomForm
}

export interface SnowcatDrawArgs extends AnimatedDrawArgs {
  /** Seeded PRNG — deterministic per tile. */
  rng: () => number
  form: SnowcatForm
}

export interface LightTreeDrawArgs extends AnimatedDrawArgs {
  /** Seeds where the fairy lights sit, so a given tree is always the same tree. */
  seed: number
}

export interface RadioDrawArgs extends AnimatedDrawArgs {
  /** A koala is near: the speaker cones pulse and notes drift out of the deck. */
  playing: boolean
}
