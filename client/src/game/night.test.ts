import { describe, expect, it } from 'vitest'
import { night } from './constants'

// night() = a purple multiply (preserves hue → dusky sage/mauve surfaces) + a violet
// lift in the deep shadows + a whiteness recovery that returns near-white to its
// original colour. Darks read violet, whites read bright, coloured surfaces stay dusky.
const rgb = (s: string) => s.match(/\d+/g)!.map(Number)

describe('night', () => {
  it('recovers pure white to itself (whiteness gate fully open)', () => {
    expect(night('#FFFFFF')).toBe('rgb(255, 255, 255)')
  })

  it('lifts black to a saturated dark violet (shadow ambient, still dark)', () => {
    expect(night('#000000')).toBe('rgb(18, 0, 48)')
  })

  it('darkens a bright surface into a cool dusky tone (not daylight)', () => {
    // grass #A8D5A2 → all channels pulled down, cool-leaning (blue ≥ red).
    const [r, g, b] = rgb(night('#A8D5A2'))
    expect(r).toBeLessThan(168)
    expect(g).toBeLessThan(213)
    expect(b).toBeGreaterThanOrEqual(r)
  })

  it('casts a violet lean on a neutral grey shadow (blue highest, green lowest)', () => {
    const [r, g, b] = rgb(night('#808080'))
    expect(b).toBeGreaterThan(r)
    expect(r).toBeGreaterThan(g)
  })

  it('treats 3-digit hex like its 6-digit form', () => {
    expect(night('#fff')).toBe(night('#ffffff'))
  })

  it('passes non-hex colours through unchanged (oklch sky, rgba shadows)', () => {
    expect(night('oklch(0.1 0.008 60)')).toBe('oklch(0.1 0.008 60)')
    expect(night('rgba(0,0,0,0.1)')).toBe('rgba(0,0,0,0.1)')
  })
})
