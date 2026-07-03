import { SELF } from 'cloudflare:test'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_INBOUND_MSGS_PER_SEC } from '@koala/shared'

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
