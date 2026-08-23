// Flat layered stone — the kind you'd step on to cross a stream. Its build is
// all proportion: wide and shallow, so it reads as flat next to a boulder.
//
//   form 0 — one slab, low and wide.
//   form 1 — two, the second leaning against the first.

import { PIXEL } from '../constants'
import { GRANITE, SANDSTONE, facetedStone } from './facet'
import { jitter } from './variance'
import type { Ctx, DrawArgs } from './types'

export function drawSlab(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: DrawArgs,
): void {
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean
  const leaning = form === 1

  const w = PIXEL * 0.44 * j.w
  const h = PIXEL * 0.2 * j.h
  facetedStone(ctx, {
    cx,
    baseY: foot,
    w,
    h,
    rng,
    ink,
    tones: GRANITE,
    moss: 0.35,
  })
  if (leaning) {
    // A second slab propped against the first: narrower, taller, tipped up.
    const side = rng() < 0.5 ? -1 : 1
    ctx.save()
    ctx.translate(cx + side * w * 0.7, foot)
    ctx.rotate(side * (0.32 + rng() * 0.2))
    const lw = PIXEL * 0.3 * j.w
    const lh = PIXEL * 0.17 * j.h
    facetedStone(ctx, {
      cx: 0,
      baseY: 0,
      w: lw,
      h: lh,
      rng,
      ink,
      tones: SANDSTONE,
      moss: 0.2,
      shadow: false,
    })
    ctx.restore()
  }
}
