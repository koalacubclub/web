import { describe, expect, it } from 'vitest'
import { JUMP_DURATION_MS } from '@koala/shared'
import { jumpLiftTiles } from './jump'

// The jump arc is the core of the ability: a parabola that lifts the koala mid-
// flight and is 0 (grounded) outside its window. Guards the load-time sentinel
// regression — the koala's jumpAt inits to -Infinity, not 0 (performance.now()'s
// origin is page load, so 0 would read as "jumped at load").
describe('jumpLiftTiles', () => {
  it('is 0 for the "never jumped" sentinel (-Infinity), even early after load', () => {
    expect(jumpLiftTiles(-Infinity, 5)).toBe(0)
    expect(jumpLiftTiles(-Infinity, 300)).toBe(0)
  })

  it('lifts the koala during the flight window and peaks at mid-flight', () => {
    const start = 1000
    expect(jumpLiftTiles(start, start)).toBe(0) // t=0 → grounded
    expect(jumpLiftTiles(start, start + JUMP_DURATION_MS)).toBe(0) // t=1 → landed
    const peak = jumpLiftTiles(start, start + JUMP_DURATION_MS / 2)
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeGreaterThan(
      jumpLiftTiles(start, start + JUMP_DURATION_MS / 4),
    )
  })

  it('is grounded after the window closes', () => {
    const start = 1000
    expect(jumpLiftTiles(start, start + JUMP_DURATION_MS + 1)).toBe(0)
  })
})
