// Weeping willow. The cascade IS the tree: a filled curtain whose top is the
// crown dome and whose hem is scalloped by the strand ends, strands raked down
// over it from right across the crown, and a cave left in the middle of the hem
// so the trunk shows through the way it does under a real willow.
//
//   form 0 — great dome: wider than tall, hem almost on the grass.
//   form 1 — young: narrower, crown held higher, far more trunk showing.

import { PIXEL, SCALE } from '../constants'
import { disc, jitter, trunkScale } from './variance'
import type { Ctx, DrawArgs } from './types'

export const WILLOW_TONES = {
  trunk: '#7A5A12',
  dark: '#548F4E',
  mid: '#6FAB5C',
  light: '#97C877',
}

/** Hem segments; more would blur the scallops at this scale, fewer look cut. */
const SEGS = 9

export function drawWillow(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: DrawArgs,
): void {
  const t = WILLOW_TONES
  const j = jitter(rng)
  const foot = py + PIXEL * 2
  const cx = px + PIXEL + j.lean * 0.4
  const great = form === 0
  const half = PIXEL * (great ? 1.0 : 0.74) * j.w
  const hemY = foot - PIXEL * (great ? 0.02 : 0.5) * j.h
  // The curtain's depth is the roll; the trunk in the cave stays much the same.
  const crownY = hemY - PIXEL * (great ? 1.52 : 1.12) * j.h
  const strands = great ? 22 + Math.round(j.d * 8) : 15 + Math.round(j.d * 6)
  const ts = trunkScale(j)
  const trunkH = PIXEL * (great ? 0.9 : 1.2) * ts

  // Hem: deepest in the middle, drawing in at the rim, with a cave at the centre.
  const hem: { x: number; y: number }[] = []
  for (let i = 0; i <= SEGS; i++) {
    const f = i / SEGS
    const bell = Math.sin(f * Math.PI)
    const cave = Math.exp(-Math.pow((f - 0.5) / 0.13, 2))
    hem.push({
      x: cx + (f - 0.5) * 2 * half,
      y:
        hemY -
        PIXEL * (0.62 - bell * 0.54 + cave * 0.5) * j.h -
        rng() * PIXEL * 0.12,
    })
  }

  // Trunk first: the cave in the hem leaves its lower half showing, and the
  // curtain covers where it ends — a trunk painted on top reads as a cut stump.
  ctx.fillStyle = ink(t.trunk)
  ctx.beginPath()
  ctx.moveTo(cx - PIXEL * 0.24 * ts, foot)
  ctx.lineTo(cx - PIXEL * 0.12 * ts, foot - trunkH)
  ctx.lineTo(cx + PIXEL * 0.12 * ts, foot - trunkH)
  ctx.lineTo(cx + PIXEL * 0.24 * ts, foot)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = ink(t.dark)
  ctx.beginPath()
  ctx.moveTo(hem[0].x, hem[0].y)
  ctx.lineTo(cx - half, crownY + PIXEL * 0.2)
  ctx.quadraticCurveTo(
    cx - half * 0.98,
    crownY - PIXEL * 0.6,
    cx - half * 0.46,
    crownY - PIXEL * 0.76,
  )
  ctx.quadraticCurveTo(
    cx - half * 0.04,
    crownY - PIXEL * 0.92,
    cx + half * 0.44,
    crownY - PIXEL * 0.72,
  )
  ctx.quadraticCurveTo(
    cx + half * 0.98,
    crownY - PIXEL * 0.54,
    cx + half,
    crownY + PIXEL * 0.2,
  )
  ctx.lineTo(hem[SEGS].x, hem[SEGS].y)
  for (let i = SEGS; i > 0; i--) {
    const a = hem[i]
    const b = hem[i - 1]
    ctx.quadraticCurveTo(
      (a.x + b.x) / 2,
      Math.max(a.y, b.y) + PIXEL * 0.22,
      b.x,
      b.y,
    )
  }
  ctx.closePath()
  ctx.fill()

  // Strands falling from right across the crown — not converging on the middle,
  // which is what makes a weeping tree read as a mop.
  ctx.lineCap = 'round'
  for (let i = 0; i < strands; i++) {
    const f = (i + 0.5) / strands
    const bell = Math.sin(f * Math.PI)
    const cave = Math.exp(-Math.pow((f - 0.5) / 0.11, 2))
    const sx = cx + (f - 0.5) * 2 * half * 0.8
    const sy = crownY - PIXEL * (0.18 + bell * 0.46) * j.h
    const ex = cx + (f - 0.5) * 2 * half * (0.9 + rng() * 0.12)
    const ey =
      hemY -
      PIXEL * (0.54 - bell * 0.5 + cave * 0.62) * j.h -
      rng() * PIXEL * 0.22
    ctx.strokeStyle = ink(i % 4 === 0 ? t.light : t.mid)
    ctx.lineWidth = SCALE * (i % 4 === 0 ? 0.9 : 0.7)
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.quadraticCurveTo(sx + (ex - sx) * 0.9, sy + (ey - sy) * 0.5, ex, ey)
    ctx.stroke()
  }

  // Light on the crown's shoulder.
  ctx.fillStyle = ink(t.light)
  disc(ctx, cx - half * 0.42, crownY - PIXEL * 0.46, PIXEL * 0.3 * j.w)
  disc(ctx, cx + half * 0.06, crownY - PIXEL * 0.6, PIXEL * 0.26 * j.w)
  disc(ctx, cx + half * 0.56, crownY - PIXEL * 0.36, PIXEL * 0.2 * j.w)
}
