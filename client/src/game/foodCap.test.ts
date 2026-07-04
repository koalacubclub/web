import { describe, expect, it } from 'vitest'
import { foodCap } from '@koala/shared'

// The collectible cap scales with the crowd: ~half the players, rounded up.
// The server enforces this against its live socket count; the solo client uses
// foodCap(1).
describe('foodCap', () => {
  it('is half the players, rounded up', () => {
    expect(foodCap(1)).toBe(1)
    expect(foodCap(2)).toBe(1)
    expect(foodCap(3)).toBe(2)
    expect(foodCap(4)).toBe(2)
    expect(foodCap(10)).toBe(5)
  })

  it('is 0 with no players (no one to spawn for)', () => {
    expect(foodCap(0)).toBe(0)
  })
})
