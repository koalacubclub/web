import { describe, expect, it } from 'vitest'
import {
  ballRestTile,
  MAX_BALL_SPEED,
  PLACED_PERMANENT,
  sanitizeMove,
  sanitizePush,
  WORLD,
} from '@koala/shared'
import { MAP_COLS, GROUND_ROWS } from './constants'
import { updateSlappables } from './slap'

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

// One rule for where a roll ends, shared by the client (which settles its own
// ball onto that tile) and the server (which stores it). They used to disagree:
// the client kept a fractional rest, the server rounded it a round-trip later,
// and the ball hopped — worst against an edge, where a short roll rounded
// straight back into the corner it had just been kicked out of.
describe('ballRestTile (one resting tile, both sides)', () => {
  it('rounds to the nearest tile', () => {
    expect(ballRestTile(11.6, 4.4)).toEqual({ x: 12, y: 4 })
    expect(ballRestTile(11.4, 4.6)).toEqual({ x: 11, y: 5 })
  })

  it('keeps a ball on the rows and columns it may occupy', () => {
    // The BALL's bounds, not the cat's: she stops at groundRows - 1.5, and
    // clamping by her bound would lift a ball resting on the bottom row.
    expect(ballRestTile(9999, 9999)).toEqual({
      x: WORLD.cols - 1,
      y: WORLD.groundRows - 1,
    })
    expect(ballRestTile(-9999, -9999)).toEqual({ x: 0, y: 1 })
    expect(sanitizeMove({ id: 'b1', x: 99, y: 99 })!.y).toBe(
      WORLD.groundRows - 1,
    )
  })

  it('is idempotent — a settled tile survives another round trip', () => {
    const once = ballRestTile(56.6, 12.7)
    expect(ballRestTile(once.x, once.y)).toEqual(once)
  })

  it('agrees with where the client integrator actually leaves a ball', () => {
    // Roll a ball out of the bottom-right corner and settle it: the tile both
    // sides land on is a tile it may occupy, and it is off the corner.
    const o = { x: WORLD.cols - 1, y: WORLD.groundRows - 1, w: 1, h: 1 } as {
      x: number
      y: number
      w: number
      h: number
      vx?: number
      vy?: number
    }
    o.vx = -0.006
    o.vy = -0.006
    for (let i = 0; i < 600 && o.vx != null; i++) {
      updateSlappables([o], 16, WORLD.cols, WORLD.groundRows)
    }
    const tile = ballRestTile(o.x, o.y)
    expect(tile.x).toBeLessThan(WORLD.cols - 1)
    expect(tile.y).toBeLessThan(WORLD.groundRows - 1)
    expect(tile.y).toBeGreaterThanOrEqual(1)
    // And what the server would store from the same numbers is the same tile.
    const wire = sanitizeMove({ id: 'b1', x: o.x, y: o.y })!
    expect(ballRestTile(wire.x, wire.y)).toEqual(tile)
  })
})
