// A red-capped mushroom (1x1) with a white stem and two spots.

import { COLORS, PIXEL, SCALE } from '../constants'
import type { Ctx, DrawArgs } from './types'

export function drawMushroom(
  ctx: Ctx,
  px: number,
  py: number,
  { ink }: DrawArgs,
) {
  ctx.fillStyle = ink(COLORS.white) // white stem, pops like the spots + other whites
  ctx.fillRect(px + PIXEL * 0.35, py + PIXEL * 0.5, PIXEL * 0.3, PIXEL * 0.4)
  ctx.fillStyle = ink('#FF6B6B')
  ctx.beginPath()
  ctx.arc(px + PIXEL * 0.5, py + PIXEL * 0.45, PIXEL * 0.35, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = ink(COLORS.white)
  ctx.beginPath()
  ctx.arc(px + PIXEL * 0.4, py + PIXEL * 0.35, SCALE, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(px + PIXEL * 0.6, py + PIXEL * 0.38, SCALE * 0.8, 0, Math.PI * 2)
  ctx.fill()
}
