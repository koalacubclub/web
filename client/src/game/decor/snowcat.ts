import { COLORS, PIXEL, SCALE } from '../constants'
import type { AnimatedDrawArgs, Ctx } from './types'

// A little snow-cat companion (1×1): two stacked snow spheres with big cat ears.
export function drawSnowcat(
  ctx: Ctx,
  px: number,
  py: number,
  { frameCount, ink }: AnimatedDrawArgs,
) {
  const cx = px + PIXEL * 0.5
  const s = SCALE
  const bob = Math.sin(frameCount * 0.04) * s * 0.3

  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.ellipse(
    cx,
    py + PIXEL * 0.92,
    PIXEL * 0.32,
    PIXEL * 0.08,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.fillStyle = ink(COLORS.white)
  ctx.beginPath()
  ctx.arc(cx, py + PIXEL * 0.68 + bob, PIXEL * 0.3, 0, Math.PI * 2)
  ctx.fill()
  const hy = py + PIXEL * 0.36 + bob
  ctx.beginPath()
  ctx.arc(cx, hy, PIXEL * 0.22, 0, Math.PI * 2)
  ctx.fill()

  // Big pointy cat ears with pink inners
  const earBaseY = hy - PIXEL * 0.13
  const earTipY = hy - PIXEL * 0.36
  ctx.fillStyle = ink(COLORS.white)
  ctx.beginPath()
  ctx.moveTo(cx - PIXEL * 0.21, earBaseY)
  ctx.lineTo(cx - PIXEL * 0.12, earTipY)
  ctx.lineTo(cx - PIXEL * 0.02, earBaseY)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + PIXEL * 0.21, earBaseY)
  ctx.lineTo(cx + PIXEL * 0.12, earTipY)
  ctx.lineTo(cx + PIXEL * 0.02, earBaseY)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = ink(COLORS.heart)
  ctx.beginPath()
  ctx.moveTo(cx - PIXEL * 0.16, earBaseY - PIXEL * 0.01)
  ctx.lineTo(cx - PIXEL * 0.12, earTipY + PIXEL * 0.07)
  ctx.lineTo(cx - PIXEL * 0.08, earBaseY - PIXEL * 0.01)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + PIXEL * 0.16, earBaseY - PIXEL * 0.01)
  ctx.lineTo(cx + PIXEL * 0.12, earTipY + PIXEL * 0.07)
  ctx.lineTo(cx + PIXEL * 0.08, earBaseY - PIXEL * 0.01)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = ink(COLORS.charcoal)
  ctx.beginPath()
  ctx.arc(cx - PIXEL * 0.08, hy - PIXEL * 0.02, s * 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + PIXEL * 0.08, hy - PIXEL * 0.02, s * 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ink(COLORS.fishBowl)
  ctx.beginPath()
  ctx.moveTo(cx, hy + PIXEL * 0.02)
  ctx.lineTo(cx + PIXEL * 0.09, hy + PIXEL * 0.05)
  ctx.lineTo(cx, hy + PIXEL * 0.08)
  ctx.closePath()
  ctx.fill()
}
