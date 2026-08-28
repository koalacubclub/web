// The park's decor — the ball, and the six shop pieces that aren't scenery: a
// mushroom, a snow-cat, a cardboard box, a cottage, a light tree and a boombox.
//
// These were the last object art left in ../sprites.ts, which now keeps only
// the placed-item flourish and the type→draw dispatch. Everything visual moved
// here, one file per piece, matching ../trees, ../flowers, ../rocks and
// ../props.
//
// Three of them vary with the tile they stand on, and only with the tile, so a
// piece is the same piece on every frame and every reload: the light tree in
// where its fairy lights sit, and the mushroom and the snow-cat in their shape
// — which cap a mushroom grows, how a snow-cat is stacked (see `mushroom.ts`
// and `snowcat.ts` for the builds). The other four are drawn one way only: a
// cardboard box is a cardboard box.

import { PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
import { drawBall as drawBallArt } from './ball'
import { drawCardbox as drawCardboxArt } from './cardbox'
import { drawHouse as drawHouseArt } from './house'
import { drawLightTree as drawLightTreeArt } from './lightTree'
import { drawMushroom as drawMushroomArt } from './mushroom'
import { drawRadio as drawRadioArt } from './radio'
import { drawSnowcat as drawSnowcatArt } from './snowcat'
import type { Ctx, DecorTile, Ink, MushroomForm, SnowcatForm } from './types'

export type { Ctx, DecorTile, Ink, MushroomForm, SnowcatForm } from './types'
export { parkInk } from './parkInk'
export { drawNote } from './note'

// Distinct salts, so a tile's lamp scatter, its build roll and the jitter that
// build draws with are independent of one another. `SEED_LIGHTS` was inline in
// sprites.ts as `31`.
//
// The two form salts are also picked so tile (0, 0) rolls each piece's FIRST
// build: the shop preview draws every item at (0, 0) (see ItemPreview), and a
// buyer should see the plain mushroom and the plain snow-cat on the card rather
// than whichever variant a salt happened to land on. `decor.test.ts` holds them
// to it.
const SEED_LIGHTS = 31
const SEED_MUSHROOM_FORM = 811
const SEED_MUSHROOM_ART = 823
const SEED_SNOWCAT_FORM = 919
const SEED_SNOWCAT_ART = 911

const seedAt = (x: number, y: number, salt: number) =>
  x * 73856093 + y * 19349663 + salt

/** The mushroom cap builds, and the snow-cat stacks. */
export const MUSHROOM_FORMS = [
  0, 1, 2, 3,
] as const satisfies readonly MushroomForm[]
export const SNOWCAT_FORMS = [0, 1, 2] as const satisfies readonly SnowcatForm[]

const rollForm = <T>(forms: readonly T[], seed: number): T =>
  forms[Math.floor(makeRng(seed)() * forms.length)] ?? forms[0]

/** A caller's `form`, if it names one this piece has; the tile's roll if not. */
const pickForm = <T>(
  forms: readonly T[],
  given: number | undefined,
  rolled: T,
) => (given === undefined ? rolled : (forms[given] ?? forms[0]))

/** Which cap the mushroom on tile (x, y) grows. Stable for that tile, forever. */
export function mushroomFormAt(x: number, y: number): MushroomForm {
  return rollForm(MUSHROOM_FORMS, seedAt(x, y, SEED_MUSHROOM_FORM))
}

/** How the snow-cat on tile (x, y) is stacked. Stable for that tile, forever. */
export function snowcatFormAt(x: number, y: number): SnowcatForm {
  return rollForm(SNOWCAT_FORMS, seedAt(x, y, SEED_SNOWCAT_FORM))
}

const identity: Ink = (c) => c

export interface DrawDecorOptions {
  /** `parkInk` in the park, identity (the default) for bright previews. */
  ink?: Ink
  /** Drives the ball's bounce, the snowcat's bob, the twinkles, the notes. */
  frameCount?: number
  /** Radio only: a koala is near, so it plays. */
  playing?: boolean
  /**
   * Which build to draw, for the two pieces that have more than one — the
   * mushroom's cap and the snow-cat's stack. Left out (the default), each is
   * rolled from the tile; a form the piece doesn't have falls back to its
   * first. Meant for previews and tests that want a specific build.
   */
  form?: number
}

/** Every decor piece this module draws, keyed by the `type` a shop item uses. */
export type DecorType =
  'ball' | 'mushroom' | 'snowcat' | 'cardbox' | 'house' | 'lighttree' | 'radio'

const TYPES: ReadonlySet<string> = new Set<DecorType>([
  'ball',
  'mushroom',
  'snowcat',
  'cardbox',
  'house',
  'lighttree',
  'radio',
])

/** Whether `type` is drawn by this module (so callers can route to it). */
export function isDecor(type: string): type is DecorType {
  return TYPES.has(type)
}

/**
 * Draw one decor piece, with the top-left of its footprint at
 * (tile.x · PIXEL, tile.y · PIXEL). Unknown types draw nothing.
 */
export function drawDecor(
  ctx: Ctx,
  type: string,
  tile: DecorTile,
  opts: DrawDecorOptions = {},
): void {
  const px = tile.x * PIXEL
  const py = tile.y * PIXEL
  const base = {
    w: tile.w * PIXEL,
    h: tile.h * PIXEL,
    ink: opts.ink ?? identity,
  }
  const animated = { ...base, frameCount: opts.frameCount ?? 0 }
  switch (type) {
    case 'ball':
      drawBallArt(ctx, px, py, animated)
      break
    case 'mushroom':
      drawMushroomArt(ctx, px, py, {
        ...base,
        rng: makeRng(seedAt(tile.x, tile.y, SEED_MUSHROOM_ART)),
        form: pickForm(
          MUSHROOM_FORMS,
          opts.form,
          mushroomFormAt(tile.x, tile.y),
        ),
      })
      break
    case 'snowcat':
      drawSnowcatArt(ctx, px, py, {
        ...animated,
        rng: makeRng(seedAt(tile.x, tile.y, SEED_SNOWCAT_ART)),
        form: pickForm(SNOWCAT_FORMS, opts.form, snowcatFormAt(tile.x, tile.y)),
      })
      break
    case 'cardbox':
      drawCardboxArt(ctx, px, py, base)
      break
    case 'house':
      drawHouseArt(ctx, px, py, base)
      break
    case 'lighttree':
      drawLightTreeArt(ctx, px, py, {
        ...animated,
        seed: seedAt(tile.x, tile.y, SEED_LIGHTS),
      })
      break
    case 'radio':
      drawRadioArt(ctx, px, py, {
        ...animated,
        playing: opts.playing === true,
      })
      break
  }
}

/** The same draw, park-inked — what the game itself wants. */
export function drawParkDecor(
  ctx: Ctx,
  type: string,
  tile: DecorTile,
  opts: Omit<DrawDecorOptions, 'ink'> = {},
): void {
  drawDecor(ctx, type, tile, { ...opts, ink: parkInk })
}

/**
 * The ball on its own, since the park draws it as a base object rather than
 * through the shop dispatch. 1×1, always.
 */
export function drawParkBall(
  ctx: Ctx,
  tile: { x: number; y: number },
  frameCount: number,
): void {
  drawParkDecor(ctx, 'ball', { ...tile, w: 1, h: 1 }, { frameCount })
}
