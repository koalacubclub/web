import { describe, expect, it } from 'vitest'
import { CAST_SIZE } from '@koala/shared'
import { Casting } from '../src/cast'

// A deterministic "random" so the sampling itself is testable: always picks the
// first candidate of the remaining pool, which makes open() take the pool's own
// order (and lets a test assert exactly who was sampled).
const firstFirst = () => 0

/** ids p0..p{n-1} */
const pool = (n: number, prefix = 'p'): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`)

describe('Casting: drawing a cast', () => {
  it('shows everyone when the park is smaller than a cast', () => {
    const c = new Casting(firstFirst)
    const cast = c.open('me', pool(6))
    expect(cast).toHaveLength(6)
    expect(c.shows('me', 'p3')).toBe(true)
  })

  it('caps the sample at CAST_SIZE however big the park is', () => {
    const c = new Casting()
    const cast = c.open('me', pool(5000))
    expect(cast).toHaveLength(CAST_SIZE)
    expect(new Set(cast).size).toBe(CAST_SIZE) // no duplicates
  })

  it('never shows a viewer to itself', () => {
    const c = new Casting()
    const cast = c.open('p7', pool(200))
    expect(cast).not.toContain('p7')
    expect(c.shows('p7', 'p7')).toBe(false)
  })

  it('samples at random — two viewers of the same park see different koalas', () => {
    const c = new Casting()
    const a = new Set(c.open('a', pool(500)))
    const b = new Set(c.open('b', pool(500)))
    const shared = [...a].filter((id) => b.has(id))
    // Two 50-of-500 samples overlapping in more than half their members would
    // be a ~1-in-astronomical fluke; anything less means it isn't sampling.
    expect(shared.length).toBeLessThan(CAST_SIZE / 2)
  })

  it('re-rolls on reconnect (a refresh is a new world)', () => {
    const c = new Casting()
    const first = new Set(c.open('me', pool(500)))
    const second = new Set(c.open('me', pool(500)))
    expect([...second].filter((id) => first.has(id)).length).toBeLessThan(
      CAST_SIZE / 2,
    )
    // The stale slots are gone: nobody thinks 'me' is still watching them.
    for (const id of first) {
      if (!second.has(id)) expect(c.watchersOf(id).has('me')).toBe(false)
    }
  })

  it('fills online koalas first, then tops up from item owners', () => {
    const c = new Casting(firstFirst, 4)
    const cast = c.open('me', ['a', 'b'], ['owner1', 'owner2', 'owner3'])
    expect(cast.slice(0, 2)).toEqual(['a', 'b'])
    expect(cast).toHaveLength(4) // 2 online + the first 2 owners
    expect(c.shows('me', 'owner3')).toBe(false)
  })

  it('does not double-count an owner who is also online', () => {
    const c = new Casting(firstFirst, 10)
    const cast = c.open('me', ['a', 'b'], ['a', 'c'])
    expect(cast).toEqual(['a', 'b', 'c'])
  })
})

describe('Casting: who sees whom', () => {
  it('relays a koala only to the viewers showing them', () => {
    const c = new Casting(firstFirst, 1)
    c.open('a', ['x', 'y'])
    c.open('b', ['y', 'x'])
    expect([...c.watchersOf('x')]).toEqual(['a'])
    expect([...c.watchersOf('y')]).toEqual(['b'])
  })

  it('is asymmetric: seeing someone does not put you in their cast', () => {
    const c = new Casting(firstFirst, 1)
    c.open('a', ['b', 'c'])
    c.open('b', ['c', 'a'])
    expect(c.shows('a', 'b')).toBe(true)
    expect(c.shows('b', 'a')).toBe(false)
  })

  it('admits a newcomer to the casts with room and skips the full ones', () => {
    const c = new Casting(firstFirst, 2)
    c.open('roomy', ['x'])
    c.open('full', ['x', 'y'])
    const admitted = c.admit('newbie')
    expect(admitted).toEqual([{ viewer: 'roomy', added: 'newbie' }])
    expect(c.shows('roomy', 'newbie')).toBe(true)
    expect(c.shows('full', 'newbie')).toBe(false)
  })

  it('does not re-admit (or duplicate) a member already in a cast', () => {
    const c = new Casting(firstFirst, 5)
    c.open('me', ['x'])
    expect(c.admit('x')).toEqual([])
    expect([...c.watchersOf('x')]).toEqual(['me'])
  })

  it('keeps a slot for a member who leaves — no backfill, and they come back', () => {
    const c = new Casting(firstFirst, 2)
    c.open('me', ['x', 'y'])
    // 'x' logging off doesn't touch anyone's cast, so the park you're shown
    // doesn't reshuffle — and a newcomer can't take the slot.
    c.close('x') // 'x' stops being a VIEWER; it stays in 'me' 's cast
    expect(c.shows('me', 'x')).toBe(true)
    expect(c.admit('newbie')).toEqual([])
    // When 'x' reconnects it is already in the cast: one join, no new slot.
    expect(c.admit('x')).toEqual([])
    expect([...c.watchersOf('x')]).toEqual(['me'])
  })

  it('forgets a departing viewer entirely', () => {
    const c = new Casting(firstFirst, 3)
    c.open('me', ['x', 'y'])
    c.close('me')
    expect(c.shows('me', 'x')).toBe(false)
    expect(c.watchersOf('x').size).toBe(0)
    expect([...c.viewerIds()]).toEqual([])
  })
})
