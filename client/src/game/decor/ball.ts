// The ball (1x1) — the park's one knockable object, and a shop item. Drawn
// here once so the base balls the park seeds and a bought one are the same
// ball; ParkGame used to carry its own copy with the park colours hard-coded.

import { COLORS, PIXEL, SCALE } from '../constants'
import type { AnimatedDrawArgs, Ctx } from './types'

export function drawBall(
  ctx: Ctx,
  px: number,
  py: number,
  { frameCount, ink }: AnimatedDrawArgs,
) {
  const bounce = Math.abs(Math.sin(frameCount * 0.06)) * SCALE * 2
  ctx.fillStyle = 'rgba(0,0,0,0.1)'
  ctx.beginPath()
  ctx.ellipse(
    px + PIXEL * 0.5,
    py + PIXEL * 0.8,
    PIXEL * 0.25,
    PIXEL * 0.1,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.fillStyle = ink('#FF6B6B')
  ctx.beginPath()
  ctx.arc(
    px + PIXEL * 0.5,
    py + PIXEL * 0.5 - bounce,
    PIXEL * 0.25,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.fillStyle = ink(COLORS.fishBowl)
  ctx.beginPath()
  ctx.arc(px + PIXEL * 0.4, py + PIXEL * 0.4 - bounce, SCALE, 0, Math.PI * 2)
  ctx.fill()
}
