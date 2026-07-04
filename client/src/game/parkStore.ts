// parkStore — the client-side bridge for the game economy (the score is a
// spendable coin wallet), the shop-placed decorations, and their persistence.
//
// It's a framework-agnostic module singleton so the two sides that need it can
// share it without coupling:
//   • the imperative canvas game (ParkGame) reads coins/placed each frame and
//     writes the cat's tile + earnings via plain getters/mutators (no React
//     re-render churn on the 60fps loop), and
//   • the React shop UI subscribes via `useSyncExternalStore` for a live balance.
//
// Source of truth:
//   • Multiplayer (a backend is configured): the SERVER owns the economy. This
//     store runs in a server-fed mode — setServerBuyer/applyServerWallet/
//     applyServerPlaced mirror the server's coins + placed, purchase() routes a
//     `buy` to the server, and nothing is written to localStorage. See
//     docs/decisions.md #15.
//   • Solo (no backend): this store IS the source of truth, persisted to
//     localStorage behind the small `sync` seam below.

import type { PlacedItem as ServerPlacedItem } from '@koala/shared'
import { PLACED_TTL_MS } from '@koala/shared'
import { GROUND_ROWS, MAP_COLS } from './constants'
import { SHOP_ITEMS_BY_KEY } from './shopItems'

// How long a purchased item lives before it expires (wall-clock). Single source
// of truth in shared/protocol.ts so client (solo) + server agree; re-exported
// here for existing callers/tests.
export { PLACED_TTL_MS }

export interface PlacedItem {
  id: string // client-generated; doubles as the server idempotency key
  key: string // catalog key
  type: string // sprite type for drawObjectByType
  x: number // top-left tile
  y: number
  w: number // footprint tiles
  h: number
  placedAt: number // Date.now() at purchase — drives the pop-in flourish
  expiresAt: number // Date.now() TTL — server may later own this value
}

export interface ParkSnapshot {
  coins: number
  best: number
  placed: PlacedItem[]
}

export type PurchaseResult = 'ok' | 'insufficient' | 'no-room'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const COINS_KEY = 'kcc-park-coins'
const BEST_KEY = 'kcc-park-best'
const PLACED_KEY = 'kcc-park-placed'
const DEVICE_KEY = 'kcc-device-id'
const VERSION_KEY = 'kcc-park-v'
const SCHEMA_VERSION = '1'

// ── localStorage-safe helpers (no-op when storage is unavailable/denied) ──────
function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode / quota — stay in-memory for the session */
  }
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isValidPlaced(p: unknown): p is PlacedItem {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.key === 'string' &&
    typeof o.type === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    typeof o.w === 'number' &&
    typeof o.h === 'number' &&
    typeof o.placedAt === 'number' &&
    typeof o.expiresAt === 'number'
  )
}

function parsePlaced(raw: string | null): PlacedItem[] {
  if (!raw) return []
  try {
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(isValidPlaced)
  } catch {
    return []
  }
}

// The persistence/sync backend. Swap/extend this (add server fetch + a
// best-effort optimistic write queue) to go client→server; callers don't change.
const sync = {
  load(): ParkSnapshot {
    return {
      coins: Number(lsGet(COINS_KEY)) || 0,
      best: Number(lsGet(BEST_KEY)) || 0,
      placed: parsePlaced(lsGet(PLACED_KEY)),
    }
  },
  saveWallet(coins: number, best: number) {
    lsSet(COINS_KEY, String(coins))
    lsSet(BEST_KEY, String(best))
  },
  savePlaced(placed: PlacedItem[]) {
    lsSet(PLACED_KEY, JSON.stringify(placed))
  },
}

// ── State ─────────────────────────────────────────────────────────────────
let coins = 0
let best = 0
let placed: PlacedItem[] = []
let catTile = { x: 9, y: 7 } // updated every frame; NOT part of the snapshot
let mapCols = MAP_COLS
let groundRows = GROUND_ROWS
let obstacles: Rect[] = [] // static base-object footprints (set once by the game)

let snapshot: ParkSnapshot = { coins, best, placed }
const listeners = new Set<() => void>()
let loaded = false

// When connected to the multiplayer backend, the SERVER owns the economy: coins
// (== likes), purchases and placed items. In that mode this store is a pure
// mirror fed by applyServer*(), purchases are routed to the server, and nothing
// is written to localStorage. `serverBuyer` is set (via setServerBuyer) iff so.
let serverBuyer: ((key: string, x: number, y: number) => void) | null = null

function rebuildSnapshot() {
  snapshot = { coins, best, placed }
}
function emit() {
  for (const cb of listeners) cb()
}

function ensureLoaded() {
  if (loaded) return
  loaded = true
  if (!lsGet(DEVICE_KEY)) lsSet(DEVICE_KEY, newId())
  lsSet(VERSION_KEY, SCHEMA_VERSION)
  const s = sync.load()
  coins = s.coins
  best = s.best
  placed = s.placed
  // Sweep anything that expired while away so stale items never flash in.
  const now = Date.now()
  const live = placed.filter((p) => p.expiresAt > now)
  if (live.length !== placed.length) {
    placed = live
    sync.savePlaced(placed)
  }
  rebuildSnapshot()
}

// ── Reactive surface (for React via useSyncExternalStore) ────────────────────
export function subscribe(cb: () => void): () => void {
  ensureLoaded()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// Returns a STABLE reference until state actually changes (rebuilt only inside
// mutations), as useSyncExternalStore requires.
export function getSnapshot(): ParkSnapshot {
  ensureLoaded()
  return snapshot
}

// ── Imperative surface (for the game loop — cheap, non-reactive) ─────────────
export function getCoins(): number {
  ensureLoaded()
  return coins
}
export function getBest(): number {
  ensureLoaded()
  return best
}
export function getPlaced(): PlacedItem[] {
  ensureLoaded()
  return placed
}
export function getCatTile(): { x: number; y: number } {
  return catTile
}
// Called ~60×/s from the game loop — deliberately does NOT notify or rebuild the
// snapshot (catTile is not part of the reactive state).
export function setCatTile(x: number, y: number) {
  catTile = { x, y }
}

export function configure(opts: { mapCols?: number; groundRows?: number }) {
  if (opts.mapCols != null) mapCols = opts.mapCols
  if (opts.groundRows != null) groundRows = opts.groundRows
}

// The static base-object footprints, so placement never overlaps fixed decor.
export function setObstacles(rects: Rect[]) {
  obstacles = rects.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h }))
}

// ── Server-fed mode (multiplayer: the DO owns the economy) ───────────────────
// Called by ParkGame with the connection's buy sender when a backend is present
// (null to return to solo/localStorage). Switching to server mode clears the
// local wallet/placed until the server's welcome fills them, so a stale
// localStorage balance never lingers.
export function setServerBuyer(
  fn: ((key: string, x: number, y: number) => void) | null,
) {
  serverBuyer = fn
  if (fn) {
    loaded = true // never read localStorage in server mode
    coins = 0
    best = 0
    placed = []
    rebuildSnapshot()
    emit()
  }
}

/** Mirror the server's authoritative wallet. */
export function applyServerWallet(serverCoins: number) {
  if (serverCoins === coins) return // no change → no re-render
  coins = serverCoins
  if (coins > best) best = coins
  rebuildSnapshot()
  emit()
}

/** Replace the placed set from the server (welcome / full resync). */
export function applyServerPlaced(items: ServerPlacedItem[]) {
  placed = items.map((p) => ({
    id: p.id,
    key: p.key,
    type: p.type,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    placedAt: p.placedAt,
    expiresAt: p.expiresAt,
  }))
  rebuildSnapshot()
  emit()
}

// ── Mutations ───────────────────────────────────────────────────────────────
export function earn(points: number) {
  ensureLoaded()
  if (serverBuyer) return // server credits coins on its authoritative collect
  if (!points) return
  coins += points
  if (coins > best) best = coins
  sync.saveWallet(coins, best)
  rebuildSnapshot()
  emit()
}

function overlaps(
  x: number,
  y: number,
  w: number,
  h: number,
  r: Rect,
): boolean {
  return x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y
}

// Nearest non-overlapping tile for a w×h footprint, spiralling out from Koala's
// tile. Returns null when the ground is full.
function findSpot(w: number, h: number): { x: number; y: number } | null {
  const occupied: Rect[] = obstacles.concat(
    placed.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
  )
  const fits = (x: number, y: number) =>
    x >= 0 &&
    y >= 1 &&
    x + w <= mapCols &&
    y + h <= groundRows &&
    !occupied.some((r) => overlaps(x, y, w, h, r))

  const ax = Math.max(0, Math.min(mapCols - w, Math.round(catTile.x)))
  const ay = Math.max(1, Math.min(groundRows - h, Math.round(catTile.y)))
  if (fits(ax, ay)) return { x: ax, y: ay }

  const maxR = mapCols + groundRows
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue // ring only
        const x = ax + dx
        const y = ay + dy
        if (fits(x, y)) return { x, y }
      }
    }
  }
  return null
}

export function purchase(itemKey: string): PurchaseResult {
  ensureLoaded()
  const item = SHOP_ITEMS_BY_KEY[itemKey]
  if (!item || coins < item.price) return 'insufficient'
  const spot = findSpot(item.w, item.h)
  if (!spot) return 'no-room'
  if (serverBuyer) {
    // Server-authoritative: send the chosen tile; the server validates coins +
    // overlap, then broadcasts the placed item and our new wallet. We optimistically
    // report 'ok' for the shop feedback; the placed item appears on the next frame.
    serverBuyer(item.key, spot.x, spot.y)
    return 'ok'
  }
  const now = Date.now()
  const item2: PlacedItem = {
    id: newId(),
    key: item.key,
    type: item.type,
    x: spot.x,
    y: spot.y,
    w: item.w,
    h: item.h,
    placedAt: now,
    expiresAt: now + PLACED_TTL_MS,
  }
  coins -= item.price
  placed = [...placed, item2]
  sync.saveWallet(coins, best)
  sync.savePlaced(placed)
  rebuildSnapshot()
  emit()
  return 'ok'
}

// Drop expired placed items. Returns true (and notifies) only if something went.
export function sweepExpired(now: number = Date.now()): boolean {
  ensureLoaded()
  if (serverBuyer) return false // the server owns placed-item TTL in this mode
  const live = placed.filter((p) => p.expiresAt > now)
  if (live.length === placed.length) return false
  placed = live
  sync.savePlaced(placed)
  rebuildSnapshot()
  emit()
  return true
}

// Test-only: reset all in-memory state so each test starts clean.
export function __resetForTests() {
  coins = 0
  best = 0
  placed = []
  catTile = { x: 9, y: 7 }
  mapCols = MAP_COLS
  groundRows = GROUND_ROWS
  obstacles = []
  listeners.clear()
  loaded = false
  serverBuyer = null
  rebuildSnapshot()
}
