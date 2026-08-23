// A scatter of stones sitting together on the ground, part-buried — the shape a
// rockery or a stream bank makes. Drawn back-to-front so the near ones overlap.
//
//   form 0 — a few: three stones, one clearly the largest.
//   form 1 — scree: five or six smaller ones, spread wider.

import { PIXEL } from '../constants'
import { GRANITE, SANDSTONE, facetedStone } from './facet'
import { jitter } from './variance'
import type { Ctx, DrawArgs } from './types'

export function drawCluster(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: DrawArgs,
): void {
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean
  const scree = form === 1
  const count = scree ? 5 + Math.round(j.d) : 3
  const spread = PIXEL * (scree ? 0.42 : 0.32) * j.w

  // Back row first (drawn higher and smaller), then the front, so the near
  // stones overlap the far ones.
  for (let i = 0; i < count; i++) {
    const back = i < Math.floor(count / 2)
    const f = count === 1 ? 0.5 : i / (count - 1)
    const size = (back ? 0.7 : 1) * (0.6 + rng() * 0.6)
    facetedStone(ctx, {
      cx: cx + (f - 0.5) * 2 * spread + (rng() - 0.5) * PIXEL * 0.06,
      baseY: foot - (back ? PIXEL * 0.08 : 0),
      w: PIXEL * (scree ? 0.16 : 0.22) * j.w * size,
      h: PIXEL * (scree ? 0.13 : 0.18) * j.h * size,
      rng,
      ink,
      tones: rng() < 0.4 ? SANDSTONE : GRANITE,
      moss: back ? 0.2 : 0.4,
    })
  }
}
