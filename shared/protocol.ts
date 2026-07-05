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
// Food cap scales with the crowd — about half the players, rounded up — so a
// solo park shows 1, 3 players see 2, 10 see 5. Server-enforced (it knows the
// live player count); the solo client uses foodCap(1) === 1.
export function foodCap(players: number): number {
  return Math.ceil(players / 2)
}
export const FOOD_SPAWN_COOLDOWN_MS = 4000 // min gap between spawns
export const FOOD_TTL_MS = 30000 // a food despawns if uncollected this long
export const COLLECT_RADIUS = 0.85 // tiles: how close a koala must be to collect

// A live collectible on the map (server-authoritative).
export interface Food {
  id: string
  key: string
  x: number
  y: number
  points: number
  bornAt: number // epoch ms (server clock) — for TTL + client pop/blink timing
  // Airborne food floats above (x,y) and can ONLY be collected mid-jump. Ground
  // food (air falsy) is collected the normal way, by walking up to it.
  air?: boolean
}

// ---- Abilities (transient, broadcast actions) + airborne food ----
// An ability is a fire-and-forget action a player triggers (space / on-screen
// button). The server rate-limits per kind, may apply a side effect (jump opens
// the airborne-food window), and rebroadcasts it so peers can animate it. Only
// jump (air food) + dash (reposition) are functional; `hand` is a paw-slap that
// jostles a nearby object; bite/meow are cosmetic emotes until enemies exist.
export type AbilityKind = 'jump' | 'dash' | 'bite' | 'hand' | 'meow'
export const ABILITIES: readonly AbilityKind[] = [
  'jump',
  'dash',
  'bite',
  'hand',
  'meow',
]

// Jump: a vertical hop (x/y never change) that unlocks airborne-food collection.
export const JUMP_DURATION_MS = 620 // length of the hop arc
export const JUMP_COOLDOWN_MS = 750 // min gap between jumps (anti-spam + feel)
export const JUMP_PEAK_TILES = 1.5 // how high the koala rises, in tiles (render)

// Dash: a quick forward lunge that actually repositions the koala (server-clamped).
export const DASH_DURATION_MS = 220
export const DASH_TILES = 3 // distance the lunge covers
export const DASH_COOLDOWN_MS = 1200
// Emotes (bite/hand/meow): cosmetic animation length.
export const EMOTE_DURATION_MS = 500

// Slap: the `hand` ability is a paw-swipe that jostles a nearby object. The swipe
// pose is broadcast (via the generic `acted` path); object reactions are local.
export const SLAP_DURATION_MS = 380 // length of the swipe animation
export const SLAP_REACH = 1.1 // tiles: how close an object must be to get hit

// Per-ability cooldowns (server-enforced + mirrored client-side for the sweep).
export const ABILITY_COOLDOWNS_MS: Record<AbilityKind, number> = {
  jump: JUMP_COOLDOWN_MS,
  dash: DASH_COOLDOWN_MS,
  bite: 600,
  hand: 600,
  meow: 1500,
}

// Airborne food shares the ground food's foodCap budget: each spawn rolls this
// probability to be airborne (else ground), so it never adds beyond the cap.
// ~1/3 → roughly one airborne treat for every two ground ones, at any player
// count (including solo).
export const AIR_SPAWN_SHARE = 1 / 3
// Pity timer: if no airborne food has spawned within this window, the next spawn
// is forced airborne — so an unlucky run of ground flips can't leave airborne
// food absent for long (and keeps it reliably reachable).
export const AIR_PITY_MS = 12000
export const AIR_FOOD_TTL_MS = 20000
export const AIR_COLLECT_RADIUS = 0.95 // a touch more forgiving (timing-gated)
export const AIR_HEIGHT_TILES = 1.35 // how high air food floats above its tile
export const AIR_POINTS_MULT = 2 // airborne food is worth double its base points

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
    key: 'lighttree',
    label: 'Fairy-light tree',
    type: 'lighttree',
    w: 2,
    h: 2,
    price: 200,
  },
  {
    key: 'house',
    label: 'Little house',
    type: 'house',
    w: 4,
    h: 4,
    price: 300,
  },
  // The priciest item — a rave boombox that plays when a koala is near.
  { key: 'radio', label: 'Boombox', type: 'radio', w: 2, h: 1, price: 1000 },
]
export const SHOP_ITEMS_BY_KEY: Record<string, ShopItem> = Object.fromEntries(
  SHOP_ITEMS.map((i) => [i.key, i]),
)

// How long a purchased item lives before it expires (wall-clock, server clock).
export const PLACED_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// A placed decoration owned by the server and shared with everyone. It points to
// its owner by id only; the display name is resolved from the `authors` map (so a
// rename updates every item that player owns, with the name stored once).
export interface PlacedItem {
  id: string
  key: string
  type: string
  x: number
  y: number
  w: number
  h: number
  ownerId: string
  placedAt: number // epoch ms (server)
  expiresAt: number // epoch ms (server)
}

// Display-name bounds (server-enforced; the input caps at NAME_MAX too).
export const NAME_MIN = 1
export const NAME_MAX = 20

// ---- World stats (shown in the Settings menu) ----
// Numbers the server derives from its durable session ledger. They don't need to
// be exact — `active24h`/`totalSessions` count distinct sessions ever seen and in
// the last 24h; `yourVisits` is how many times THIS session has (re)joined. The
// live "online" count isn't here: the client derives it from the presence roster.
export interface WorldStats {
  active24h: number
  totalSessions: number
  yourVisits: number
}

// Window for the "active in the last 24h" stat.
export const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000

// ---- Client -> Server ----
export type ClientMessage =
  | { t: 'state'; s: PlayerState }
  | { t: 'collect'; id: string }
  // Buy a catalog item; x/y is the client-chosen placement tile (the server
  // validates affordability + bounds + no overlap and owns the result).
  | { t: 'buy'; key: string; x: number; y: number }
  // Change this session's display name (server validates + persists + broadcasts).
  | { t: 'setName'; name: string }
  // Trigger an ability. Server rate-limits per kind, applies any side effect
  // (jump opens this session's airborne-collect window), and broadcasts `acted`.
  | { t: 'action'; a: AbilityKind }

export type BuyFailReason = 'insufficient' | 'occupied' | 'invalid'

// ---- Server -> Client ----
export type ServerMessage =
  | {
      t: 'welcome'
      self: Player
      players: Player[]
      food: Food[]
      placed: PlacedItem[]
      authors: Record<string, string> // ownerId → current name (incl. offline owners)
      likes: number
      stats: WorldStats
      now: number
    }
  | { t: 'join'; p: Player }
  | { t: 'leave'; id: string }
  | { t: 'state'; id: string; s: PlayerState }
  | { t: 'spawn'; f: Food }
  | { t: 'despawn'; id: string; reason: 'taken' | 'expired' }
  // Full food resync (replaces the client's set). Sent when the Durable Object
  // wakes from hibernation — its in-memory food was wiped without per-item
  // despawns, so this reconciles clients (dropping any stale/blinking food).
  | { t: 'foods'; food: Food[] }
  | { t: 'collected'; id: string; by: string; points: number; likes: number }
  | { t: 'placed'; item: PlacedItem; authorName: string } // broadcast to everyone
  | { t: 'unplaced'; id: string; reason: 'expired' } // broadcast to everyone
  | { t: 'wallet'; likes: number } // the recipient's new balance after a spend
  | { t: 'buyfail'; reason: BuyFailReason } // sent only to the buyer
  | { t: 'renamed'; id: string; name: string } // broadcast; also acks the sender
  // Refreshed global stats, broadcast when a brand-new session joins (so open
  // Settings menus update). Per-viewer `yourVisits` only travels in `welcome`.
  | { t: 'stats'; active24h: number; totalSessions: number }
  // A player used an ability — broadcast to everyone else so they animate it.
  | { t: 'acted'; id: string; a: AbilityKind }

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

// Validate an untrusted ability request against the known ability set.
export function sanitizeAction(raw: unknown): { a: AbilityKind } | null {
  if (!raw || typeof raw !== 'object') return null
  const a = (raw as Record<string, unknown>).a
  return typeof a === 'string' && (ABILITIES as readonly string[]).includes(a)
    ? { a: a as AbilityKind }
    : null
}

// Validate an untrusted display name: strip control chars, collapse whitespace,
// trim, cap at NAME_MAX. Returns null if nothing usable remains. Used by the
// client to pre-validate and by the server, which never trusts the wire.
// Allowlist for display names: Unicode letters + numbers, spaces, and a little
// name punctuation (dot, underscore, apostrophe, hyphen). Everything else —
// symbols, emoji, quotes, control chars, lone surrogates — is dropped. The
// server's SQL is parameterized (so injection is already impossible); this
// controlled set is defense-in-depth and keeps names tidy/renderable.
const NAME_ALLOWED = /[\p{L}\p{N} ._'-]/u

export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let out = ''
  for (const ch of raw) if (NAME_ALLOWED.test(ch)) out += ch
  // Cap by CODE POINTS (not UTF-16 units) so the limit is consistent and an
  // astral letter at the boundary is never split.
  const cleaned = [...out.replace(/\s+/g, ' ').trim()]
    .slice(0, NAME_MAX)
    .join('')
  return cleaned.length >= NAME_MIN ? cleaned : null
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
