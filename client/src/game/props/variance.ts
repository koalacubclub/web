// Per-pond variation. A pond reads at its outline, so what varies is the basin's
// proportions — a wide shallow pool next to a long narrow one — plus how much
// planting sits at its edge.

import { PIXEL } from '../constants'

export interface Jitter {
  /** Width multiplier for the basin. */
  w: number
  /** Height (depth-into-the-screen) multiplier. */
  h: number
  /** Sideways offset of the whole pond, in logical px. */
  lean: number
  /** A 0–1 roll for counts — rim stones, reeds, lily pads. */
  d: number
}

export function jitter(rng: () => number): Jitter {
  const size = 0.86 + rng() * 0.34 // 0.86–1.20; a pond is a dug basin, not a tree
  const aspect = 0.9 + rng() * 0.2
  return {
    w: size * aspect,
    h: size / aspect,
    lean: (rng() - 0.5) * PIXEL * 0.12,
    d: rng(),
  }
}
