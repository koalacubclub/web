// Lavender: no blooms to speak of, just purple spikes of florets on straight
// grey-green stems. Reads as texture rather than as flowers, which is exactly
// what a patch of it should do next to daisies and poppies.
//
//   form 0 — tall: long spikes standing well clear of the grass.
//   form 1 — mounded: many shorter spikes over a dense base.

import { PIXEL, SCALE } from '../constants'
import { bob, disc, jitter } from './variance'
import type { Ctx, DrawArgs } from './types'

export const LAVENDER_TONES = {
  stem: '#7E9B6E',
  leaf: '#88A578',
  base: '#6E8F62',
  floret: '#A87BE0',
  floretPale: '#C9AFF2',
}

export function drawLavender(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink, frameCount, sway }: DrawArgs,
): void {
  const t = LAVENDER_TONES
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean * 0.5
  const tall = form === 0
  const count = tall ? 5 + Math.round(j.d * 3) : 7 + Math.round(j.d * 4)
  const spread = PIXEL * (tall ? 0.34 : 0.46) * j.w
  const stemH = PIXEL * (tall ? 0.76 : 0.46) * j.h

  // A few blades of foliage at the base. (A filled mound here read as a cast
  // shadow under the patch rather than as leaves.)
  ctx.strokeStyle = ink(t.base)
  ctx.lineCap = 'round'
  ctx.lineWidth = SCALE * 0.7
  for (let i = 0; i < 5; i++) {
    const bx = cx + (rng() - 0.5) * spread * 1.6
    ctx.beginPath()
    ctx.moveTo(bx, foot)
    ctx.quadraticCurveTo(
      bx + (rng() - 0.5) * SCALE * 3,
      foot - SCALE * 2,
      bx + (rng() - 0.5) * SCALE * 4,
      foot - SCALE * (2.4 + rng() * 1.6),
    )
    ctx.stroke()
  }

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.5 : i / (count - 1)
    const bx = cx + (f - 0.5) * 2 * spread + (rng() - 0.5) * PIXEL * 0.05
    const h = stemH * (0.7 + rng() * 0.6)
    const nod = bob(frameCount, i * 0.8 + px * 0.05, sway) * 0.6
    const topY = foot - h + nod

    ctx.strokeStyle = ink(t.stem)
    ctx.lineCap = 'round'
    ctx.lineWidth = SCALE * 0.5
    ctx.beginPath()
    ctx.moveTo(bx, foot - SCALE)
    ctx.quadraticCurveTo(bx + nod * 0.5, foot - h * 0.5, bx + nod, topY)
    ctx.stroke()

    // Narrow leaves in opposite pairs down the lower stem — lavender is as much
    // grey-green foliage as it is flower.
    ctx.strokeStyle = ink(t.leaf)
    ctx.lineWidth = SCALE * 0.5
    const pairs = 2 + Math.round(rng())
    for (let k = 0; k < pairs; k++) {
      const lf = 0.22 + (k / pairs) * 0.46
      const ly = foot - h * lf
      const lx = bx + nod * lf
      for (const dir of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(lx, ly)
        ctx.quadraticCurveTo(
          lx + dir * SCALE * 1.3,
          ly - SCALE * 0.1,
          lx + dir * SCALE * (1.8 + rng() * 0.8),
          ly - SCALE * (0.9 + rng() * 0.6),
        )
        ctx.stroke()
      }
    }

    // Florets stacked up the top third of the spike, smallest at the tip.
    const florets = 6 + Math.round(rng() * 3)
    for (let k = 0; k < florets; k++) {
      const kf = k / florets
      ctx.fillStyle = k % 3 === 0 ? t.floretPale : t.floret
      disc(
        ctx,
        bx + nod * (0.6 + kf * 0.4) + (rng() - 0.5) * SCALE * 0.5,
        topY + kf * h * 0.3,
        SCALE * (0.9 - kf * 0.28) * j.bloom,
      )
    }
  }
}
