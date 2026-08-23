// Maple in autumn: a dense crown with a ragged leafy outline, deep red pooling at
// the rim, hotter orange and gold higher up, over a clear straight trunk, with
// leaves already drifted around its foot.
//
//   form 0 — tall oval: noticeably taller than wide.
//   form 1 — broad crown: shorter, spreading instead of climbing.

import { PIXEL, SCALE } from '../constants'
import { disc, jitter, trunkScale } from './variance'
import type { Ctx, DrawArgs } from './types'

export const MAPLE_TONES = {
  trunk: '#6B4E18',
  deep: '#96331F',
  dark: '#BE4726',
  light: '#E0692C',
  glow: '#EFA83A',
}

export function drawMaple(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: DrawArgs,
): void {
  const t = MAPLE_TONES
  const j = jitter(rng)
  const foot = py + PIXEL * 2
  const cx = px + PIXEL + j.lean * 0.4
  const tall = form === 0
  const halfW = PIXEL * (tall ? 0.78 : 0.99) * j.w
  // A near-constant clear trunk, with the crown's whole depth taking the roll —
  // so two maples differ in canopy volume, not in leg length.
  const ts = trunkScale(j)
  const botY = foot - PIXEL * (tall ? 0.9 : 0.76) * ts
  const topY = botY - PIXEL * (tall ? 1.6 : 1.38) * j.h
  const midY = (topY + botY) / 2
  const ryC = (botY - topY) / 2

  // Straight trunk, first limbs disappearing into the crown.
  ctx.fillStyle = ink(t.trunk)
  ctx.fillRect(
    cx - PIXEL * 0.1 * ts,
    botY - PIXEL * 0.15,
    PIXEL * 0.2 * ts,
    foot - botY + PIXEL * 0.15,
  )
  ctx.strokeStyle = ink(t.trunk)
  ctx.lineCap = 'round'
  ctx.lineWidth = PIXEL * 0.08 * ts
  ctx.beginPath()
  ctx.moveTo(cx, botY)
  ctx.lineTo(cx - PIXEL * 0.26, botY - PIXEL * 0.3)
  ctx.moveTo(cx, botY)
  ctx.lineTo(cx + PIXEL * 0.28, botY - PIXEL * 0.32)
  ctx.stroke()

  ctx.fillStyle = ink(t.dark)
  ctx.beginPath()
  ctx.ellipse(cx, midY, halfW, ryC, 0, 0, Math.PI * 2)
  ctx.fill()

  // Leafy outline: bumps round the rim, lighter across the top.
  const bumps = 12 + Math.floor(j.d * 5)
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 + rng() * 0.2
    ctx.fillStyle = ink(Math.sin(a) < -0.25 ? t.light : t.dark)
    disc(
      ctx,
      cx + Math.cos(a) * halfW * 0.92,
      midY + Math.sin(a) * ryC * 0.92,
      PIXEL * (0.12 + rng() * 0.09) * j.w,
    )
  }

  ctx.fillStyle = ink(t.light)
  disc(ctx, cx - halfW * 0.28, midY - ryC * 0.5, PIXEL * 0.44 * j.w)
  disc(ctx, cx + halfW * 0.34, midY - ryC * 0.36, PIXEL * 0.4 * j.w)
  disc(ctx, cx - halfW * 0.02, midY - ryC * 0.02, PIXEL * 0.34 * j.w)
  ctx.fillStyle = ink(t.deep)
  disc(ctx, cx - halfW * 0.42, midY + ryC * 0.5, PIXEL * 0.25 * j.w)
  disc(ctx, cx + halfW * 0.44, midY + ryC * 0.46, PIXEL * 0.23 * j.w)
  ctx.fillStyle = ink(t.glow)
  disc(ctx, cx + halfW * 0.08, midY - ryC * 0.56, PIXEL * 0.16 * j.w)
  disc(ctx, cx - halfW * 0.42, midY - ryC * 0.06, PIXEL * 0.12 * j.w)

  // Fallen leaves at the foot.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = ink(i % 2 ? t.light : t.glow)
    ctx.beginPath()
    ctx.ellipse(
      cx + (rng() - 0.5) * PIXEL * 1.8,
      foot - SCALE * (0.2 + rng() * 1.1),
      SCALE * 1.4,
      SCALE * 0.65,
      (rng() - 0.5) * 1.2,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
}
