import { describe, expect, it } from 'vitest'
import { SLAP_DURATION_MS } from '@koala/shared'
import { slapPhase, slapSwing } from './slap'

// The swipe is an out-and-back arc that peaks mid-swing and is 0 (idle) outside
// its window. Guards the load-time sentinel regression — slapAt inits to
// -Infinity, not 0 (performance.now()'s origin is page load).
describe('slap animation', () => {
  it('is idle for the "never slapped" sentinel (-Infinity)', () => {
    expect(slapPhase(-Infinity, 5)).toBe(0)
    expect(slapSwing(-Infinity, 300)).toBe(0)
  })

  it('runs 0→1 through the window, then idles', () => {
    const start = 1000
    expect(slapPhase(start, start)).toBe(0) // t=0 boundary → idle
    expect(slapPhase(start, start + SLAP_DURATION_MS / 2)).toBeCloseTo(0.5)
    expect(slapPhase(start, start + SLAP_DURATION_MS)).toBe(0) // t=1 → done
    expect(slapPhase(start, start + SLAP_DURATION_MS + 1)).toBe(0)
  })

  it('swings out and back, peaking at mid-swing', () => {
    const start = 1000
    const peak = slapSwing(start, start + SLAP_DURATION_MS / 2)
    expect(peak).toBeCloseTo(1, 5)
    expect(peak).toBeGreaterThan(slapSwing(start, start + SLAP_DURATION_MS / 4))
    expect(peak).toBeGreaterThan(
      slapSwing(start, start + (SLAP_DURATION_MS * 3) / 4),
    )
    expect(slapSwing(start, start + SLAP_DURATION_MS + 1)).toBe(0)
  })
})
