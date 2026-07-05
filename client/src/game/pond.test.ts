import { describe, expect, it } from 'vitest'
import { PIXEL } from './constants'
import { pondGeom, pondStones } from './pond'

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
