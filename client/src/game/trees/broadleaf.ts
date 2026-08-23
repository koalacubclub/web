// The park's own tree, rebuilt. Same silhouette family as the original three-blob
// canopy, but with a trunk that tapers from a root flare and forks into the
// crown, a leafy rim instead of a clean circle, and shadow pooling underneath.
//
//   form 0 — upright: canopy carried high on a long trunk.
//   form 1 — spreading: wider than tall, on a short trunk.

import { PIXEL } from '../constants'
import { disc, jitter, trunkScale } from './variance'
import type { Ctx, DrawArgs } from './types'

export const BROADLEAF_TONES = {
  trunk: '#8B6914',
  deep: '#2E7D3F',
  dark: '#3D9C4E',
  light: '#66BB6A',
}

export function drawBroadleaf(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink, sizeBoost }: DrawArgs,
): void {
  const t = BROADLEAF_TONES
  const j = jitter(rng, sizeBoost)
  const foot = py + PIXEL * 2
  const cx = px + PIXEL + j.lean * 0.5
  const upright = form === 0
  const rx = PIXEL * (upright ? 0.84 : 1.04) * j.w
  const ry = PIXEL * (upright ? 0.86 : 0.64) * j.h
  // Trunk barely varies; the crown takes the whole roll and sits on top of it,
  // so a big canopy rides higher instead of swallowing the stem.
  const ts = trunkScale(j)
  const trunkH = PIXEL * (upright ? 1.06 : 0.8) * ts
  const cy = foot - trunkH - ry * (upright ? 0.42 : 0.66)

  // Trunk: wider at the root, forking into the canopy.
  ctx.fillStyle = ink(t.trunk)
  ctx.beginPath()
  ctx.moveTo(cx - PIXEL * 0.28 * ts, foot)
  ctx.lineTo(cx - PIXEL * 0.14 * ts, foot - trunkH)
  ctx.lineTo(cx + PIXEL * 0.14 * ts, foot - trunkH)
  ctx.lineTo(cx + PIXEL * 0.28 * ts, foot)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = ink(t.trunk)
  ctx.lineCap = 'round'
  ctx.lineWidth = PIXEL * 0.1 * ts
  ctx.beginPath()
  ctx.moveTo(cx, foot - trunkH * 0.9)
  ctx.lineTo(cx - PIXEL * 0.3, foot - trunkH * 1.2)
  ctx.moveTo(cx, foot - trunkH * 0.92)
  ctx.lineTo(cx + PIXEL * 0.32, foot - trunkH * 1.22)
  ctx.stroke()

  // Canopy mass, then a leafy rim walked round it so the edge isn't a circle.
  ctx.fillStyle = ink(t.dark)
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  const bumps = 11 + Math.floor(j.d * 5)
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 + rng() * 0.22
    ctx.fillStyle = ink(Math.sin(a) > 0.3 ? t.deep : t.dark)
    disc(
      ctx,
      cx + Math.cos(a) * rx * 0.9,
      cy + Math.sin(a) * ry * 0.9,
      PIXEL * (0.13 + rng() * 0.1) * j.w,
    )
  }

  // Shadow under the canopy, light on the upper lobes.
  ctx.fillStyle = ink(t.deep)
  disc(ctx, cx - rx * 0.34, cy + ry * 0.42, PIXEL * 0.32 * j.w)
  disc(ctx, cx + rx * 0.38, cy + ry * 0.36, PIXEL * 0.28 * j.w)
  ctx.fillStyle = ink(t.light)
  disc(
    ctx,
    cx - rx * (0.34 + (rng() - 0.5) * 0.14),
    cy - ry * 0.34,
    PIXEL * 0.4 * j.w,
  )
  disc(
    ctx,
    cx + rx * (0.3 + (rng() - 0.5) * 0.14),
    cy - ry * 0.44,
    PIXEL * 0.36 * j.w,
  )
  disc(ctx, cx - rx * 0.02, cy - ry * 0.62, PIXEL * 0.28 * j.w)
}
