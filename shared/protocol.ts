// Shared wire protocol for Koala's Park multiplayer.
//
// Imported by BOTH the browser client (src/multiplayer/connection.ts) and the
// Cloudflare Worker / Durable Object (server/src/*). It must therefore stay
// dependency-free and use only erasable TypeScript (no `enum`, no namespaces)
// so it compiles under the app's strict tsconfig and the worker's tsconfig
// alike. Keep payload keys short — these travel on every position update.

// World bounds are duplicated here (rather than imported from ParkGame.tsx) so
// the server can validate positions without pulling in any browser/canvas code.
// These MUST stay in sync with MAP_COLS / GROUND_ROWS in ParkGame.tsx.
export const WORLD = {
  cols: 20, // MAP_COLS
  groundRows: 13, // GROUND_ROWS
} as const

export type Dir = 'left' | 'right'
export type CatPose = 'standing' | 'lying' | 'sleeping'

// The minimal per-player state that must travel over the wire for a remote
// koala to be drawn. Leg animation, tail wag and idle bob are all derived
// locally from the shared frame clock, so they never need to be sent.
export interface PlayerState {
  x: number
  y: number
  dir: Dir
  pose: CatPose
  interacting: boolean
}

export interface Player extends PlayerState {
  id: string
  name: string
}

// ---- Client -> Server ----
export type ClientMessage = { t: 'state'; s: PlayerState }

// ---- Server -> Client ----
export type ServerMessage =
  | { t: 'welcome'; self: Player; players: Player[]; now: number }
  | { t: 'join'; p: Player }
  | { t: 'leave'; id: string }
  | { t: 'state'; id: string; s: PlayerState }

export const PROTOCOL_VERSION = 1

// Client sends at most this many position updates per second (it may call the
// send function every frame; the client throttles down to this rate).
export const CLIENT_SEND_HZ = 12

// Best-effort server-side anti-cheat: inbound messages beyond this rate on a
// single connection are silently dropped. Sits comfortably above CLIENT_SEND_HZ
// so honest clients are never affected.
export const MAX_INBOUND_MSGS_PER_SEC = 25

// Validate and clamp an untrusted state payload. Returns null for anything that
// isn't a well-formed, finite position. Used server-side (never trust the wire)
// and safe to reuse client-side.
export function sanitizeState(raw: unknown): PlayerState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const { x, y } = o
  if (typeof x !== 'number' || !Number.isFinite(x)) return null
  if (typeof y !== 'number' || !Number.isFinite(y)) return null
  const dir: Dir = o.dir === 'left' ? 'left' : 'right'
  const pose: CatPose =
    o.pose === 'lying'
      ? 'lying'
      : o.pose === 'sleeping'
        ? 'sleeping'
        : 'standing'
  return {
    x: Math.max(0, Math.min(WORLD.cols - 1, x)),
    y: Math.max(1, Math.min(WORLD.groundRows - 1.5, y)),
    dir,
    pose,
    interacting: o.interacting === true,
  }
}
