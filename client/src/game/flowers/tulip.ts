// Tulips: closed cups on straight stems, each with one long blade of leaf. The
// most upright, structured patch — a contrast to the scattered daisies.
//
//   form 0 — tall: three or four full-height stems.
//   form 1 — bedded: more stems, shorter, packed together.

import { PIXEL, SCALE } from '../constants'
import { bob, jitter } from './variance'
import type { Ctx, DrawArgs } from './types'

export const TULIP_TONES = {
  stem: '#4A8C46',
  leaf: '#5EA855',
  cups: ['#F2496B', '#FF8FB1', '#FFD24A', '#E86BC4'],
}

export function drawTulip(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink, frameCount, sway }: DrawArgs,
): void {
  const t = TULIP_TONES
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean * 0.5
  const tall = form === 0
  const count = tall ? 3 + Math.round(j.d) : 4 + Math.round(j.d * 3)
  const spread = PIXEL * (tall ? 0.3 : 0.44) * j.w
  const stemH = PIXEL * (tall ? 0.78 : 0.5) * j.h
  const cupW = SCALE * 1.9 * j.bloom
  const cupH = SCALE * 2.9 * j.bloom

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.5 : i / (count - 1)
    const bx = cx + (f - 0.5) * 2 * spread
    const h = stemH * (0.78 + rng() * 0.44)
    const nod = bob(frameCount, i * 1.9 + px * 0.05, sway) * 0.5
    const topY = foot - h + nod

    ctx.strokeStyle = ink(t.stem)
    ctx.lineCap = 'round'
    ctx.lineWidth = SCALE * 0.6
    ctx.beginPath()
    ctx.moveTo(bx, foot)
    ctx.quadraticCurveTo(bx + nod, foot - h * 0.5, bx + nod, topY)
    ctx.stroke()

    // One blade of leaf, arcing up from the base.
    ctx.strokeStyle = ink(t.leaf)
    ctx.lineWidth = SCALE * 0.9
    const side = rng() < 0.5 ? -1 : 1
    ctx.beginPath()
    ctx.moveTo(bx, foot)
    ctx.quadraticCurveTo(
      bx + side * SCALE * 2.6,
      foot - h * 0.5,
      bx + side * SCALE * 1.4,
      foot - h * 0.78,
    )
    ctx.stroke()

    // The cup: a rounded body with two points at the rim.
    ctx.fillStyle = t.cups[Math.floor(rng() * t.cups.length)]
    ctx.beginPath()
    ctx.moveTo(bx + nod - cupW, topY - cupH * 0.35)
    ctx.quadraticCurveTo(
      bx + nod - cupW,
      topY + cupH * 0.55,
      bx + nod,
      topY + cupH * 0.55,
    )
    ctx.quadraticCurveTo(
      bx + nod + cupW,
      topY + cupH * 0.55,
      bx + nod + cupW,
      topY - cupH * 0.35,
    )
    ctx.quadraticCurveTo(
      bx + nod + cupW * 0.5,
      topY - cupH * 0.1,
      bx + nod,
      topY - cupH * 0.5,
    )
    ctx.quadraticCurveTo(
      bx + nod - cupW * 0.5,
      topY - cupH * 0.1,
      bx + nod - cupW,
      topY - cupH * 0.35,
    )
    ctx.closePath()
    ctx.fill()
  }
}
