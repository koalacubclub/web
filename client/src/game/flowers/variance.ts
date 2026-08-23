// Per-patch variation, shared by every flower species. Same idea as the trees'
// `variance.ts`, tuned for something a twentieth the size: a patch's contrast
// comes from how MANY stems it has and how tall they stand, more than from the
// size of an individual bloom — a giant daisy reads as a mistake, a tall thick
// clump next to a sparse short one reads as two patches.

import { PIXEL } from '../constants'
import type { Ctx } from './types'

export interface Jitter {
  /** How wide the patch spreads across its tile. */
  w: number
  /** How tall the stems stand. */
  h: number
  /** Sideways offset of the whole patch, in logical px. */
  lean: number
  /** A 0–1 roll for counts — how many stems this patch puts up. */
  d: number
  /** Bloom size, deliberately narrow: flowers of a species are much of a size. */
  bloom: number
}

export function jitter(rng: () => number): Jitter {
  const size = 0.8 + rng() * 0.6 // 0.80–1.40
  const aspect = 0.9 + rng() * 0.2
  return {
    w: size * aspect,
    h: size / aspect,
    lean: (rng() - 0.5) * PIXEL * 0.16,
    d: rng(),
    bloom: 0.88 + rng() * 0.26,
  }
}

/** The park's bloom bob: a slow sway, phase-shifted per stem. */
export function bob(frameCount: number, phase: number): number {
  return Math.sin(frameCount * 0.05 + phase) * 2
}

/** Filled circle. */
export function disc(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

/** A stem, drawn as a slight curve so a patch isn't a row of matchsticks. */
export function stem(
  ctx: Ctx,
  x: number,
  footY: number,
  topX: number,
  topY: number,
  width: number,
): void {
  ctx.lineCap = 'round'
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x, footY)
  ctx.quadraticCurveTo(x + (topX - x) * 0.3, (footY + topY) / 2, topX, topY)
  ctx.stroke()
}
