import { describe, expect, it } from 'vitest'
import { SLAP_DURATION_MS } from '@koala/shared'
import { slapPhase, slapSwing, updateSlappables, pickSlapTarget } from './slap'

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

// A knocked ball rolls under friction and eventually settles — at which point its
// velocity is cleared to undefined. The game loop watches for that edge to fire a
// single `rest` (persist) for a ball we launched, so this is the client contract
// that drives ball-position sync.
describe('updateSlappables (ball roll → settle)', () => {
  it('carries an injected velocity, then clears it once the ball comes to rest', () => {
    const ball = { x: 8, y: 6, w: 1, h: 1, vx: 0.006, vy: -0.003 }
    const startX = ball.x
    // Advance the sim in 16ms steps until it settles (or a generous cap).
    let settled = false
    for (let i = 0; i < 2000 && !settled; i++) {
      updateSlappables([ball], 16, 40, 13)
      settled = ball.vx == null && ball.vy == null
    }
    expect(settled).toBe(true) // friction brought it to rest
    expect(ball.x).not.toBe(startX) // it actually moved before stopping
    // Stays put once settled (no residual velocity to integrate).
    const rested = { x: ball.x, y: ball.y }
    updateSlappables([ball], 16, 40, 13)
    expect(ball.x).toBe(rested.x)
    expect(ball.y).toBe(rested.y)
  })

  it('bounces off the map edges instead of escaping', () => {
    // Fling it hard toward the left wall; it must stay in-bounds.
    const ball = { x: 1, y: 6, w: 1, h: 1, vx: -0.02, vy: 0 }
    for (let i = 0; i < 400; i++) updateSlappables([ball], 16, 40, 13)
    expect(ball.x).toBeGreaterThanOrEqual(0)
    expect(ball.x).toBeLessThanOrEqual(40 - ball.w)
  })
})

// The cat's slap targets the nearest reachable object, but a BALL always wins so
// an overlapping ball stays kickable. UI hotspots (social/photo) are never hit.
describe('pickSlapTarget', () => {
  const REACH = 1.1
  const obj = (type: string, x: number, y: number) => ({
    type,
    x,
    y,
    w: 1,
    h: 1,
  })

  it('picks the ball even when another item is closer', () => {
    const bench = obj('bench', 5, 5) // right on the cat
    const ball = obj('ball', 6, 5) // one tile further
    const target = pickSlapTarget([bench, ball], 5.5, 5.5, REACH)
    expect(target).toBe(ball)
  })

  it('falls back to the nearest item when no ball is in reach', () => {
    const bench = obj('bench', 5, 5)
    const stone = obj('stone', 7, 7) // out of reach
    expect(pickSlapTarget([bench, stone], 5.5, 5.5, REACH)).toBe(bench)
  })

  it('ignores a ball that is out of reach', () => {
    const bench = obj('bench', 5, 5)
    const farBall = obj('ball', 20, 5) // way out of reach
    expect(pickSlapTarget([bench, farBall], 5.5, 5.5, REACH)).toBe(bench)
  })

  it('skips UI hotspots (social / photo) and whiffs when nothing else is near', () => {
    const ig = obj('social', 5, 5)
    const photo = obj('photo', 5, 5)
    expect(pickSlapTarget([ig, photo], 5.5, 5.5, REACH)).toBeNull()
  })

  it('prefers the NEAREST ball when several are in reach', () => {
    const near = obj('ball', 5, 5)
    const far = obj('ball', 6, 5)
    expect(pickSlapTarget([far, near], 5.5, 5.5, REACH)).toBe(near)
  })
})
