import { COLORS, PIXEL, SCALE } from '../constants'
import type { Ctx, DrawArgs } from './types'

// An open cardboard box (2×1) — cats love boxes.
export function drawCardbox(
  ctx: Ctx,
  px: number,
  py: number,
  { w, ink }: DrawArgs,
) {
  const W = w

  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.beginPath()
  ctx.ellipse(
    px + W / 2,
    py + PIXEL * 0.92,
    W * 0.4,
    PIXEL * 0.09,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  const bx = px + W * 0.18
  const bw = W * 0.64
  const by = py + PIXEL * 0.36
  const bh = PIXEL * 0.52

  ctx.fillStyle = ink(COLORS.dirt)
  ctx.fillRect(bx, by, bw, bh)
  ctx.fillStyle = ink('#C4A06A')
  ctx.fillRect(bx + bw * 0.78, by, bw * 0.22, bh)
  ctx.fillStyle = ink('#A87B4A')
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx + bw, by)
  ctx.lineTo(bx + bw * 0.82, by + PIXEL * 0.12)
  ctx.lineTo(bx + bw * 0.18, by + PIXEL * 0.12)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = ink(COLORS.dirtLight)
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx - PIXEL * 0.16, by - PIXEL * 0.18)
  ctx.lineTo(bx + bw * 0.2, by - PIXEL * 0.04)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(bx + bw, by)
  ctx.lineTo(bx + bw + PIXEL * 0.16, by - PIXEL * 0.14)
  ctx.lineTo(bx + bw * 0.8, by - PIXEL * 0.03)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = ink('#B5895A')
  ctx.lineWidth = SCALE * 0.5
  ctx.beginPath()
  ctx.moveTo(bx + bw * 0.5, by + PIXEL * 0.12)
  ctx.lineTo(bx + bw * 0.5, by + bh)
  ctx.stroke()
  ctx.strokeStyle = ink(COLORS.dirtLight)
  ctx.lineWidth = SCALE
  ctx.beginPath()
  ctx.moveTo(bx + bw * 0.5, by)
  ctx.lineTo(bx + bw * 0.5, by + PIXEL * 0.12)
  ctx.stroke()
}
