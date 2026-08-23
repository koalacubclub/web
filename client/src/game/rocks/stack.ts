// Stones balanced one on another — a cairn. Each stone sits on the peak of the
// one below and steps in a little, so the pile leans the way a real one does.
//
//   form 0 — a pair: one broad base stone with a smaller one on top.
//   form 1 — a cairn: three, tapering, with a noticeable lean.

import { PIXEL } from '../constants'
import { GRANITE, SANDSTONE, facetedStone } from './facet'
import { jitter } from './variance'
import type { Ctx, DrawArgs } from './types'

export function drawStack(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: DrawArgs,
): void {
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean
  const cairn = form === 1
  const stones = cairn ? 3 : 2
  const lean = (rng() - 0.5) * PIXEL * (cairn ? 0.16 : 0.1)

  let restOn = foot
  let sx = cx
  for (let i = 0; i < stones; i++) {
    const f = i / stones
    const w = PIXEL * (0.4 - f * 0.13) * j.w
    const h = PIXEL * (0.26 - f * 0.05) * j.h
    const peak = facetedStone(ctx, {
      cx: sx,
      baseY: restOn,
      w,
      h,
      rng,
      ink,
      tones: i % 2 === (j.d < 0.5 ? 0 : 1) ? SANDSTONE : GRANITE,
      // Only the stone on the ground casts a contact shadow; the ones above sit
      // on stone, and a shadow there reads as a gap.
      shadow: i === 0,
      moss: i === 0 ? 0.5 : 0.15,
    })
    // The next stone rests just below this one's peak so they bed together
    // rather than balancing on a point.
    restOn = peak + h * 0.22
    sx += lean + (rng() - 0.5) * PIXEL * 0.06
  }
}
