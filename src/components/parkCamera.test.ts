import { describe, expect, it } from 'vitest'
import { cameraPan } from './parkCamera'

describe('cameraPan', () => {
  it('does not pan when the canvas fits within the viewport', () => {
    // Smaller canvas, exactly equal, and within the sub-px slop all "fit".
    expect(cameraPan(0.5, 1000, 800, 960)).toEqual({
      translate: 0,
      hudShift: 0,
    })
    expect(cameraPan(0.9, 1000, 1000, 960)).toEqual({
      translate: 0,
      hudShift: 0,
    })
    expect(cameraPan(0.9, 1000, 1000.4, 960)).toEqual({
      translate: 0,
      hudShift: 0,
    })
  })

  it('clamps at the leading edge when the point is near the start', () => {
    // Cat far left: canvas left edge aligns to viewport left, HUD not shifted.
    const pan = cameraPan(0.025, 500, 1000, 960)
    expect(pan.translate).toBe(250)
    expect(pan.hudShift).toBeCloseTo(0)
  })

  it('clamps at the trailing edge when the point is near the end', () => {
    // Cat far right: canvas right edge aligns to viewport right (the old bug was
    // stopping short of here); HUD counter-shifted to stay pinned.
    const pan = cameraPan(0.975, 500, 1000, 960)
    expect(pan.translate).toBe(-250)
    expect(pan.hudShift).toBeCloseTo(480)
  })

  it('does not scroll past the far edge even if the point is out of range', () => {
    const atEdge = cameraPan(0.975, 500, 1000, 960).translate
    expect(cameraPan(1.5, 500, 1000, 960).translate).toBe(atEdge)
    expect(cameraPan(3, 500, 1000, 960).translate).toBe(atEdge)
  })

  it('follows the point between the clamps', () => {
    const pan = cameraPan(0.6, 500, 1000, 960)
    expect(pan.translate).toBe(-100)
    expect(pan.hudShift).toBeCloseTo(336)
  })

  it('keeps the panned canvas edge within the viewport (never leaves a gap)', () => {
    const viewport = 500
    const display = 1000
    const centered = (viewport - display) / 2
    for (let frac = 0; frac <= 1.0001; frac += 0.05) {
      const edge = centered + cameraPan(frac, viewport, display, 960).translate
      // Leading edge stays within [viewport - display, 0] — no gap on either side.
      expect(edge).toBeLessThanOrEqual(1e-9)
      expect(edge).toBeGreaterThanOrEqual(viewport - display - 1e-9)
    }
  })

  it('works identically on the vertical axis', () => {
    // The same pure function drives the vertical pan on short viewports.
    const pan = cameraPan(0.5, 400, 720, 720)
    expect(pan.translate).toBe(0)
    expect(pan.hudShift).toBeCloseTo(160)
  })

  it('regression: a scrollbar-inflated viewport under-pans at the trailing edge', () => {
    // The bug: measuring the viewport with window.innerWidth (which *includes*
    // the vertical scrollbar) makes the trailing clamp stop short, so the cat
    // slides off-screen. The fix measures the scrollbar-excluded parent box.
    const correct = cameraPan(0.975, 500, 1000, 960).translate // parent width
    const inflated = cameraPan(0.975, 515, 1000, 960).translate // innerWidth (+scrollbar)
    // "correct" pans further left (more negative) to keep the far-right cat on
    // screen; the inflated viewport stops short (less negative → cat drifts off).
    expect(inflated).toBeGreaterThan(correct)
  })
})
