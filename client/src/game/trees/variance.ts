// Per-individual variation, shared by every species: the two forms give a tree
// its build, and this gives each tree its own proportions inside that build so a
// row of three maples doesn't read as one maple stamped three times.

import { PIXEL } from '../constants'
import type { Ctx } from './types'

export interface Jitter {
  /** Width multiplier for the crown and its detail. */
  w: number
  /** Height multiplier for the crown and trunk. */
  h: number
  /** Sideways offset of the whole tree, in logical px. */
  lean: number
  /** A spare 0–1 roll, used for counts (how many lobes, blooms, bumps). */
  d: number
}

/**
 * Rolls one tree's proportions off its seeded rng. Kept to ±7% on each axis:
 * enough that neighbours differ, small enough that a species still reads as
 * itself and the 2×2 footprint stays honest.
 */
export function jitter(rng: () => number): Jitter {
  return {
    w: 0.93 + rng() * 0.15,
    h: 0.93 + rng() * 0.15,
    lean: (rng() - 0.5) * PIXEL * 0.14,
    d: rng(),
  }
}

/** Filled circle — the workhorse of every canopy in here. */
export function disc(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}
