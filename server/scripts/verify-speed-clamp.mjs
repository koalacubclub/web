// Live validation of the server-side movement-speed clamp (anti-teleport).
//
// You can't test an anti-cheat with the honest client — it never teleports. This
// is a MALICIOUS client: it opens two anonymous sessions, has an "attacker" send
// a raw teleport `state` (a jump no real client would send), and an "observer"
// (a different session) watches what position the server relays for the attacker.
// If the cap works, the observer sees the attacker pulled back to ~walking
// distance from its last position, not the far tile it claimed.
//
// Usage:
//   node server/scripts/verify-speed-clamp.mjs [httpBase]
//     httpBase defaults to https://game.koalacub.club
//     for local dev:  node server/scripts/verify-speed-clamp.mjs http://localhost:8787
//
// Requires Node >= 22 (global fetch + WebSocket). Exits non-zero on FAIL so it
// can double as a smoke test.

const HTTP = process.argv[2] || 'https://game.koalacub.club'
const WS = HTTP.replace(/^http/, 'ws')
const ORIGIN = 'https://www.koalacub.club' // allowlisted; node WS may omit Origin

async function mkSession() {
  const res = await fetch(`${HTTP}/session`, {
    method: 'POST',
    headers: { Origin: ORIGIN },
  })
  if (!res.ok) throw new Error(`/session failed: ${res.status}`)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const body = await res.json()
  return { cookie, id: body.id }
}

function connect(cookie) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS}/world/main`, {
      headers: { Cookie: cookie, Origin: ORIGIN },
    })
    ws.addEventListener('open', () => resolve(ws))
    ws.addEventListener('error', (e) =>
      reject(new Error(e.message || 'ws error')),
    )
  })
}

const send = (ws, obj) => ws.send(JSON.stringify(obj))
const state = (x, y) => ({
  t: 'state',
  s: { x, y, dir: 'right', pose: 'standing', interacting: false },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const attacker = await mkSession()
const observer = await mkSession()
console.log(`target: ${HTTP}\nattacker session: ${attacker.id}`)

const obsWs = await connect(observer.cookie)
const seen = []
obsWs.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.t === 'state' && m.id === attacker.id) seen.push(m.s)
})

const atkWs = await connect(attacker.cookie)
await sleep(300)
send(atkWs, state(5, 5)) // baseline (accepted as-is)
await sleep(300)
send(atkWs, state(50, 8)) // teleport ~45 tiles across the map
await sleep(600)

const last = seen[seen.length - 1]
console.log('observer saw attacker relayed at:', last)
if (!last) {
  console.log('INCONCLUSIVE: observer received no state for the attacker')
  process.exit(2)
} else if (last.x < 10) {
  console.log(
    `PASS ✅ teleport clamped: x=${last.x.toFixed(2)} (attacker claimed x=50)`,
  )
  process.exit(0)
} else {
  console.log(
    `FAIL ❌ teleport NOT clamped: x=${last.x.toFixed(2)} — server missing the cap?`,
  )
  process.exit(1)
}
