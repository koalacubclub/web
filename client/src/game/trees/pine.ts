// Conifer: overlapping drooping boughs over a short bare trunk. Deliberately
// lopsided — every bough gets its own left and right reach, its own centre
// drift and its own spacing, so no two sides match and the tree leans a little.
//
// A solid cone carries the silhouette and the boughs are drawn over it, so the
// tree never separates into floating triangles at the top of the size range.
// The cone is drawn STRAIGHT-SIDED (its control points sit on the chord from
// apex to base). Bulging it outward, which is the obvious way to write that
// curve, swallows the boughs whole: they end up inside the body and the tree
// reads as a smooth triangle with horizontal stripes painted on it. Keeping the
// body lean lets the bough tips break the outline, which is what makes the
// silhouette read as a conifer rather than as a cone.
//
// The leader — the spike at the very top — is the top bough's own tip, not bare
// body above the last bough. Left bare it reads as a separate spike balanced on
// the tree.
//
//   form 0 — spire: tall and narrow, seven tight boughs.
//   form 1 — full: shorter and broader, five boughs with a wide skirt.

import { PIXEL } from '../constants'
import { jitter, trunkScale } from './variance'
import type { Ctx, DrawArgs } from './types'

/** How much narrower the solid body is than the boughs that cover it. */
const BODY_INSET = 0.78

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
  const tiers = spire ? 7 : 5
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

  // Solid body first: the boughs are shading on top of a continuous silhouette,
  // so a taller tree can't come apart into floating triangles. Control points
  // sit ON the apex→base chord (a straight taper, very slightly waisted), which
  // is what keeps the body inside the boughs — see the note at the top.
  ctx.fillStyle = ink(t.dark)
  // BODY_INSET: the body is drawn narrower than the boughs reach, so every tip
  // clears it. Matching them (inset 1) is what left the tree a smooth triangle
  // — the boughs landed flush with the outline and only their tone showed.
  const bodyL = leftR * BODY_INSET
  const bodyR = rightR * BODY_INSET
  ctx.beginPath()
  ctx.moveTo(apexX, topY)
  ctx.quadraticCurveTo(
    cx - bodyL * 0.44,
    baseY - coneH * 0.52,
    cx - bodyL,
    baseY,
  )
  ctx.lineTo(cx + bodyR, baseY)
  ctx.quadraticCurveTo(cx + bodyR * 0.44, baseY - coneH * 0.52, apexX, topY)
  ctx.closePath()
  ctx.fill()

  // Boughs, drawn over the body: uneven spacing, each with its own left and
  // right reach and its own tip offset. The top one runs all the way to the
  // apex, so the leader belongs to a bough instead of standing bare above them.
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1) // 0 = bottom bough, 1 = leader
    const midY = baseY - coneH * f * 0.9 - rng() * coneH * 0.04
    // Reach stays ahead of the body's taper at the same height, so the tips
    // break the outline: the body is straight, this curve is convex.
    const taper = (1 - f) ** 0.62
    const wl = leftR * taper * (0.9 + rng() * 0.28)
    const wr = rightR * taper * (0.9 + rng() * 0.28)
    const drop = coneH * 0.19 * (1 - 0.3 * f)
    const tipX = apexX + (cx - apexX) * (1 - f) + (rng() - 0.5) * PIXEL * 0.12
    // How far this bough's own point rises above its midline. The top bough
    // reaches the apex; the rest rise about a drop and a half.
    const rise = f > 0.99 ? midY - topY : drop * (1.5 + rng() * 0.6)
    ctx.fillStyle = ink(i % 2 ? t.light : t.dark)
    ctx.beginPath()
    ctx.moveTo(tipX, midY - rise)
    // Upper edges bow INWARD toward the point, so a bough reads as two swept
    // limbs rather than as a triangle with straight sides.
    ctx.quadraticCurveTo(
      cx + wr * 0.42,
      midY - rise * 0.28,
      cx + wr,
      midY + drop * (0.85 + rng() * 0.5),
    )
    // Underside: dips at the tips, lifts through the middle.
    ctx.quadraticCurveTo(
      cx,
      midY + drop * 0.2,
      cx - wl,
      midY + drop * (0.85 + rng() * 0.5),
    )
    ctx.quadraticCurveTo(cx - wl * 0.42, midY - rise * 0.28, tipX, midY - rise)
    ctx.closePath()
    ctx.fill()
  }
}
