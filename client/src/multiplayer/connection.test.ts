import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorldStats } from '@koala/shared'
import type { Multiplayer } from './connection'

// Minimal controllable WebSocket stand-in (jsdom has no WebSocket). Tests grab
// the instance the client creates and drive its lifecycle by hand.
class FakeWebSocket {
  static OPEN = 1
  static instances: FakeWebSocket[] = []
  url: string
  readyState = 0
  sent: string[] = []
  private listeners: Record<string, ((e: unknown) => void)[]> = {}

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }
  addEventListener(type: string, cb: (e: unknown) => void) {
    ;(this.listeners[type] ??= []).push(cb)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.emit('close', {})
  }
  private emit(type: string, e: unknown) {
    for (const cb of this.listeners[type] ?? []) cb(e)
  }
  // test helpers
  fireOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.emit('open', {})
  }
  receive(msg: unknown) {
    this.emit('message', { data: JSON.stringify(msg) })
  }
}

// Import the module fresh each test so its module-level env reads pick up the
// stubbed VITE_GAME_* values.
async function startConnected(): Promise<{
  mp: Multiplayer
  ws: FakeWebSocket
}> {
  const { createMultiplayer } = await import('./connection')
  const mp = createMultiplayer()
  expect(mp).not.toBeNull()
  await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1))
  const ws = FakeWebSocket.instances[0]
  ws.fireOpen()
  return { mp: mp as Multiplayer, ws }
}

const player = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Koala ${id}`,
  x: 1,
  y: 1,
  dir: 'right',
  pose: 'standing',
  interacting: false,
  ...over,
})

describe('createMultiplayer', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_GAME_HTTP_URL', 'http://localhost:8787')
    vi.stubEnv('VITE_GAME_WS_URL', 'ws://localhost:8787')
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    )
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns null when no backend is configured', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_GAME_HTTP_URL', '')
    vi.stubEnv('VITE_GAME_WS_URL', '')
    vi.stubEnv('DEV', false) // force the prod-without-config path
    vi.resetModules()
    const { createMultiplayer } = await import('./connection')
    expect(createMultiplayer()).toBeNull()
  })

  it('connects, records self, and adds the initial roster (excluding self)', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [player('a'), player('self')], // self must be filtered out
      now: 0,
    })
    expect(mp.connected).toBe(true)
    expect(mp.self?.id).toBe('self')
    expect(mp.players.has('a')).toBe(true)
    expect(mp.players.has('self')).toBe(false)
  })

  it('handles join, state, and leave for remote players', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({ t: 'welcome', self: player('self'), players: [], now: 0 })

    ws.receive({ t: 'join', p: player('b') })
    expect(mp.players.has('b')).toBe(true)

    ws.receive({
      t: 'state',
      id: 'b',
      s: player('b', { x: 5, y: 6, dir: 'left' }),
    })
    const b = mp.players.get('b')
    expect(b?.x).toBe(5)
    expect(b?.y).toBe(6)
    expect(b?.dir).toBe('left')

    ws.receive({ t: 'leave', id: 'b' })
    expect(mp.players.has('b')).toBe(false)
  })

  it('ignores state echoed back for self', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({ t: 'welcome', self: player('self'), players: [], now: 0 })
    ws.receive({ t: 'state', id: 'self', s: player('self', { x: 9 }) })
    expect(mp.players.has('self')).toBe(false)
    expect(mp.players.size).toBe(0)
  })

  it('throttles sends but lets a pose/dir change through immediately', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({ t: 'welcome', self: player('self'), players: [], now: 0 })

    const s = {
      x: 1,
      y: 1,
      dir: 'right' as const,
      pose: 'standing' as const,
      interacting: false,
    }
    mp.sendState(s)
    mp.sendState({ ...s }) // identical + within interval → dropped
    expect(ws.sent.length).toBe(1)

    mp.sendState({ ...s, pose: 'lying' }) // pose change bypasses the throttle
    expect(ws.sent.length).toBe(2)
  })

  it('does not send while the socket is not open', async () => {
    const { createMultiplayer } = await import('./connection')
    const mp = createMultiplayer() as Multiplayer
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1))
    // never fired open → readyState 0
    mp.sendState({
      x: 1,
      y: 1,
      dir: 'right',
      pose: 'standing',
      interacting: false,
    })
    expect(FakeWebSocket.instances[0].sent.length).toBe(0)
  })

  it('clears players and marks disconnected when the socket closes', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [player('a')],
      now: 0,
    })
    expect(mp.players.size).toBe(1)
    ws.close()
    expect(mp.connected).toBe(false)
    expect(mp.players.size).toBe(0)
    mp.close() // cancel the backoff reconnect so it can't leak into later tests
  })

  it('close() tears down the socket and stops reconnecting', async () => {
    const { mp, ws } = await startConnected()
    mp.close()
    expect(mp.connected).toBe(false)
    expect(ws.readyState).toBe(3)
  })

  // ---- server-owned food + likes ----

  const food = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    key: 'treat',
    x: 1,
    y: 1,
    points: 5,
    bornAt: 0,
    ...over,
  })

  it('seeds food and likes from welcome', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [food('f1'), food('f2')],
      likes: 42,
      now: 0,
    })
    expect(mp.likes).toBe(42)
    expect(mp.food.has('f1')).toBe(true)
    expect(mp.food.has('f2')).toBe(true)
  })

  it('adds on spawn and removes on despawn', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      likes: 0,
      now: 0,
    })
    ws.receive({ t: 'spawn', f: food('f1') })
    expect(mp.food.has('f1')).toBe(true)
    ws.receive({ t: 'despawn', id: 'f1', reason: 'taken' })
    expect(mp.food.has('f1')).toBe(false)
  })

  it('replaces the whole food set on a resync (server woke from hibernation)', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [food('stale')],
      likes: 0,
      now: 0,
    })
    expect(mp.food.has('stale')).toBe(true)
    // A resync drops the stale food and installs whatever the server now has.
    ws.receive({ t: 'foods', food: [food('fresh')] })
    expect(mp.food.has('stale')).toBe(false)
    expect(mp.food.has('fresh')).toBe(true)
    // An empty resync clears everything.
    ws.receive({ t: 'foods', food: [] })
    expect(mp.food.size).toBe(0)
  })

  it('updates own likes only when the collector is us', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      likes: 0,
      now: 0,
    })
    ws.receive({ t: 'collected', id: 'f1', by: 'other', points: 5, likes: 999 })
    expect(mp.likes).toBe(0) // someone else's award
    ws.receive({ t: 'collected', id: 'f2', by: 'self', points: 10, likes: 10 })
    expect(mp.likes).toBe(10)
  })

  it('sendCollect emits a collect request on the wire', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      likes: 0,
      now: 0,
    })
    mp.sendCollect('f1')
    const sent = ws.sent.map((s) => JSON.parse(s))
    expect(sent).toContainEqual({ t: 'collect', id: 'f1' })
  })

  it('clears food when the socket closes', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [food('f1')],
      likes: 0,
      now: 0,
    })
    expect(mp.food.size).toBe(1)
    ws.close()
    expect(mp.food.size).toBe(0)
    mp.close() // cancel the backoff reconnect so it can't leak into later tests
  })

  // ---- shop: placed items + wallet ----

  const placedItem = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    key: 'flowers',
    type: 'flowers',
    x: 1,
    y: 1,
    w: 1,
    h: 1,
    ownerId: 'self',
    placedAt: 0,
    expiresAt: 0,
    ...over,
  })

  it('seeds placed items + wallet from welcome', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      placed: [placedItem('p1')],
      likes: 30,
      now: 0,
    })
    expect(mp.likes).toBe(30)
    expect(mp.placed.has('p1')).toBe(true)
  })

  it('adds on placed and removes on unplaced', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      placed: [],
      likes: 0,
      now: 0,
    })
    ws.receive({ t: 'placed', item: placedItem('p1') })
    expect(mp.placed.has('p1')).toBe(true)
    ws.receive({ t: 'unplaced', id: 'p1', reason: 'expired' })
    expect(mp.placed.has('p1')).toBe(false)
  })

  it('updates the wallet on a wallet message', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      placed: [],
      likes: 50,
      now: 0,
    })
    ws.receive({ t: 'wallet', likes: 30 }) // after a purchase
    expect(mp.likes).toBe(30)
  })

  it('sendBuy emits a buy request on the wire', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      placed: [],
      likes: 0,
      now: 0,
    })
    mp.sendBuy('flowers', 3, 4)
    const sent = ws.sent.map((s) => JSON.parse(s))
    expect(sent).toContainEqual({ t: 'buy', key: 'flowers', x: 3, y: 4 })
  })

  it('reports a rejected buy via onBuyFail', async () => {
    const { createMultiplayer } = await import('./connection')
    let reason: string | undefined
    const mp = createMultiplayer({ onBuyFail: (r) => (reason = r) })
    expect(mp).not.toBeNull()
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1))
    FakeWebSocket.instances[0].fireOpen()
    FakeWebSocket.instances[0].receive({ t: 'buyfail', reason: 'insufficient' })
    expect(reason).toBe('insufficient')
    ;(mp as Multiplayer).close()
  })

  it('clears placed items when the socket closes', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      placed: [placedItem('p1')],
      likes: 0,
      now: 0,
    })
    expect(mp.placed.size).toBe(1)
    ws.close()
    expect(mp.placed.size).toBe(0)
    mp.close() // cancel the backoff reconnect so it can't leak into later tests
  })
})

describe('createMultiplayer — names', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_GAME_HTTP_URL', 'http://localhost:8787')
    vi.stubEnv('VITE_GAME_WS_URL', 'ws://localhost:8787')
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    )
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sendName emits a trimmed/capped setName on the wire', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({ t: 'welcome', self: player('self'), players: [], now: 0 })
    mp.sendName('  Pixel  ')
    const sent = ws.sent.map((s) => JSON.parse(s))
    expect(sent).toContainEqual({ t: 'setName', name: 'Pixel' })
  })

  it('renamed for self updates self.name and fires onName; peer updates the roster', async () => {
    const { createMultiplayer } = await import('./connection')
    const names: string[] = []
    const mp = createMultiplayer({ onName: (n) => names.push(n) })
    expect(mp).not.toBeNull()
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1))
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [player('b')],
      now: 0,
    })
    expect(names).toContain('Koala self') // welcome fires onName

    ws.receive({ t: 'renamed', id: 'self', name: 'Pixel' })
    expect((mp as Multiplayer).self?.name).toBe('Pixel')
    expect(names).toContain('Pixel')

    ws.receive({ t: 'renamed', id: 'b', name: 'Mochi' })
    expect((mp as Multiplayer).players.get('b')?.name).toBe('Mochi')
    ;(mp as Multiplayer).close()
  })
})

describe('createMultiplayer — authors directory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_GAME_HTTP_URL', 'http://localhost:8787')
    vi.stubEnv('VITE_GAME_WS_URL', 'ws://localhost:8787')
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    )
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const item = (id: string, ownerId: string) => ({
    id,
    key: 'flowers',
    type: 'flowers',
    x: 1,
    y: 1,
    w: 1,
    h: 1,
    ownerId,
    placedAt: 0,
    expiresAt: 0,
  })

  it('seeds authors from welcome and updates on placed + renamed', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      food: [],
      placed: [item('p1', 'u1')],
      authors: { u1: 'Old' },
      likes: 0,
      now: 0,
    })
    expect(mp.authors.get('u1')).toBe('Old')

    // A new item by another owner brings its author name.
    ws.receive({ t: 'placed', item: item('p2', 'u2'), authorName: 'Buyer' })
    expect(mp.authors.get('u2')).toBe('Buyer')

    // A rename relabels ALL of that owner's items via one map update.
    ws.receive({ t: 'renamed', id: 'u1', name: 'Pixel' })
    expect(mp.authors.get('u1')).toBe('Pixel')
  })
})

describe('createMultiplayer — presence + stats', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_GAME_HTTP_URL', 'http://localhost:8787')
    vi.stubEnv('VITE_GAME_WS_URL', 'ws://localhost:8787')
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    )
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('emits the roster (self + remotes) on welcome/join/leave', async () => {
    const { createMultiplayer } = await import('./connection')
    let roster: { id: string; name: string; self: boolean }[] = []
    const mp = createMultiplayer({
      onPresence: (r) => (roster = r),
    }) as Multiplayer
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1))
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()

    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [player('a')],
      now: 0,
    })
    expect(roster.map((p) => p.id).sort()).toEqual(['a', 'self'])
    expect(roster.find((p) => p.id === 'self')?.self).toBe(true)
    expect(roster.find((p) => p.id === 'a')?.self).toBe(false)

    ws.receive({ t: 'join', p: player('b') })
    expect(roster.map((p) => p.id).sort()).toEqual(['a', 'b', 'self'])

    ws.receive({ t: 'leave', id: 'a' })
    expect(roster.map((p) => p.id).sort()).toEqual(['b', 'self'])

    // Disconnect empties the roster.
    ws.close()
    expect(roster).toEqual([])
    mp.close()
  })

  it('sendJump emits a jump request on the wire', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({ t: 'welcome', self: player('self'), players: [], now: 0 })
    mp.sendJump()
    const sent = ws.sent.map((s) => JSON.parse(s))
    expect(sent).toContainEqual({ t: 'jump' })
    mp.close()
  })

  it('marks a remote player mid-jump on a jumped message', async () => {
    const { mp, ws } = await startConnected()
    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [player('b')],
      now: 0,
    })
    expect(mp.players.get('b')?.jumpAt).toBeUndefined()
    ws.receive({ t: 'jumped', id: 'b' })
    expect(typeof mp.players.get('b')?.jumpAt).toBe('number')
    mp.close()
  })

  it('exposes stats from welcome and merges stats updates, keeping yourVisits', async () => {
    const { createMultiplayer } = await import('./connection')
    const seen: WorldStats[] = []
    const mp = createMultiplayer({
      onStats: (s) => seen.push(s),
    }) as Multiplayer
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1))
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()

    ws.receive({
      t: 'welcome',
      self: player('self'),
      players: [],
      stats: { active24h: 3, totalSessions: 10, yourVisits: 4 },
      now: 0,
    })
    expect(mp.stats).toEqual({ active24h: 3, totalSessions: 10, yourVisits: 4 })

    // A stats broadcast carries only the globals; yourVisits is preserved.
    ws.receive({ t: 'stats', active24h: 5, totalSessions: 12 })
    expect(mp.stats).toEqual({ active24h: 5, totalSessions: 12, yourVisits: 4 })
    expect(seen.at(-1)).toEqual({
      active24h: 5,
      totalSessions: 12,
      yourVisits: 4,
    })
    mp.close()
  })
})
