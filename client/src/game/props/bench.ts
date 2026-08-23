// The park bench, rebuilt. No forms: a park's benches come from one supplier,
// and a row of them differing from each other reads as a mistake rather than as
// variety. What the rebuild adds over the five flat rectangles the park draws
// today is structure — a slatted seat and back on a dark frame, armrests, legs
// with a stretcher between them, and a contact shadow so it sits on the grass.

import { PIXEL, SCALE } from '../constants'
import type { Ctx, DrawArgs } from './types'

const TAU = Math.PI * 2

export const BENCH_TONES = {
  /** Timber, lit face. */
  slatLight: '#A1887F',
  /** Timber, shaded face and front edges. */
  slat: '#8D6E63',
  /** The frame: legs, arm supports, the stretcher. */
  frame: '#6B5049',
  /** Deepest shadow — under the seat and between slats. */
  shade: '#4A3832',
}

/**
 * Draws a bench with the top-left of its 2×1 footprint at (px, py) in logical
 * px; the feet sit on the footprint's bottom edge.
 */
export function drawBench(
  ctx: Ctx,
  px: number,
  py: number,
  { ink }: DrawArgs,
): void {
  const t = BENCH_TONES
  const W = PIXEL * 2
  const foot = py + PIXEL
  const cx = px + W / 2

  // Contact shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(cx, foot - SCALE * 0.4, W * 0.46, SCALE * 1.4, 0, 0, TAU)
  ctx.fill()

  // Legs: a pair each side, splayed a little, with a stretcher between them.
  ctx.fillStyle = ink(t.frame)
  const legTop = py + PIXEL * 0.5
  for (const side of [-1, 1]) {
    const lx = cx + side * W * 0.34
    ctx.beginPath()
    ctx.moveTo(lx - SCALE * 1.1, legTop)
    ctx.lineTo(lx + SCALE * 1.1, legTop)
    ctx.lineTo(lx + side * SCALE * 2.4 + SCALE * 0.9, foot - SCALE * 0.6)
    ctx.lineTo(lx + side * SCALE * 2.4 - SCALE * 0.9, foot - SCALE * 0.6)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillRect(cx - W * 0.32, foot - SCALE * 3.4, W * 0.64, SCALE * 1.1)

  // Seat: three slats with a shadow gap between them, front edge darker so the
  // seat has a thickness rather than being a painted stripe.
  const seatY = py + PIXEL * 0.34
  const slatH = SCALE * 1.9
  for (let i = 0; i < 3; i++) {
    const sy = seatY + i * (slatH + SCALE * 0.5)
    ctx.fillStyle = ink(t.shade)
    ctx.fillRect(
      px + SCALE * 0.6,
      sy + slatH * 0.72,
      W - SCALE * 1.2,
      slatH * 0.5,
    )
    ctx.fillStyle = ink(i === 0 ? t.slatLight : t.slat)
    ctx.fillRect(px + SCALE * 0.6, sy, W - SCALE * 1.2, slatH)
  }

  // Back: two uprights carrying three rails, the top one proud of the rest.
  ctx.fillStyle = ink(t.frame)
  for (const side of [-1, 1]) {
    ctx.fillRect(
      cx + side * W * 0.36 - SCALE * 1.1,
      py + SCALE * 0.6,
      SCALE * 2.2,
      PIXEL * 0.36,
    )
  }
  for (let i = 0; i < 3; i++) {
    const ry = py + SCALE * (1.1 + i * 2.6)
    ctx.fillStyle = ink(i === 0 ? t.slatLight : t.slat)
    ctx.fillRect(px + SCALE * 1.4, ry, W - SCALE * 2.8, SCALE * 1.8)
    ctx.fillStyle = ink(t.shade)
    ctx.fillRect(
      px + SCALE * 1.4,
      ry + SCALE * 1.5,
      W - SCALE * 2.8,
      SCALE * 0.5,
    )
  }

  // Armrests: a rail sitting proud of the seat on a short post, drawn last so it
  // reads in front of the slats rather than blending into them.
  for (const side of [-1, 1]) {
    const ax = cx + side * W * 0.42
    ctx.fillStyle = ink(t.frame)
    ctx.fillRect(ax - SCALE * 0.9, py + PIXEL * 0.24, SCALE * 1.8, PIXEL * 0.16)
    ctx.fillStyle = ink(t.slatLight)
    ctx.fillRect(
      ax - side * SCALE * 3.4,
      py + PIXEL * 0.2,
      SCALE * 4.6,
      SCALE * 1.6,
    )
    ctx.fillStyle = ink(t.shade)
    ctx.fillRect(
      ax - side * SCALE * 3.4,
      py + PIXEL * 0.2 + SCALE * 1.4,
      SCALE * 4.6,
      SCALE * 0.6,
    )
  }
}
