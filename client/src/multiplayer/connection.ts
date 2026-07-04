// Browser side of Koala's Park multiplayer.
//
// Responsibilities, kept deliberately small:
//   1. establish the anonymous session cookie (POST /session, credentialed)
//   2. hold a WebSocket to the shared world, reconnecting with backoff
//   3. keep a Map of remote players that the game loop reads each frame
//   4. throttle outgoing position updates to CLIENT_SEND_HZ
//
// It is framework-agnostic (no React) so ParkGame can create it inside its
// existing canvas effect and tear it down in the same cleanup. It never throws
// for network reasons — if the backend is down the game simply runs solo.

import type {
  Dir,
  BuyFailReason,
  CatPose,
  Food,
  PlacedItem,
  Player,
  PlayerState,
  ServerMessage,
  WorldStats,
} from '@koala/shared'
import { CLIENT_SEND_HZ, NAME_MAX } from '@koala/shared'

/** A player currently connected to the world (self included), for the roster. */
export interface OnlinePlayer {
  id: string
  name: string
  self: boolean
}

export interface RemotePlayer {
  id: string
  name: string
  // Latest authoritative position from the server (the interpolation target).
  x: number
  y: number
  dir: Dir
  pose: CatPose
  interacting: boolean
  // Smoothed on-screen position, advanced toward x/y by the game loop so remote
  // koalas glide between the ~12Hz updates instead of teleporting.
  rx: number
  ry: number
}

export interface Multiplayer {
  /** Remote players only (never includes self), keyed by session id. */
  readonly players: Map<string, RemotePlayer>
  /** Server-owned collectibles currently on the map, keyed by food id. */
  readonly food: Map<string, Food>
  /** Server-owned placed decorations (shop items), keyed by item id. */
  readonly placed: Map<string, PlacedItem>
  /** ownerId → current display name, for rendering item author labels. Updated
   *  live on rename, so it also covers owners who've left the park. */
  readonly authors: Map<string, string>
  self: Player | null
  connected: boolean
  /** This player's authoritative likes total (== coin wallet; server-tracked). */
  likes: number
  /** serverNow - clientNow (ms), from welcome. Add to Date.now() to read the
   *  server clock, so food TTL/pop timing is correct despite client clock skew. */
  clockOffset: number
  /** Durable world stats from the server (null until the first welcome). */
  stats: WorldStats | null
  /** Send local koala state; internally throttled to CLIENT_SEND_HZ. */
  sendState(s: PlayerState): void
  /** Ask the server to collect a food by id; the server validates + awards. */
  sendCollect(id: string): void
  /** Ask the server to buy + place a catalog item at a tile; server validates. */
  sendBuy(key: string, x: number, y: number): void
  /** Change this session's display name; server validates + persists + broadcasts. */
  sendName(name: string): void
  close(): void
}

const DEV = import.meta.env.DEV
const HTTP_BASE: string | undefined =
  import.meta.env.VITE_GAME_HTTP_URL ??
  (DEV ? 'http://localhost:8787' : undefined)
const WS_BASE: string | undefined =
  import.meta.env.VITE_GAME_WS_URL ?? (DEV ? 'ws://localhost:8787' : undefined)

/** Whether a multiplayer backend is configured for this build. */
export const MULTIPLAYER_ENABLED = Boolean(HTTP_BASE && WS_BASE)

/**
 * Start a multiplayer session. Returns null when no backend is configured
 * (e.g. a production build before the Worker is deployed), so callers can fall
 * back to solo play with a single `if`.
 */
export function createMultiplayer(
  opts: {
    onStatus?: (connected: boolean) => void
    /** Fired when this player's wallet (likes) changes. */
    onWallet?: (likes: number) => void
    /** Fired with the full placed set whenever it changes. */
    onPlaced?: (placed: PlacedItem[]) => void
    /** Fired when a buy is rejected by the server. */
    onBuyFail?: (reason: BuyFailReason) => void
    /** Fired with this player's own name (on welcome and on rename). */
    onName?: (name: string) => void
    /** Fired with the live roster (self + remotes) whenever presence changes. */
    onPresence?: (players: OnlinePlayer[]) => void
    /** Fired with the durable world stats (on welcome and on stats updates). */
    onStats?: (stats: WorldStats) => void
  } = {},
): Multiplayer | null {
  if (!HTTP_BASE || !WS_BASE) return null

  const players = new Map<string, RemotePlayer>()
  const food = new Map<string, Food>()
  const placed = new Map<string, PlacedItem>()
  const authors = new Map<string, string>()
  let ws: WebSocket | null = null
  let closed = false
  let retry = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const handle: Multiplayer = {
    players,
    food,
    placed,
    authors,
    self: null,
    connected: false,
    likes: 0,
    clockOffset: 0,
    stats: null,
    sendState,
    sendCollect,
    sendBuy,
    sendName,
    close,
  }

  const setLikes = (v: number) => {
    handle.likes = v
    opts.onWallet?.(v)
  }
  const setSelfName = (name: string) => {
    if (handle.self) handle.self.name = name
    opts.onName?.(name)
  }
  const emitPlaced = () => opts.onPlaced?.([...placed.values()])
  // The live roster = self (if known) + every remote player, sorted by name so
  // the Settings list is stable frame to frame.
  const emitPresence = () => {
    if (!opts.onPresence) return
    // While disconnected there is no live roster — even our own entry is gone.
    if (!handle.connected) {
      opts.onPresence([])
      return
    }
    const roster: OnlinePlayer[] = []
    if (handle.self)
      roster.push({ id: handle.self.id, name: handle.self.name, self: true })
    for (const p of players.values())
      roster.push({ id: p.id, name: p.name, self: false })
    roster.sort((a, b) => a.name.localeCompare(b.name))
    opts.onPresence(roster)
  }

  const setConnected = (v: boolean) => {
    if (handle.connected !== v) {
      handle.connected = v
      opts.onStatus?.(v)
    }
  }

  function upsert(p: Player) {
    if (handle.self && p.id === handle.self.id) return
    const existing = players.get(p.id)
    if (existing) {
      existing.x = p.x
      existing.y = p.y
      existing.dir = p.dir
      existing.pose = p.pose
      existing.interacting = p.interacting
      existing.name = p.name
    } else {
      players.set(p.id, { ...p, rx: p.x, ry: p.y })
    }
  }

  function onMessage(raw: string) {
    let msg: ServerMessage
    try {
      msg = JSON.parse(raw) as ServerMessage
    } catch {
      return
    }
    switch (msg.t) {
      case 'welcome':
        handle.self = msg.self
        opts.onName?.(msg.self.name)
        handle.clockOffset =
          typeof msg.now === 'number' ? msg.now - Date.now() : 0
        players.clear()
        for (const p of msg.players ?? []) upsert(p)
        food.clear()
        for (const f of msg.food ?? []) food.set(f.id, f)
        placed.clear()
        for (const it of msg.placed ?? []) placed.set(it.id, it)
        authors.clear()
        for (const [oid, nm] of Object.entries(msg.authors ?? {}))
          authors.set(oid, nm)
        setLikes(msg.likes ?? 0)
        handle.stats = msg.stats
        if (msg.stats) opts.onStats?.(msg.stats)
        emitPlaced()
        emitPresence()
        break
      case 'join':
        upsert(msg.p)
        emitPresence()
        break
      case 'leave':
        players.delete(msg.id)
        emitPresence()
        break
      case 'state': {
        if (handle.self && msg.id === handle.self.id) break
        const p = players.get(msg.id)
        if (p) {
          p.x = msg.s.x
          p.y = msg.s.y
          p.dir = msg.s.dir
          p.pose = msg.s.pose
          p.interacting = msg.s.interacting
        }
        break
      }
      case 'spawn':
        food.set(msg.f.id, msg.f)
        break
      case 'despawn':
        food.delete(msg.id)
        break
      case 'collected':
        // The server awards likes; only OUR total is echoed back to us.
        if (handle.self && msg.by === handle.self.id) setLikes(msg.likes)
        break
      case 'placed':
        placed.set(msg.item.id, msg.item)
        authors.set(msg.item.ownerId, msg.authorName)
        emitPlaced()
        break
      case 'unplaced':
        if (placed.delete(msg.id)) emitPlaced()
        break
      case 'wallet':
        setLikes(msg.likes)
        break
      case 'buyfail':
        opts.onBuyFail?.(msg.reason)
        break
      case 'renamed':
        if (handle.self && msg.id === handle.self.id) setSelfName(msg.name)
        else {
          const p = players.get(msg.id)
          if (p) p.name = msg.name // canvas name tag reads this each frame
        }
        // One update relabels ALL of this owner's items (author labels resolve
        // through this map), so a rename propagates to previously-placed items.
        authors.set(msg.id, msg.name)
        emitPresence() // roster name may have changed
        break
      case 'stats': {
        // Merge the fresh globals, preserving this viewer's own visit count.
        const next: WorldStats = {
          active24h: msg.active24h,
          totalSessions: msg.totalSessions,
          yourVisits: handle.stats?.yourVisits ?? 0,
        }
        handle.stats = next
        opts.onStats?.(next)
        break
      }
    }
  }

  function openSocket() {
    if (closed) return
    let socket: WebSocket
    try {
      socket = new WebSocket(`${WS_BASE}/world/main`)
    } catch {
      scheduleReconnect()
      return
    }
    ws = socket
    socket.addEventListener('open', () => {
      retry = 0
      setConnected(true)
    })
    socket.addEventListener('message', (e) => onMessage(e.data as string))
    socket.addEventListener('close', () => {
      if (ws === socket) ws = null
      setConnected(false)
      players.clear()
      food.clear()
      placed.clear()
      authors.clear()
      emitPlaced()
      emitPresence()
      scheduleReconnect()
    })
    // 'error' is always followed by 'close'; let close handle reconnection.
    socket.addEventListener('error', () => {})
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer) return
    // Exponential backoff, capped at 10s.
    const delay = Math.min(1000 * 2 ** retry, 10_000)
    retry++
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connect()
    }, delay)
  }

  async function connect() {
    if (closed) return
    try {
      // Establish / refresh the session cookie before upgrading.
      await fetch(`${HTTP_BASE}/session`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      scheduleReconnect()
      return
    }
    openSocket()
  }

  // ---- outbound throttling ----
  const minInterval = 1000 / CLIENT_SEND_HZ
  let lastSentAt = 0
  let lastSent: PlayerState | null = null

  function sendState(s: PlayerState) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const now = performance.now()
    if (now - lastSentAt < minInterval && !poseOrDirChanged(lastSent, s)) return
    lastSentAt = now
    lastSent = s
    try {
      ws.send(JSON.stringify({ t: 'state', s }))
    } catch {
      /* socket closing; the reconnect path will recover */
    }
  }

  // Not throttled — proximity collection is debounced client-side (one request
  // per food id) and still counts against the per-session inbound rate limit.
  function sendCollect(id: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify({ t: 'collect', id }))
    } catch {
      /* socket closing; the reconnect path will recover */
    }
  }

  function sendBuy(key: string, x: number, y: number) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify({ t: 'buy', key, x, y }))
    } catch {
      /* socket closing; the reconnect path will recover */
    }
  }

  function sendName(name: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const clean = name.trim().slice(0, NAME_MAX)
    if (!clean) return
    try {
      ws.send(JSON.stringify({ t: 'setName', name: clean }))
    } catch {
      /* socket closing; the reconnect path will recover */
    }
  }

  function close() {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    setConnected(false)
    players.clear()
    food.clear()
    placed.clear()
    authors.clear()
    if (ws) {
      const s = ws
      ws = null
      try {
        s.close()
      } catch {
        /* ignore */
      }
    }
  }

  void connect()
  return handle
}

// Send immediately (bypassing the rate throttle) when the pose or facing flips,
// so a remote koala's sit/sleep/turn shows up without waiting for the next tick.
function poseOrDirChanged(a: PlayerState | null, b: PlayerState): boolean {
  if (!a) return true
  return a.pose !== b.pose || a.dir !== b.dir || a.interacting !== b.interacting
}
