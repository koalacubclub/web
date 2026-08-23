// Per-individual variation, shared by every species: the two forms give a tree
// its build, and this gives each tree its own proportions inside that build so a
// row of three maples doesn't read as one maple stamped three times.

import { PIXEL } from '../constants'
import type { Ctx } from './types'

export interface Jitter {
  /** Width multiplier for the crown and its detail. */
  w: number
  /** Height multiplier for the crown and the trunk under it. */
  h: number
  /** Sideways offset of the whole tree, in logical px. */
  lean: number
  /** A spare 0–1 roll, used for counts (how many lobes, blooms, bumps). */
  d: number
}

/**
 * Rolls one tree's proportions off its seeded rng.
 *
 * Two independent rolls, not one: an overall **size** (0.78–1.50) sets how much
 * tree there is, and an **aspect** bias then trades width against height — so a
 * big tree can be a broad low dome or a narrow tall one, rather than every tree
 * being the same shape at a different zoom. Multiplied out, crowns run roughly
 * 0.72×–1.62× on each axis: the biggest is about twice the smallest across, and
 * several times its volume, which is what makes neighbours read as different
 * trees rather than one tree redrawn. Crowns overhang the 2×2 footprint at the
 * top of that range — as the park's existing tree art already does.
 *
 * Species measure everything up from the trunk's foot, so a tree always stands
 * on the ground. The crown takes the full roll; the trunk takes `trunkScale`,
 * which is deliberately damped — a park's trunks are much of a muchness, and
 * it's the crown that makes two neighbours read as different trees.
 *
 * `sizeBoost` multiplies the size roll for ONE tree, for the odd specimen the map
 * wants noticeably bigger (or smaller) than whatever it happened to roll. It goes
 * through the same roll rather than scaling the finished drawing, so the boosted
 * tree keeps the damped trunk and the aspect bias it would have had — a big tree,
 * not a small tree zoomed. Prefer widening the range above if EVERY tree should
 * vary more; this is for singling one out.
 */
export function jitter(rng: () => number, sizeBoost = 1): Jitter {
  const size = (0.78 + rng() * 0.72) * sizeBoost
  const aspect = 0.92 + rng() * 0.16 // >1 leans wide, <1 leans tall
  return {
    w: size * aspect,
    h: size / aspect,
    lean: (rng() - 0.5) * PIXEL * 0.2,
    d: rng(),
  }
}

/** Filled circle — the workhorse of every canopy in here. */
export function disc(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * How much a trunk varies: 35% of the crown's roll, applied to both its length
 * and its thickness. Trunks stay in a narrow band so the contrast between
 * neighbours lands in the canopy, where it reads — but a big crown still gets a
 * slightly stouter stem instead of balancing on a spindle.
 */
export function trunkScale(j: Jitter): number {
  return 1 + (j.h - 1) * 0.35
}
