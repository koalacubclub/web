import { describe, expect, it } from 'vitest'
import { PIXEL } from './constants'
import {
  pondGeom,
  pondStones,
  objectReflectsInPond,
  catReflectAxis,
  type ReflectBox,
} from './pond'

// A generous visible range so the on-screen check never culls in these tests.
const ALL_VISIBLE = { left: -1e9, right: 1e9 }
const box = (o: Partial<ReflectBox>): ReflectBox => ({
  type: 'tree',
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  ...o,
})

describe('pondGeom', () => {
  it('centers the ellipse over the pond footprint', () => {
    const g = pondGeom(10, 4)
    expect(g.cx).toBe(10 * PIXEL + PIXEL * 1.5)
    expect(g.cy).toBe(4 * PIXEL + PIXEL)
    expect(g.rx).toBe(PIXEL * 1.4)
    expect(g.ry).toBe(PIXEL * 0.8)
  })
})

describe('pondStones', () => {
  it('is deterministic for a given tile (stable frame-to-frame)', () => {
    expect(pondStones(10, 4)).toEqual(pondStones(10, 4))
  })

  it('varies between ponds at different tiles', () => {
    expect(pondStones(10, 4)).not.toEqual(pondStones(11, 4))
  })

  it('lays down 8–11 stones', () => {
    for (let x = 0; x < 20; x++) {
      const n = pondStones(x, 3).length
      expect(n).toBeGreaterThanOrEqual(8)
      expect(n).toBeLessThanOrEqual(11)
    }
  })

  it('hugs the rim — every stone sits near the waterline, not floating away', () => {
    const g = pondGeom(10, 4)
    for (const s of pondStones(10, 4)) {
      // Normalized elliptical radius of the stone's center: spread ∈ [0.82, 0.98].
      const nx = (s.x - g.cx) / g.rx
      const ny = (s.y - g.cy) / g.ry
      const spread = Math.hypot(nx, ny)
      expect(spread).toBeGreaterThanOrEqual(0.82 - 1e-9)
      expect(spread).toBeLessThanOrEqual(0.98 + 1e-9)
    }
  })

  it('produces varied sizes (not a uniform ring)', () => {
    const sizes = pondStones(10, 4).map((s) => s.rx)
    expect(new Set(sizes.map((r) => r.toFixed(3))).size).toBeGreaterThan(1)
  })
})

// Pond at tile (10, 4): center ~11.5 tiles across, water spans ~9.1–13.9 tiles;
// reflectable band above the water is oBase ∈ ~[1.2, 5.8] tiles.
describe('objectReflectsInPond', () => {
  it('reflects scenery over the water and just above the waterline', () => {
    expect(objectReflectsInPond(box({ x: 11, y: 4 }), 10, 4, ALL_VISIBLE)).toBe(
      true,
    )
  })

  it('does not reflect ponds themselves', () => {
    expect(
      objectReflectsInPond(
        box({ type: 'pond', x: 11, y: 4 }),
        10,
        4,
        ALL_VISIBLE,
      ),
    ).toBe(false)
  })

  it('rejects objects beside, below, or far above the pond', () => {
    expect(objectReflectsInPond(box({ x: 30, y: 4 }), 10, 4, ALL_VISIBLE)).toBe(
      false,
    ) // off to the side
    expect(objectReflectsInPond(box({ x: 11, y: 6 }), 10, 4, ALL_VISIBLE)).toBe(
      false,
    ) // below/in front of the water
    expect(objectReflectsInPond(box({ x: 11, y: 0 }), 10, 4, ALL_VISIBLE)).toBe(
      false,
    ) // too far above → reflection would clip away
  })

  it('rejects objects that are off screen', () => {
    const offRight = { left: 0, right: 1 }
    expect(objectReflectsInPond(box({ x: 11, y: 4 }), 10, 4, offRight)).toBe(
      false,
    )
  })
})

describe('catReflectAxis', () => {
  it('returns the feet-line for a cat standing over the pond', () => {
    expect(catReflectAxis(11, 4, 10, 4)).toBe((4 + 0.95) * PIXEL)
  })

  it('is null for a cat away from the water or below it', () => {
    expect(catReflectAxis(30, 4, 10, 4)).toBeNull() // off to the side
    expect(catReflectAxis(11, 6, 10, 4)).toBeNull() // below the pond
  })
})
