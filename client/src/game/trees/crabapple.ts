// Crabapple: open branches carrying masses of pink-and-white blossom, with leaf
// green breaking through *between* the flowers (green underneath, blossom over
// it, then leaf clumps back on top). A couple of last season's fruit and petals
// down on the grass.
//
//   form 0 — upright: crown held high on a clear trunk, three branches.
//   form 1 — spreading: low and wide, five branches showing.

import { PIXEL, SCALE } from '../constants'
import { disc, jitter, trunkScale } from './variance'
import type { Ctx, DrawArgs } from './types'

export const CRABAPPLE_TONES = {
  trunk: '#6E5424',
  branch: '#5C4520',
  leaf: '#5C9A4C',
  leafLight: '#7CBE63',
  blossom: '#F3BAD0',
  bloomPale: '#FCEDF2',
  fruit: '#CC3B35',
}

const LIMBS_UPRIGHT = [
  [-0.5, -0.42],
  [-0.1, -0.6],
  [0.42, -0.44],
]
const LIMBS_SPREADING = [
  [-0.78, -0.2],
  [-0.36, -0.5],
  [0.06, -0.56],
  [0.44, -0.44],
  [0.78, -0.14],
]

export function drawCrabapple(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink, sizeBoost }: DrawArgs,
): void {
  const t = CRABAPPLE_TONES
  const j = jitter(rng, sizeBoost)
  const foot = py + PIXEL * 2
  const cx = px + PIXEL + j.lean * 0.5
  const upright = form === 0
  const crx = PIXEL * (upright ? 0.7 : 0.92) * j.w
  const cry = PIXEL * (upright ? 0.68 : 0.54) * j.h
  const ts = trunkScale(j)
  const trunkH = PIXEL * (upright ? 0.76 : 0.48) * ts
  const crownY = foot - trunkH - cry * (upright ? 0.85 : 1.19)

  ctx.lineCap = 'round'
  ctx.strokeStyle = ink(t.trunk)
  ctx.lineWidth = PIXEL * 0.17 * ts
  ctx.beginPath()
  ctx.moveTo(cx - PIXEL * 0.04, foot)
  ctx.lineTo(cx, foot - trunkH)
  ctx.stroke()

  ctx.strokeStyle = ink(t.branch)
  const limbs = upright ? LIMBS_UPRIGHT : LIMBS_SPREADING
  limbs.forEach(([dx, dy], i) => {
    ctx.lineWidth =
      PIXEL * (i === 0 || i === limbs.length - 1 ? 0.075 : 0.095) * ts
    ctx.beginPath()
    ctx.moveTo(cx, foot - trunkH * 0.94)
    ctx.quadraticCurveTo(
      cx + PIXEL * dx * 0.45,
      foot - trunkH * 1.35,
      cx + PIXEL * dx * j.w,
      crownY + PIXEL * dy * j.h,
    )
    ctx.stroke()
  })

  // Leaf green underneath the crown.
  ctx.fillStyle = ink(t.leaf)
  ctx.beginPath()
  ctx.ellipse(cx, crownY - PIXEL * 0.04, crx, cry, 0, 0, Math.PI * 2)
  ctx.fill()

  // Even fill inside the crown (sqrt keeps clumps off a ring at the rim).
  const spot = () => {
    const ang = rng() * Math.PI * 2
    const rad = Math.sqrt(rng())
    return {
      x: cx + Math.cos(ang) * rad * crx * 0.88,
      y: crownY - PIXEL * 0.04 + Math.sin(ang) * rad * cry * 0.88,
    }
  }
  const blooms = 13 + Math.floor(j.d * 8)
  for (let i = 0; i < blooms; i++) {
    const c = spot()
    ctx.fillStyle = ink(i % 3 === 0 ? t.bloomPale : t.blossom)
    disc(ctx, c.x, c.y, PIXEL * (0.11 + rng() * 0.09) * j.w)
  }
  const leaves = 8 + Math.floor(j.d * 5)
  for (let i = 0; i < leaves; i++) {
    const c = spot()
    ctx.fillStyle = ink(i % 3 === 0 ? t.leafLight : t.leaf)
    disc(ctx, c.x, c.y, PIXEL * (0.08 + rng() * 0.07) * j.w)
  }
  for (let i = 0; i < 6; i++) {
    const c = spot()
    ctx.fillStyle = ink(i % 2 === 0 ? t.bloomPale : t.blossom)
    disc(ctx, c.x, c.y, PIXEL * (0.07 + rng() * 0.06) * j.w)
  }

  // Two crabapples left from last season, and petals on the grass.
  ctx.fillStyle = ink(t.fruit)
  disc(ctx, cx - crx * 0.42, crownY + cry * 0.42, SCALE * 1.05)
  disc(ctx, cx + crx * 0.52, crownY + cry * 0.2, SCALE * 0.95)
  ctx.fillStyle = ink(t.bloomPale)
  for (let i = 0; i < 5; i++) {
    disc(
      ctx,
      cx + (rng() - 0.5) * PIXEL * 1.7,
      foot - SCALE * (0.2 + rng() * 1.1),
      SCALE * 0.6,
    )
  }
}
