import { DurableObject } from 'cloudflare:workers'
import type {
  ClientMessage,
  Food,
  PlacedItem,
  Player,
  PlayerState,
  ServerMessage,
} from '@koala/shared'
import {
  ABILITY_COOLDOWNS_MS,
  ACTIVE_WINDOW_MS,
  AIR_COLLECT_RADIUS,
  AIR_FOOD_TTL_MS,
  AIR_PITY_MS,
  AIR_POINTS_MULT,
  AIR_SPAWN_SHARE,
  clampToSpeed,
  COLLECT_RADIUS,
  DEFAULT_BALLS,
  FOOD_SPAWN_COOLDOWN_MS,
  FOOD_TTL_MS,
  FOODS,
  FOOD_TOTAL_WEIGHT,
  foodCap,
  JUMP_DURATION_MS,
  MAX_INBOUND_MSGS_PER_SEC,
  MOVE_SPEED_TILES_PER_MS,
  PLACED_PERMANENT,
  PLACED_TTL_MS,
  PROTOCOL_VERSION,
  sanitizeAction,
  sanitizeBuy,
  sanitizeCollect,
  sanitizeMove,
  sanitizeName,
  sanitizePush,
  sanitizeState,
  SHOP_ITEMS_BY_KEY,
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
  private lastAirSpawnAt = 0 // for the airborne pity timer

  // When each session last started a jump (epoch ms). Ephemeral (jumps are
  // transient): used to gate airborne-food collection to a live jump window.
  private jumpAt = new Map<string, number>()

  // Per-(session, ability) last-used epoch ms for cooldown enforcement, keyed
  // `${sessionId}::${ability}`. Ephemeral; cleared on disconnect.
  private lastActionAt = new Map<string, number>()

  // Last accepted position + the server receive time (epoch ms) for each
  // session, used to cap movement speed. Ephemeral: a missing entry (first
  // update, respawn, or a hibernation wake) resets the baseline — that update is
  // accepted as-is and clamping starts from the next one.
  private lastMove = new Map<string, { x: number; y: number; t: number }>()

  // The movement-speed cap (tiles/ms) used by the state clamp. Defaults to the
  // real shared constant in production; tests raise it in-place (via
  // runInDurableObject) so movement-heavy setup isn't paced by the real speed,
  // while the anti-teleport tests keep this default to exercise the true cap.
  private moveSpeed = MOVE_SPEED_TILES_PER_MS

  // Server-owned placed decorations (bought with likes). Shared across players,
  // persisted in SQLite, expire on a wall-clock TTL. Kept in memory for fast
  // overlap checks + broadcasts; rehydrated from SQLite on wake.
  private placed = new Map<string, PlacedItem>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Durable state (survives hibernation, reconnects, return visits): per-session
    // "likes" (the coin wallet) and the shared placed items. Both live in this
    // world's SQLite (the `new_sqlite_classes` migration in wrangler.jsonc).
    const sql = this.ctx.storage.sql
    sql.exec(
      `CREATE TABLE IF NOT EXISTS likes (
         session TEXT PRIMARY KEY,
         likes   INTEGER NOT NULL DEFAULT 0,
         updated INTEGER NOT NULL
       )`,
    )
    sql.exec(
      `CREATE TABLE IF NOT EXISTS names (
         session TEXT PRIMARY KEY,
         name    TEXT NOT NULL,
         updated INTEGER NOT NULL
       )`,
    )
    // A durable ledger of every session that has ever joined this world — one row
    // per session, with a visit counter and a last-seen stamp. Powers the Settings
    // stats (total sessions ever, active in the last 24h, this session's visits).
    sql.exec(
      `CREATE TABLE IF NOT EXISTS sessions (
         session   TEXT PRIMARY KEY,
         firstSeen INTEGER NOT NULL,
         lastSeen  INTEGER NOT NULL,
         visits    INTEGER NOT NULL DEFAULT 0
       )`,
    )
    sql.exec(
      `CREATE TABLE IF NOT EXISTS placed (
         id       TEXT PRIMARY KEY,
         owner    TEXT NOT NULL,
         itemKey  TEXT NOT NULL,
         type     TEXT NOT NULL,
         x        INTEGER NOT NULL,
         y        INTEGER NOT NULL,
         w        INTEGER NOT NULL,
         h        INTEGER NOT NULL,
         placedAt INTEGER NOT NULL,
         expiresAt INTEGER NOT NULL
       )`,
    )
    // Drop anything already expired, then load the rest into memory. The author
    // name is NOT stored per item — it's resolved from the `names` table by owner.
    // Permanent items (expiresAt === PLACED_PERMANENT, i.e. 0 — the seeded balls)
    // are exempt from the reap.
    sql.exec(
      'DELETE FROM placed WHERE expiresAt <> ? AND expiresAt <= ?',
      PLACED_PERMANENT,
      Date.now(),
    )
    for (const r of sql.exec('SELECT * FROM placed').toArray()) {
      const item: PlacedItem = {
        id: String(r.id),
        key: String(r.itemKey),
        type: String(r.type),
        x: Number(r.x),
        y: Number(r.y),
        w: Number(r.w),
        h: Number(r.h),
        ownerId: String(r.owner),
        placedAt: Number(r.placedAt),
        expiresAt: Number(r.expiresAt),
      }
      this.placed.set(item.id, item)
    }
    // Seed the permanent default balls (idempotent by their stable ids — a wake
    // after they've been moved keeps the stored position). Runs after rehydrate so
    // it sees whatever SQLite already holds.
    this.seedDefaults(Date.now())
    // Rehydrate presence for sockets that survived hibernation, restoring each
    // player's last-known position from its attachment.
    const sockets = this.ctx.getWebSockets()
    for (const ws of sockets) {
      const a = ws.deserializeAttachment() as Attachment | null
      if (a) this.positions.set(a.id, { ...a.s })
    }
    // If we woke from hibernation with players still connected, our in-memory
    // food was wiped without per-item despawns — so those clients may still be
    // rendering stale food (which blinks forever, never getting a despawn). Push
    // a full resync (empty now) so they drop it; fresh food refills on the next
    // player traffic. (No sockets on a brand-new DO — accept happens in fetch.)
    if (sockets.length > 0) {
      this.broadcast({ t: 'foods', food: [...this.food.values()] })
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
    if (!id) return new Response('missing sid', { status: 400 })
    // A stored username (set via the shop's Settings) wins over the Worker's
    // default nameFor(id); first-timers get the default. Persist the default so
    // the `names` table has a row for everyone who connects — that lets the
    // authors directory resolve a name for any item owner, even offline ones.
    const stored = this.getName(id)
    const name = stored ?? url.searchParams.get('name') ?? 'Koala'
    if (!stored) this.saveName(id, name)

    // Is this session already present (e.g. a second tab)? A connect only counts
    // as a fresh "visit" when the session was fully offline beforehand — checked
    // before acceptWebSocket() so the new socket isn't in the set yet.
    const rejoining = this.ctx
      .getWebSockets()
      .some(
        (ws) => (ws.deserializeAttachment() as Attachment | null)?.id === id,
      )

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
    // Refresh the collectibles + placed items on join, then hand the newcomer
    // the current world plus their stored likes total.
    const nowJoin = Date.now()
    // Record the visit (bumps the counter only for a genuinely new arrival, but
    // always refreshes last-seen), then read the stats for this viewer.
    const yourVisits = this.touchSession(id, nowJoin, !rejoining)
    this.maybeSpawn(nowJoin)
    this.sweepPlaced(nowJoin)
    const placedItems = [...this.placed.values()]
    this.sendTo(server, {
      t: 'welcome',
      self,
      players,
      food: [...this.food.values()],
      placed: placedItems,
      authors: this.authorsFor(placedItems),
      likes: this.getLikes(id),
      stats: { ...this.globalStats(nowJoin), yourVisits },
      now: nowJoin,
    })

    // Announce the newcomer to everyone else.
    this.broadcast({ t: 'join', p: self }, id)
    // A brand-new session changes the global totals — push them to everyone else
    // so open Settings menus refresh (rejoins don't move these numbers).
    if (!rejoining) {
      this.broadcast({ t: 'stats', ...this.globalStats(nowJoin) }, id)
    }

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

    // Player traffic drives the collectibles + placed-item expiry (no game tick →
    // the DO can still hibernate when the park is empty).
    const now = Date.now()
    this.maybeSpawn(now)
    this.sweepPlaced(now)

    if (msg.t === 'state') {
      const s = sanitizeState(msg.s)
      if (!s) return
      // Cap how far the position may jump since the last accepted update, so a
      // hostile client can't teleport (which would beat the collect proximity
      // check — it validates against this server-side position). A live dash
      // window grants a one-off burst allowance. No prior sample → accept and
      // seed the baseline. Clamp x/y only; pose/dir/interacting are cosmetic.
      const prev = this.lastMove.get(a.id)
      if (prev) {
        // Credit the one-off dash allowance to whichever update interval the
        // dash landed in (its action timestamp is newer than our last accepted
        // sample) — robust to jitter, and dash's own cooldown bounds it to once
        // per lunge. Ignore the plain window here to avoid clamping honest dashes.
        const dashActive =
          (this.lastActionAt.get(`${a.id}::dash`) ?? 0) > prev.t
        const { x, y } = clampToSpeed(
          prev,
          s,
          now - prev.t,
          dashActive,
          this.moveSpeed,
        )
        s.x = x
        s.y = y
      }
      this.lastMove.set(a.id, { x: s.x, y: s.y, t: now })
      this.positions.set(a.id, s)
      // Persist last-known position on the socket so it survives hibernation.
      ws.serializeAttachment({ ...a, s } satisfies Attachment)
      this.broadcast({ t: 'state', id: a.id, s }, a.id)
      return
    }

    if (msg.t === 'setName') {
      const name = sanitizeName(msg.name)
      if (!name) return // invalid → no write, no broadcast
      this.saveName(a.id, name)
      // Update this socket's attachment + any sibling sockets of the same
      // session (e.g. a second tab) so their name tag stays right on reconnect.
      for (const other of this.ctx.getWebSockets()) {
        const oa = other.deserializeAttachment() as Attachment | null
        if (oa?.id === a.id)
          other.serializeAttachment({ ...oa, name } satisfies Attachment)
      }
      this.broadcast({ t: 'renamed', id: a.id, name }) // everyone incl. sender = ack
      return
    }

    if (msg.t === 'action') {
      const act = sanitizeAction(msg)
      if (!act) return
      // Per-ability cooldown (independent of the flood budget).
      const ck = `${a.id}::${act.a}`
      const last = this.lastActionAt.get(ck) ?? 0
      if (now - last < ABILITY_COOLDOWNS_MS[act.a]) return
      this.lastActionAt.set(ck, now)
      // Jump additionally opens this session's airborne-food collect window.
      if (act.a === 'jump') this.jumpAt.set(a.id, now)
      // Broadcast so everyone else can animate it (the actor plays it locally).
      this.broadcast({ t: 'acted', id: a.id, a: act.a }, a.id)
      return
    }

    if (msg.t === 'push') {
      // A ball was launched. Motion is transient (client-simulated), so we only
      // update the in-memory position and relay the launch velocity to peers —
      // NO SQL here. The resting position is persisted later, on `rest`.
      const r = sanitizePush(msg)
      if (!r) return
      const item = this.placed.get(r.id)
      if (!item || item.type !== 'ball') return
      item.x = r.x
      item.y = r.y
      this.broadcast(
        { t: 'pushed', id: r.id, x: r.x, y: r.y, vx: r.vx, vy: r.vy },
        a.id, // exclude the sender — it already simulates the roll locally
      )
      return
    }

    if (msg.t === 'rest') {
      // A ball settled — the single persist point. Round to a whole tile (the x/y
      // columns are INTEGER) and re-clamp so rounding can't push out of bounds,
      // write SQLite once, then broadcast the authoritative tile to EVERYONE (incl.
      // the sender, so its fractional local position snaps to the stored value).
      const r = sanitizeMove(msg)
      if (!r) return
      const item = this.placed.get(r.id)
      if (!item || item.type !== 'ball') return
      // Clamp to the integer tiles a 1×1 ball can actually occupy — matching
      // updateSlappables' bounce ceiling (groundRows - h). A tighter bound here
      // would snap a ball resting on the bottom row up a tile.
      const rx = Math.max(0, Math.min(WORLD.cols - 1, Math.round(r.x)))
      const ry = Math.max(1, Math.min(WORLD.groundRows - 1, Math.round(r.y)))
      item.x = rx
      item.y = ry
      this.ctx.storage.sql.exec(
        'UPDATE placed SET x = ?, y = ? WHERE id = ?',
        rx,
        ry,
        r.id,
      )
      this.broadcast({ t: 'moved', id: r.id, x: rx, y: ry })
      return
    }

    if (msg.t === 'collect') {
      const c = sanitizeCollect(msg)
      if (!c) return
      const f = this.food.get(c.id)
      if (!f) return // already taken / unknown — dedupe no-op
      const ttl = f.air ? AIR_FOOD_TTL_MS : FOOD_TTL_MS
      if (now - f.bornAt > ttl) {
        // Stale; sweep it and tell everyone.
        this.food.delete(c.id)
        this.broadcast({ t: 'despawn', id: c.id, reason: 'expired' })
        return
      }
      // Airborne food can only be grabbed during a live jump window — the whole
      // point of the jump ability. (Ground food has no such gate.)
      if (f.air) {
        const ja = this.jumpAt.get(a.id)
        if (ja == null || now - ja > JUMP_DURATION_MS) return
      }
      // Validate against the SERVER-known position, never anything on the wire.
      const p = this.positions.get(a.id)
      if (!p) return
      const reach = f.air ? AIR_COLLECT_RADIUS : COLLECT_RADIUS
      const dx = p.x - f.x
      const dy = p.y - f.y
      if (dx * dx + dy * dy > reach * reach) return
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
      return
    }

    if (msg.t === 'buy') {
      const b = sanitizeBuy(msg)
      if (!b) {
        this.sendTo(ws, { t: 'buyfail', reason: 'invalid' })
        return
      }
      // Server-authoritative: the tile must be free of other placed items, and
      // the buyer must be able to afford it. (Base-object avoidance is the
      // client's placement choice; the server owns coins + the placed set.)
      if (this.overlapsPlaced(b.x, b.y, b.item.w, b.item.h)) {
        this.sendTo(ws, { t: 'buyfail', reason: 'occupied' })
        return
      }
      // Spend only when the player can afford it, so addLikes() never drives a
      // balance negative (a session's row is first created positive by a
      // collect; a spend of <= balance keeps it >= 0).
      if (this.getLikes(a.id) < b.item.price) {
        this.sendTo(ws, { t: 'buyfail', reason: 'insufficient' })
        return
      }
      const likes = this.addLikes(a.id, -b.item.price)
      const item: PlacedItem = {
        id: crypto.randomUUID(),
        key: b.item.key,
        type: b.item.type,
        x: b.x,
        y: b.y,
        w: b.item.w,
        h: b.item.h,
        ownerId: a.id,
        placedAt: now,
        expiresAt: now + PLACED_TTL_MS,
      }
      // Persist first, then mirror in memory — so an (unlikely) SQL throw rolls
      // back the whole turn (DO transaction) without leaving an orphan in memory.
      this.ctx.storage.sql.exec(
        `INSERT INTO placed (id, owner, itemKey, type, x, y, w, h, placedAt, expiresAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.ownerId,
        item.key,
        item.type,
        item.x,
        item.y,
        item.w,
        item.h,
        item.placedAt,
        item.expiresAt,
      )
      this.placed.set(item.id, item)
      // Include the buyer's current name so every client can fill its authors map.
      this.broadcast({ t: 'placed', item, authorName: a.name })
      this.sendTo(ws, { t: 'wallet', likes }) // buyer's new balance
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
      this.jumpAt.delete(a.id)
      this.lastMove.delete(a.id)
      for (const k of this.lastActionAt.keys()) {
        if (k.startsWith(`${a.id}::`)) this.lastActionAt.delete(k)
      }
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

  // ---- session ledger + stats (durable) ----

  /** Upsert a session row: refresh last-seen, and add one visit when `newVisit`.
   *  Returns this session's total visit count. */
  private touchSession(id: string, now: number, newVisit: boolean): number {
    const inc = newVisit ? 1 : 0
    const row = this.ctx.storage.sql
      .exec(
        `INSERT INTO sessions (session, firstSeen, lastSeen, visits) VALUES (?, ?, ?, ?)
         ON CONFLICT(session) DO UPDATE SET
           lastSeen = excluded.lastSeen,
           visits = visits + ?
         RETURNING visits`,
        id,
        now,
        now,
        inc,
        inc,
      )
      .one()
    return Number(row.visits)
  }

  /** Global (same-for-everyone) stats: distinct sessions ever + in the last 24h. */
  private globalStats(now: number): {
    active24h: number
    totalSessions: number
  } {
    const sql = this.ctx.storage.sql
    const active24h = Number(
      sql
        .exec(
          'SELECT COUNT(*) AS n FROM sessions WHERE lastSeen > ?',
          now - ACTIVE_WINDOW_MS,
        )
        .one().n,
    )
    const totalSessions = Number(
      sql.exec('SELECT COUNT(*) AS n FROM sessions').one().n,
    )
    return { active24h, totalSessions }
  }

  // ---- collectibles (no game tick: lazy top-up on player traffic) ----

  /** Sweep expired food and top up the map. One shared budget — foodCap(players)
   *  (~half the crowd, rounded up) — and one cooldown. Each spawn rolls
   *  AIR_SPAWN_SHARE to be airborne (else ground), so the total never exceeds the
   *  cap and airborne food can appear at any player count (including solo). A pity
   *  timer (AIR_PITY_MS) forces airborne if it's been absent too long. */
  private maybeSpawn(now: number): void {
    for (const [id, f] of this.food) {
      const ttl = f.air ? AIR_FOOD_TTL_MS : FOOD_TTL_MS
      if (now - f.bornAt > ttl) {
        this.food.delete(id)
        this.broadcast({ t: 'despawn', id, reason: 'expired' })
      }
    }
    const cap = foodCap(this.ctx.getWebSockets().length)
    if (
      this.food.size < cap &&
      now - this.lastSpawnAt >= FOOD_SPAWN_COOLDOWN_MS
    ) {
      this.lastSpawnAt = now
      // Start the pity clock on the first spawn, then force airborne if none has
      // spawned within AIR_PITY_MS; otherwise a plain AIR_SPAWN_SHARE coin flip.
      if (this.lastAirSpawnAt === 0) this.lastAirSpawnAt = now
      const air =
        now - this.lastAirSpawnAt >= AIR_PITY_MS ||
        Math.random() < AIR_SPAWN_SHARE
      if (air) this.lastAirSpawnAt = now
      const f = this.spawnFood(now, air)
      if (f) this.broadcast({ t: 'spawn', f })
    }
  }

  private spawnFood(now: number, air: boolean): Food | null {
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
        points: air ? pick.points * AIR_POINTS_MULT : pick.points,
        bornAt: now,
        ...(air ? { air: true } : {}),
      }
      this.food.set(f.id, f)
      return f
    }
    return null
  }

  // ---- display names (durable, per session) ----

  private getName(id: string): string | null {
    const rows = this.ctx.storage.sql
      .exec('SELECT name FROM names WHERE session = ?', id)
      .toArray()
    return rows.length ? String(rows[0].name) : null
  }

  private saveName(id: string, name: string): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO names (session, name, updated) VALUES (?, ?, ?)
       ON CONFLICT(session) DO UPDATE SET name = excluded.name, updated = excluded.updated`,
      id,
      name,
      Date.now(),
    )
  }

  /** ownerId → current name for the given items (every owner has a names row,
   *  persisted on connect), so clients can label items whose owner is offline. */
  private authorsFor(items: PlacedItem[]): Record<string, string> {
    const authors: Record<string, string> = {}
    for (const it of items) {
      if (!it.ownerId) continue // system-seeded items (balls) have no author
      if (!(it.ownerId in authors)) {
        authors[it.ownerId] = this.getName(it.ownerId) ?? 'Koala'
      }
    }
    return authors
  }

  // ---- placed items (durable, shared) ----

  private overlapsPlaced(x: number, y: number, w: number, h: number): boolean {
    for (const p of this.placed.values()) {
      // Balls are non-solid (the cat walks through them and they roll around), so
      // they never block a purchase — and a decoration can share a ball's tile.
      if (p.type === 'ball') continue
      if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) {
        return true
      }
    }
    return false
  }

  /** Seed the permanent default balls exactly once. INSERT OR IGNORE keyed on the
   *  stable DEFAULT_BALLS ids makes this idempotent across every DO wake: the
   *  first construction inserts them, later wakes no-op, and a ball a player has
   *  rolled to a new tile (persisted via `rest`) is kept — existence is checked by
   *  id only, never position. Owner is '' (system); authorsFor skips empty owners
   *  so no phantom author tag is drawn near them. */
  private seedDefaults(now: number): void {
    const ball = SHOP_ITEMS_BY_KEY.ball
    for (const d of DEFAULT_BALLS) {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO placed (id, owner, itemKey, type, x, y, w, h, placedAt, expiresAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.id,
        '',
        ball.key,
        ball.type,
        d.x,
        d.y,
        ball.w,
        ball.h,
        now,
        PLACED_PERMANENT,
      )
      if (!this.placed.has(d.id)) {
        this.placed.set(d.id, {
          id: d.id,
          key: ball.key,
          type: ball.type,
          x: d.x,
          y: d.y,
          w: ball.w,
          h: ball.h,
          ownerId: '',
          placedAt: now,
          expiresAt: PLACED_PERMANENT,
        })
      }
    }
  }

  /** Remove expired placed items (lazy, driven by player traffic). Permanent
   *  items (the seeded balls, expiresAt === PLACED_PERMANENT) are never swept. */
  private sweepPlaced(now: number): void {
    for (const [id, p] of this.placed) {
      if (p.expiresAt !== PLACED_PERMANENT && p.expiresAt <= now) {
        this.placed.delete(id)
        this.ctx.storage.sql.exec('DELETE FROM placed WHERE id = ?', id)
        this.broadcast({ t: 'unplaced', id, reason: 'expired' })
      }
    }
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
