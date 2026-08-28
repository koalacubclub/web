// Daisies: a ring of white petals round a yellow eye, on thin stems. The closest
// species to the park's existing bloom, and the one that reads at any size.
//
//   form 0 — standing: fewer, taller stems.
//   form 1 — carpet: many short ones, low to the grass.

import { PIXEL, SCALE } from '../constants'
import { bob, disc, jitter, stem } from './variance'
import type { Ctx, DrawArgs } from './types'

export const DAISY_TONES = {
  stem: '#4E9150',
  leaf: '#63B85E',
  petal: '#FFFFFF',
  petalPink: '#FFE3EC',
  eye: '#FFD93D',
}

export function drawDaisy(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink, frameCount, sway }: DrawArgs,
): void {
  const t = DAISY_TONES
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean * 0.5
  const standing = form === 0
  const count = standing ? 3 + Math.round(j.d * 2) : 5 + Math.round(j.d * 4)
  const spread = PIXEL * (standing ? 0.34 : 0.46) * j.w
  const stemH = PIXEL * (standing ? 0.62 : 0.34) * j.h
  const petalR = SCALE * 1.15 * j.bloom

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.5 : i / (count - 1)
    const bx = cx + (f - 0.5) * 2 * spread + (rng() - 0.5) * PIXEL * 0.06
    const h = stemH * (0.7 + rng() * 0.6)
    const by = foot - h + bob(frameCount, i * 1.4 + px * 0.05, sway)
    ctx.strokeStyle = ink(t.stem)
    stem(ctx, bx + (rng() - 0.5) * SCALE, foot, bx, by + petalR, SCALE * 0.7)
    // A leaf on some stems, never all.
    if (rng() < 0.45) {
      ctx.fillStyle = ink(t.leaf)
      ctx.beginPath()
      ctx.ellipse(
        bx + (rng() < 0.5 ? -1 : 1) * SCALE * 1.2,
        foot - h * 0.35,
        SCALE * 1.3,
        SCALE * 0.6,
        rng() - 0.5,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    // Petals, bright and un-graded so they pop at night.
    ctx.fillStyle = rng() < 0.25 ? t.petalPink : t.petal
    const petals = 6
    const turn = rng() * Math.PI
    for (let k = 0; k < petals; k++) {
      const a = turn + (k / petals) * Math.PI * 2
      disc(
        ctx,
        bx + Math.cos(a) * petalR,
        by + Math.sin(a) * petalR * 0.9,
        petalR * 0.62,
      )
    }
    ctx.fillStyle = t.eye
    disc(ctx, bx, by, petalR * 0.55)
  }
}
