import { describe, expect, it } from 'vitest'
import { arcDeg } from './abilityWheel'

// The ability wheel fans the main abilities evenly across [ARC_FROM, ARC_TO],
// symmetric about 135° (the corner diagonal the Jump sits on). This guards the
// "proportional gaps around Jump" layout so removing/adding a spell can't quietly
// re-tilt it (as the meow removal once did). ARC_FROM/ARC_TO are 95°/175°.
describe('arcDeg (ability wheel geometry)', () => {
  it('pins the endpoints to the configured range', () => {
    expect(arcDeg(0, 3)).toBe(95)
    expect(arcDeg(2, 3)).toBe(175)
  })

  it('centres a lone button on the diagonal', () => {
    expect(arcDeg(0, 1)).toBe(135)
  })

  it('spaces buttons evenly and symmetric about 135°', () => {
    const n = 3
    const angles = Array.from({ length: n }, (_, i) => arcDeg(i, n))
    // Middle button lands on the diagonal.
    expect(angles[1]).toBe(135)
    // Equal gaps between neighbours.
    const gaps = angles.slice(1).map((a, i) => a - angles[i])
    expect(new Set(gaps).size).toBe(1)
    // First/last are mirror images across 135°.
    expect(135 - angles[0]).toBe(angles[n - 1] - 135)
  })

  it('stays evenly spaced for any count (rebalances itself)', () => {
    for (const n of [2, 4, 5]) {
      const angles = Array.from({ length: n }, (_, i) => arcDeg(i, n))
      const gaps = angles.slice(1).map((a, i) => +(a - angles[i]).toFixed(6))
      expect(new Set(gaps).size).toBe(1)
      expect(angles[0]).toBe(95)
      expect(angles[n - 1]).toBe(175)
    }
  })
})
