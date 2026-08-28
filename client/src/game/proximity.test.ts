import { describe, expect, it } from 'vitest'
import {
  IDLE_FADE,
  IDLE_REACH,
  idleMotion,
  idleMotionNear,
  isNear,
  tileDistance,
} from './proximity'

describe('idle motion', () => {
  it('runs at full strength while Koala is inside the reach', () => {
    expect(idleMotion(0)).toBe(1)
    expect(idleMotion(IDLE_REACH)).toBe(1)
    expect(idleMotion(IDLE_REACH - 0.5)).toBe(1)
  })

  it('stops dead once she is past the fade band', () => {
    expect(idleMotion(IDLE_REACH + IDLE_FADE)).toBe(0)
    expect(idleMotion(IDLE_REACH + IDLE_FADE + 4)).toBe(0)
    expect(idleMotion(999)).toBe(0)
  })

  it('eases across the band rather than snapping off', () => {
    // The whole point of the band: a bloom mid-stroke has somewhere to settle
    // to, so nothing jumps as she walks past.
    const mid = idleMotion(IDLE_REACH + IDLE_FADE / 2)
    expect(mid).toBeCloseTo(0.5)
    let last = 1
    for (let step = 0; step <= 15; step++) {
      const m = idleMotion(IDLE_REACH + (IDLE_FADE * step) / 15)
      expect(m).toBeLessThanOrEqual(last)
      last = m
    }
    expect(last).toBe(0)
  })

  it('measures from the centre of the footprint, not its corner', () => {
    // A 4×3 cottage two tiles off Koala's nose is further away than a 1×1
    // mushroom on the same corner tile, and the centres are what say so.
    const cat = { x: 10, y: 10 }
    const small = { x: 12, y: 10, w: 1, h: 1 }
    const big = { x: 12, y: 10, w: 4, h: 3 }
    expect(idleMotionNear(cat, small)).toBeGreaterThan(idleMotionNear(cat, big))
    // Standing on it is as near as it gets, whatever its size.
    expect(idleMotionNear(cat, { x: 10, y: 10, w: 1, h: 1 })).toBe(1)
  })

  it('falls off as she walks away, and never below nothing', () => {
    const obj = { x: 10, y: 10, w: 1, h: 1 }
    const near = idleMotionNear({ x: 10, y: 10 }, obj)
    const mid = idleMotionNear({ x: 13, y: 10 }, obj)
    const far = idleMotionNear({ x: 20, y: 10 }, obj)
    expect(near).toBe(1)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    expect(far).toBe(0)
  })
})

describe('near enough', () => {
  const obj = { x: 10, y: 10, w: 1, h: 1 }

  it('is the same reach the motion runs at full strength within', () => {
    // The radio asks this question and everything else asks for an amplitude,
    // but both measure to the same edge — one felt distance across the park.
    expect(isNear({ x: 10, y: 10 }, obj)).toBe(true)
    expect(isNear({ x: 10 + IDLE_REACH - 0.1, y: 10 }, obj)).toBe(true)
    expect(isNear({ x: 10 + IDLE_REACH, y: 10 }, obj)).toBe(false)
    expect(isNear({ x: 20, y: 10 }, obj)).toBe(false)
    // Everything it says yes to is moving at full strength.
    expect(idleMotionNear({ x: 10 + IDLE_REACH - 0.1, y: 10 }, obj)).toBe(1)
  })

  it('takes a reach of its own for the things that want one closer in', () => {
    // The author labels reveal at 2.2 tiles, nearer than motion starts.
    expect(isNear({ x: 12, y: 10 }, obj, 2.2)).toBe(true)
    expect(isNear({ x: 12.5, y: 10 }, obj, 2.2)).toBe(false)
  })

  it('measures the same distance the amplitude does', () => {
    const cat = { x: 8, y: 9 }
    const d = tileDistance(cat, obj)
    expect(isNear(cat, obj)).toBe(d < IDLE_REACH)
    expect(idleMotionNear(cat, obj)).toBe(idleMotion(d))
  })
})
