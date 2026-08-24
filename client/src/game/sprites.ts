// Placed-item dispatch for the shop's sprites — which art draws a given item
// type, and the pop-in/blink flourish a freshly-placed one gets. Used by BOTH
// the shop's item previews (src/components/ItemPreview.tsx) and the placed
// decorations the game renders (ParkGame routes placed items here).
//
// There is no art in this file any more. Every sprite is drawn by a module
// under ./trees, ./flowers, ./rocks, ./props or ./decor — the same draws the
// park itself uses, so a bought tree looks like a park tree. That is also why
// the module-level PAL/INK/IS_PARK trio is gone: each module owns its own
// bright→park map, and `night` is now passed down a call rather than left in a
// variable for the draws to read.
//
// Each fn draws with the object's top-left at (obj.x*PIXEL, obj.y*PIXEL); the
// caller sets up any world translate / device-resolution transform.

import { PIXEL } from './constants'
import { drawNightTree, drawTree as drawSpeciesTree } from './trees'
import { drawFlowers as drawSpeciesFlowers, drawNightFlowers } from './flowers'
import { drawNightRock, drawRock as drawSpeciesRock } from './rocks'
import {
  drawBench as drawPropBench,
  drawParkBench,
  drawPond as drawPropPond,
  drawParkPond,
} from './props'
import { drawDecor, drawParkDecor, isDecor } from './decor'

export interface SpriteObject {
  type: string
  x: number
  y: number
  w: number
  h: number
  // Set on shop-placed decorations (absent for shop previews):
  placedAt?: number // Date.now() at purchase — drives the pop-in flourish
  expiresAt?: number // Date.now() TTL — drives the pre-expiry blink
}

type Ctx = CanvasRenderingContext2D

// How long (ms, wall-clock) a freshly-placed item takes to pop in to full size.
export const PLACED_POP_MS = 260
// How long before expiry (ms) a placed item starts blinking.
const BLINK_LEAD_MS = 8000

// The scenery sprites are the park's own art, from its own modules — the
// species tree, the patch of flowers, the faceted stone, the pond, the bench.
// All are a function of the tile, so these need no state; they only pick the
// ink, since previews draw bright and the park draws in its own palette.
function drawScenery(
  ctx: Ctx,
  obj: SpriteObject,
  frameCount: number,
  night: boolean,
): void {
  const tile = { x: obj.x, y: obj.y }
  switch (obj.type) {
    case 'tree':
      if (night) drawNightTree(ctx, tile)
      else drawSpeciesTree(ctx, tile)
      break
    case 'bench':
      if (night) drawParkBench(ctx, tile)
      else drawPropBench(ctx, tile)
      break
    case 'flowers':
      if (night) drawNightFlowers(ctx, tile, { frameCount })
      else drawSpeciesFlowers(ctx, tile, { frameCount })
      break
    case 'pond':
      if (night) drawParkPond(ctx, tile)
      else drawPropPond(ctx, tile)
      break
    case 'stone':
      if (night) drawNightRock(ctx, tile)
      else drawSpeciesRock(ctx, tile)
      break
  }
}

export interface DrawSpriteOptions {
  // Wall-clock time (Date.now()) — drives the pop-in + pre-expiry blink for
  // placed items. Omit (previews) for a static, full-size, fully-opaque draw.
  now?: number
  reducedMotion?: boolean
  // In-game placed decor draws night-tinted; shop previews (omit) stay bright.
  night?: boolean
  // Set on a placed radio when a koala is near it: pulses its speakers and
  // makes music notes drift up. Ignored by every other sprite.
  playing?: boolean
}

// Pop-in scale + pre-expiry blink alpha for a placed item (wall-clock based, so
// it stays correct even though the game loop pauses off-screen). Identity for
// previews (no `now`) or base objects (no `placedAt`).
function placedFlourish(
  obj: SpriteObject,
  now: number | undefined,
  reducedMotion: boolean | undefined,
): { scale: number; alpha: number } {
  let scale = 1
  let alpha = 1
  if (now != null && !reducedMotion) {
    if (obj.placedAt != null) {
      const age = now - obj.placedAt
      if (age < PLACED_POP_MS) {
        const t = Math.min(1, Math.max(0, age / PLACED_POP_MS))
        scale = 1 - Math.pow(1 - t, 3)
      }
    }
    if (obj.expiresAt != null) {
      const remaining = obj.expiresAt - now
      if (remaining > 0 && remaining < BLINK_LEAD_MS) {
        alpha = Math.floor(now / 180) % 2 === 0 ? 0.5 : 1
      }
    }
  }
  return { scale, alpha }
}

// Run `draw` wrapped in a placed item's pop-in scale + pre-expiry blink. Exported
// so the game can apply the same flourish to sprites it renders itself rather
// than via drawShopSprite (e.g. reflective ponds, which ParkGame draws).
export function withPlacedFlourish(
  ctx: Ctx,
  obj: SpriteObject,
  now: number | undefined,
  reducedMotion: boolean | undefined,
  draw: () => void,
): void {
  const { scale, alpha } = placedFlourish(obj, now, reducedMotion)
  const wrap = scale !== 1 || alpha !== 1
  if (wrap) {
    ctx.save()
    ctx.globalAlpha = alpha
    if (scale !== 1) {
      const cx = (obj.x + obj.w / 2) * PIXEL
      const cy = (obj.y + obj.h / 2) * PIXEL
      ctx.translate(cx, cy)
      ctx.scale(scale, scale)
      ctx.translate(-cx, -cy)
    }
  }
  draw()
  if (wrap) ctx.restore()
}

// Draw a shop sprite, wrapping placed items in a pop-in scale and a pre-expiry
// blink (both wall-clock based, correct even though the game loop pauses
// off-screen). Previews (no placedAt/now) draw static at full size.
export function drawShopSprite(
  ctx: Ctx,
  obj: SpriteObject,
  frameCount: number,
  opts: DrawSpriteOptions = {},
) {
  const { now, reducedMotion } = opts
  const night = !!opts.night
  withPlacedFlourish(ctx, obj, now, reducedMotion, () => {
    if (isDecor(obj.type)) {
      const draw = night ? drawParkDecor : drawDecor
      draw(ctx, obj.type, obj, { frameCount, playing: opts.playing === true })
      return
    }
    drawScenery(ctx, obj, frameCount, night)
  })
}
