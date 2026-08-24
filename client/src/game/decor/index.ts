// The park's decor — the ball, and the six shop pieces that aren't scenery: a
// mushroom, a snow-cat, a cardboard box, a cottage, a light tree and a boombox.
//
// These were the last object art left in ../sprites.ts, which now keeps only
// the placed-item flourish and the type→draw dispatch. Everything visual moved
// here, one file per piece, matching ../trees, ../flowers, ../rocks and
// ../props.
//
// Unlike those, nothing here rolls a form or a jitter: a mushroom is a
// mushroom. The light tree is the one exception, and only in where its fairy
// lights sit — seeded from the tile, so a given tree is always the same tree.

import { PIXEL } from '../constants'
import { parkInk } from './parkInk'
import { drawBall as drawBallArt } from './ball'
import { drawCardbox as drawCardboxArt } from './cardbox'
import { drawHouse as drawHouseArt } from './house'
import { drawLightTree as drawLightTreeArt } from './lightTree'
import { drawMushroom as drawMushroomArt } from './mushroom'
import { drawRadio as drawRadioArt } from './radio'
import { drawSnowcat as drawSnowcatArt } from './snowcat'
import type { Ctx, DecorTile, Ink } from './types'

export type { Ctx, DecorTile, Ink } from './types'
export { parkInk } from './parkInk'
export { drawNote } from './note'

/** Salt for the light tree's lamp scatter. Was inline in sprites.ts as `31`. */
const SEED_LIGHTS = 31

const identity: Ink = (c) => c

export interface DrawDecorOptions {
  /** `parkInk` in the park, identity (the default) for bright previews. */
  ink?: Ink
  /** Drives the ball's bounce, the snowcat's bob, the twinkles, the notes. */
  frameCount?: number
  /** Radio only: a koala is near, so it plays. */
  playing?: boolean
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
      drawMushroomArt(ctx, px, py, base)
      break
    case 'snowcat':
      drawSnowcatArt(ctx, px, py, animated)
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
        seed: tile.x * 73856093 + tile.y * 19349663 + SEED_LIGHTS,
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
