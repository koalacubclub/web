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
//
// The fairy-light tree in ../decor/lightTree.ts is this pine with lamps and a
// star on it — it calls `drawPine` for the tree and `pineFrame` to find out
// where the boughs landed, so the two can never drift apart.

import { PIXEL } from '../constants'
import { jitter, trunkScale } from './variance'
import type { Ctx, DrawArgs, TreeForm } from './types'

/** How much narrower the solid body is than the boughs that cover it. */
const BODY_INSET = 0.78

export const PINE_TONES = {
  trunk: '#7A5A12',
  dark: '#2F7C43',
  light: '#46A15A',
}

/**
 * The cone a pine stands in, before any of its art is drawn: where the apex is,
 * where the boughs reach, how tall the body is.
 */
export interface PineFrame {
  /** Centre of the trunk, in logical px. */
  cx: number
  /** Where the very top of the tree sits — the leader's tip. */
  apexX: number
  topY: number
  /** The foliage's bottom edge, and how far it is from apex to base. */
  baseY: number
  coneH: number
  /** How far the boughs reach at the base — the two sides differ on purpose. */
  leftR: number
  rightR: number
  /** The bare trunk under the cone. */
  foot: number
  trunkH: number
  trunkW: number
  /** How many boughs this build carries. */
  tiers: number
}

/**
 * Rolls one pine's cone. It CONSUMES `rng` — `drawPine` calls it first and then
 * keeps drawing the boughs off the same rng, so the two stay in step.
 *
 * Exported because the fairy-light tree (`../decor/lightTree.ts`) is this same
 * pine with lamps on it: it re-rolls the frame from the same seed to find out
 * where the foliage actually ended up, rather than hanging its lamps on a cone
 * of its own that would drift the moment this one was retuned.
 */
export function pineFrame(
  px: number,
  py: number,
  rng: () => number,
  form: TreeForm,
): PineFrame {
  const j = jitter(rng)
  const foot = py + PIXEL * 2
  const cx = px + PIXEL + j.lean * 0.4
  const spire = form === 0
  // The cone takes the roll; the bare trunk under it stays much the same.
  const ts = trunkScale(j)
  const trunkH = PIXEL * (spire ? 0.42 : 0.58) * ts
  const coneH = PIXEL * (spire ? 1.92 : 1.44) * j.h
  const baseY = foot - trunkH * 0.85

  // One side of the tree reaches further than the other, all the way up — a
  // conifer that mirrors itself down the middle reads as a paper cut-out.
  const reach0 = PIXEL * (spire ? 0.8 : 1.04) * j.w
  const bias = 0.78 + rng() * 0.44

  return {
    cx,
    apexX: cx + (rng() - 0.5) * PIXEL * 0.2,
    topY: baseY - coneH,
    baseY,
    coneH,
    leftR: reach0 * bias,
    rightR: reach0 * (1.9 - bias),
    foot,
    trunkH,
    trunkW: PIXEL * 0.24 * ts,
    tiers: spire ? 7 : 5,
  }
}

/** Half-width of the boughs at height `f` up the cone (0 = base, 1 = leader). */
export const pineTaper = (f: number): number => (1 - f) ** 0.62

export function drawPine(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: DrawArgs,
): void {
  const t = PINE_TONES
  const {
    cx,
    apexX,
    topY,
    baseY,
    coneH,
    leftR,
    rightR,
    foot,
    trunkH,
    trunkW,
    tiers,
  } = pineFrame(px, py, rng, form)

  ctx.fillStyle = ink(t.trunk)
  ctx.fillRect(cx - trunkW / 2, foot - trunkH, trunkW, trunkH)

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
    const taper = pineTaper(f)
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
