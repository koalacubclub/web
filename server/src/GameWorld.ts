import { DurableObject } from 'cloudflare:workers'
import type {
  ClientMessage,
  Player,
  PlayerState,
  ServerMessage,
} from '@koala/shared'
import {
  MAX_INBOUND_MSGS_PER_SEC,
  PROTOCOL_VERSION,
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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
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
    this.sendTo(server, { t: 'welcome', self, players, now: Date.now() })

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

    if (msg.t === 'state') {
      const s = sanitizeState(msg.s)
      if (!s) return
      this.positions.set(a.id, s)
      // Persist last-known position on the socket so it survives hibernation.
      ws.serializeAttachment({ ...a, s } satisfies Attachment)
      this.broadcast({ t: 'state', id: a.id, s }, a.id)
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
