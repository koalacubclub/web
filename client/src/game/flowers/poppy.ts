// Poppies: wide open blooms with a dark eye, nodding on thin wiry stems. The
// loosest patch — stems curve, blooms tilt, nothing lines up.
//
//   form 0 — nodding: tall stems with the heads leaning over.
//   form 1 — bushy: shorter, more of them, heads held up.

import { PIXEL, SCALE } from '../constants'
import { bob, disc, jitter, stem } from './variance'
import type { Ctx, DrawArgs } from './types'

export const POPPY_TONES = {
  stem: '#5B8F4A',
  petals: ['#E8402F', '#FF6A4D', '#F2704F'],
  eye: '#2E2430',
  pollen: '#FFD93D',
}

export function drawPoppy(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink, frameCount, sway }: DrawArgs,
): void {
  const t = POPPY_TONES
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean * 0.5
  const nodding = form === 0
  const count = nodding ? 3 + Math.round(j.d * 2) : 4 + Math.round(j.d * 3)
  const spread = PIXEL * (nodding ? 0.32 : 0.46) * j.w
  const stemH = PIXEL * (nodding ? 0.74 : 0.44) * j.h
  const petalR = SCALE * 1.9 * j.bloom

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.5 : i / (count - 1)
    const bx = cx + (f - 0.5) * 2 * spread
    const h = stemH * (0.72 + rng() * 0.56)
    // A nodding head hangs off to one side of its stem's foot.
    const nod = (nodding ? 1 : 0.35) * (rng() - 0.5) * PIXEL * 0.24
    const by = foot - h + bob(frameCount, i * 1.1 + px * 0.05, sway)

    ctx.strokeStyle = ink(t.stem)
    stem(ctx, bx, foot, bx + nod, by + petalR * 0.6, SCALE * 0.6)

    // Four overlapping petals make a round, slightly ragged bloom.
    ctx.fillStyle = t.petals[Math.floor(rng() * t.petals.length)]
    const turn = rng() * Math.PI
    for (let k = 0; k < 4; k++) {
      const a = turn + (k / 4) * Math.PI * 2
      disc(
        ctx,
        bx + nod + Math.cos(a) * petalR * 0.42,
        by + Math.sin(a) * petalR * 0.36,
        petalR * 0.72,
      )
    }
    ctx.fillStyle = t.eye
    disc(ctx, bx + nod, by, petalR * 0.36)
    ctx.fillStyle = t.pollen
    disc(ctx, bx + nod, by, petalR * 0.15)
  }
}
