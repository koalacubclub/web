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

// ---- Collectibles / points ("likes") ----
// The server owns the collectibles: it spawns them, decides their point value,
// and awards "likes" when a koala reaches one. The client never reports points
// or its score — it only asks to collect a food id, and the server validates
// (proximity, existence) and awards. This is the single source of truth for the
// food table; the client keeps only presentation (label/emoji/sprite) locally.
export type FoodTier = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface FoodDef {
  key: string
  points: number
  weight: number // relative spawn frequency
  tier: FoodTier
}

export const FOODS: readonly FoodDef[] = [
  { key: 'treat', points: 5, weight: 30, tier: 'common' },
  { key: 'fish', points: 10, weight: 28, tier: 'common' },
  { key: 'cheese', points: 15, weight: 16, tier: 'uncommon' },
  { key: 'drumstick', points: 15, weight: 16, tier: 'uncommon' },
  { key: 'shrimp', points: 20, weight: 12, tier: 'uncommon' },
  { key: 'tin', points: 25, weight: 7, tier: 'rare' },
  { key: 'sushi', points: 30, weight: 6, tier: 'rare' },
  { key: 'goldfish', points: 50, weight: 2, tier: 'legendary' },
]

export const FOOD_TOTAL_WEIGHT = FOODS.reduce((sum, f) => sum + f.weight, 0)
export const FOODS_BY_KEY: Record<string, FoodDef> = Object.fromEntries(
  FOODS.map((f) => [f.key, f]),
)

// Shared game-balance tuning for the server-owned collectibles.
export const MAX_FOOD = 3 // max collectibles on the map at once
export const FOOD_SPAWN_COOLDOWN_MS = 4000 // min gap between spawns
export const FOOD_TTL_MS = 15000 // a food despawns if uncollected this long
export const COLLECT_RADIUS = 0.85 // tiles: how close a koala must be to collect

// A live collectible on the map (server-authoritative).
export interface Food {
  id: string
  key: string
  x: number
  y: number
  points: number
  bornAt: number // epoch ms (server clock) — for TTL + client pop/blink timing
}

// ---- Shop / economy (server-authoritative) ----
// Coins == likes (earned from food). The catalog is the single source of truth
// for prices + footprints, shared so the server validates purchases. The client
// keeps only presentation (it maps `type` to a procedural sprite).
export interface ShopItem {
  key: string
  label: string
  type: string // sprite type for drawShopSprite / drawObjectByType
  w: number
  h: number
  price: number
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    key: 'flowers',
    label: 'Flower patch',
    type: 'flowers',
    w: 1,
    h: 1,
    price: 20,
  },
  {
    key: 'mushroom',
    label: 'Mushroom',
    type: 'mushroom',
    w: 1,
    h: 1,
    price: 25,
  },
  { key: 'stone', label: 'Warm rock', type: 'stone', w: 1, h: 1, price: 30 },
  { key: 'ball', label: 'Toy ball', type: 'ball', w: 1, h: 1, price: 35 },
  { key: 'snowcat', label: 'Snow-cat', type: 'snowcat', w: 1, h: 1, price: 60 },
  {
    key: 'cardbox',
    label: 'Cardboard box',
    type: 'cardbox',
    w: 2,
    h: 1,
    price: 70,
  },
  { key: 'bench', label: 'Park bench', type: 'bench', w: 2, h: 1, price: 90 },
  { key: 'pond', label: 'Pond', type: 'pond', w: 3, h: 2, price: 150 },
  { key: 'tree', label: 'Tree', type: 'tree', w: 2, h: 2, price: 180 },
  {
    key: 'house',
    label: 'Little house',
    type: 'house',
    w: 4,
    h: 4,
    price: 300,
  },
]
export const SHOP_ITEMS_BY_KEY: Record<string, ShopItem> = Object.fromEntries(
  SHOP_ITEMS.map((i) => [i.key, i]),
)

// How long a purchased item lives before it expires (wall-clock, server clock).
export const PLACED_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// A placed decoration owned by the server and shared with everyone.
export interface PlacedItem {
  id: string
  key: string
  type: string
  x: number
  y: number
  w: number
  h: number
  ownerId: string
  ownerName: string // buyer's display name at purchase (for on-proximity authorship)
  placedAt: number // epoch ms (server)
  expiresAt: number // epoch ms (server)
}

// ---- Client -> Server ----
export type ClientMessage =
  | { t: 'state'; s: PlayerState }
  | { t: 'collect'; id: string }
  // Buy a catalog item; x/y is the client-chosen placement tile (the server
  // validates affordability + bounds + no overlap and owns the result).
  | { t: 'buy'; key: string; x: number; y: number }

export type BuyFailReason = 'insufficient' | 'occupied' | 'invalid'

// ---- Server -> Client ----
export type ServerMessage =
  | {
      t: 'welcome'
      self: Player
      players: Player[]
      food: Food[]
      placed: PlacedItem[]
      likes: number
      now: number
    }
  | { t: 'join'; p: Player }
  | { t: 'leave'; id: string }
  | { t: 'state'; id: string; s: PlayerState }
  | { t: 'spawn'; f: Food }
  | { t: 'despawn'; id: string; reason: 'taken' | 'expired' }
  | { t: 'collected'; id: string; by: string; points: number; likes: number }
  | { t: 'placed'; item: PlacedItem } // broadcast to everyone
  | { t: 'unplaced'; id: string; reason: 'expired' } // broadcast to everyone
  | { t: 'wallet'; likes: number } // the recipient's new balance after a spend
  | { t: 'buyfail'; reason: BuyFailReason } // sent only to the buyer

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

// Validate an untrusted collect request. Returns the food id or null. Bounds the
// id length so a hostile client can't send a huge string.
export function sanitizeCollect(raw: unknown): { id: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const id = (raw as Record<string, unknown>).id
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return null
  return { id }
}

// Validate an untrusted buy request: a known catalog key and an in-bounds tile
// whose footprint fits inside the playable grid. Returns the item + tile or null.
export function sanitizeBuy(
  raw: unknown,
): { item: ShopItem; x: number; y: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.key !== 'string') return null
  const item = SHOP_ITEMS_BY_KEY[o.key]
  if (!item) return null
  const x = o.x
  const y = o.y
  if (typeof x !== 'number' || !Number.isInteger(x)) return null
  if (typeof y !== 'number' || !Number.isInteger(y)) return null
  if (x < 0 || y < 0) return null
  if (x + item.w > WORLD.cols || y + item.h > WORLD.groundRows) return null
  return { item, x, y }
}
