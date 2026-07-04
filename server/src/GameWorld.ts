import { DurableObject } from 'cloudflare:workers'
import type {
  ClientMessage,
  Food,
  Player,
  PlayerState,
  ServerMessage,
} from '@koala/shared'
import {
  COLLECT_RADIUS,
  FOOD_SPAWN_COOLDOWN_MS,
  FOOD_TTL_MS,
  FOODS,
  FOOD_TOTAL_WEIGHT,
  MAX_FOOD,
  MAX_INBOUND_MSGS_PER_SEC,
  PROTOCOL_VERSION,
  sanitizeCollect,
  sanitizeState,
  WORLD,
} from '@koala/shared'
import type { Env } from './types'

// Per-socket metadata. Stored via serializeAttachment so it survives Durable
// Object hibernation (the socket stays connected while the DO sleeps). We keep
// the last-known state `s` here too, so a wake doesn't snap idle players back
// to spawn for anyone who joins during the quiet period.
interface Attachment {
  id: string
  name: string
  v: number
  s: PlayerState
}

// Where a koala first appears — centre of the park.
const SPAWN: PlayerState = {
  x: WORLD.cols / 2,
  y: WORLD.groundRows / 2,
  dir: 'right',
  pose: 'standing',
  interacting: false,
}

/**
 * The single authoritative server for one shared park. Every player connecting
 * to `world-main` is routed here. It coordinates presence and relays movement;
 * it does NOT run a game tick, so it can hibernate (staying cheap) whenever the
 * park is idle — positions are ephemeral and re-sent by clients on wake.
 */
export class GameWorld extends DurableObject<Env> {
  // Live positions, keyed by session id. In-memory only: cleared on hibernation
  // and repopulated as peers send their next state (or from SPAWN on wake).
  private positions = new Map<string, PlayerState>()

  // Sliding 1s window of inbound message timestamps, keyed by SESSION id (not
  // socket) so opening extra tabs/connections can't multiply the flood budget.
  private rate = new Map<string, number[]>()

  // Server-owned collectibles, keyed by food id. In-memory + ephemeral (like
  // positions): a hibernation wake starts empty and refills via lazy top-up.
  private food = new Map<string, Food>()
  private lastSpawnAt = 0

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Durable per-session "likes" (points). This is the ONLY persisted state —
    // it survives hibernation, reconnects and return visits. The table lives in
    // this world's SQLite (the `new_sqlite_classes` migration in wrangler.jsonc).
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS likes (
         session TEXT PRIMARY KEY,
         likes   INTEGER NOT NULL DEFAULT 0,
         updated INTEGER NOT NULL
       )`,
    )
    // Rehydrate presence for sockets that survived hibernation, restoring each
    // player's last-known position from its attachment.
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null
      if (a) this.positions.set(a.id, { ...a.s })
    }
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    // The Worker has already authenticated the session and passes the trusted
    // id/name as internal query params (any client-supplied values were
    // overwritten upstream).
    const url = new URL(req.url)
    const id = url.searchParams.get('sid')
    const name = url.searchParams.get('name') ?? 'Koala'
    if (!id) return new Response('missing sid', { status: 400 })

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    // Seed from any position this session already has (a second tab), else spawn.
    const start = this.positions.get(id) ?? { ...SPAWN }
    server.serializeAttachment({
      id,
      name,
      v: PROTOCOL_VERSION,
      s: start,
    } satisfies Attachment)
    this.positions.set(id, start)

    // Tell the newcomer who is already in the park.
    const players: Player[] = []
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === server) continue
      const a = ws.deserializeAttachment() as Attachment | null
      if (!a || a.id === id) continue
      players.push({
        id: a.id,
        name: a.name,
        ...(this.positions.get(a.id) ?? SPAWN),
      })
    }
    const self: Player = { id, name, ...start }
    // Refresh the collectibles on join, then hand the newcomer the current set
    // plus their stored likes total.
    this.maybeSpawn(Date.now())
    this.sendTo(server, {
      t: 'welcome',
      self,
      players,
      food: [...this.food.values()],
      likes: this.getLikes(id),
      now: Date.now(),
    })

    // Announce the newcomer to everyone else.
    this.broadcast({ t: 'join', p: self }, id)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment | null
    if (!a) {
      ws.close(1011, 'no session')
      return
    }
    // Best-effort anti-cheat: drop floods silently rather than disconnecting.
    if (!this.allow(a.id)) return

    let msg: ClientMessage
    try {
      const text =
        typeof message === 'string'
          ? message
          : new TextDecoder().decode(message)
      msg = JSON.parse(text) as ClientMessage
    } catch {
      return
    }

    // Player traffic drives the collectibles (no game tick → the DO can still
    // hibernate when the park is empty). Sweep expired + top up on every message.
    const now = Date.now()
    this.maybeSpawn(now)

    if (msg.t === 'state') {
      const s = sanitizeState(msg.s)
      if (!s) return
      this.positions.set(a.id, s)
      // Persist last-known position on the socket so it survives hibernation.
      ws.serializeAttachment({ ...a, s } satisfies Attachment)
      this.broadcast({ t: 'state', id: a.id, s }, a.id)
      return
    }

    if (msg.t === 'collect') {
      const c = sanitizeCollect(msg)
      if (!c) return
      const f = this.food.get(c.id)
      if (!f) return // already taken / unknown — dedupe no-op
      if (now - f.bornAt > FOOD_TTL_MS) {
        // Stale; sweep it and tell everyone.
        this.food.delete(c.id)
        this.broadcast({ t: 'despawn', id: c.id, reason: 'expired' })
        return
      }
      // Validate against the SERVER-known position, never anything on the wire.
      const p = this.positions.get(a.id)
      if (!p) return
      const dx = p.x - f.x
      const dy = p.y - f.y
      if (dx * dx + dy * dy > COLLECT_RADIUS * COLLECT_RADIUS) return
      // Delete before awarding: the DO is single-threaded per turn, so this is
      // an atomic claim — a racing collect for the same id then hits `!f`.
      this.food.delete(c.id)
      const likes = this.addLikes(a.id, f.points)
      this.broadcast({ t: 'despawn', id: c.id, reason: 'taken' })
      this.broadcast({
        t: 'collected',
        id: c.id,
        by: a.id,
        points: f.points,
        likes,
      })
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.dropped(ws)
  }

  webSocketError(ws: WebSocket): void {
    this.dropped(ws)
  }

  // ---- internals ----

  private dropped(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as Attachment | null
    if (!a) return
    // Keep the player present if another socket (e.g. a second tab) shares the
    // same session id.
    const stillHere = this.ctx
      .getWebSockets()
      .some(
        (o) =>
          o !== ws &&
          (o.deserializeAttachment() as Attachment | null)?.id === a.id,
      )
    if (!stillHere) {
      this.positions.delete(a.id)
      this.rate.delete(a.id)
      this.broadcast({ t: 'leave', id: a.id }, a.id)
    }
  }

  private allow(id: string): boolean {
    const now = Date.now()
    const win = this.rate.get(id) ?? []
    while (win.length && now - win[0] > 1000) win.shift()
    if (win.length >= MAX_INBOUND_MSGS_PER_SEC) return false
    win.push(now)
    this.rate.set(id, win)
    return true
  }

  // ---- likes (durable, SQLite) ----

  private getLikes(id: string): number {
    const rows = this.ctx.storage.sql
      .exec('SELECT likes FROM likes WHERE session = ?', id)
      .toArray()
    return rows.length ? Number(rows[0].likes) : 0
  }

  /** Add points to a session's likes and return the new authoritative total. */
  private addLikes(id: string, delta: number): number {
    const row = this.ctx.storage.sql
      .exec(
        `INSERT INTO likes (session, likes, updated) VALUES (?, ?, ?)
         ON CONFLICT(session) DO UPDATE SET
           likes = likes + excluded.likes,
           updated = excluded.updated
         RETURNING likes`,
        id,
        delta,
        Date.now(),
      )
      .one()
    return Number(row.likes)
  }

  // ---- collectibles (no game tick: lazy top-up on player traffic) ----

  /** Sweep expired food and spawn at most one, respecting the cooldown + cap. */
  private maybeSpawn(now: number): void {
    for (const [id, f] of this.food) {
      if (now - f.bornAt > FOOD_TTL_MS) {
        this.food.delete(id)
        this.broadcast({ t: 'despawn', id, reason: 'expired' })
      }
    }
    if (this.food.size >= MAX_FOOD) return
    if (now - this.lastSpawnAt < FOOD_SPAWN_COOLDOWN_MS) return
    this.lastSpawnAt = now
    const f = this.spawnFood(now)
    if (f) this.broadcast({ t: 'spawn', f })
  }

  private spawnFood(now: number): Food | null {
    // Weighted pick over the shared FOODS table.
    let r = Math.random() * FOOD_TOTAL_WEIGHT
    let pick = FOODS[0]
    for (const def of FOODS) {
      r -= def.weight
      if (r <= 0) {
        pick = def
        break
      }
    }
    // Find an open tile not on top of another food. Objects aren't solid (the
    // cat walks freely), so any open grid cell is reachable/collectable.
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = 1 + Math.floor(Math.random() * (WORLD.cols - 2))
      const y = 2 + Math.floor(Math.random() * (WORLD.groundRows - 4))
      let clash = false
      for (const f of this.food.values()) {
        const dx = f.x - x
        const dy = f.y - y
        if (dx * dx + dy * dy < 1.2 * 1.2) {
          clash = true
          break
        }
      }
      if (clash) continue
      const f: Food = {
        id: crypto.randomUUID(),
        key: pick.key,
        x,
        y,
        points: pick.points,
        bornAt: now,
      }
      this.food.set(f.id, f)
      return f
    }
    return null
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // Socket already gone; ignore.
    }
  }

  private broadcast(msg: ServerMessage, exceptId?: string): void {
    const data = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      if (exceptId) {
        const a = ws.deserializeAttachment() as Attachment | null
        if (a?.id === exceptId) continue
      }
      try {
        ws.send(data)
      } catch {
        // Ignore individual send failures; the close handler will clean up.
      }
    }
  }
}
