// One big faceted mass — the park's plain grey ellipse, given planes.
//
//   form 0 — standing: taller than wide, a steep lit crown.
//   form 1 — squat: low and broad, with a wide top plane you could sit on.

import { PIXEL } from '../constants'
import { GRANITE, SANDSTONE, facetedStone } from './facet'
import { jitter } from './variance'
import type { Ctx, DrawArgs } from './types'

export function drawBoulder(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: DrawArgs,
): void {
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean
  const standing = form === 0

  facetedStone(ctx, {
    cx,
    baseY: foot,
    w: PIXEL * (standing ? 0.34 : 0.46) * j.w,
    h: PIXEL * (standing ? 0.56 : 0.34) * j.h,
    rng,
    ink,
    tones: j.d < 0.35 ? SANDSTONE : GRANITE,
    moss: standing ? 0.3 : 0.45,
  })

  // A small stone half-buried at its foot, on most boulders but not all.
  if (rng() < 0.55) {
    const side = rng() < 0.5 ? -1 : 1
    facetedStone(ctx, {
      cx: cx + side * PIXEL * (0.3 + rng() * 0.12) * j.w,
      baseY: foot,
      w: PIXEL * 0.14 * j.w,
      h: PIXEL * 0.1 * j.h,
      rng,
      ink,
      tones: GRANITE,
      moss: 0.2,
    })
  }
}
