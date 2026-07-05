import { describe, expect, it } from 'vitest'
import {
  MAX_BALL_SPEED,
  PLACED_PERMANENT,
  sanitizeMove,
  sanitizePush,
  WORLD,
} from '@koala/shared'
import { MAP_COLS, GROUND_ROWS } from './constants'

// The ball-sync wire contract: the server never trusts a pushed/rested ball, so
// these validators are the trust boundary. They accept FRACTIONAL positions (a
// ball rolls to a sub-tile spot, unlike sanitizeBuy which wants integer tiles),
// clamp into the playable bounds, and bound the launch velocity.
describe('sanitizePush', () => {
  it('accepts a fractional position + finite velocity', () => {
    expect(
      sanitizePush({ id: 'b1', x: 8.4, y: 6.1, vx: 0.006, vy: -0.003 }),
    ).toEqual({ id: 'b1', x: 8.4, y: 6.1, vx: 0.006, vy: -0.003 })
  })

  it('clamps the position into the playable bounds', () => {
    const far = sanitizePush({ id: 'b1', x: 9999, y: -9999, vx: 0, vy: 0 })!
    expect(far.x).toBe(WORLD.cols - 1)
    expect(far.y).toBe(1)
  })

  it('clamps the velocity to ±MAX_BALL_SPEED', () => {
    const fast = sanitizePush({ id: 'b1', x: 1, y: 1, vx: 999, vy: -999 })!
    expect(fast.vx).toBe(MAX_BALL_SPEED)
    expect(fast.vy).toBe(-MAX_BALL_SPEED)
  })

  it('rejects a non-finite position or velocity', () => {
    expect(sanitizePush({ id: 'b1', x: NaN, y: 1, vx: 0, vy: 0 })).toBeNull()
    expect(
      sanitizePush({ id: 'b1', x: 1, y: Infinity, vx: 0, vy: 0 }),
    ).toBeNull()
    expect(sanitizePush({ id: 'b1', x: 1, y: 1, vx: NaN, vy: 0 })).toBeNull()
    expect(
      sanitizePush({ id: 'b1', x: 1, y: 1, vx: 0, vy: Infinity }),
    ).toBeNull()
  })

  it('rejects a missing, empty, or oversized id', () => {
    expect(sanitizePush({ x: 1, y: 1, vx: 0, vy: 0 })).toBeNull()
    expect(sanitizePush({ id: '', x: 1, y: 1, vx: 0, vy: 0 })).toBeNull()
    expect(
      sanitizePush({ id: 'x'.repeat(65), x: 1, y: 1, vx: 0, vy: 0 }),
    ).toBeNull()
  })
})

describe('sanitizeMove', () => {
  it('accepts a fractional position (no velocity)', () => {
    expect(sanitizeMove({ id: 'b1', x: 10.4, y: 5.6 })).toEqual({
      id: 'b1',
      x: 10.4,
      y: 5.6,
    })
  })

  it('clamps and rejects like sanitizePush', () => {
    expect(sanitizeMove({ id: 'b1', x: 9999, y: 9999 })!.x).toBe(WORLD.cols - 1)
    expect(sanitizeMove({ id: 'b1', x: NaN, y: 1 })).toBeNull()
    expect(sanitizeMove({ id: '', x: 1, y: 1 })).toBeNull()
  })
})

// The map was widened (MAP_COLS 40); WORLD.cols is the server's copy used by every
// position clamp. If they ever drift again, the right half of the park silently
// stops accepting movement/placements — so lock them together.
describe('world bounds stay in sync', () => {
  it('WORLD matches the client map dimensions', () => {
    expect(WORLD.cols).toBe(MAP_COLS)
    expect(WORLD.groundRows).toBe(GROUND_ROWS)
  })
})

// Permanent (never-expiring) placed items — the seeded default balls — use the
// PLACED_PERMANENT sentinel, which must be distinguishable from a real expiry.
describe('PLACED_PERMANENT sentinel', () => {
  it('is guardable against the "expiresAt <= now" reap', () => {
    const now = Date.now()
    const isExpired = (expiresAt: number) =>
      expiresAt !== PLACED_PERMANENT && expiresAt <= now
    expect(isExpired(PLACED_PERMANENT)).toBe(false) // never reaped
    expect(isExpired(now - 1)).toBe(true) // a real past expiry still reaps
    expect(isExpired(now + 100000)).toBe(false)
  })
})
