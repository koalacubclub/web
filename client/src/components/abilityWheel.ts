// Geometry for the on-screen ability wheel (see GamerControls). Kept in its own
// module so the pure math is unit-testable and GamerControls stays
// components-only (fast-refresh friendly).

// The main abilities fan evenly across [ARC_FROM, ARC_TO], symmetric about 135° —
// the corner diagonal the Jump sits on — so the icons stay mirror-balanced with
// equal gaps and equal radius no matter how many there are. (Add or remove one and
// the spacing rebalances itself; it used to be centred off-diagonal to
// counterweight a tiny meow button that tucked into the lower-left, now gone.)
export const ARC_FROM = 90 //  deg of the first button (straight above Jump)
export const ARC_TO = 180 //   deg of the last (straight left of Jump)

/**
 * Even angle for the i-th of n buttons across [ARC_FROM, ARC_TO]; a lone button
 * sits on the midpoint (the diagonal).
 */
export function arcDeg(i: number, n: number): number {
  if (n <= 1) return (ARC_FROM + ARC_TO) / 2
  return ARC_FROM + ((ARC_TO - ARC_FROM) * i) / (n - 1)
}
