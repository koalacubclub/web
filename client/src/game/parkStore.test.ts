import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as store from './parkStore'
import { PLACED_TTL_MS } from './parkStore'

const BASE = 1_000_000 // fixed base "now" for deterministic timestamps

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  localStorage.clear()
  store.__resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('parkStore economy', () => {
  it('earns coins and tracks the peak (best)', () => {
    store.earn(10)
    expect(store.getCoins()).toBe(10)
    expect(store.getBest()).toBe(10)
    store.earn(5)
    expect(store.getCoins()).toBe(15)
    expect(store.getBest()).toBe(15)
  })

  it('spends coins on purchase but never lowers best', () => {
    store.earn(100)
    expect(store.purchase('flowers')).toBe('ok') // flowers = 20
    expect(store.getCoins()).toBe(80)
    expect(store.getBest()).toBe(100) // peak unchanged by spending
  })

  it('refuses a purchase you cannot afford', () => {
    store.earn(10)
    expect(store.purchase('flowers')).toBe('insufficient') // needs 20
    expect(store.getCoins()).toBe(10)
    expect(store.getPlaced()).toHaveLength(0)
  })
})

describe('placement', () => {
  it('records a purchased item at a tile within the map', () => {
    store.earn(100)
    store.setCatTile(5, 5)
    expect(store.purchase('flowers')).toBe('ok')
    const placed = store.getPlaced()
    expect(placed).toHaveLength(1)
    expect(placed[0]).toMatchObject({
      key: 'flowers',
      type: 'flowers',
      w: 1,
      h: 1,
    })
    expect(placed[0].x).toBeGreaterThanOrEqual(0)
    expect(placed[0].x).toBeLessThanOrEqual(20 - 1)
    expect(placed[0].y).toBeGreaterThanOrEqual(1)
  })

  it('never overlaps two placed items on the same tile', () => {
    store.earn(100)
    store.setCatTile(5, 5)
    store.purchase('flowers')
    store.purchase('flowers')
    const [a, b] = store.getPlaced()
    expect(a.x === b.x && a.y === b.y).toBe(false)
  })

  it('returns no-room (and does not charge) when the ground is full', () => {
    store.earn(1000)
    store.configure({ mapCols: 2, groundRows: 2 }) // only tiles (0,1) and (1,1)
    store.setCatTile(0, 1)
    expect(store.purchase('flowers')).toBe('ok')
    expect(store.purchase('flowers')).toBe('ok')
    const coinsBefore = store.getCoins()
    expect(store.purchase('flowers')).toBe('no-room')
    expect(store.getCoins()).toBe(coinsBefore) // no charge
    expect(store.getPlaced()).toHaveLength(2)
  })
})

describe('expiry', () => {
  it('sweeps items only once their TTL has passed', () => {
    store.earn(100)
    store.purchase('flowers')
    expect(store.sweepExpired()).toBe(false) // still fresh
    expect(store.getPlaced()).toHaveLength(1)

    vi.setSystemTime(BASE + PLACED_TTL_MS + 1)
    expect(store.sweepExpired()).toBe(true)
    expect(store.getPlaced()).toHaveLength(0)
  })
})

describe('persistence', () => {
  it('restores coins, best and placed on reload, sweeping expired on load', () => {
    store.earn(100)
    store.purchase('flowers') // expiresAt = BASE + TTL
    store.purchase('tree') // 180 > 80 remaining → insufficient, ignore
    expect(store.getPlaced()).toHaveLength(1)

    // Reload (fresh in-memory) BEFORE expiry: item survives.
    store.__resetForTests()
    expect(store.getCoins()).toBe(80)
    expect(store.getBest()).toBe(100)
    expect(store.getPlaced()).toHaveLength(1)

    // Reload AFTER expiry: the load-time sweep drops it.
    vi.setSystemTime(BASE + PLACED_TTL_MS + 1)
    store.__resetForTests()
    expect(store.getPlaced()).toHaveLength(0)
    expect(store.getCoins()).toBe(80) // wallet persists regardless
  })

  it('stays functional in-memory when localStorage throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('denied')
      })
    expect(() => store.earn(50)).not.toThrow()
    expect(store.getCoins()).toBe(50)
    expect(() => store.purchase('flowers')).not.toThrow()
    expect(store.getCoins()).toBe(30)
    spy.mockRestore()
  })
})

describe('snapshot stability', () => {
  it('returns a stable reference until state changes', () => {
    const a = store.getSnapshot()
    expect(store.getSnapshot()).toBe(a) // same ref, no change
    store.earn(10)
    expect(store.getSnapshot()).not.toBe(a) // new ref after mutation
  })

  it('notifies subscribers on mutation only', () => {
    const cb = vi.fn()
    const unsub = store.subscribe(cb)
    store.setCatTile(1, 1) // imperative — must NOT notify
    expect(cb).not.toHaveBeenCalled()
    store.earn(10)
    expect(cb).toHaveBeenCalledTimes(1)
    unsub()
    store.earn(10)
    expect(cb).toHaveBeenCalledTimes(1) // unsubscribed
  })
})

describe('parkStore — display name (server-fed)', () => {
  it('mirrors the server name into the snapshot', () => {
    expect(store.getSnapshot().name).toBe('')
    store.applyServerName('Pixel')
    expect(store.getSnapshot().name).toBe('Pixel')
    expect(store.getName()).toBe('Pixel')
  })

  it('routes rename() to the injected server renamer', () => {
    const sender = vi.fn()
    store.setServerRenamer(sender)
    store.rename('Mochi')
    expect(sender).toHaveBeenCalledWith('Mochi')
  })

  it('is a no-op rename without a server renamer (solo)', () => {
    expect(() => store.rename('Solo')).not.toThrow()
  })
})

describe('parkStore — presence + stats (server-fed)', () => {
  it('mirrors the roster and stats into the snapshot', () => {
    expect(store.getSnapshot().online).toEqual([])
    expect(store.getSnapshot().stats).toBeNull()

    store.applyServerPresence([{ id: 'a', name: 'Alice', self: true }])
    store.applyServerStats({ active24h: 2, totalSessions: 9, yourVisits: 3 })

    expect(store.getSnapshot().online).toEqual([
      { id: 'a', name: 'Alice', self: true },
    ])
    expect(store.getSnapshot().stats).toEqual({
      active24h: 2,
      totalSessions: 9,
      yourVisits: 3,
    })
  })

  it('clears presence + stats when switching to server-fed mode', () => {
    store.applyServerPresence([{ id: 'a', name: 'Alice', self: true }])
    store.applyServerStats({ active24h: 2, totalSessions: 9, yourVisits: 3 })
    store.setServerBuyer(() => {}) // (re)entering multiplayer resets the mirror
    expect(store.getSnapshot().online).toEqual([])
    expect(store.getSnapshot().stats).toBeNull()
  })
})
