// Conifer: overlapping tapering tiers over a short bare trunk. Deliberately
// lopsided — every tier gets its own left and right reach, its own centre drift
// and its own spacing, so no two sides match and the tree leans a little.
//
// A solid cone carries the silhouette and the tiers are drawn over it as
// skirts, so the tree never separates into floating triangles at the top of the
// size range.
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
  // The cone takes the roll; the bare trunk under it stays much the same.
  const ts = trunkScale(j)
  const trunkH = PIXEL * (spire ? 0.42 : 0.58) * ts
  const coneH = PIXEL * (spire ? 1.92 : 1.44) * j.h
  const baseY = foot - trunkH * 0.85
  const topY = baseY - coneH

  // One side of the tree reaches further than the other, all the way up — a
  // conifer that mirrors itself down the middle reads as a paper cut-out.
  const reach0 = PIXEL * (spire ? 0.8 : 1.04) * j.w
  const bias = 0.78 + rng() * 0.44
  const leftR = reach0 * bias
  const rightR = reach0 * (1.9 - bias)
  const apexX = cx + (rng() - 0.5) * PIXEL * 0.2

  ctx.fillStyle = ink(t.trunk)
  ctx.fillRect(cx - PIXEL * 0.12 * ts, foot - trunkH, PIXEL * 0.24 * ts, trunkH)

  // Solid body first: the tiers are shading on top of a continuous silhouette,
  // so a taller tree can't come apart into floating triangles.
  ctx.fillStyle = ink(t.dark)
  ctx.beginPath()
  ctx.moveTo(apexX, topY)
  ctx.quadraticCurveTo(
    cx - leftR * 0.5,
    baseY - coneH * 0.44,
    cx - leftR,
    baseY,
  )
  ctx.lineTo(cx + rightR, baseY)
  ctx.quadraticCurveTo(cx + rightR * 0.5, baseY - coneH * 0.44, apexX, topY)
  ctx.closePath()
  ctx.fill()

  // Skirts, drawn over the body: uneven spacing, each with its own left and
  // right reach and its own tip offset.
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1) // 0 = bottom skirt, 1 = apex
    const midY = baseY - coneH * f * 0.84 - rng() * coneH * 0.05
    const taper = 1 - 0.7 * f
    const wl = leftR * taper * (0.84 + rng() * 0.3)
    const wr = rightR * taper * (0.84 + rng() * 0.3)
    const drop = coneH * 0.15 * (1 - 0.3 * f)
    const tipX = apexX + (cx - apexX) * (1 - f) + (rng() - 0.5) * PIXEL * 0.12
    ctx.fillStyle = ink(i % 2 ? t.light : t.dark)
    ctx.beginPath()
    ctx.moveTo(tipX, midY - drop * (1.5 + rng() * 0.6))
    ctx.lineTo(cx + wr, midY + drop * (0.8 + rng() * 0.5))
    ctx.quadraticCurveTo(
      cx,
      midY + drop * 0.2,
      cx - wl,
      midY + drop * (0.8 + rng() * 0.5),
    )
    ctx.closePath()
    ctx.fill()
  }
}
