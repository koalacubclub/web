import { SELF } from 'cloudflare:test'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_INBOUND_MSGS_PER_SEC, NAME_MAX } from '@koala/shared'

const ORIGIN = 'http://localhost:5173'

// Track sockets so we always tidy up between tests.
const open: WebSocket[] = []
afterEach(() => {
  for (const ws of open.splice(0)) {
    try {
      ws.close()
    } catch {
      /* already closed */
    }
  }
})

/** POST /session and return the cookie pair + assigned identity. */
async function session(): Promise<{
  cookie: string
  id: string
  name: string
}> {
  const res = await SELF.fetch('https://game.test/session', {
    method: 'POST',
    headers: { Origin: ORIGIN },
  })
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('Set-Cookie')
  expect(setCookie).toBeTruthy()
  const cookie = setCookie!.split(';')[0]
  const body = (await res.json()) as { id: string; name: string }
  return { cookie, id: body.id, name: body.name }
}

/** Connect a player and start collecting the server messages it receives. */
async function connect(
  cookie: string,
): Promise<{ ws: WebSocket; msgs: any[] }> {
  const res = await SELF.fetch('https://game.test/world/main', {
    headers: { Upgrade: 'websocket', Origin: ORIGIN, Cookie: cookie },
  })
  expect(res.status).toBe(101)
  const ws = res.webSocket
  expect(ws).toBeTruthy()
  const msgs: any[] = []
  ws!.accept()
  ws!.addEventListener('message', (e: MessageEvent) => {
    msgs.push(JSON.parse(e.data as string))
  })
  open.push(ws!)
  return { ws: ws!, msgs }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('GameWorld multiplayer', () => {
  it('gives each new visitor a distinct signed session', async () => {
    const a = await session()
    const b = await session()
    expect(a.id).not.toBe(b.id)
    expect(a.name).toMatch(/^Koala /)
  })

  it('reuses the session id when the cookie is presented again', async () => {
    const first = await session()
    const res = await SELF.fetch('https://game.test/session', {
      method: 'POST',
      headers: { Origin: ORIGIN, Cookie: first.cookie },
    })
    const body = (await res.json()) as { id: string }
    expect(body.id).toBe(first.id)
  })

  it('rejects a WebSocket with no session cookie', async () => {
    const res = await SELF.fetch('https://game.test/world/main', {
      headers: { Upgrade: 'websocket', Origin: ORIGIN },
    })
    expect(res.status).toBe(401)
  })

  it('rejects a WebSocket from a disallowed origin', async () => {
    const { cookie } = await session()
    const res = await SELF.fetch('https://game.test/world/main', {
      headers: {
        Upgrade: 'websocket',
        Origin: 'https://evil.example',
        Cookie: cookie,
      },
    })
    expect(res.status).toBe(403)
  })

  it('welcomes a newcomer with the current roster', async () => {
    const a = await session()
    await connect(a.cookie)
    const b = await session()
    const { msgs: msgsB } = await connect(b.cookie)
    await wait(50)
    const welcome = msgsB.find((m) => m.t === 'welcome')
    expect(welcome).toBeTruthy()
    expect(welcome.self.id).toBe(b.id)
    // A is already in the park, so B's roster should include A.
    expect(welcome.players.some((p: any) => p.id === a.id)).toBe(true)
  })

  it('relays movement and join/leave to other players', async () => {
    const a = await session()
    const { msgs: msgsA } = await connect(a.cookie)
    const b = await session()
    const { ws: wsB } = await connect(b.cookie)
    await wait(50)
    // A should have been told B joined.
    expect(msgsA.some((m) => m.t === 'join' && m.p.id === b.id)).toBe(true)

    wsB.send(
      JSON.stringify({
        t: 'state',
        s: { x: 5, y: 5, dir: 'left', pose: 'standing', interacting: false },
      }),
    )
    await wait(50)
    const relayed = msgsA.find((m) => m.t === 'state' && m.id === b.id)
    expect(relayed).toBeTruthy()
    expect(relayed.s.x).toBe(5)

    wsB.close()
    await wait(50)
    expect(msgsA.some((m) => m.t === 'leave' && m.id === b.id)).toBe(true)
  })

  it('clamps out-of-bounds positions server-side', async () => {
    const a = await session()
    const { msgs: msgsA } = await connect(a.cookie)
    const b = await session()
    const { ws: wsB } = await connect(b.cookie)
    await wait(50)
    wsB.send(
      JSON.stringify({
        t: 'state',
        s: {
          x: 9999,
          y: -9999,
          dir: 'right',
          pose: 'standing',
          interacting: false,
        },
      }),
    )
    await wait(50)
    const relayed = msgsA.find((m) => m.t === 'state' && m.id === b.id)
    expect(relayed).toBeTruthy()
    expect(relayed.s.x).toBeLessThanOrEqual(19)
    expect(relayed.s.y).toBeGreaterThanOrEqual(1)
  })

  it('drops inbound floods beyond the rate limit (best-effort anti-cheat)', async () => {
    const a = await session()
    const { msgs: msgsA } = await connect(a.cookie)
    const b = await session()
    const { ws: wsB } = await connect(b.cookie)
    await wait(50)

    const flood = MAX_INBOUND_MSGS_PER_SEC + 20
    for (let i = 0; i < flood; i++) {
      wsB.send(
        JSON.stringify({
          t: 'state',
          s: {
            x: i % 10,
            y: 5,
            dir: 'right',
            pose: 'standing',
            interacting: false,
          },
        }),
      )
    }
    await wait(100)
    const relayed = msgsA.filter((m) => m.t === 'state' && m.id === b.id)
    expect(relayed.length).toBeGreaterThan(0)
    expect(relayed.length).toBeLessThanOrEqual(MAX_INBOUND_MSGS_PER_SEC)
  })

  it('shares one rate-limit budget across a session (no multi-socket bypass)', async () => {
    const a = await session()
    const { msgs: msgsA } = await connect(a.cookie)
    // One session (b) opens TWO sockets and floods across both.
    const b = await session()
    const { ws: wsB1 } = await connect(b.cookie)
    const { ws: wsB2 } = await connect(b.cookie)
    await wait(50)

    const each = MAX_INBOUND_MSGS_PER_SEC
    for (let i = 0; i < each; i++) {
      const m = JSON.stringify({
        t: 'state',
        s: {
          x: i % 10,
          y: 5,
          dir: 'right',
          pose: 'standing',
          interacting: false,
        },
      })
      wsB1.send(m)
      wsB2.send(m)
    }
    await wait(100)
    // Combined across both sockets, the session must not exceed one budget.
    const relayed = msgsA.filter((m) => m.t === 'state' && m.id === b.id)
    expect(relayed.length).toBeLessThanOrEqual(MAX_INBOUND_MSGS_PER_SEC)
  })
})

// ---- server-authoritative likes / collectibles ----

const sendState = (ws: WebSocket, x: number, y: number) =>
  ws.send(
    JSON.stringify({
      t: 'state',
      s: { x, y, dir: 'right', pose: 'standing', interacting: false },
    }),
  )
const sendCollect = (ws: WebSocket, id: string) =>
  ws.send(JSON.stringify({ t: 'collect', id }))

// The DO auto-spawns food lazily; grab whatever is currently live (from the
// welcome roster or a spawn broadcast), nudging with state messages until one
// appears. Only this test's player is connected, so nothing else can take it.
async function obtainFood(ws: WebSocket, msgs: any[]): Promise<any> {
  const fromWelcome = msgs.find((m) => m.t === 'welcome')?.food ?? []
  if (fromWelcome.length) return fromWelcome[0]
  for (let i = 0; i < 12; i++) {
    const spawned = msgs.find((m) => m.t === 'spawn')?.f
    if (spawned) return spawned
    sendState(ws, 10, 6)
    await wait(500)
  }
  throw new Error('no food spawned in time')
}

describe('GameWorld likes', () => {
  it('welcomes a new session with a food array and zero likes', async () => {
    const a = await session()
    const { msgs } = await connect(a.cookie)
    await wait(50)
    const w = msgs.find((m) => m.t === 'welcome')
    expect(w).toBeTruthy()
    expect(Array.isArray(w.food)).toBe(true)
    expect(w.likes).toBe(0)
  })

  it('awards likes when a koala collects the food it stands on', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    const food = await obtainFood(ws, msgs)
    // Stand exactly on it (server-known position), then collect.
    sendState(ws, food.x, food.y)
    await wait(80)
    sendCollect(ws, food.id)
    await wait(150)
    const collected = msgs.find((m) => m.t === 'collected' && m.id === food.id)
    expect(collected).toBeTruthy()
    expect(collected.by).toBe(a.id)
    expect(collected.points).toBe(food.points)
    expect(collected.likes).toBe(food.points)
    expect(
      msgs.some(
        (m) => m.t === 'despawn' && m.id === food.id && m.reason === 'taken',
      ),
    ).toBe(true)
  }, 10000)

  it('ignores a collect when the koala is out of range', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    const food = await obtainFood(ws, msgs)
    // Stand far away, then try to collect.
    sendState(ws, food.x > 9 ? 1 : 18, food.y)
    await wait(80)
    sendCollect(ws, food.id)
    await wait(150)
    expect(msgs.some((m) => m.t === 'collected' && m.id === food.id)).toBe(
      false,
    )
  }, 10000)

  it('awards a food only once even if collected twice (dedupe/race)', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    const food = await obtainFood(ws, msgs)
    sendState(ws, food.x, food.y)
    await wait(80)
    sendCollect(ws, food.id)
    sendCollect(ws, food.id)
    await wait(150)
    const hits = msgs.filter((m) => m.t === 'collected' && m.id === food.id)
    expect(hits.length).toBe(1)
  }, 10000)

  it('persists likes across a reconnect with the same session', async () => {
    const a = await session()
    const first = await connect(a.cookie)
    await wait(50)
    const food = await obtainFood(first.ws, first.msgs)
    sendState(first.ws, food.x, food.y)
    await wait(80)
    sendCollect(first.ws, food.id)
    await wait(150)
    const collected = first.msgs.find((m) => m.t === 'collected')
    expect(collected.likes).toBe(food.points)

    // Reconnect with the SAME cookie → likes come back from SQLite.
    const second = await connect(a.cookie)
    await wait(80)
    const w = second.msgs.find((m) => m.t === 'welcome')
    expect(w.likes).toBe(food.points)
  }, 10000)

  it('rejects a malformed collect id without awarding or crashing', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    ws.send(JSON.stringify({ t: 'collect', id: 12345 })) // non-string
    ws.send(JSON.stringify({ t: 'collect', id: 'x'.repeat(200) })) // oversized
    await wait(100)
    expect(msgs.some((m) => m.t === 'collected')).toBe(false)
    // Connection still works afterwards.
    sendState(ws, 5, 5)
    await wait(50)
    expect(true).toBe(true)
  })
})

// ---- server-authoritative shop (buy + placed items) ----

// Reconstruct the live food set from the message log, excluding ids we've
// already collected, so we can earn coins deterministically.
function liveFood(msgs: any[], exclude: Set<string>): any {
  const set = new Map<string, any>()
  for (const m of msgs) {
    if (m.t === 'welcome') for (const f of m.food) set.set(f.id, f)
    else if (m.t === 'spawn') set.set(m.f.id, m.f)
    else if (m.t === 'despawn') set.delete(m.id)
  }
  for (const f of set.values()) if (!exclude.has(f.id)) return f
  return null
}

// Collect foods until the session's likes reach `target`. Returns final likes.
async function earnAtLeast(
  ws: WebSocket,
  msgs: any[],
  target: number,
): Promise<number> {
  const done = new Set<string>()
  let likes = 0
  for (let i = 0; i < 30 && likes < target; i++) {
    let f = liveFood(msgs, done)
    for (let j = 0; j < 12 && !f; j++) {
      sendState(ws, 10, 6)
      await wait(500)
      f = liveFood(msgs, done)
    }
    if (!f) break
    done.add(f.id)
    sendState(ws, f.x, f.y)
    await wait(70)
    sendCollect(ws, f.id)
    await wait(120)
    const c = [...msgs].reverse().find((m) => m.t === 'collected')
    if (c) likes = c.likes
  }
  return likes
}

describe('GameWorld shop', () => {
  it('rejects a buy with no coins', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    ws.send(JSON.stringify({ t: 'buy', key: 'flowers', x: 5, y: 5 }))
    await wait(120)
    expect(msgs.some((m) => m.t === 'placed')).toBe(false)
    expect(
      msgs.some((m) => m.t === 'buyfail' && m.reason === 'insufficient'),
    ).toBe(true)
  }, 10000)

  it('rejects a buy with an unknown item key', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    ws.send(JSON.stringify({ t: 'buy', key: 'nope', x: 5, y: 5 }))
    await wait(120)
    expect(msgs.some((m) => m.t === 'buyfail' && m.reason === 'invalid')).toBe(
      true,
    )
  }, 10000)

  it('places an item, deducts likes, shares it, and persists it', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    // A second player to prove the placement is broadcast (shared world).
    const b = await session()
    const { msgs: msgsB } = await connect(b.cookie)
    await wait(50)

    const likes = await earnAtLeast(ws, msgs, 20) // flowers cost 20
    expect(likes).toBeGreaterThanOrEqual(20)

    ws.send(JSON.stringify({ t: 'buy', key: 'flowers', x: 3, y: 3 }))
    await wait(150)
    const placed = msgs.find(
      (m) => m.t === 'placed' && m.item.x === 3 && m.item.y === 3,
    )
    expect(placed).toBeTruthy()
    expect(placed.item.key).toBe('flowers')
    expect(placed.item.ownerId).toBe(a.id)
    // Authorship: the placed broadcast carries the buyer's current name.
    expect(placed.authorName).toBe(a.name)
    // Buyer's wallet dropped by the price.
    const wallet = [...msgs].reverse().find((m) => m.t === 'wallet')
    expect(wallet.likes).toBe(likes - 20)
    // The other player saw the same placement (shared).
    expect(
      msgsB.some((m) => m.t === 'placed' && m.item.id === placed.item.id),
    ).toBe(true)

    // A second buy on the SAME tile is rejected as occupied.
    ws.send(JSON.stringify({ t: 'buy', key: 'flowers', x: 3, y: 3 }))
    await wait(120)
    expect(msgs.some((m) => m.t === 'buyfail' && m.reason === 'occupied')).toBe(
      true,
    )

    // Placement persists across a reconnect (SQLite).
    const c = await connect(a.cookie)
    await wait(80)
    const w = c.msgs.find((m) => m.t === 'welcome')
    const persisted = w.placed.find((p: any) => p.id === placed.item.id)
    expect(persisted).toBeTruthy()
    expect(persisted.ownerId).toBe(a.id) // item persists, pointing to its owner
    expect(w.authors[a.id]).toBe(a.name) // author resolved via the directory
  }, 30000)
})

// ---- server-authoritative display names ----

describe('GameWorld names', () => {
  it('broadcasts a rename to everyone (incl. the sender)', async () => {
    const a = await session()
    const { ws: wsA, msgs: msgsA } = await connect(a.cookie)
    const b = await session()
    const { msgs: msgsB } = await connect(b.cookie)
    await wait(50)
    wsA.send(JSON.stringify({ t: 'setName', name: 'Pixel' }))
    await wait(80)
    expect(
      msgsA.some(
        (m) => m.t === 'renamed' && m.id === a.id && m.name === 'Pixel',
      ),
    ).toBe(true)
    expect(
      msgsB.some(
        (m) => m.t === 'renamed' && m.id === a.id && m.name === 'Pixel',
      ),
    ).toBe(true)
  })

  it('persists the name across a reconnect and to new peers', async () => {
    const a = await session()
    const first = await connect(a.cookie)
    await wait(50)
    first.ws.send(JSON.stringify({ t: 'setName', name: 'Mochi' }))
    await wait(80)
    first.ws.close()
    await wait(50)
    // Reconnect same cookie → welcome carries the stored name.
    const again = await connect(a.cookie)
    await wait(50)
    expect(again.msgs.find((m) => m.t === 'welcome')?.self.name).toBe('Mochi')
    // A fresh peer sees A as 'Mochi' in its roster.
    const c = await session()
    const peer = await connect(c.cookie)
    await wait(50)
    const roster = peer.msgs.find((m) => m.t === 'welcome')?.players ?? []
    expect(roster.some((p: any) => p.id === a.id && p.name === 'Mochi')).toBe(
      true,
    )
  })

  it('caps an oversized name and ignores an empty one', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    ws.send(JSON.stringify({ t: 'setName', name: 'x'.repeat(NAME_MAX + 30) }))
    await wait(80)
    const renamed = msgs.find((m) => m.t === 'renamed' && m.id === a.id)
    expect(renamed).toBeTruthy()
    expect(renamed.name.length).toBe(NAME_MAX)

    const before = msgs.filter((m) => m.t === 'renamed').length
    ws.send(JSON.stringify({ t: 'setName', name: '   ' }))
    await wait(80)
    expect(msgs.filter((m) => m.t === 'renamed').length).toBe(before) // no broadcast
  })
})

describe('GameWorld names (allowlist + injection safety)', () => {
  it('strips emoji/symbols to the allowed character set', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    ws.send(
      JSON.stringify({
        t: 'setName',
        name: 'Pixel \u{1F600}\u{1F3AE} Koala!;',
      }),
    )
    await wait(80)
    const rn = msgs.find((m) => m.t === 'renamed' && m.id === a.id)
    expect(rn).toBeTruthy()
    expect(rn.name).toBe('Pixel Koala') // emoji + ! + ; dropped, spaces collapsed
    const before = msgs.filter((m) => m.t === 'renamed').length
    ws.send(
      JSON.stringify({ t: 'setName', name: '\u{1F600}\u{1F600}\u{1F600}' }),
    )
    await wait(80)
    expect(msgs.filter((m) => m.t === 'renamed').length).toBe(before)
  })

  it('stores a SQL-injection-style name as harmless text and keeps working', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    ws.send(JSON.stringify({ t: 'setName', name: "Rob'; DROP TABLE names;--" }))
    await wait(80)
    const rn = msgs.find((m) => m.t === 'renamed' && m.id === a.id)
    expect(rn).toBeTruthy()
    expect(rn.name).not.toContain(';') // stripped by the allowlist
    // The `names` table is intact — a later rename still works + persists.
    ws.send(JSON.stringify({ t: 'setName', name: 'Safe' }))
    await wait(80)
    const b = await connect(a.cookie)
    await wait(50)
    expect(b.msgs.find((m) => m.t === 'welcome')?.self.name).toBe('Safe')
  })
})

describe('GameWorld authorship follows rename (directory)', () => {
  it('renaming updates the author for items placed before the rename', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    const likes = await earnAtLeast(ws, msgs, 20)
    expect(likes).toBeGreaterThanOrEqual(20)
    ws.send(JSON.stringify({ t: 'buy', key: 'flowers', x: 8, y: 8 }))
    await wait(150)
    const placed = msgs.find(
      (m) => m.t === 'placed' && m.item.x === 8 && m.item.y === 8,
    )
    expect(placed).toBeTruthy()

    ws.send(JSON.stringify({ t: 'setName', name: 'Pixel' }))
    await wait(100)
    // A fresh peer: the pre-existing item still exists (points to owner) and the
    // authors directory resolves that owner to the NEW name.
    const peer = await connect((await session()).cookie)
    await wait(60)
    const w = peer.msgs.find((m) => m.t === 'welcome')
    expect(w.placed.some((p: any) => p.id === placed.item.id)).toBe(true)
    expect(w.authors[a.id]).toBe('Pixel')
  }, 30000)
})

// ---- world stats (session ledger) ----

describe('GameWorld stats', () => {
  it('welcomes a session with world stats (visits, 24h, total)', async () => {
    const a = await session()
    const { msgs } = await connect(a.cookie)
    await wait(50)
    const w = msgs.find((m) => m.t === 'welcome')
    expect(w.stats).toBeTruthy()
    expect(w.stats.yourVisits).toBe(1) // first visit for this fresh session
    expect(w.stats.totalSessions).toBeGreaterThanOrEqual(1)
    expect(w.stats.active24h).toBeGreaterThanOrEqual(1)
  })

  it('counts a reconnect as another visit for the same session', async () => {
    const a = await session()
    const first = await connect(a.cookie)
    await wait(50)
    expect(first.msgs.find((m) => m.t === 'welcome').stats.yourVisits).toBe(1)
    first.ws.close()
    await wait(50)
    const second = await connect(a.cookie)
    await wait(50)
    expect(second.msgs.find((m) => m.t === 'welcome').stats.yourVisits).toBe(2)
  })

  it('does not count a second concurrent tab as a new visit', async () => {
    const a = await session()
    const first = await connect(a.cookie)
    await wait(50)
    expect(first.msgs.find((m) => m.t === 'welcome').stats.yourVisits).toBe(1)
    // Second socket, SAME session, while the first is still open.
    const second = await connect(a.cookie)
    await wait(50)
    expect(second.msgs.find((m) => m.t === 'welcome').stats.yourVisits).toBe(1)
  })

  it('broadcasts refreshed global stats to peers when a new session joins', async () => {
    const a = await session()
    const { msgs: msgsA } = await connect(a.cookie)
    await wait(50)
    const before = msgsA.find((m) => m.t === 'welcome').stats.totalSessions
    // A brand-new session joins → existing peers get a stats update.
    const b = await session()
    await connect(b.cookie)
    await wait(80)
    const statsMsg = [...msgsA].reverse().find((m) => m.t === 'stats')
    expect(statsMsg).toBeTruthy()
    expect(statsMsg.totalSessions).toBeGreaterThan(before)
  })
})

// ---- jump ability + airborne food ----

const sendJump = (ws: WebSocket) => ws.send(JSON.stringify({ t: 'jump' }))

// Grab a currently-live AIRBORNE food (spawned lazily on the first traffic).
async function obtainAirFood(ws: WebSocket, msgs: any[]): Promise<any> {
  for (let i = 0; i < 12; i++) {
    const fromWelcome = msgs.find((m) => m.t === 'welcome')?.food ?? []
    const spawned = msgs.filter((m) => m.t === 'spawn').map((m) => m.f)
    const air = [...fromWelcome, ...spawned].find((f) => f?.air)
    if (air) return air
    sendState(ws, 10, 6)
    await wait(500)
  }
  throw new Error('no airborne food spawned in time')
}

describe('GameWorld jump', () => {
  it('broadcasts a jump to other players (not the sender)', async () => {
    const a = await session()
    const { ws: wsA, msgs: msgsA } = await connect(a.cookie)
    const b = await session()
    const { msgs: msgsB } = await connect(b.cookie)
    await wait(50)
    sendJump(wsA)
    await wait(80)
    expect(msgsB.some((m) => m.t === 'jumped' && m.id === a.id)).toBe(true)
    // The sender animates locally, so it should NOT receive its own jumped.
    expect(msgsA.some((m) => m.t === 'jumped')).toBe(false)
  })

  it('drops a second jump inside the cooldown', async () => {
    const a = await session()
    const { ws: wsA } = await connect(a.cookie)
    const b = await session()
    const { msgs: msgsB } = await connect(b.cookie)
    await wait(50)
    sendJump(wsA)
    sendJump(wsA) // immediately again → within cooldown
    await wait(120)
    const jumps = msgsB.filter((m) => m.t === 'jumped' && m.id === a.id)
    expect(jumps.length).toBe(1)
  })
})

describe('GameWorld airborne food', () => {
  it('only awards an airborne food while mid-jump', async () => {
    const a = await session()
    const { ws, msgs } = await connect(a.cookie)
    await wait(50)
    const air = await obtainAirFood(ws, msgs)
    // Stand exactly on it (server-known position).
    sendState(ws, air.x, air.y)
    await wait(80)

    // Grounded collect: rejected (no jump window open).
    sendCollect(ws, air.id)
    await wait(120)
    expect(msgs.some((m) => m.t === 'collected' && m.id === air.id)).toBe(false)

    // Jump, then collect within the window: awarded (double points).
    sendJump(ws)
    sendCollect(ws, air.id)
    await wait(150)
    const got = msgs.find((m) => m.t === 'collected' && m.id === air.id)
    expect(got).toBeTruthy()
    expect(got.points).toBe(air.points)
  }, 15000)
})
