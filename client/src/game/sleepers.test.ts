import { describe, expect, it } from 'vitest'
import { layoutSleepers } from './sleepers'
import type { SleepSpot, SleepWorld } from './sleepers'

const world = (over: Partial<SleepWorld> = {}): SleepWorld => ({
  objects: [],
  cols: 58,
  rows: 14,
  ...over,
})

const who = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `koala${i}` }))

/** Every sleeper on its own tile, inside the walkable band. */
function assertTidy(spots: Map<string, SleepSpot>, w: SleepWorld) {
  const seen = new Set<string>()
  for (const s of spots.values()) {
    expect(seen.has(`${s.x},${s.y}`)).toBe(false)
    seen.add(`${s.x},${s.y}`)
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.x).toBeLessThanOrEqual(w.cols - 1)
    expect(s.y).toBeGreaterThanOrEqual(1)
    expect(s.y).toBeLessThanOrEqual(w.rows - 3)
  }
}

describe('layoutSleepers', () => {
  it('gives every sleeper a tile of its own', () => {
    const w = world()
    const spots = layoutSleepers(who(10), w)
    expect(spots.size).toBe(10)
    assertTidy(spots, w)
  })

  it('never lies on a tree, a bench or a placed item', () => {
    const objects = [
      { x: 10, y: 5, w: 2, h: 2 }, // a park tree
      { x: 20, y: 6, w: 3, h: 2, ownerId: 'someone', id: 'pond' }, // a pond
    ]
    const w = world({ objects })
    for (const s of layoutSleepers(who(30), w).values()) {
      for (const r of objects) {
        const hit =
          s.x < r.x + r.w && s.x + 1 > r.x && s.y < r.y + r.h && s.y + 1 > r.y
        expect(hit).toBe(false)
      }
    }
  })

  it('naps beside the first item its sleeper planted', () => {
    const w = world({
      objects: [
        { id: 'a', ownerId: 's0', x: 30, y: 6, w: 2, h: 2, placedAt: 2 },
        { id: 'b', ownerId: 's0', x: 5, y: 3, w: 1, h: 1, placedAt: 1 },
      ],
    })
    const spot = layoutSleepers(who(1), w).get('s0')!
    // Next to the earlier item (x 5, y 3), not the later one out at x 30.
    expect(Math.abs(spot.x - 5)).toBeLessThanOrEqual(1)
    expect(Math.abs(spot.y - 3)).toBeLessThanOrEqual(1)
  })

  it('is deterministic — the same park lays out the same way twice', () => {
    const w = world()
    const a = layoutSleepers(who(12), w)
    const b = layoutSleepers(who(12), w)
    expect([...b.entries()]).toEqual([...a.entries()])
  })

  it('does not depend on the order the server listed them in', () => {
    const w = world()
    const forwards = layoutSleepers(who(8), w)
    const backwards = layoutSleepers([...who(8)].reverse(), w)
    for (const [id, s] of forwards) {
      expect(backwards.get(id)).toEqual(s)
    }
  })

  it('keeps a sleeper where it was when the park changes around it', () => {
    const w = world()
    const first = layoutSleepers(who(5), w)
    const before = first.get('s2')!
    // Someone plants a tree right on top of them, and a peer wakes up.
    const after = layoutSleepers(
      who(5).filter((s) => s.id !== 's0'),
      world({ objects: [{ x: before.x, y: before.y, w: 2, h: 2 }] }),
      first,
    )
    expect(after.get('s2')).toEqual(before)
    expect(after.has('s0')).toBe(false)
  })

  it('follows a rename without moving the sleeper', () => {
    const w = world()
    const first = layoutSleepers(who(3), w)
    const after = layoutSleepers([{ id: 's1', name: 'Eucalyptus' }], w, first)
    expect(after.get('s1')).toEqual({ ...first.get('s1')!, name: 'Eucalyptus' })
  })

  it('leaves a sleeper out rather than stacking when the park is full', () => {
    // A 3x4 park: rows 1..1 are the only walkable band (bottom margin 2), so
    // there are exactly 3 tiles for 6 sleepers.
    const w = world({ cols: 3, rows: 4 })
    const spots = layoutSleepers(who(6), w)
    expect(spots.size).toBe(3)
    assertTidy(spots, w)
  })
})
