import { describe, expect, it } from 'vitest'
import { CANVAS_WIDTH } from './constants'
import { visibleRange, isVisibleX } from './culling'

describe('visibleRange', () => {
  it('treats the whole map as visible when the canvas is not panned', () => {
    // displayW <= 0 → no camera pan measured yet; the full map is on screen.
    const r = visibleRange(0, 800, 0)
    expect(r).toEqual({ left: 0, right: CANVAS_WIDTH })
  })

  it('scales the viewport width from CSS px back into logical px', () => {
    // A 400px viewport over a 800px-wide (CSS) canvas shows half the canvas, i.e.
    // half of CANVAS_WIDTH in logical px, offset by hudShift.
    const r = visibleRange(100, 400, 800)
    expect(r.left).toBe(100)
    expect(r.right).toBe(100 + CANVAS_WIDTH / 2)
  })
})

describe('isVisibleX', () => {
  const range = { left: 100, right: 300 }

  it('keeps objects that overlap the range', () => {
    expect(isVisibleX(150, 200, range)).toBe(true) // fully inside
    expect(isVisibleX(50, 120, range)).toBe(true) // straddles the left edge
    expect(isVisibleX(280, 400, range)).toBe(true) // straddles the right edge
  })

  it('culls objects fully outside the range', () => {
    expect(isVisibleX(0, 90, range)).toBe(false) // off to the left
    expect(isVisibleX(310, 400, range)).toBe(false) // off to the right
  })

  it('applies the pad as slack on both sides', () => {
    // 90..95 is outside [100,300] but inside once padded by 20.
    expect(isVisibleX(80, 95, range)).toBe(false)
    expect(isVisibleX(80, 95, range, 20)).toBe(true)
    expect(isVisibleX(315, 400, range, 20)).toBe(true)
  })
})
