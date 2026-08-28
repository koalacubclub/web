// Bluebells: arching stems with bells hanging in a row down one side. The only
// species whose blooms point DOWN, which is what makes a patch of them read as
// bluebells and not as blue daisies.
//
//   form 0 — arching: tall stems bowed over, four or five bells each.
//   form 1 — clumped: shorter and denser, fewer bells per stem.

import { PIXEL, SCALE } from '../constants'
import { bob, jitter } from './variance'
import type { Ctx, DrawArgs } from './types'

export const BLUEBELL_TONES = {
  stem: '#4C8B57',
  bell: '#6C7BE0',
  bellPale: '#9AA6F2',
}

export function drawBluebell(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink, frameCount, sway }: DrawArgs,
): void {
  const t = BLUEBELL_TONES
  const j = jitter(rng)
  const foot = py + PIXEL
  const cx = px + PIXEL * 0.5 + j.lean * 0.5
  const arching = form === 0
  const stems = arching ? 3 + Math.round(j.d * 2) : 4 + Math.round(j.d * 3)
  const spread = PIXEL * (arching ? 0.3 : 0.42) * j.w
  const stemH = PIXEL * (arching ? 0.76 : 0.5) * j.h

  for (let i = 0; i < stems; i++) {
    const f = stems === 1 ? 0.5 : i / (stems - 1)
    const bx = cx + (f - 0.5) * 2 * spread
    const h = stemH * (0.76 + rng() * 0.48)
    const side = rng() < 0.5 ? -1 : 1
    const bow = side * PIXEL * (arching ? 0.22 : 0.1) * (0.7 + rng() * 0.6)
    const nod = bob(frameCount, i * 1.6 + px * 0.05, sway) * 0.5
    const topX = bx + bow + nod
    const topY = foot - h

    ctx.strokeStyle = ink(t.stem)
    ctx.lineCap = 'round'
    ctx.lineWidth = SCALE * 0.6
    ctx.beginPath()
    ctx.moveTo(bx, foot)
    ctx.quadraticCurveTo(bx, foot - h * 0.75, topX, topY)
    ctx.stroke()

    // Bells hung along the arch, biggest nearest the bend.
    const bells = arching
      ? 3 + Math.round(rng() * 2)
      : 2 + Math.round(rng() * 2)
    for (let k = 0; k < bells; k++) {
      const kf = (k + 1) / (bells + 1)
      // Point on the stem's curve.
      const hx =
        (1 - kf) * (1 - kf) * bx + 2 * (1 - kf) * kf * bx + kf * kf * topX
      const hy =
        (1 - kf) * (1 - kf) * foot +
        2 * (1 - kf) * kf * (foot - h * 0.75) +
        kf * kf * topY
      const r = SCALE * (1.25 - kf * 0.3) * j.bloom
      // A short pedicel out from the stem, then the bell hanging below it —
      // drawn straight down, never rotated, so it reads as hanging rather than
      // as a leaf lying along the stalk.
      const hangX = hx + side * r * 0.85
      ctx.strokeStyle = ink(t.stem)
      ctx.lineWidth = SCALE * 0.35
      ctx.beginPath()
      ctx.moveTo(hx, hy)
      ctx.lineTo(hangX, hy + r * 0.3)
      ctx.stroke()
      ctx.fillStyle = k % 3 === 0 ? t.bellPale : t.bell
      ctx.beginPath()
      ctx.ellipse(hangX, hy + r * 0.95, r * 0.6, r * 0.8, 0, 0, Math.PI * 2)
      ctx.fill()
      // The flared mouth at the bell's lower lip.
      ctx.beginPath()
      ctx.ellipse(hangX, hy + r * 1.6, r * 0.68, r * 0.3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = ink(t.stem)
      ctx.lineWidth = SCALE * 0.6
    }
  }
}
