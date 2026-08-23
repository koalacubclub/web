// Conifer: overlapping tapering tiers over a short bare trunk. Deliberately
// lopsided — every tier gets its own left and right reach, its own centre drift
// and its own spacing, so no two sides match and the tree leans a little.
//
//   form 0 — spire: tall and narrow, six tight tiers.
//   form 1 — full: shorter and broader, four tiers with a wide skirt.

import { PIXEL } from '../constants'
import { jitter, trunkScale } from './variance'
import type { Ctx, DrawArgs } from './types'

export const PINE_TONES = {
  trunk: '#7A5A12',
  dark: '#2F7C43',
  light: '#46A15A',
}

export function drawPine(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: DrawArgs,
): void {
  const t = PINE_TONES
  const j = jitter(rng)
  const foot = py + PIXEL * 2
  const cx = px + PIXEL + j.lean * 0.4
  const spire = form === 0
  const tiers = spire ? 6 : 4
  const reach0 = PIXEL * (spire ? 0.8 : 1.04) * j.w
  // The cone takes the roll; the bare trunk under it stays much the same.
  const ts = trunkScale(j)
  const trunkH = PIXEL * (spire ? 0.42 : 0.58) * ts
  const coneH = PIXEL * (spire ? 1.92 : 1.44) * j.h

  ctx.fillStyle = ink(t.trunk)
  ctx.fillRect(cx - PIXEL * 0.12 * ts, foot - trunkH, PIXEL * 0.24 * ts, trunkH)

  const baseY = foot - trunkH * 0.85
  const topY = baseY - coneH
  let drift = 0
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1) // 0 = bottom skirt, 1 = apex
    drift += (rng() - 0.5) * PIXEL * 0.1
    const tx = cx + drift + j.lean * f
    const midY = baseY + (topY - baseY) * (f + (rng() - 0.5) * 0.06)
    const reach = reach0 * (1 - 0.62 * f)
    const wl = reach * (0.82 + rng() * 0.34)
    const wr = reach * (0.82 + rng() * 0.34)
    const drop = PIXEL * (spire ? 0.28 : 0.36) * (1 - 0.28 * f)
    ctx.fillStyle = ink(i % 2 ? t.light : t.dark)
    ctx.beginPath()
    ctx.moveTo(
      tx + (rng() - 0.5) * PIXEL * 0.06,
      midY - PIXEL * (spire ? 0.5 : 0.42) * (1 - f * 0.45),
    )
    ctx.lineTo(tx + wr, midY + drop * (0.85 + rng() * 0.3))
    ctx.quadraticCurveTo(
      tx,
      midY + drop * 0.35,
      tx - wl,
      midY + drop * (0.85 + rng() * 0.3),
    )
    ctx.closePath()
    ctx.fill()
  }
}
