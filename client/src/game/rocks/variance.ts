// Per-rock variation. Rocks read at their silhouette, so the contrast that
// matters is bulk and proportion — a low wide boulder next to a tall narrow one.

import { PIXEL } from '../constants'

export interface Jitter {
  /** Width multiplier. */
  w: number
  /** Height multiplier. */
  h: number
  /** Sideways offset of the whole arrangement, in logical px. */
  lean: number
  /** A 0–1 roll for counts and for which stone gets the odd tone. */
  d: number
}

export function jitter(rng: () => number): Jitter {
  const size = 0.78 + rng() * 0.62 // 0.78–1.40
  const aspect = 0.86 + rng() * 0.3 // >1 squat and wide, <1 tall and narrow
  return {
    w: size * aspect,
    h: size / aspect,
    lean: (rng() - 0.5) * PIXEL * 0.12,
    d: rng(),
  }
}
