import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { createMultiplayer, type Multiplayer } from '@/multiplayer/connection'
import {
  ABILITY_COOLDOWNS_MS,
  AIR_COLLECT_RADIUS,
  AIR_FOOD_TTL_MS,
  AIR_HEIGHT_TILES,
  AIR_POINTS_MULT,
  COLLECT_RADIUS,
  DASH_DURATION_MS,
  DASH_TILES,
  EMOTE_DURATION_MS,
  FOOD_TTL_MS,
  foodCap,
  JUMP_DURATION_MS,
  type AbilityKind,
} from '@koala/shared'
import { cameraPan } from './parkCamera'
import { jumpLiftTiles } from '@/game/jump'
import { IG_PROFILE } from '@/data/reels'
import { drawShopSprite } from '@/game/sprites'
import { radio } from '@/game/radio'
import { NIGHT, night } from '@/game/constants'
import * as parkStore from '@/game/parkStore'
import * as controls from '@/game/controlsStore'

/**
 * ParkGame - A Neko Atsume-inspired pixel-art park where Koala the tabby cat
 * can walk around and interact with objects like trees, flowers, benches, etc.
 *
 * Ported from the "Cat-Themed Website with Mini Game" starter. The game logic
 * is unchanged; the returned markup is adapted so the canvas fits inside the
 * site's fixed hero/header (letterboxed to stay fully visible) instead of
 * rendering its own full-bleed section. Move with arrow keys / WASD, or the
 * on-screen D-pad on touch devices.
 */

const SCALE = 3
const MAP_COLS = 20
const GROUND_ROWS = 13 // the playable park (unchanged game logic)
const SKY_ROWS = 2 // extra sky rows on top; the world is shifted down by these
const MAP_ROWS = GROUND_ROWS + SKY_ROWS
const PIXEL = 16 * SCALE
const CANVAS_WIDTH = MAP_COLS * PIXEL
const CANVAS_HEIGHT = MAP_ROWS * PIXEL
const GROUND_HEIGHT = GROUND_ROWS * PIXEL
const WORLD_OFFSET = SKY_ROWS * PIXEL // px the park is pushed down for more sky

const COLORS = {
  // Near-black night sky matched to the site background (--background token)
  sky: 'oklch(0.1 0.008 60)',
  skyLight: 'oklch(0.11 0.008 60)',
  grass: '#A8D5A2',
  grassDark: '#7CB87A',
  grassLight: '#C4E8BF',
  dirt: '#D4A574',
  dirtLight: '#E8C9A0',
  treeTrunk: '#8B6914',
  treeLeaves: '#4CAF50',
  treeLeavesLight: '#66BB6A',
  flower1: '#FF6B9D',
  flower2: '#FFD93D',
  flower3: '#C9B1FF',
  bench: '#8D6E63',
  benchLight: '#A1887F',
  water: '#64B5F6',
  waterLight: '#90CAF9',
  catLight: '#C4A882',
  catOrange: '#A07850',
  catDark: '#8B5E3C',
  catStripe: '#6D4C2A',
  white: '#FFFFFF',
  heart: '#FF6B9D',
  fishBowl: '#FFD93D',
  butterfly: '#C9B1FF',
  stone: '#9E9E9E',
  stoneDark: '#757575',
  charcoal: '#4A4A4A',
}

// Collectible food. Custom sprites drop in at public/game/food/<key>.png (256px,
// transparent); until then each falls back to its emoji so the game works now.
type FoodTier = 'common' | 'uncommon' | 'rare' | 'legendary'
interface FoodType {
  key: string
  label: string
  emoji: string
  points: number
  weight: number // relative spawn frequency
  tier: FoodTier
}
const FOODS: FoodType[] = [
  {
    key: 'treat',
    label: 'Treat',
    emoji: '🍪',
    points: 5,
    weight: 30,
    tier: 'common',
  },
  {
    key: 'fish',
    label: 'Fish',
    emoji: '🐟',
    points: 10,
    weight: 28,
    tier: 'common',
  },
  {
    key: 'cheese',
    label: 'Cheese',
    emoji: '🧀',
    points: 15,
    weight: 16,
    tier: 'uncommon',
  },
  {
    key: 'drumstick',
    label: 'Drumstick',
    emoji: '🍗',
    points: 15,
    weight: 16,
    tier: 'uncommon',
  },
  {
    key: 'shrimp',
    label: 'Shrimp',
    emoji: '🍤',
    points: 20,
    weight: 12,
    tier: 'uncommon',
  },
  {
    key: 'tin',
    label: 'Cat food tin',
    emoji: '🥫',
    points: 25,
    weight: 7,
    tier: 'rare',
  },
  {
    key: 'sushi',
    label: 'Sushi',
    emoji: '🍣',
    points: 30,
    weight: 6,
    tier: 'rare',
  },
  {
    key: 'goldfish',
    label: 'Golden fish',
    emoji: '🐠',
    points: 50,
    weight: 2,
    tier: 'legendary',
  },
]
const FOODS_BY_KEY: Record<string, FoodType> = Object.fromEntries(
  FOODS.map((f) => [f.key, f]),
)
const FOOD_TOTAL_WEIGHT = FOODS.reduce((sum, f) => sum + f.weight, 0)
// Interactive on-grass hotspots.
const TIKTOK_PROFILE = 'https://tiktok.com/@koalacubclub'
const HERO_PHOTO = '/hero.webp' // Koala photo for the polaroid + lightbox

// Tiny deterministic PRNG (mulberry32) so procedural art can vary per instance
// (seeded by tile position) yet stay identical frame-to-frame — no flicker.
function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface GameObject {
  type: string
  x: number
  y: number
  w: number
  h: number
  interactMsg?: string
  solid?: boolean
  _shown?: boolean
  // Interactive hotspots (hover tooltip + click), hit-tested by pointer:
  href?: string // 'social' → opens this URL
  channel?: 'instagram' | 'tiktok' // 'social' → which glyph + tooltip
  photo?: boolean // 'photo' → hover shows the picture, click enlarges
  // Shop-placed decorations (absent on base objects):
  key?: string
  placedAt?: number
  expiresAt?: number
  ownerId?: string // author's session id; name resolved via mp.authors on proximity
}

interface Butterfly {
  x: number
  y: number
  vx: number
  vy: number
  timer: number
  color: string
}

interface Popup {
  text: string
  x: number
  y: number
  life: number
}

interface Food {
  key: string
  x: number
  y: number
  born: number
  life: number
  // Present only for server-owned collectibles (multiplayer).
  id?: string
  points?: number
  // Airborne food floats above its tile and is only collectable mid-jump.
  air?: boolean
}

// How often (ms) the client re-asks to collect a food it's standing on. A single
// request can be rejected while the server's last-known position lags, so we
// retry until the food is gone (stays well under the inbound rate limit).
const COLLECT_RETRY_MS = 200

// The minimal shape drawCat needs. Both the local cat (g.cat) and the scratch
// object used to render each remote koala are structurally this.
type DrawableCat = {
  x: number
  y: number
  dir: 'left' | 'right'
  idle: boolean
  interacting: boolean
  idleFrames: number
  state: 'standing' | 'lying' | 'sleeping'
}

export default function ParkGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Interactive-hotspot UI (driven from the canvas hit-testing in the effect).
  const [hover, setHover] = useState<{
    kind: 'text' | 'photo'
    label: string
    sx: number
    sy: number
  } | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const lightboxRef = useRef(false) // mirror of `lightbox` readable inside the effect
  const closeLightbox = useCallback(() => {
    lightboxRef.current = false
    setLightbox(false)
  }, [])

  // Control hint — a one-time chip telling first-time players how to move Koala.
  // Device + reduced-motion are read once at mount (fixed for the session so the
  // copy never flickers). `showHint` is seeded from storage so a returning player
  // who has already moved never even renders it; `hintMovedRef` mirrors the flag
  // for the imperative game loop (a ref, always current — avoids a stale closure).
  const [isTouch] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches,
  )
  const [prefersReducedMotion] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [showHint, setShowHint] = useState(
    () => parkStore.lsGet('kcc-hint-moved') !== '1',
  )
  const hintMovedRef = useRef(parkStore.lsGet('kcc-hint-moved') === '1')

  const gameRef = useRef({
    cat: {
      x: 9,
      y: 7,
      dir: 'right' as 'left' | 'right',
      idle: true,
      interacting: false,
      idleFrames: 0,
      state: 'standing' as 'standing' | 'lying' | 'sleeping',
    },
    // performance.now() when the local koala's current jump started. Init to
    // -Infinity (never jumped) — NOT 0: performance.now()'s origin is page load,
    // so a 0 sentinel would read as "jumped at load" for the first ~620ms (phantom
    // hop + first-jump lockout). Doubles as the cooldown clock; render-only offset.
    jumpAt: -Infinity,
    keys: {} as Record<string, boolean>,
    // Tap/click target the cat walks toward (top-left tile coords), or null.
    target: null as { x: number; y: number } | null,
    objects: [] as GameObject[],
    butterflies: [] as Butterfly[],
    popups: [] as Popup[],
    foods: [] as Food[],
    score: 0,
    best: 0,
    nextFoodAt: 180,
    // Multiplayer collectibles: per-food last collect-request time (retry, not a
    // permanent block), last-seen likes total, and whether we've synced it.
    collectCooldowns: new Map<string, number>(),
    prevLikes: 0,
    likesSynced: false,
    hudShift: 0, // canvas-px X offset to keep the HUD pinned against the camera pan
    hudShiftY: 0, // canvas-px Y offset (vertical camera), same purpose
    frameCount: 0,
    // Dash lunge (functional reposition): when it started + the from/to tiles.
    dashAt: -Infinity,
    dashFrom: { x: 0, y: 0 },
    dashTo: { x: 0, y: 0 },
    // Latest emote (bite/hand/meow) + when it started, for the local overlay.
    emote: null as AbilityKind | null,
    emoteAt: -Infinity,
  })

  const initObjects = useCallback(() => {
    const g = gameRef.current
    g.objects = [
      {
        type: 'tree',
        x: 2,
        y: 2,
        w: 2,
        h: 2,
        interactMsg: '♪ Rustling leaves...',
      },
      {
        type: 'tree',
        x: 16,
        y: 1,
        w: 2,
        h: 2,
        interactMsg: '♪ A bird chirps!',
      },
      { type: 'tree', x: 10, y: 1, w: 2, h: 2, interactMsg: '♪ Shady spot!' },
      {
        type: 'bench',
        x: 6,
        y: 3,
        w: 2,
        h: 1,
        interactMsg: '♥ Koala takes a rest',
      },
      {
        type: 'flowers',
        x: 4,
        y: 8,
        w: 1,
        h: 1,
        interactMsg: '✿ Pretty flowers!',
      },
      {
        type: 'flowers',
        x: 14,
        y: 9,
        w: 1,
        h: 1,
        interactMsg: '✿ Smells nice!',
      },
      {
        type: 'flowers',
        x: 8,
        y: 10,
        w: 1,
        h: 1,
        interactMsg: '✿ So colorful!',
      },
      {
        type: 'pond',
        x: 14,
        y: 4,
        w: 3,
        h: 2,
        interactMsg: '~ Splish splash!',
      },
      { type: 'ball', x: 8, y: 6, w: 1, h: 1, interactMsg: '★ Boing boing!' },
      { type: 'stone', x: 1, y: 9, w: 1, h: 1, interactMsg: '... A warm rock' },
      // A second bench for balance now the map is less cluttered.
      { type: 'bench', x: 12, y: 10, w: 2, h: 1, interactMsg: '♥ Comfy!' },
      // Interactive hotspots (hover tooltip + click) — non-solid, no interactMsg
      // so the cat's proximity popups skip them; handled by pointer hit-testing.
      {
        type: 'social',
        channel: 'instagram',
        href: IG_PROFILE,
        x: 10,
        y: 7,
        w: 1,
        h: 1,
      },
      {
        type: 'social',
        channel: 'tiktok',
        href: TIKTOK_PROFILE,
        x: 12,
        y: 7,
        w: 1,
        h: 1,
      },
      { type: 'photo', photo: true, x: 17, y: 8, w: 1, h: 1 },
    ]
    g.butterflies = [
      { x: 100, y: 80, vx: 0.5, vy: 0.3, timer: 0, color: NIGHT.butterfly },
      {
        x: 300,
        y: 120,
        vx: -0.3,
        vy: 0.5,
        timer: Math.PI,
        color: NIGHT.flower1,
      },
      {
        x: 500,
        y: 60,
        vx: 0.4,
        vy: -0.2,
        timer: Math.PI / 2,
        color: NIGHT.fishBowl,
      },
    ]
  }, [])

  // Close the photo lightbox on Escape (only while it's open).
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, closeLightbox])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    initObjects()

    const g = gameRef.current

    // Multiplayer: connect to the shared park (null when no backend is
    // configured — e.g. a prod build before the Worker is deployed — in which
    // case the game just runs solo). Torn down in this effect's cleanup.
    // When connected, the SERVER owns the economy: it feeds the coin wallet +
    // placed items into parkStore (which the shop UI + HUD read), and purchases
    // are routed back to it.
    const mp: Multiplayer | null = createMultiplayer({
      onWallet: (likes) => parkStore.applyServerWallet(likes),
      onPlaced: (items) => parkStore.applyServerPlaced(items),
      onName: (name) => parkStore.applyServerName(name),
      onPresence: (roster) => parkStore.applyServerPresence(roster),
      onStats: (stats) => parkStore.applyServerStats(stats),
    })
    if (mp) {
      parkStore.setServerBuyer(mp.sendBuy)
      parkStore.setServerRenamer(mp.sendName)
    }
    // Scratch object reused each frame to render remote koalas without churn.
    const remoteCat: DrawableCat = {
      x: 0,
      y: 0,
      dir: 'right',
      idle: true,
      interacting: false,
      idleFrames: 0,
      state: 'standing',
    }

    // Skip the decorative placed-item pop-in / blink when reduced motion is on.
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Bridge to the shop/economy store. The score is now a spendable coin
    // wallet the store owns (with the peak/best); shop-placed decorations are
    // merged on top of the fixed base objects whenever the store changes.
    const baseObjects = g.objects
    parkStore.configure({ mapCols: MAP_COLS, groundRows: GROUND_ROWS })
    parkStore.setObstacles(baseObjects)
    const rebuildObjects = () => {
      g.objects = baseObjects.concat(
        parkStore.getPlaced().map((p) => ({
          type: p.type,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          key: p.key,
          placedAt: p.placedAt,
          expiresAt: p.expiresAt,
          ownerId: p.ownerId,
        })),
      )
    }
    rebuildObjects()
    const unsubscribeStore = parkStore.subscribe(rebuildObjects)

    // Preload the Koala photo used by the on-grass polaroid + its lightbox.
    const heroImg = new Image()
    heroImg.src = HERO_PHOTO

    // Offscreen canvas holding the fully static sky + ground. Rendered once,
    // then blitted each frame instead of recomputing the grass blobs, sand
    // texture, and gradients every frame.
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = CANVAS_WIDTH
    bgCanvas.height = CANVAS_HEIGHT
    const bgCtx = bgCanvas.getContext('2d')

    // Whether an ability input should act right now: hero on-screen, not typing
    // in a field, and no lightbox open. When false, keys (e.g. space) keep their
    // normal browser behaviour (page scroll / text entry).
    const actionAllowed = () => {
      if (lightboxRef.current) return false
      const el = typeof document !== 'undefined' ? document.activeElement : null
      const tag = el?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (el as HTMLElement | null)?.isContentEditable
      ) {
        return false
      }
      return window.scrollY < window.innerHeight // hero in view
    }

    // Set up a dash lunge: pick a direction (active move vector, else facing),
    // then the clamped landing tile. Advanced each frame in the game loop.
    const startDash = (now: number) => {
      const cat = g.cat
      let dx = 0
      let dy = 0
      const mv = controls.getMove()
      if (mv && (mv.x !== 0 || mv.y !== 0)) {
        dx = mv.x
        dy = mv.y
      } else {
        if (g.keys['arrowleft'] || g.keys['a']) dx -= 1
        if (g.keys['arrowright'] || g.keys['d']) dx += 1
        if (g.keys['arrowup'] || g.keys['w']) dy -= 1
        if (g.keys['arrowdown'] || g.keys['s']) dy += 1
      }
      if (dx === 0 && dy === 0) dx = cat.dir === 'left' ? -1 : 1
      const mag = Math.hypot(dx, dy) || 1
      dx /= mag
      dy /= mag
      g.dashFrom = { x: cat.x, y: cat.y }
      g.dashTo = {
        x: Math.max(0, Math.min(MAP_COLS - 1, cat.x + dx * DASH_TILES)),
        y: Math.max(1, Math.min(GROUND_ROWS - 1.5, cat.y + dy * DASH_TILES)),
      }
      g.dashAt = now
      if (dx < -0.2) cat.dir = 'left'
      else if (dx > 0.2) cat.dir = 'right'
    }

    // Fire an ability: cooldown-gated (shared per-ability cooldown, mirrored to
    // the UI sweep), wakes a resting koala, applies the local effect immediately,
    // and tells the server (which broadcasts it; jump opens the air-food window).
    const startAbility = (a: AbilityKind) => {
      const now = performance.now()
      if (now - controls.getFiredAt(a) < ABILITY_COOLDOWNS_MS[a]) return
      controls.markFired(a)
      g.cat.state = 'standing'
      g.cat.idle = false
      g.cat.idleFrames = 0
      if (a === 'jump') {
        g.jumpAt = now // drives the hop arc + airborne-food window
      } else if (a === 'dash') {
        startDash(now)
      } else {
        g.emote = a // bite / hand / meow
        g.emoteAt = now
      }
      mp?.sendAction(a)
    }
    // Let the React control overlay fire abilities through the same path.
    controls.registerAbility(startAbility)

    // Desktop shortcuts for the extra abilities (jump = space, always). These are
    // gamer-mode only; jump works regardless (it's a core mechanic).
    const EXTRA_ABILITY_KEYS: Record<string, AbilityKind> = {
      shift: 'dash',
      '1': 'bite',
      '2': 'hand',
      '3': 'meow',
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      // Space = jump. Only preventDefault (blocking page scroll) when we actually
      // handle it, so space still scrolls / types when the game isn't in focus.
      if (key === ' ') {
        if (actionAllowed()) {
          e.preventDefault()
          startAbility('jump')
        }
        return
      }
      const extra = EXTRA_ABILITY_KEYS[key]
      if (extra) {
        if (controls.getGamerMode() && actionAllowed()) startAbility(extra)
        return
      }
      g.keys[key] = true
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      g.keys[e.key.toLowerCase()] = false
    }

    // Press-and-hold (or drag) on the game to walk the cat toward the pointer;
    // release to stop. Listens on window (not the canvas) so it works even if
    // another element is layered over the fixed hero — events still bubble to
    // window. Only engages when the press starts inside the canvas box and the
    // hero is actually in view (not scrolled to the content below).
    let pointerActive = false
    // Aim the cat's walk target at a client (screen) point, clamped to the
    // canvas box so dragging past an edge keeps steering there.
    const aimAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const cx = Math.min(Math.max(clientX, rect.left), rect.right)
      const cy = Math.min(Math.max(clientY, rect.top), rect.bottom)
      const px = ((cx - rect.left) / rect.width) * CANVAS_WIDTH
      const py = ((cy - rect.top) / rect.height) * CANVAS_HEIGHT
      // py is screen space; subtract the world offset to get a park tile coord.
      g.target = { x: px / PIXEL - 0.5, y: (py - WORLD_OFFSET) / PIXEL - 0.5 }
    }
    // Can a game drag start at this point? (inside the canvas box, hero in view,
    // not on a UI control like the social links).
    const canEngageAt = (
      target: EventTarget | null,
      clientX: number,
      clientY: number,
    ) => {
      if (target instanceof Element && target.closest('a, button')) return false
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return false
      if (window.scrollY > window.innerHeight * 0.5) return false
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      )
    }
    const engage = (clientX: number, clientY: number) => {
      pointerActive = true
      // Turn off page selection for the drag so it can't start an iOS selection.
      document.body.classList.add('kcc-dragging')
      aimAt(clientX, clientY)
    }
    const disengage = () => {
      pointerActive = false
      g.target = null
      document.body.classList.remove('kcc-dragging')
    }

    // ── Interactive hotspots: social icons + the Koala photo ──
    // Map a screen point to a tile coord (same math as aimAt; the rect already
    // reflects the camera transform) and return the hotspot object under it.
    let hoveredObj: GameObject | null = null
    let pressedHotspot: GameObject | null = null
    let touchHotspot: GameObject | null = null
    const hotspotAt = (clientX: number, clientY: number): GameObject | null => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      )
        return null
      const tx = (((clientX - rect.left) / rect.width) * CANVAS_WIDTH) / PIXEL
      const py = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT
      const ty = (py - WORLD_OFFSET) / PIXEL
      for (const o of g.objects) {
        if (
          (o.type === 'social' || o.type === 'photo') &&
          tx >= o.x &&
          tx <= o.x + o.w &&
          ty >= o.y &&
          ty <= o.y + o.h
        )
          return o
      }
      return null
    }
    const activateHotspot = (o: GameObject) => {
      if (o.type === 'social' && o.href) {
        window.open(o.href, '_blank', 'noopener,noreferrer')
      } else if (o.type === 'photo') {
        hoveredObj = null
        setHover(null)
        lightboxRef.current = true
        setLightbox(true)
      }
    }
    // Mouse-only hover → tooltip. Positions the tooltip at the hotspot's on-screen
    // spot (canvas rect + tile→canvas→screen), deduped so we only setState on
    // change.
    const updateHover = (clientX: number, clientY: number) => {
      const o = hotspotAt(clientX, clientY)
      if (o === hoveredObj) return
      hoveredObj = o
      if (!o) {
        setHover(null)
        return
      }
      const rect = canvas.getBoundingClientRect()
      const sx =
        rect.left + (((o.x + o.w / 2) * PIXEL) / CANVAS_WIDTH) * rect.width
      const sy =
        rect.top + ((WORLD_OFFSET + o.y * PIXEL) / CANVAS_HEIGHT) * rect.height
      if (o.type === 'photo') {
        setHover({ kind: 'photo', label: 'Koala', sx, sy })
      } else {
        setHover({
          kind: 'text',
          label:
            o.channel === 'instagram'
              ? 'Follow on Instagram'
              : '@koalacubclub on TikTok',
          sx,
          sy,
        })
      }
    }

    // ── Mouse / pen: engage immediately (no page-scroll gesture to conflict). ──
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return // touch handled below (hold-to-grab)
      if (lightboxRef.current) return
      if (!canEngageAt(e.target, e.clientX, e.clientY)) return
      // A press on a hotspot is a click, not a walk — don't engage the cat.
      const hs = hotspotAt(e.clientX, e.clientY)
      if (hs) {
        pressedHotspot = hs
        return
      }
      engage(e.clientX, e.clientY)
    }
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (pointerActive) {
        aimAt(e.clientX, e.clientY)
        return
      }
      updateHover(e.clientX, e.clientY)
    }
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (pressedHotspot) {
        // Fire only if released on the same hotspot (a real click, not a drag).
        if (hotspotAt(e.clientX, e.clientY) === pressedHotspot) {
          activateHotspot(pressedHotspot)
        }
        pressedHotspot = null
        return
      }
      disengage()
    }

    // ── Touch: the hero stays a SCROLLABLE hero. A swipe scrolls the page
    // (we never preventDefault here); a tap on a channel sign / photo opens it;
    // a double-tap jumps. Movement is via the on-screen joystick (Gamer mode) —
    // the canvas itself never steers by touch, so scroll and play never fight. ──
    const MOVE_TOL = 10 // px of drift before a tap counts as a swipe (→ scroll)
    const DOUBLE_TAP_MS = 300 // two quick taps within this window = jump
    const TAP_TOL = 28 // px the two taps must land within
    let touchId: number | null = null
    let touchStartX = 0
    let touchStartY = 0
    let touchMoved = false
    // Double-tap tracking (kept in the outer scope so it survives per-touch resets).
    let lastTapAt = 0
    let lastTapX = 0
    let lastTapY = 0
    const touchById = (list: TouchList) => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === touchId) return list[i]
      }
      return null
    }
    const handleTouchStart = (e: TouchEvent) => {
      if (touchId !== null) return // already tracking one touch
      if (lightboxRef.current) return
      const t = e.changedTouches[0]
      if (!t || !canEngageAt(e.target, t.clientX, t.clientY)) return
      touchId = t.identifier
      touchStartX = t.clientX
      touchStartY = t.clientY
      touchMoved = false
      touchHotspot = hotspotAt(t.clientX, t.clientY)
      // No preventDefault anywhere in the touch path → the page scrolls freely.
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (touchId === null) return
      const t = touchById(e.changedTouches)
      if (!t) return
      if (
        Math.abs(t.clientX - touchStartX) > MOVE_TOL ||
        Math.abs(t.clientY - touchStartY) > MOVE_TOL
      ) {
        touchMoved = true // it's a swipe (scroll), not a tap
      }
    }
    const endTouch = () => {
      touchId = null
      touchMoved = false
      touchHotspot = null
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchId === null) return
      const t = touchById(e.changedTouches)
      if (!t) return
      // Tap on a channel sign / photo → open it.
      if (touchHotspot) {
        if (!touchMoved && hotspotAt(t.clientX, t.clientY) === touchHotspot) {
          activateHotspot(touchHotspot)
        }
        endTouch()
        return
      }
      // A clean tap (no hotspot, no swipe) → two quick taps jump.
      if (!touchMoved) {
        const now = Date.now()
        if (
          now - lastTapAt < DOUBLE_TAP_MS &&
          Math.abs(t.clientX - lastTapX) < TAP_TOL &&
          Math.abs(t.clientY - lastTapY) < TAP_TOL
        ) {
          if (actionAllowed()) startAbility('jump')
          lastTapAt = 0 // consume; a third tap starts a fresh pair
        } else {
          lastTapAt = now
          lastTapX = t.clientX
          lastTapY = t.clientY
        }
      }
      endTouch()
    }

    // While dragging, block text/element selection (belt with .kcc-dragging).
    const handleSelectStart = (e: Event) => {
      if (pointerActive) e.preventDefault()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    // non-passive: while the joystick is engaged we preventDefault to capture the
    // gesture (no page scroll). Non-engaged touches never call preventDefault.
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchEnd)
    document.addEventListener('selectstart', handleSelectStart)

    let animId = 0
    // Has the local koala walked yet this session? Gates radio playback so a cat
    // that spawns beside a radio stays silent until the player moves.
    let hasWalked = false

    function drawGround() {
      if (!ctx) return
      // Sky is drawn separately (screen space) in the game loop.

      // Sand base
      ctx.fillStyle = '#E8D5A8'
      ctx.fillRect(0, PIXEL * 1, CANVAS_WIDTH, CANVAS_HEIGHT - PIXEL * 1)

      // Sand texture dots
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 73 + 17) % MAP_COLS) * PIXEL + ((i * 31) % PIXEL)
        const sy = PIXEL * 1.5 + ((i * 47 + 11) % (CANVAS_HEIGHT - PIXEL * 2))
        ctx.fillStyle = i % 2 === 0 ? '#DCC89A' : '#F0E2B8'
        ctx.fillRect(sx, sy, SCALE, SCALE)
      }

      // Irregular grass patches on top of sand (using bezier blob shapes)
      function drawBlobPatch(
        cx: number,
        cy: number,
        radiusX: number,
        radiusY: number,
        seed: number,
      ) {
        if (!ctx) return
        const points = 10
        ctx.fillStyle = COLORS.grass
        ctx.beginPath()
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2
          // Use seed-based pseudo-random wobble for irregular shape
          const wobble =
            0.7 +
            0.3 *
              Math.sin(seed * 3.7 + i * 2.1) *
              Math.cos(seed * 1.3 + i * 4.7)
          const wobble2 = 0.8 + 0.2 * Math.cos(seed * 5.1 + i * 1.9)
          const rx = radiusX * wobble
          const ry = radiusY * wobble2
          const px = cx + Math.cos(angle) * rx
          const py = cy + Math.sin(angle) * ry
          if (i === 0) {
            ctx.moveTo(px, py)
          } else {
            // Use quadratic curve to previous midpoint for smooth irregular edges
            const prevAngle = ((i - 0.5) / points) * Math.PI * 2
            const prevWobble =
              0.75 + 0.25 * Math.sin(seed * 2.3 + (i - 0.5) * 3.1)
            const cpx = cx + Math.cos(prevAngle) * radiusX * prevWobble * 1.1
            const cpy = cy + Math.sin(prevAngle) * radiusY * prevWobble * 1.05
            ctx.quadraticCurveTo(cpx, cpy, px, py)
          }
        }
        ctx.closePath()
        ctx.fill()

        // Grass blade details scattered inside
        for (let j = 0; j < 10; j++) {
          const angle = (j / 10) * Math.PI * 2 + seed
          const dist = 0.4 + ((j * 0.07) % 0.4)
          const gx = cx + Math.cos(angle) * radiusX * dist
          const gy = cy + Math.sin(angle) * radiusY * dist
          ctx.fillStyle = j % 3 === 0 ? COLORS.grassDark : COLORS.grassLight
          ctx.fillRect(gx, gy, SCALE * 2, SCALE * 3)
        }
      }

      // Large patches (some very big, overlapping)
      drawBlobPatch(PIXEL * 3, PIXEL * 4, PIXEL * 4.5, PIXEL * 3.2, 1.2)
      // Fills the bare sand gap below the hills (upper-centre) so grass meets the
      // ridge and there's no visible sand/hill seam — kept low enough that its top
      // tucks just under the ridge crest rather than poking into the sky.
      drawBlobPatch(PIXEL * 6.8, PIXEL * 2.3, PIXEL * 3.4, PIXEL * 1.7, 4.9)
      drawBlobPatch(PIXEL * 15, PIXEL * 3.5, PIXEL * 5, PIXEL * 3.5, 5.1)
      drawBlobPatch(PIXEL * 5, PIXEL * 9.5, PIXEL * 4.2, PIXEL * 3, 7.4)
      drawBlobPatch(PIXEL * 13, PIXEL * 10, PIXEL * 4.8, PIXEL * 2.8, 9.2)
      // Medium patches (touching the big ones)
      drawBlobPatch(PIXEL * 7.5, PIXEL * 4.5, PIXEL * 2.2, PIXEL * 1.6, 3.7)
      drawBlobPatch(PIXEL * 10, PIXEL * 3, PIXEL * 1.8, PIXEL * 1.4, 2.3)
      drawBlobPatch(PIXEL * 18.5, PIXEL * 8, PIXEL * 2, PIXEL * 2.5, 11.5)
      // Small patches scattered
      drawBlobPatch(PIXEL * 1, PIXEL * 7, PIXEL * 1.3, PIXEL * 1, 13.1)
      drawBlobPatch(PIXEL * 9, PIXEL * 8, PIXEL * 1.5, PIXEL * 1.2, 15.8)
      drawBlobPatch(PIXEL * 19, PIXEL * 5, PIXEL * 1.2, PIXEL * 0.9, 17.3)
    }

    function drawStars() {
      if (!ctx) return
      // Stars
      const stars = [
        { x: 30, y: 12, s: 2 },
        { x: 80, y: 25, s: 1.5 },
        { x: 140, y: 8, s: 2.5 },
        { x: 200, y: 30, s: 1 },
        { x: 260, y: 15, s: 2 },
        { x: 320, y: 35, s: 1.5 },
        { x: 380, y: 10, s: 1 },
        { x: 440, y: 28, s: 2 },
        { x: 500, y: 5, s: 1.5 },
        { x: 560, y: 22, s: 2.5 },
        { x: 620, y: 38, s: 1 },
        { x: 680, y: 12, s: 2 },
        { x: 740, y: 30, s: 1.5 },
        { x: 800, y: 8, s: 2 },
        { x: 860, y: 25, s: 1 },
        { x: 900, y: 18, s: 2.5 },
        { x: 950, y: 40, s: 1.5 },
        { x: 120, y: 42, s: 1 },
        { x: 420, y: 42, s: 1.5 },
        { x: 750, y: 42, s: 1 },
      ]
      stars.forEach((star) => {
        const twinkle = 0.5 + 0.5 * Math.sin(g.frameCount * 0.03 + star.x * 0.1)
        ctx.fillStyle = `rgba(255, 255, 230, ${twinkle * 0.9})`
        if (star.s >= 2.5) {
          // A few 4-point sparkle stars, with slightly uneven points (seeded by
          // position so the shape is stable — only the brightness twinkles).
          const rng = makeRng(Math.round(star.x) + 1)
          const inner = star.s * 0.8
          ctx.beginPath()
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 - Math.PI / 2
            const rr = i % 2 === 0 ? star.s * (1.8 + rng() * 1.2) : inner
            const px = star.x + Math.cos(ang) * rr
            const py = star.y + Math.sin(ang) * rr
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.s, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    }

    // Full moon, baked into the sky BEHIND the hills (drawn in screen coords in
    // renderStaticBackground, before the wavy ridge). Smaller so the ridge only
    // clips its lower edge.
    function drawMoon() {
      if (!ctx) return
      const moonX = CANVAS_WIDTH - PIXEL * 1.2
      const moonY = WORLD_OFFSET + PIXEL * 0.1
      const moonR = PIXEL * 0.38
      // Soft halo.
      ctx.fillStyle = 'rgba(255, 253, 232, 0.12)'
      ctx.beginPath()
      ctx.arc(moonX, moonY, moonR * 1.7, 0, Math.PI * 2)
      ctx.fill()
      // Disc.
      ctx.fillStyle = '#FFFDE8'
      ctx.beginPath()
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
      ctx.fill()
      // Craters (slightly darker translucent spots).
      ctx.fillStyle = 'rgba(208, 202, 175, 0.55)'
      const craters: [number, number, number][] = [
        [-0.35, -0.18, 0.16],
        [0.28, -0.3, 0.1],
        [0.12, 0.3, 0.14],
        [-0.12, 0.16, 0.08],
        [0.4, 0.1, 0.09],
      ]
      craters.forEach(([dx, dy, r]) => {
        ctx!.beginPath()
        ctx!.arc(
          moonX + dx * moonR,
          moonY + dy * moonR,
          r * moonR,
          0,
          Math.PI * 2,
        )
        ctx!.fill()
      })
    }

    function drawDreamBubble() {
      if (!ctx) return
      const cat = g.cat
      if (cat.state !== 'sleeping') return
      const x = cat.x * PIXEL
      const y = cat.y * PIXEL
      const s = SCALE
      const bubbleX = x + PIXEL * 0.8
      const bubbleY = y - PIXEL * 0.5 + Math.sin(g.frameCount * 0.03) * 3

      // Small bubbles leading up
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.arc(bubbleX - s * 1, bubbleY + s * 4, s * 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(bubbleX, bubbleY + s * 2, s * 1.5, 0, Math.PI * 2)
      ctx.fill()

      // Main dream bubble
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.ellipse(
        bubbleX + s * 2,
        bubbleY - s * 1,
        s * 5,
        s * 3.5,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.strokeStyle = 'rgba(200,200,200,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Zzz text inside bubble
      ctx.font = `italic 600 ${s * 4}px 'Cormorant Garamond', Georgia, serif`
      ctx.textAlign = 'center'
      const zzAlpha = 0.6 + Math.sin(g.frameCount * 0.05) * 0.4
      ctx.fillStyle = `rgba(150, 130, 200, ${zzAlpha})`
      ctx.fillText('Zzz', bubbleX + s * 2, bubbleY)
    }

    function drawTree(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      // Keep the original clean 3-blob canopy, but nudge scale + blob offsets a
      // little per tree (seeded by tile position) so they aren't all identical.
      const rng = makeRng(obj.x * 73856093 + obj.y * 19349663 + 1)
      const s = 0.9 + rng() * 0.22 // overall canopy scale
      const jx = (rng() - 0.5) * PIXEL * 0.16 // main-blob jitter
      const jy = (rng() - 0.5) * PIXEL * 0.12

      // Trunk (original fixed shape).
      ctx.fillStyle = NIGHT.treeTrunk
      ctx.fillRect(x + PIXEL * 0.7, y + PIXEL, PIXEL * 0.6, PIXEL)

      // Main (darker) canopy blob.
      ctx.fillStyle = NIGHT.treeLeaves
      ctx.beginPath()
      ctx.arc(
        x + PIXEL + jx,
        y + PIXEL * 0.6 + jy,
        PIXEL * 0.9 * s,
        0,
        Math.PI * 2,
      )
      ctx.fill()

      // Two lighter blobs (upper-left + upper-right), each slightly jittered.
      ctx.fillStyle = NIGHT.treeLeavesLight
      ctx.beginPath()
      ctx.arc(
        x + PIXEL * (0.7 + (rng() - 0.5) * 0.16),
        y + PIXEL * (0.5 + (rng() - 0.5) * 0.12),
        PIXEL * 0.5 * s,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.beginPath()
      ctx.arc(
        x + PIXEL * (1.3 + (rng() - 0.5) * 0.16),
        y + PIXEL * (0.4 + (rng() - 0.5) * 0.12),
        PIXEL * 0.55 * s,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }

    function drawBench(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      ctx.fillStyle = NIGHT.bench
      ctx.fillRect(x + SCALE * 3, y + PIXEL * 0.5, SCALE * 3, PIXEL * 0.5)
      ctx.fillRect(x + PIXEL * 1.5, y + PIXEL * 0.5, SCALE * 3, PIXEL * 0.5)
      ctx.fillStyle = NIGHT.benchLight
      ctx.fillRect(x, y + PIXEL * 0.3, PIXEL * 2, SCALE * 4)
      ctx.fillStyle = NIGHT.bench
      ctx.fillRect(x, y + PIXEL * 0.2, PIXEL * 2, SCALE * 2)
      ctx.fillRect(x, y, PIXEL * 2, SCALE * 3)
    }

    function drawFlowers(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      // Per-patch randomness (seeded by tile position) so each flower cluster has
      // its own count / colours / sizes / scatter instead of all looking alike.
      const palette = [
        NIGHT.flower1,
        NIGHT.flower2,
        NIGHT.flower3,
        NIGHT.heart,
        NIGHT.butterfly,
      ]
      const rng = makeRng(obj.x * 73856093 + obj.y * 19349663 + 7)
      const bobOffset = Math.sin(g.frameCount * 0.05 + obj.x) * 2
      const count = 3 + Math.floor(rng() * 2) // 3–4 blooms
      let fx = x + PIXEL * 0.08
      for (let i = 0; i < count; i++) {
        const cxp = fx + SCALE * 2.5
        const cyp = y + PIXEL * (0.28 + rng() * 0.28) + bobOffset
        const petalR = SCALE * 2.5 // uniform size — only colour/position/count vary
        const stemH = SCALE * 4
        ctx.fillStyle = NIGHT.grassDark
        ctx.fillRect(cxp - SCALE * 0.5, cyp + petalR * 0.4, SCALE, stemH)
        ctx.fillStyle = palette[Math.floor(rng() * palette.length)]
        ctx.beginPath()
        ctx.arc(cxp, cyp, petalR, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = NIGHT.fishBowl
        ctx.beginPath()
        ctx.arc(cxp, cyp, petalR * 0.42, 0, Math.PI * 2)
        ctx.fill()
        fx += SCALE * (3.6 + rng() * 1.8)
      }
    }

    function drawPond(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      const wobble = Math.sin(g.frameCount * 0.03) * 2
      ctx.fillStyle = NIGHT.water
      ctx.beginPath()
      ctx.ellipse(
        x + PIXEL * 1.5,
        y + PIXEL + wobble * 0.1,
        PIXEL * 1.4,
        PIXEL * 0.8,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.fillStyle = NIGHT.waterLight
      ctx.beginPath()
      ctx.ellipse(
        x + PIXEL * 1.2,
        y + PIXEL * 0.8,
        PIXEL * 0.4,
        PIXEL * 0.2,
        -0.3,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        const sx = x + PIXEL * 1.5 + Math.cos(angle) * PIXEL * 1.3
        const sy = y + PIXEL + Math.sin(angle) * PIXEL * 0.7
        ctx.fillStyle = i % 2 === 0 ? NIGHT.stone : NIGHT.stoneDark
        ctx.beginPath()
        ctx.arc(sx, sy, SCALE * 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawBall(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      const bounce = Math.abs(Math.sin(g.frameCount * 0.06)) * SCALE * 2
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.beginPath()
      ctx.ellipse(
        x + PIXEL * 0.5,
        y + PIXEL * 0.8,
        PIXEL * 0.25,
        PIXEL * 0.1,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.fillStyle = night('#FF6B6B')
      ctx.beginPath()
      ctx.arc(
        x + PIXEL * 0.5,
        y + PIXEL * 0.5 - bounce,
        PIXEL * 0.25,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.fillStyle = NIGHT.fishBowl
      ctx.beginPath()
      ctx.arc(x + PIXEL * 0.4, y + PIXEL * 0.4 - bounce, SCALE, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawStone(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      ctx.fillStyle = NIGHT.stone
      ctx.beginPath()
      ctx.ellipse(
        x + PIXEL * 0.5,
        y + PIXEL * 0.6,
        PIXEL * 0.4,
        PIXEL * 0.25,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }

    // Interactive social sign on the grass: a short post + a rounded badge with a
    // simple procedural glyph (IG or TikTok). Hover/click handled by hit-testing.
    function drawSocialSign(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      const cx = x + PIXEL * 0.5
      const ig = obj.channel === 'instagram'
      // Ground shadow + short post.
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath()
      ctx.ellipse(
        cx,
        y + PIXEL * 0.92,
        PIXEL * 0.2,
        PIXEL * 0.06,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.fillStyle = COLORS.treeTrunk
      ctx.fillRect(cx - SCALE * 0.7, y + PIXEL * 0.52, SCALE * 1.4, PIXEL * 0.4)
      // Rounded badge.
      const bs = PIXEL * 0.52
      const bx = cx - bs / 2
      const by = y + PIXEL * 0.06
      // Soft halo that follows the badge's rounded-rect shape (a flat, slightly
      // larger rounded rect behind it).
      const tint = ig ? '255,150,205' : '255,255,255' // IG pink / TikTok white
      const m = bs * 0.16
      ctx.fillStyle = `rgba(${tint},0.16)`
      ctx.beginPath()
      ctx.roundRect(bx - m, by - m, bs + 2 * m, bs + 2 * m, bs * 0.28 + m)
      ctx.fill()
      ctx.fillStyle = ig ? '#E1306C' : '#111318'
      ctx.beginPath()
      ctx.roundRect(bx, by, bs, bs, bs * 0.28)
      ctx.fill()
      if (ig) {
        // Instagram: rounded-square outline + ring + corner dot.
        ctx.strokeStyle = COLORS.white
        ctx.lineWidth = SCALE * 0.9
        const inset = bs * 0.22
        ctx.beginPath()
        ctx.roundRect(
          bx + inset,
          by + inset,
          bs - inset * 2,
          bs - inset * 2,
          bs * 0.18,
        )
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(bx + bs / 2, by + bs / 2, bs * 0.15, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = COLORS.white
        ctx.beginPath()
        ctx.arc(bx + bs * 0.72, by + bs * 0.28, SCALE * 0.7, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // TikTok: a music note with a cyan offset head.
        ctx.strokeStyle = COLORS.white
        ctx.lineWidth = SCALE * 1.1
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(bx + bs * 0.6, by + bs * 0.26)
        ctx.lineTo(bx + bs * 0.6, by + bs * 0.64)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(bx + bs * 0.6, by + bs * 0.26)
        ctx.quadraticCurveTo(
          bx + bs * 0.86,
          by + bs * 0.24,
          bx + bs * 0.8,
          by + bs * 0.44,
        )
        ctx.stroke()
        ctx.fillStyle = 'rgba(37,244,238,0.9)'
        ctx.beginPath()
        ctx.arc(bx + bs * 0.48, by + bs * 0.66, bs * 0.13, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = COLORS.white
        ctx.beginPath()
        ctx.arc(bx + bs * 0.54, by + bs * 0.64, bs * 0.13, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Interactive Koala photo: a small tilted polaroid on the grass. Hover shows
    // the picture; click opens the full lightbox (both handled in React).
    function drawPhoto(obj: GameObject) {
      if (!ctx) return
      const cx = obj.x * PIXEL + PIXEL * 0.5
      const cy = obj.y * PIXEL + PIXEL * 0.5
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-0.12)
      const w = PIXEL * 0.82
      const h = PIXEL * 0.8
      // Drop shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath()
      ctx.ellipse(0, h * 0.5, w * 0.5, PIXEL * 0.08, 0, 0, Math.PI * 2)
      ctx.fill()
      // Polaroid frame.
      ctx.fillStyle = night('#FBFBF7')
      ctx.beginPath()
      ctx.roundRect(-w / 2, -h / 2, w, h, SCALE)
      ctx.fill()
      // Photo (cover-fit) or a placeholder until it loads.
      const pad = SCALE * 1.2
      const ix = -w / 2 + pad
      const iy = -h / 2 + pad
      const iw = w - pad * 2
      const ih = h - pad * 2 - SCALE * 2 // wider bottom border = polaroid look
      if (heroImg.complete && heroImg.naturalWidth > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(ix, iy, iw, ih)
        ctx.clip()
        const scale = Math.max(
          iw / heroImg.naturalWidth,
          ih / heroImg.naturalHeight,
        )
        const dw = heroImg.naturalWidth * scale
        const dh = heroImg.naturalHeight * scale
        ctx.drawImage(heroImg, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh)
        ctx.restore()
      } else {
        ctx.fillStyle = night('#DDD7C8')
        ctx.fillRect(ix, iy, iw, ih)
      }
      ctx.restore()
    }

    function drawButterflies(f: number) {
      if (!ctx) return
      g.butterflies.forEach((b) => {
        b.timer += 0.05 * f
        b.x += (b.vx + Math.sin(b.timer) * 0.5) * f
        b.y += (b.vy + Math.cos(b.timer * 1.3) * 0.3) * f
        if (b.x > CANVAS_WIDTH) b.x = -10
        if (b.x < -10) b.x = CANVAS_WIDTH
        if (b.y > GROUND_HEIGHT - PIXEL * 2) b.vy = -Math.abs(b.vy)
        if (b.y < PIXEL * 2) b.vy = Math.abs(b.vy)
        const wingFlap = Math.sin(g.frameCount * 0.3 + b.timer) * 3
        ctx.fillStyle = b.color
        ctx.beginPath()
        ctx.ellipse(b.x - 3, b.y, 4, 3 + wingFlap, -0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(b.x + 3, b.y, 4, 3 + wingFlap, 0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = NIGHT.charcoal
        ctx.fillRect(b.x - 1, b.y - 2, 2, 4)
      })
    }

    // Draws a koala. Defaults to the local cat; pass a remote player's state
    // (and name) to render other players in the same world space.
    function drawCat(cat: DrawableCat = g.cat, label?: string, jumpPx = 0) {
      if (!ctx) return
      const x = cat.x * PIXEL
      const y = cat.y * PIXEL
      const flip = cat.dir === 'left' ? -1 : 1
      const s = SCALE

      // Floating name tag for remote players (drawn above the head, unflipped).
      if (label) {
        ctx.save()
        ctx.font = `${s * 4}px "Inter", system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.lineWidth = s
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        const lx = x + PIXEL * 0.5
        const ly = y - PIXEL * 0.15 - jumpPx // ride the hop with the body
        ctx.strokeText(label, lx, ly)
        ctx.fillText(label, lx, ly)
        ctx.restore()
      }

      // Different poses based on idle state
      if (cat.state === 'lying' || cat.state === 'sleeping') {
        // Draw lying/sleeping cat
        ctx.save()
        ctx.translate(x + PIXEL * 0.5, y + PIXEL * 0.5)
        ctx.scale(flip, 1)

        // Shadow (wider when lying)
        ctx.fillStyle = 'rgba(0,0,0,0.08)'
        ctx.beginPath()
        ctx.ellipse(0, PIXEL * 0.3, PIXEL * 0.5, PIXEL * 0.1, 0, 0, Math.PI * 2)
        ctx.fill()

        // Body (flat oval, lying down)
        ctx.fillStyle = NIGHT.catLight
        ctx.beginPath()
        ctx.ellipse(0, s * 3, s * 6, s * 3, 0, 0, Math.PI * 2)
        ctx.fill()

        // White belly (underside visible when lying)
        ctx.fillStyle = NIGHT.white
        ctx.beginPath()
        ctx.ellipse(0, s * 4.5, s * 4, s * 1.8, 0, 0, Math.PI * 2)
        ctx.fill()

        // Tabby stripes on body
        ctx.fillStyle = NIGHT.catStripe
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(-s * 4 + i * s * 3, s * 1.5, s * 1.5, s * 2.5)
        }

        // Head (resting on paws)
        ctx.fillStyle = NIGHT.catLight
        ctx.beginPath()
        ctx.arc(s * 5, s * 1.5, s * 3.5, 0, Math.PI * 2)
        ctx.fill()

        // White muzzle/chin
        ctx.fillStyle = NIGHT.white
        ctx.beginPath()
        ctx.ellipse(s * 5.2, s * 2.8, s * 2, s * 1.5, 0, 0, Math.PI * 2)
        ctx.fill()

        // Ears
        ctx.fillStyle = NIGHT.catOrange
        ctx.beginPath()
        ctx.moveTo(s * 3.5, -s * 1.5)
        ctx.lineTo(s * 5, 0)
        ctx.lineTo(s * 2.5, -s * 0.2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(s * 6.5, -s * 1.5)
        ctx.lineTo(s * 7.5, -s * 0.2)
        ctx.lineTo(s * 5, 0)
        ctx.fill()

        // Inner ears (light pink)
        ctx.fillStyle = NIGHT.catEar
        ctx.beginPath()
        ctx.moveTo(s * 3.8, -s * 1)
        ctx.lineTo(s * 4.8, 0)
        ctx.lineTo(s * 3, -s * 0.1)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(s * 6.2, -s * 1)
        ctx.lineTo(s * 7, -s * 0.1)
        ctx.lineTo(s * 5.2, 0)
        ctx.fill()

        // Eyes (closed when sleeping, half-closed when lying)
        ctx.strokeStyle = NIGHT.charcoal
        ctx.lineWidth = 1.5
        if (cat.state === 'sleeping') {
          // Closed eyes - curved lines
          ctx.beginPath()
          ctx.arc(s * 4, s * 1.5, s * 0.8, 0, Math.PI)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(s * 6.2, s * 1.5, s * 0.8, 0, Math.PI)
          ctx.stroke()
        } else {
          // Half-closed eyes
          ctx.fillStyle = night('#8B9B2A')
          ctx.beginPath()
          ctx.ellipse(s * 4, s * 1.5, s * 0.6, s * 0.3, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.ellipse(s * 6.2, s * 1.5, s * 0.6, s * 0.3, 0, 0, Math.PI * 2)
          ctx.fill()
        }

        // Nose (brown, matching her back fur)
        ctx.fillStyle = NIGHT.catOrange
        ctx.beginPath()
        ctx.moveTo(s * 5.1, s * 2.2)
        ctx.lineTo(s * 4.8, s * 2.6)
        ctx.lineTo(s * 5.4, s * 2.6)
        ctx.fill()

        // Tail curled around body
        const tailWag = Math.sin(g.frameCount * 0.03) * s * 0.5
        ctx.strokeStyle = NIGHT.catOrange
        ctx.lineWidth = s * 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-s * 5, s * 3)
        ctx.quadraticCurveTo(
          -s * 7,
          s * 1 + tailWag,
          -s * 5,
          -s * 0.5 + tailWag,
        )
        ctx.stroke()

        // Front paws tucked under head
        ctx.fillStyle = NIGHT.white
        ctx.fillRect(s * 3, s * 3.5, s * 1.5, s * 1)
        ctx.fillRect(s * 5, s * 3.5, s * 1.5, s * 1)

        ctx.restore()

        return
      }

      // Standing/walking cat (original code)
      const bobY = cat.idle ? Math.sin(g.frameCount * 0.05) * 2 : 0
      const walkBob = !cat.idle ? Math.sin(g.frameCount * 0.2) * 2 : 0
      // Mid-hop: the rear legs stretch down (reaching, mid-leap) while the front
      // feet tuck up shorter; everything else stays as the standing pose.
      const airborne = jumpPx > 0
      const backStretch = airborne ? s * 2.5 : 0
      const frontTuck = airborne ? s * 1.5 : 0

      // Mid-hop: draw a separate shrinking shadow on the GROUND so the lift reads
      // as height (the body's own shadow below is skipped while airborne).
      if (jumpPx > 0) {
        const shrink = Math.max(0.45, 1 - jumpPx / (PIXEL * 2.2))
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.beginPath()
        ctx.ellipse(
          x + PIXEL * 0.5,
          y + PIXEL * 0.85,
          PIXEL * 0.35 * shrink,
          PIXEL * 0.1 * shrink,
          0,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }

      ctx.save()
      ctx.translate(x + PIXEL * 0.5, y + PIXEL * 0.5 + bobY + walkBob - jumpPx)
      ctx.scale(flip, 1)

      // Shadow (only on the ground — while airborne the grounded shadow above
      // stands in for it).
      if (jumpPx <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)'
        ctx.beginPath()
        ctx.ellipse(
          0,
          PIXEL * 0.35,
          PIXEL * 0.35,
          PIXEL * 0.1,
          0,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }

      // Body
      ctx.fillStyle = NIGHT.catLight
      ctx.beginPath()
      ctx.ellipse(0, s * 2, s * 5, s * 4, 0, 0, Math.PI * 2)
      ctx.fill()

      // White belly (bottom half of body)
      ctx.fillStyle = NIGHT.white
      ctx.beginPath()
      ctx.ellipse(0, s * 4, s * 3.5, s * 2.5, 0, 0, Math.PI * 2)
      ctx.fill()

      // Tabby stripes
      ctx.fillStyle = NIGHT.catStripe
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-s * 3 + i * s * 3, s * 0.5, s * 1.5, s * 2)
      }

      // Head
      ctx.fillStyle = NIGHT.catLight
      ctx.beginPath()
      ctx.arc(s * 4, -s * 1, s * 4, 0, Math.PI * 2)
      ctx.fill()

      // White muzzle/chin area
      ctx.fillStyle = NIGHT.white
      ctx.beginPath()
      ctx.ellipse(s * 4.3, s * 1, s * 2.5, s * 2, 0, 0, Math.PI * 2)
      ctx.fill()

      // Ears
      ctx.fillStyle = NIGHT.catOrange
      ctx.beginPath()
      ctx.moveTo(s * 1.5, -s * 5.5)
      ctx.lineTo(s * 3, -s * 3)
      ctx.lineTo(0, -s * 3)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(s * 6.5, -s * 5.5)
      ctx.lineTo(s * 8, -s * 3)
      ctx.lineTo(s * 5, -s * 3)
      ctx.fill()

      // Inner ears (light pink)
      ctx.fillStyle = NIGHT.catEar
      ctx.beginPath()
      ctx.moveTo(s * 1.5, -s * 4.8)
      ctx.lineTo(s * 2.7, -s * 3.3)
      ctx.lineTo(s * 0.5, -s * 3.3)
      ctx.fill()

      // Head stripes
      ctx.fillStyle = NIGHT.catStripe
      ctx.fillRect(s * 3, -s * 3, s * 1, s * 1.5)
      ctx.fillRect(s * 4.5, -s * 2.8, s * 0.8, s * 1.2)

      // Eyes
      ctx.fillStyle = NIGHT.white
      ctx.beginPath()
      ctx.arc(s * 3, -s * 0.5, s * 1.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s * 5.5, -s * 0.5, s * 1.2, 0, Math.PI * 2)
      ctx.fill()

      // Pupils
      ctx.fillStyle = night('#8B9B2A')
      ctx.beginPath()
      ctx.arc(s * 3.2, -s * 0.4, s * 0.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s * 5.7, -s * 0.4, s * 0.7, 0, Math.PI * 2)
      ctx.fill()

      // Pupil highlights
      ctx.fillStyle = NIGHT.white
      ctx.beginPath()
      ctx.arc(s * 3.4, -s * 0.7, s * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s * 5.9, -s * 0.7, s * 0.3, 0, Math.PI * 2)
      ctx.fill()

      // Nose (brown, matching her back fur)
      ctx.fillStyle = NIGHT.catOrange
      ctx.beginPath()
      ctx.moveTo(s * 4.3, s * 0.5)
      ctx.lineTo(s * 4, s * 1)
      ctx.lineTo(s * 4.6, s * 1)
      ctx.fill()

      // Little open mouth while airborne (with a tiny pink tongue).
      if (airborne) {
        ctx.fillStyle = night('#5A2A2A')
        ctx.beginPath()
        ctx.ellipse(s * 4.3, s * 1.8, s * 0.7, s * 0.9, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = NIGHT.catEar
        ctx.beginPath()
        ctx.ellipse(s * 4.3, s * 2.2, s * 0.4, s * 0.4, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Whiskers
      ctx.strokeStyle = NIGHT.charcoal
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(s * 2, s * 0.5)
      ctx.lineTo(-s * 0.5, 0)
      ctx.moveTo(s * 2, s * 1)
      ctx.lineTo(-s * 0.5, s * 1.5)
      ctx.moveTo(s * 6.5, s * 0.5)
      ctx.lineTo(s * 9, 0)
      ctx.moveTo(s * 6.5, s * 1)
      ctx.lineTo(s * 9, s * 1.5)
      ctx.stroke()

      // Tail
      const tailWag = Math.sin(g.frameCount * 0.08) * s * 2
      ctx.strokeStyle = NIGHT.catOrange
      ctx.lineWidth = s * 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-s * 5, s * 1)
      ctx.quadraticCurveTo(-s * 7, -s * 2 + tailWag, -s * 6, -s * 4 + tailWag)
      ctx.stroke()

      // Tail stripes
      ctx.strokeStyle = NIGHT.catStripe
      ctx.lineWidth = s * 0.8
      ctx.beginPath()
      ctx.moveTo(-s * 5.5, 0)
      ctx.lineTo(-s * 6, -s * 0.5)
      ctx.moveTo(-s * 6, -s * 1.5 + tailWag * 0.5)
      ctx.lineTo(-s * 6.2, -s * 2.5 + tailWag * 0.5)
      ctx.stroke()

      // Legs — front pair tucks up shorter mid-hop.
      const legOffset = !cat.idle ? Math.sin(g.frameCount * 0.2) * s * 1.5 : 0
      ctx.fillStyle = NIGHT.white
      ctx.fillRect(s * 2, s * 4 + legOffset, s * 2, s * 3 - frontTuck)
      ctx.fillRect(s * 4, s * 4 - legOffset, s * 2, s * 3 - frontTuck)
      // Front paws (ride up with the tuck).
      ctx.fillRect(s * 2, s * 6.5 + legOffset - frontTuck, s * 2, s * 1)
      ctx.fillRect(s * 4, s * 6.5 - legOffset - frontTuck, s * 2, s * 1)

      // Rear legs — stretched down, and rotated back a touch mid-hop so they
      // trail the torso (drawn about the hip pivot since fillRect can't rotate).
      const backRot = airborne ? 0.5 : 0
      const backLen = s * 3 + backStretch
      for (const [pivotX, pivotY] of [
        [-s * 2, s * 4 - legOffset],
        [s * 0, s * 4 + legOffset],
      ] as const) {
        ctx.save()
        ctx.translate(pivotX, pivotY)
        ctx.rotate(backRot)
        ctx.fillRect(-s * 1, 0, s * 2, backLen)
        ctx.fillRect(-s * 1, backLen - s * 0.5, s * 2, s * 1) // paw
        ctx.restore()
      }

      ctx.restore()

      // Hearts when interacting
      if (cat.interacting) {
        const heartY = y - PIXEL * 0.3 + Math.sin(g.frameCount * 0.1) * 3
        ctx.fillStyle = NIGHT.heart
        ctx.beginPath()
        const hx = x + PIXEL * 0.5
        const hy = heartY
        const hs = s * 2
        // Lobes rise above hy and the tip drops to ~1.75·hs, so the heart is
        // about as tall as it is wide (was squashed at ~1.2·hs tall).
        ctx.moveTo(hx, hy + hs * 0.35)
        ctx.bezierCurveTo(
          hx,
          hy - hs * 0.25,
          hx - hs,
          hy - hs * 0.25,
          hx - hs,
          hy + hs * 0.35,
        )
        ctx.bezierCurveTo(
          hx - hs,
          hy + hs * 0.95,
          hx,
          hy + hs * 1.25,
          hx,
          hy + hs * 1.75,
        )
        ctx.bezierCurveTo(
          hx,
          hy + hs * 1.25,
          hx + hs,
          hy + hs * 0.95,
          hx + hs,
          hy + hs * 0.35,
        )
        ctx.bezierCurveTo(
          hx + hs,
          hy - hs * 0.25,
          hx,
          hy - hs * 0.25,
          hx,
          hy + hs * 0.35,
        )
        ctx.fill()
      }
    }

    // How close (tiles) Koala must be for a radio to start playing.
    const RADIO_REACH = 2.5
    // Don't auto-play until the player has actually walked — so spawning next to
    // a radio on entry stays silent (and it satisfies audio autoplay rules).
    // Set true on the first movement in updateCat.

    function drawObjects(now: number) {
      const sorted = [...g.objects].sort((a, b) => a.y - b.y)
      const catX = g.cat.x + 0.5
      const catY = g.cat.y + 0.5
      let radioPlaying = false
      sorted.forEach((obj) => {
        // Shop-placed decorations render via the shared sprite module (with
        // pop-in / pre-expiry blink); base objects use their own art below.
        if (obj.placedAt != null) {
          // A radio plays (pulses + notes + sound) while Koala is near it — but
          // only once she's walked, so entering the world doesn't trigger it.
          const playing =
            hasWalked &&
            obj.type === 'radio' &&
            Math.hypot(catX - (obj.x + obj.w / 2), catY - (obj.y + obj.h / 2)) <
              RADIO_REACH
          if (playing) radioPlaying = true
          drawShopSprite(ctx!, obj, g.frameCount, {
            now,
            reducedMotion,
            night: true,
            playing,
          })
          return
        }
        switch (obj.type) {
          case 'tree':
            drawTree(obj)
            break
          case 'bench':
            drawBench(obj)
            break
          case 'flowers':
            drawFlowers(obj)
            break
          case 'pond':
            drawPond(obj)
            break
          case 'ball':
            drawBall(obj)
            break
          case 'stone':
            drawStone(obj)
            break
          case 'social':
            // Billboards render with the objects (before the cat) so the cat
            // walks in front of them. They stay bright (no wash to escape now).
            drawSocialSign(obj)
            break
          case 'photo':
            drawPhoto(obj)
            break
        }
      })
      // Fade the radio jingle in/out with proximity (idempotent per frame).
      radio.setNear(radioPlaying)
    }

    // Cosmetic ability emote drawn over a koala's head/face. `t` is 0→1 progress
    // (alpha eases in then out). Bite = a chomp near the mouth, hand = a paw
    // swipe in front, meow = a little speech bubble. tx/ty are tile coords.
    function drawEmote(
      tx: number,
      ty: number,
      dir: 'left' | 'right',
      kind: AbilityKind,
      t: number,
    ) {
      if (!ctx) return
      const cx = tx * PIXEL + PIXEL * 0.5
      const cy = ty * PIXEL
      const front = dir === 'left' ? -1 : 1
      const alpha = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) // 0→1→0
      ctx.save()
      ctx.globalAlpha = alpha
      if (kind === 'meow') {
        const bx = cx
        const by = cy - PIXEL * 0.55
        ctx.font = `${SCALE * 4}px 'Cormorant Garamond', Georgia, serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const w = ctx.measureText('meow').width + SCALE * 6
        const h = SCALE * 8
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.beginPath()
        ctx.roundRect(bx - w / 2, by - h / 2, w, h, SCALE * 3)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(bx - SCALE * 2, by + h / 2)
        ctx.lineTo(bx + SCALE * 2, by + h / 2)
        ctx.lineTo(bx, by + h / 2 + SCALE * 3)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = COLORS.charcoal
        ctx.fillText('meow', bx, by)
      } else if (kind === 'bite') {
        const fx = cx + front * PIXEL * 0.4
        const fy = cy + PIXEL * 0.2
        const open = (0.5 - Math.abs(t - 0.5)) * PIXEL * 0.5 // opens then shuts
        const s = PIXEL * 0.26
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.beginPath()
        ctx.moveTo(fx - s, fy - open)
        ctx.lineTo(fx + s, fy - open)
        ctx.lineTo(fx, fy - open - s * 0.7)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(fx - s, fy + open)
        ctx.lineTo(fx + s, fy + open)
        ctx.lineTo(fx, fy + open + s * 0.7)
        ctx.closePath()
        ctx.fill()
      } else if (kind === 'hand') {
        const fx = cx + front * PIXEL * 0.45
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = SCALE
        for (let i = 0; i < 3; i++) {
          const r = PIXEL * (0.2 + i * 0.12)
          const a0 = -0.6 + t * 1.2
          ctx.beginPath()
          ctx.arc(fx, cy + PIXEL * 0.1, r, a0, a0 + 0.7 * front, front < 0)
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    function drawPopups(f: number) {
      if (!ctx) return
      g.popups = g.popups.filter((p) => p.life > 0)
      g.popups.forEach((p) => {
        p.life -= f
        p.y -= 0.5 * f
        // Clamp to [0,1]: once life goes negative this would be negative, and
        // `ctx.globalAlpha = <out-of-range>` is silently ignored by canvas —
        // leaving alpha at 1 for the final frame, which read as a blink.
        const alpha = Math.max(0, Math.min(1, p.life / 30))
        ctx.globalAlpha = alpha
        ctx.font = "600 16px 'Cormorant Garamond', Georgia, serif"
        ctx.textAlign = 'center'
        const metrics = ctx.measureText(p.text)
        const padding = 8
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.roundRect(
          p.x - metrics.width / 2 - padding,
          p.y - 10,
          metrics.width + padding * 2,
          24,
          8,
        )
        ctx.fill()
        ctx.fillStyle = COLORS.charcoal
        ctx.fillText(p.text, p.x, p.y + 6)
        ctx.globalAlpha = 1
      })
    }

    function spawnFood() {
      // Weighted random pick.
      let r = Math.random() * FOOD_TOTAL_WEIGHT
      let pick = FOODS[0]
      for (const f of FOODS) {
        r -= f.weight
        if (r <= 0) {
          pick = f
          break
        }
      }
      // Find a free tile away from objects, other food, and the cat.
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
        const y = 2 + Math.floor(Math.random() * (GROUND_ROWS - 4))
        const onObject = g.objects.some(
          (o) =>
            x + 0.5 >= o.x && x < o.x + o.w && y + 0.5 >= o.y && y < o.y + o.h,
        )
        if (onObject) continue
        if (g.foods.some((f) => Math.hypot(f.x - x, f.y - y) < 1.2)) continue
        if (Math.hypot(g.cat.x - x, g.cat.y - y) < 1.5) continue
        // Occasionally the (single) collectible is airborne — a jump target.
        const air = Math.random() < 0.3
        g.foods.push({
          key: pick.key,
          x,
          y,
          born: g.frameCount,
          // frameCount units (60fps) — matches the server TTLs.
          life: (air ? AIR_FOOD_TTL_MS : FOOD_TTL_MS) * 0.06,
          air,
        })
        return
      }
    }

    // Multiplayer: the SERVER owns food + scoring. We ask to collect on
    // proximity (server validates + awards likes → parkStore via onWallet).
    // Solo (no backend): the original client-side spawn + pickup + earn.
    function updateFoods() {
      const cat = g.cat
      // Are we mid-hop right now? Airborne food can only be grabbed in this window
      // (the server enforces the same rule; this just avoids futile requests).
      const jumping = performance.now() - g.jumpAt <= JUMP_DURATION_MS
      if (mp) {
        const now = Date.now() + mp.clockOffset
        for (const sf of mp.food.values()) {
          const age = (now - sf.bornAt) * 0.06 // ms → 60fps-frame units
          const last = g.collectCooldowns.get(sf.id) ?? 0
          const reach = sf.air ? AIR_COLLECT_RADIUS : COLLECT_RADIUS
          if (
            age > 8 &&
            now - last > COLLECT_RETRY_MS &&
            (!sf.air || jumping) &&
            Math.hypot(cat.x - sf.x, cat.y - sf.y) < reach
          ) {
            g.collectCooldowns.set(sf.id, now)
            mp.sendCollect(sf.id)
          }
        }
        for (const id of g.collectCooldowns.keys()) {
          if (!mp.food.has(id)) g.collectCooldowns.delete(id)
        }
        // Coins are server-fed into parkStore; when our total rises, pop "+N".
        if (mp.connected) {
          if (g.likesSynced && mp.likes > g.prevLikes) {
            g.popups.push({
              text: `+${mp.likes - g.prevLikes}`,
              x: (cat.x + 0.5) * PIXEL,
              y: cat.y * PIXEL - 6,
              life: 80,
            })
            cat.interacting = true
          }
          g.prevLikes = mp.likes
          g.likesSynced = true
        } else {
          g.likesSynced = false
        }
        return
      }

      // --- Solo fallback ---
      if (g.frameCount >= g.nextFoodAt && g.foods.length < foodCap(1)) {
        spawnFood()
        g.nextFoodAt = g.frameCount + 240 + Math.floor(Math.random() * 300)
      }
      g.foods = g.foods.filter((f) => {
        const age = g.frameCount - f.born
        if (age > f.life) return false
        const reach = f.air ? AIR_COLLECT_RADIUS : 0.85
        if (
          age > 8 &&
          (!f.air || jumping) &&
          Math.hypot(cat.x - f.x, cat.y - f.y) < reach
        ) {
          const def = FOODS_BY_KEY[f.key]
          const pts = f.air ? def.points * AIR_POINTS_MULT : def.points
          parkStore.earn(pts)
          g.popups.push({
            text: `+${pts} ${def.label}`,
            x: (f.x + 0.5) * PIXEL,
            y: f.y * PIXEL - 6,
            life: 80,
          })
          cat.interacting = true // little hearts on pickup
          return false
        }
        return true
      })
    }

    // Collectibles to render: solo → the local list; multiplayer → the
    // server-owned set mapped into render shape (born/life derived from the
    // server clock, clamped so skew can't produce a negative pop-in size).
    function foodsToRender(): Food[] {
      if (!mp) return g.foods
      const now = Date.now() + mp.clockOffset
      const life = FOOD_TTL_MS * 0.06
      const out: Food[] = []
      for (const sf of mp.food.values()) {
        const ageFrames = Math.max(0, (now - sf.bornAt) * 0.06)
        out.push({
          id: sf.id,
          key: sf.key,
          x: sf.x,
          y: sf.y,
          points: sf.points,
          born: g.frameCount - ageFrames,
          life: sf.air ? AIR_FOOD_TTL_MS * 0.06 : life,
          air: sf.air,
        })
      }
      return out
    }

    // Collectible food drawn as flat, basic-shape art with `ctx` primitives so
    // it matches the park's other procedurally-drawn objects (tree, bench,
    // flowers, …) rather than looking like pasted-in emoji. Centered at (cx, cy)
    // and sized to fit `size` px; `emoji` is only a last-resort fallback for an
    // unknown key. Colours are bright because food is drawn above the purple
    // night wash (unlike the objects beneath it) so it reads as collectible.
    function drawFoodShape(
      key: string,
      cx: number,
      cy: number,
      size: number,
      emoji: string,
    ) {
      if (!ctx) return
      const u = size / 2 // half extent
      const dot = (dx: number, dy: number, r: number, color: string) => {
        ctx!.fillStyle = color
        ctx!.beginPath()
        ctx!.arc(dx, dy, r, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx.save()
      ctx.translate(cx, cy)

      switch (key) {
        case 'treat': {
          // Choc-chip cookie
          dot(0, 0, u * 0.85, '#CD9557')
          dot(-u * 0.28, -u * 0.28, u * 0.34, '#DBA870') // highlight
          const chips: [number, number][] = [
            [-0.34, -0.18],
            [0.28, -0.32],
            [0.36, 0.2],
            [-0.06, 0.34],
            [-0.42, 0.26],
            [0.04, -0.02],
          ]
          chips.forEach(([dx, dy]) => dot(dx * u, dy * u, u * 0.12, '#7A4A25'))
          break
        }
        case 'fish':
        case 'goldfish': {
          const gold = key === 'goldfish'
          const body = gold ? '#FFCB2E' : '#5AA9E6'
          const belly = gold ? '#FFE27A' : '#93C9F2'
          const fin = gold ? '#F5A623' : '#3D8FD6'
          // Tail (left)
          ctx.fillStyle = fin
          ctx.beginPath()
          ctx.moveTo(-u * 0.5, 0)
          ctx.lineTo(-u * 0.95, -u * 0.45)
          ctx.lineTo(-u * 0.95, u * 0.45)
          ctx.closePath()
          ctx.fill()
          // Body
          ctx.fillStyle = body
          ctx.beginPath()
          ctx.ellipse(u * 0.08, 0, u * 0.6, u * 0.44, 0, 0, Math.PI * 2)
          ctx.fill()
          // Belly
          ctx.fillStyle = belly
          ctx.beginPath()
          ctx.ellipse(u * 0.12, u * 0.16, u * 0.44, u * 0.24, 0, 0, Math.PI * 2)
          ctx.fill()
          // Top fin
          ctx.fillStyle = fin
          ctx.beginPath()
          ctx.moveTo(-u * 0.05, -u * 0.38)
          ctx.lineTo(u * 0.26, -u * 0.62)
          ctx.lineTo(u * 0.3, -u * 0.28)
          ctx.closePath()
          ctx.fill()
          // Eye
          dot(u * 0.4, -u * 0.1, u * 0.13, '#FFFFFF')
          dot(u * 0.43, -u * 0.1, u * 0.07, '#2A2A2A')
          break
        }
        case 'cheese': {
          // Wedge
          ctx.fillStyle = '#FFD23D'
          ctx.beginPath()
          ctx.moveTo(-u * 0.7, u * 0.5)
          ctx.lineTo(u * 0.78, u * 0.12)
          ctx.lineTo(-u * 0.08, -u * 0.6)
          ctx.closePath()
          ctx.fill()
          // Top face (lighter)
          ctx.fillStyle = '#FFE474'
          ctx.beginPath()
          ctx.moveTo(-u * 0.08, -u * 0.6)
          ctx.lineTo(u * 0.78, u * 0.12)
          ctx.lineTo(u * 0.22, u * 0.02)
          ctx.closePath()
          ctx.fill()
          // Holes
          dot(-u * 0.14, u * 0.24, u * 0.12, '#E8B92E')
          dot(u * 0.26, u * 0.04, u * 0.08, '#E8B92E')
          dot(-u * 0.36, u * 0.36, u * 0.07, '#E8B92E')
          break
        }
        case 'drumstick': {
          ctx.save()
          ctx.rotate(-0.5)
          // Bone
          ctx.strokeStyle = '#FFF3DE'
          ctx.lineCap = 'round'
          ctx.lineWidth = u * 0.26
          ctx.beginPath()
          ctx.moveTo(-u * 0.05, u * 0.05)
          ctx.lineTo(-u * 0.65, u * 0.68)
          ctx.stroke()
          dot(-u * 0.72, u * 0.6, u * 0.13, '#FFF3DE')
          dot(-u * 0.58, u * 0.76, u * 0.13, '#FFF3DE')
          // Meat
          dot(u * 0.18, -u * 0.18, u * 0.5, '#C0803F')
          dot(u * 0.04, -u * 0.32, u * 0.2, '#D2965A') // highlight
          ctx.restore()
          break
        }
        case 'shrimp': {
          // Fried tempura shrimp — arc of batter lobes with a red tail fan
          const lobes: [number, number, number][] = [
            [-0.45, 0.35, 0.34],
            [-0.15, 0.1, 0.34],
            [0.15, -0.12, 0.3],
            [0.4, -0.35, 0.24],
          ]
          lobes.forEach(([dx, dy, r]) => dot(dx * u, dy * u, r * u, '#E89A5C'))
          lobes.forEach(([dx, dy, r]) =>
            dot(
              dx * u - r * u * 0.25,
              dy * u - r * u * 0.25,
              r * u * 0.4,
              '#F6BC86',
            ),
          )
          ctx.fillStyle = '#FF6B5C'
          ctx.beginPath()
          ctx.moveTo(u * 0.48, -u * 0.42)
          ctx.lineTo(u * 0.85, -u * 0.68)
          ctx.lineTo(u * 0.78, -u * 0.32)
          ctx.closePath()
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(u * 0.48, -u * 0.42)
          ctx.lineTo(u * 0.82, -u * 0.16)
          ctx.lineTo(u * 0.58, -u * 0.12)
          ctx.closePath()
          ctx.fill()
          break
        }
        case 'tin': {
          // Cat-food can (cylinder)
          const w = u * 1.1
          const h = u * 1.25
          const ex = w / 2
          const ey = u * 0.22
          ctx.fillStyle = '#AEB9C1'
          ctx.fillRect(-ex, -h / 2, w, h)
          ctx.fillStyle = '#96A2AB' // side shading
          ctx.fillRect(ex - w * 0.26, -h / 2, w * 0.26, h)
          ctx.fillStyle = '#F26D5B' // label band
          ctx.fillRect(-ex, -u * 0.24, w, u * 0.48)
          dot(0, 0, u * 0.15, '#FFE0B2') // emblem
          ctx.fillStyle = '#CDD6DC' // top lid
          ctx.beginPath()
          ctx.ellipse(0, -h / 2, ex, ey, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#E6ECEF'
          ctx.beginPath()
          ctx.ellipse(0, -h / 2, ex * 0.68, ey * 0.6, 0, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        case 'sushi': {
          // Nigiri — rice mound + salmon slab + a nori band
          ctx.fillStyle = '#F6F1E7' // rice
          ctx.beginPath()
          ctx.ellipse(0, u * 0.3, u * 0.72, u * 0.4, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#FF9E6B' // salmon
          ctx.beginPath()
          ctx.ellipse(0, -u * 0.12, u * 0.78, u * 0.34, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#FFC6A3' // salmon marbling
          ctx.lineWidth = u * 0.09
          ctx.beginPath()
          ctx.moveTo(-u * 0.5, -u * 0.2)
          ctx.lineTo(u * 0.5, -u * 0.28)
          ctx.moveTo(-u * 0.46, -u * 0.02)
          ctx.lineTo(u * 0.5, -u * 0.08)
          ctx.stroke()
          ctx.fillStyle = '#37503B' // nori
          ctx.fillRect(-u * 0.18, -u * 0.22, u * 0.36, u * 0.78)
          break
        }
        default: {
          ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(emoji, 0, 0)
          ctx.textBaseline = 'alphabetic'
        }
      }
      ctx.restore()
    }

    // Authorship: a shop item shows its buyer's name in a small, subtle label
    // underneath — but only while Koala is standing near it (fades in with
    // proximity), like the object tooltips. Purely cosmetic pride.
    function drawAuthorLabels() {
      if (!ctx) return
      const catX = g.cat.x + 0.5
      const catY = g.cat.y + 0.5
      const REACH = 2.2 // tiles within which the author is revealed
      for (const obj of g.objects) {
        if (obj.placedAt == null || obj.ownerId == null) continue
        // Resolve the author's CURRENT name from the shared authors map, so a
        // rename is reflected on every item that owner placed.
        const author = mp?.authors.get(obj.ownerId)
        if (!author) continue
        const ix = obj.x + obj.w / 2
        const iy = obj.y + obj.h / 2
        const d = Math.hypot(catX - ix, catY - iy)
        if (d > REACH) continue
        const alpha = Math.min(0.8, ((REACH - d) / REACH) * 1.4)
        const px = ix * PIXEL
        const py = (obj.y + obj.h) * PIXEL + 4
        ctx.save()
        ctx.font = `${SCALE * 3}px 'Inter', system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.lineWidth = SCALE
        ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.6})`
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.strokeText(author, px, py)
        ctx.fillText(author, px, py)
        ctx.restore()
      }
    }

    function drawFoods() {
      if (!ctx) return
      foodsToRender().forEach((f) => {
        const def = FOODS_BY_KEY[f.key]
        const cx = (f.x + 0.5) * PIXEL
        const baseY = (f.y + 0.5) * PIXEL
        const age = g.frameCount - f.born
        const ease = 1 - Math.pow(1 - Math.min(1, age / 12), 3) // pop-in
        const bob = Math.sin(g.frameCount * 0.08 + f.x * 1.3) * 3
        const remaining = f.life - age
        const blink =
          remaining < 150 && Math.floor(g.frameCount / 6) % 2 === 0 ? 0.4 : 1
        const size = PIXEL * 0.9 * ease
        // Airborne food floats above its tile (a jump target); its shadow stays
        // on the ground and shrinks to sell the height.
        const lift = f.air ? AIR_HEIGHT_TILES * PIXEL : 0
        const hover = f.air ? Math.sin(g.frameCount * 0.06 + f.x) * 5 : 0
        const shadowScale = f.air ? Math.max(0.5, 1 - lift / (PIXEL * 3)) : 1
        const cy = baseY + bob - lift + hover
        ctx.globalAlpha = blink

        // Soft glow (gold for the legendary, warm cream otherwise).
        const glowCol = def.tier === 'legendary' ? '255,215,80' : '255,240,190'
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size)
        glow.addColorStop(0, `rgba(${glowCol},0.45)`)
        glow.addColorStop(1, `rgba(${glowCol},0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(cx, cy, size, 0, Math.PI * 2)
        ctx.fill()

        // Ground shadow (anchored to the tile, not the lifted sprite).
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.beginPath()
        ctx.ellipse(
          cx,
          baseY + size * 0.42,
          size * 0.3 * shadowScale,
          size * 0.1 * shadowScale,
          0,
          0,
          Math.PI * 2,
        )
        ctx.fill()

        // Airborne food wears little flapping wings so it's unmistakably a
        // jump target (drawn behind the food body). Ground food has none.
        if (f.air) {
          const flap = Math.sin(g.frameCount * 0.35) * 0.5 // radians
          const wingW = size * 0.62
          for (const dir of [-1, 1] as const) {
            ctx.save()
            ctx.translate(cx + dir * size * 0.2, cy - size * 0.05)
            ctx.rotate(dir * (0.3 + flap)) // spread outward, then flap
            ctx.scale(dir, 1)
            ctx.fillStyle = 'rgba(255,253,245,0.95)'
            ctx.strokeStyle = 'rgba(150,160,190,0.55)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.ellipse(
              wingW * 0.5,
              0,
              wingW * 0.5,
              wingW * 0.3,
              0,
              0,
              Math.PI * 2,
            )
            ctx.fill()
            ctx.stroke()
            // a feather crease
            ctx.strokeStyle = 'rgba(150,160,190,0.4)'
            ctx.beginPath()
            ctx.moveTo(wingW * 0.15, 0)
            ctx.lineTo(wingW * 0.92, 0)
            ctx.stroke()
            ctx.restore()
          }
        }

        // Flat basic-shape sprite, matching the rest of the park's art.
        drawFoodShape(f.key, cx, cy, size, def.emoji)

        // Twinkle sparkle.
        const tw = (Math.sin(g.frameCount * 0.15 + f.x) + 1) / 2
        ctx.fillStyle = `rgba(255,255,240,${0.4 + tw * 0.5})`
        ctx.beginPath()
        ctx.arc(
          cx + size * 0.34,
          cy - size * 0.36,
          1.5 + tw * 1.5,
          0,
          Math.PI * 2,
        )
        ctx.fill()

        ctx.globalAlpha = 1
      })
    }

    function updateCat(dt: number) {
      const cat = g.cat
      // Time-based speed so the cat walks at the same real-world pace regardless
      // of frame rate (mobile often runs below 60fps). 0.0021 tiles/ms ≈ the old
      // 0.035 tiles/frame at 60fps.
      const speed = 0.0021 * dt
      let moving = false
      let newX = cat.x
      let newY = cat.y

      if (g.keys['arrowleft'] || g.keys['a']) {
        newX -= speed
        cat.dir = 'left'
        moving = true
      }
      if (g.keys['arrowright'] || g.keys['d']) {
        newX += speed
        cat.dir = 'right'
        moving = true
      }
      if (g.keys['arrowup'] || g.keys['w']) {
        newY -= speed
        moving = true
      }
      if (g.keys['arrowdown'] || g.keys['s']) {
        newY += speed
        moving = true
      }

      // Analog on-screen joystick (Gamer mode) — a direct 2D vector whose
      // magnitude scales speed, same feel as the keyboard but continuous.
      const mv = controls.getMove()
      if (mv && (mv.x !== 0 || mv.y !== 0)) {
        newX += mv.x * speed
        newY += mv.y * speed
        if (Math.abs(mv.x) > 0.2) cat.dir = mv.x < 0 ? 'left' : 'right'
        moving = true
      }

      // Keyboard/joystick input overrides tap-to-walk; otherwise head toward the
      // tapped target and stop once we arrive.
      if (moving) {
        g.target = null
      } else if (g.target) {
        const dx = g.target.x - cat.x
        const dy = g.target.y - cat.y
        const dist = Math.hypot(dx, dy)
        if (dist <= speed) {
          newX = g.target.x
          newY = g.target.y
          g.target = null
        } else {
          newX += (dx / dist) * speed
          newY += (dy / dist) * speed
          if (Math.abs(dx) > 0.01) cat.dir = dx < 0 ? 'left' : 'right'
          moving = true
        }
      }

      // Idle state management
      if (moving) {
        cat.idleFrames = 0
        cat.state = 'standing'
        hasWalked = true // first real movement enables radio playback
      } else {
        // Accumulate in 60fps-frame units (dt * 0.06) so idle timing is
        // frame-rate-independent: ~10s to lie, ~20s to sleep.
        cat.idleFrames += dt * 0.06
        if (cat.idleFrames > 1200) {
          cat.state = 'sleeping'
        } else if (cat.idleFrames > 600) {
          cat.state = 'lying'
        } else {
          cat.state = 'standing'
        }
      }

      newX = Math.max(0, Math.min(MAP_COLS - 1, newX))
      newY = Math.max(1, Math.min(GROUND_ROWS - 1.5, newY))

      let blocked = false
      g.objects.forEach((obj) => {
        if (
          obj.solid &&
          newX + 0.5 > obj.x &&
          newX < obj.x + obj.w &&
          newY + 0.5 > obj.y &&
          newY < obj.y + obj.h
        ) {
          blocked = true
        }
      })

      if (!blocked) {
        // First real movement dismisses the control hint (and remembers it, so
        // returning movers never see it again). This is the one point both input
        // modes converge on an actual position change — idle animation, blocked
        // moves, and edge-clamped no-ops (newX === cat.x) don't reach here.
        if (!hintMovedRef.current && (newX !== cat.x || newY !== cat.y)) {
          hintMovedRef.current = true
          parkStore.lsSet('kcc-hint-moved', '1')
          setShowHint(false) // loop -> React bridge, same as setHover/setLightbox
        }
        cat.x = newX
        cat.y = newY
      } else {
        // Ran into something solid — abandon the tap target so we don't push.
        g.target = null
      }
      cat.idle = !moving

      cat.interacting = false
      g.objects.forEach((obj) => {
        if (obj.interactMsg && !obj.solid) {
          const dist = Math.hypot(
            cat.x + 0.5 - (obj.x + obj.w / 2),
            cat.y + 0.5 - (obj.y + obj.h / 2),
          )
          if (dist < 1.5) {
            cat.interacting = true
            // Show the reaction once per approach: pop it when the cat enters
            // range, then stay quiet until it leaves and comes back (the else
            // below re-arms it) — instead of re-popping on a timer while lingering.
            if (!obj._shown) {
              obj._shown = true
              g.popups.push({
                text: obj.interactMsg,
                x: obj.x * PIXEL + (obj.w * PIXEL) / 2,
                y: obj.y * PIXEL - 20,
                life: 90,
              })
            }
          } else {
            obj._shown = false
          }
        }
      })
    }

    // Camera measurements are cached and refreshed on resize / any canvas box
    // change (see the ResizeObserver below), so panning doesn't force a layout
    // reflow (offsetWidth read) every frame.
    //
    // viewportW is measured from the canvas's parent (the fixed hero fills the
    // viewport), NOT window.innerWidth: innerWidth *includes* the vertical
    // scrollbar, but the canvas is centered inside the scrollbar-excluded
    // content box. Using innerWidth made the right-edge clamp (viewportW -
    // displayW) overshoot by the scrollbar width, so the camera stopped short of
    // the right edge and Koala could slide off-screen to the right.
    let viewportW = 0
    let displayW = 0
    let viewportH = 0
    let displayH = 0
    let lastTx = NaN
    let lastTy = NaN
    const measure = () => {
      const parent = canvas.parentElement
      viewportW = parent?.clientWidth || window.innerWidth
      displayW = canvas.offsetWidth
      viewportH = parent?.clientHeight || window.innerHeight
      displayH = canvas.offsetHeight
    }
    measure()

    // Render the canvas near device resolution (capped) and draw in logical
    // 960x816 coords via a context scale. This replaces the old low-res backing
    // + image-rendering:pixelated (nearest-neighbor) upscale, so moving sprites
    // are smooth instead of blocky/crawling. RS = backing / logical scale.
    let RS = 1
    const sizeBacking = () => {
      if (!canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.clientWidth || CANVAS_WIDTH
      RS = Math.max(1, Math.min(2, (cssW * dpr) / CANVAS_WIDTH))
      canvas.width = Math.round(CANVAS_WIDTH * RS)
      canvas.height = Math.round(CANVAS_HEIGHT * RS)
      ctx.imageSmoothingEnabled = true
    }

    // Follow camera: when the (scaled) canvas is larger than the viewport, pan it
    // via CSS transform to keep the cat centered — clamped so we never scroll past
    // the map edges. Horizontal handles wide canvases on narrow viewports;
    // vertical handles tall canvases on short viewports (e.g. a wide/short window
    // where the canvas is sized by its `100%` width and ends up taller than the
    // viewport). The cat's on-canvas Y sits below the sky rows (WORLD_OFFSET),
    // hence the SKY_ROWS term. See parkCamera.ts for the (unit-tested) math.
    function updateCamera() {
      if (!canvas) return
      const h = cameraPan(
        (g.cat.x + 0.5) / MAP_COLS,
        viewportW,
        displayW,
        CANVAS_WIDTH,
      )
      const v = cameraPan(
        (SKY_ROWS + g.cat.y + 0.5) / MAP_ROWS,
        viewportH,
        displayH,
        CANVAS_HEIGHT,
      )
      g.hudShift = h.hudShift
      g.hudShiftY = v.hudShift
      // Only touch the DOM when the pan actually changes.
      if (h.translate !== lastTx || v.translate !== lastTy) {
        canvas.style.transform = `translate(${h.translate}px, ${v.translate}px)`
        lastTx = h.translate
        lastTy = v.translate
      }
    }

    // Bake the fully static sky + ground into the offscreen canvas once.
    // A single pressed-grass paw print (pad + 4 toe beans), baked into the bg.
    function drawPawStamp(px: number, py: number, angle: number, s: number) {
      if (!ctx) return
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(angle)
      ctx.fillStyle = 'rgba(110,165,110,0.4)'
      ctx.beginPath()
      ctx.ellipse(0, s * 0.55, s * 0.9, s * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()
      const toes: [number, number][] = [
        [-0.7, -0.5],
        [-0.25, -0.85],
        [0.25, -0.85],
        [0.7, -0.5],
      ]
      toes.forEach(([tx, ty]) => {
        ctx!.beginPath()
        ctx!.ellipse(tx * s, ty * s, s * 0.32, s * 0.4, 0, 0, Math.PI * 2)
        ctx!.fill()
      })
      ctx.restore()
    }
    // A short wandering trail of paw prints across the lower grass (world coords).
    function drawPawTrail() {
      const trail: [number, number, number][] = [
        [PIXEL * 3.2, PIXEL * 11.2, 0.5],
        [PIXEL * 4.3, PIXEL * 10.7, 0.4],
        [PIXEL * 5.4, PIXEL * 10.3, 0.5],
        [PIXEL * 6.6, PIXEL * 10.0, 0.45],
        [PIXEL * 7.8, PIXEL * 9.8, 0.5],
      ]
      trail.forEach(([px, py, a]) => drawPawStamp(px, py, a, SCALE * 1.6))
    }
    // Rolling grass ridges over the (otherwise straight) sky/ground seam so the
    // horizon reads as soft hills against the night sky rather than a hard line.
    function drawWavyHorizon() {
      if (!ctx) return
      const seam = WORLD_OFFSET + PIXEL // where the straight sand top used to read
      const amp = PIXEL * 0.5
      const ridge = (
        color: string,
        base: number,
        wob: number,
        phase: number,
        freq: number,
      ) => {
        ctx!.fillStyle = color
        ctx!.beginPath()
        ctx!.moveTo(0, seam + PIXEL * 0.8)
        for (let i = 0; i <= CANVAS_WIDTH; i += 6) {
          const t = i / CANVAS_WIDTH
          const yy =
            seam - amp * (base + wob * Math.sin(t * Math.PI * freq + phase))
          ctx!.lineTo(i, yy)
        }
        ctx!.lineTo(CANVAS_WIDTH, seam + PIXEL * 0.8)
        ctx!.closePath()
        ctx!.fill()
      }
      ridge(COLORS.grassDark, 0.75, 0.4, 2.1, 5) // darker back ridge (taller)
      ridge(COLORS.grass, 0.4, 0.42, 0.0, 7) // lighter front ridge
    }

    function renderStaticBackground() {
      if (!bgCtx || !canvas) return
      ctx!.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      const horizon = WORLD_OFFSET + PIXEL * 1.8
      const skyGrad = ctx!.createLinearGradient(0, 0, 0, horizon)
      skyGrad.addColorStop(0, COLORS.sky)
      skyGrad.addColorStop(0.6, COLORS.skyLight)
      skyGrad.addColorStop(1, 'oklch(0.12 0.008 60)')
      ctx!.fillStyle = skyGrad
      ctx!.fillRect(0, 0, CANVAS_WIDTH, horizon)
      // Ridge on the sky, so the textured grass patches drawn by drawGround()
      // render on top of the wave. (Stars + moon are drawn in the loop, above the
      // wash, so they stay bright rather than being dimmed by the night overlay.)
      drawWavyHorizon()
      ctx!.save()
      ctx!.translate(0, WORLD_OFFSET)
      drawGround()
      drawPawTrail()
      ctx!.restore()
      // Bake the night tint into the static background once (sky/hills/ground/
      // grass/paws), replacing the old per-frame full-canvas multiply overlay.
      ctx!.save()
      ctx!.globalCompositeOperation = 'multiply'
      ctx!.fillStyle = 'rgba(120, 80, 180, 0.5)'
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx!.restore()
      bgCtx.drawImage(canvas, 0, 0)
    }
    renderStaticBackground()
    // Bake runs at logical size (above); now upsize the visible canvas backing.
    sizeBacking()

    // Only animate while the game is on screen and the tab is visible.
    let onScreen = window.scrollY < window.innerHeight
    let tabVisible = !document.hidden
    const active = () => onScreen && tabVisible

    let lastNow = 0
    let lastSweepAt = 0
    function gameLoop(now = 0) {
      animId = 0
      // Elapsed ms since last frame, clamped so a tab-resume / stall can't make
      // the cat teleport. First frame assumes ~60fps.
      const dt = lastNow ? Math.min(now - lastNow, 100) : 1000 / 60
      lastNow = now
      // Elapsed time in 60fps-frame units. Scales every animation (the
      // frameCount clock below + per-frame integrations like butterflies/popups/
      // idle) so they run at the same pace regardless of frame rate.
      const f = dt * 0.06
      g.frameCount += f
      // Wall-clock time for placed-item pop-in / expiry (frameCount pauses with
      // the loop). Mirror the store wallet onto the HUD fields; sweep expired
      // decor ~1×/s.
      const wallNow = Date.now()
      g.score = parkStore.getCoins()
      g.best = parkStore.getBest()
      if (wallNow - lastSweepAt > 1000) {
        lastSweepAt = wallNow
        parkStore.sweepExpired(wallNow)
      }
      // Draw in logical 960x816 coords scaled up to the high-res backing.
      ctx!.setTransform(RS, 0, 0, RS, 0, 0)
      ctx!.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Pre-rendered static sky + ground (blitted, smoothly upscaled).
      ctx!.drawImage(bgCanvas, 0, 0)

      // Dynamic world, pushed down so the sky has room above it.
      ctx!.save()
      ctx!.translate(0, WORLD_OFFSET)
      drawObjects(wallNow)
      drawButterflies(f)
      updateCat(dt)
      // Dash lunge: while active, ease the koala from dashFrom→dashTo, overriding
      // this frame's movement so the lunged position propagates + renders.
      // (dashAt inits to -Infinity, so the guard is false until the first dash.)
      {
        const dEl = performance.now() - g.dashAt
        if (dEl >= 0 && dEl < DASH_DURATION_MS) {
          const e = 1 - Math.pow(1 - dEl / DASH_DURATION_MS, 3) // easeOutCubic
          g.cat.x = g.dashFrom.x + (g.dashTo.x - g.dashFrom.x) * e
          g.cat.y = g.dashFrom.y + (g.dashTo.y - g.dashFrom.y) * e
        }
      }
      parkStore.setCatTile(g.cat.x, g.cat.y)
      updateFoods()
      // Publish our position (throttled inside sendState).
      mp?.sendState({
        x: g.cat.x,
        y: g.cat.y,
        dir: g.cat.dir,
        pose: g.cat.state,
        interacting: g.cat.interacting,
      })
      const nowMs = performance.now()
      drawCat(g.cat, undefined, jumpLiftTiles(g.jumpAt, nowMs) * PIXEL)
      if (g.emote) {
        const et = (nowMs - g.emoteAt) / EMOTE_DURATION_MS
        if (et >= 0 && et <= 1)
          drawEmote(g.cat.x, g.cat.y, g.cat.dir, g.emote, et)
        else g.emote = null
      }
      // Remote koalas, interpolated toward their latest target and depth-sorted
      // with each other (drawn after the local cat, like all other players).
      if (mp && mp.players.size) {
        const lerp = Math.min(1, dt / 90)
        const remotes = [...mp.players.values()].sort((a, b) => a.ry - b.ry)
        for (const p of remotes) {
          p.rx += (p.x - p.rx) * lerp
          p.ry += (p.y - p.ry) * lerp
          const moving =
            Math.abs(p.x - p.rx) > 0.02 || Math.abs(p.y - p.ry) > 0.02
          remoteCat.x = p.rx
          remoteCat.y = p.ry
          remoteCat.dir = p.dir
          remoteCat.state = p.pose
          remoteCat.idle = !moving && p.pose === 'standing'
          remoteCat.interacting = p.interacting
          const rjump = p.jumpAt ? jumpLiftTiles(p.jumpAt, nowMs) * PIXEL : 0
          drawCat(remoteCat, p.name, rjump)
          if (p.act === 'bite' || p.act === 'hand' || p.act === 'meow') {
            const et = (nowMs - (p.actAt ?? -Infinity)) / EMOTE_DURATION_MS
            if (et >= 0 && et <= 1) drawEmote(p.rx, p.ry, p.dir, p.act, et)
          }
        }
      }
      ctx!.restore()

      // The night tint is now baked into each object's colours (below) + the
      // static background, so there's no full-canvas overlay. Drawn last (over
      // the world): the sky (stars + moon), then the dream bubble, food, and
      // popups. (The IG/TikTok billboards now draw with the objects, so the cat
      // walks in front of them.)
      drawMoon()
      // Stars sit higher in the sky (a smaller offset than the world).
      ctx!.save()
      ctx!.translate(0, WORLD_OFFSET * 0.65)
      drawStars()
      ctx!.restore()
      ctx!.save()
      ctx!.translate(0, WORLD_OFFSET)
      drawDreamBubble()
      drawFoods()
      drawAuthorLabels()
      drawPopups(f)
      ctx!.restore()

      updateCamera()
      // (The score/likes HUD + the presence roster now live in the DOM
      // BottomBar / Settings menu, not on the canvas.)

      if (active()) animId = requestAnimationFrame(gameLoop)
    }

    const ensureRunning = () => {
      if (active()) {
        if (!animId) animId = requestAnimationFrame(gameLoop)
      } else {
        // Paused (scrolled away / tab hidden): the loop stops updating radio
        // proximity, so silence it now rather than leave it playing.
        radio.setNear(false)
      }
    }
    // The hero is position:fixed, so it always intersects the viewport
    // geometrically — track scroll to pause once it's covered by the content.
    const updateOnScreen = () => {
      const v = window.scrollY < window.innerHeight
      if (v !== onScreen) {
        onScreen = v
        ensureRunning()
      }
    }
    const handleVisibility = () => {
      tabVisible = !document.hidden
      ensureRunning()
    }
    const handleScroll = () => {
      updateOnScreen()
      setHover(null) // don't leave a tooltip stranded while scrolling away
    }
    const handleResize = () => {
      measure()
      sizeBacking()
      updateOnScreen()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    // Refresh the cached camera measurements on ANY change to the canvas box —
    // not just window 'resize'. A scrollbar appearing, a DPR change, or the
    // mobile URL-bar / svh re-resolving all change displayW without firing
    // 'resize', which would otherwise leave a stale measurement and make the
    // camera pan the wrong amount. The observer only writes cached values (and
    // re-sizes the backing store); it triggers no per-frame reflow. Changing the
    // drawing-buffer size in sizeBacking() doesn't alter the element's CSS box,
    // so this can't feed back into the observer.
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measure()
            sizeBacking()
          })
        : null
    ro?.observe(canvas)

    ensureRunning()

    return () => {
      cancelAnimationFrame(animId)
      unsubscribeStore()
      controls.registerAbility(null)
      controls.clearMove()
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      ro?.disconnect()
      radio.dispose()
      document.body.classList.remove('kcc-dragging')
      mp?.close()
      parkStore.setServerBuyer(null) // back to solo/localStorage economy
      parkStore.setServerRenamer(null)
    }
  }, [initObjects])

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        // Set the drawing-buffer size on the element itself so the canvas has
        // its real intrinsic ratio (960x816) from first paint. Without these,
        // the canvas renders at the default 300x150 until the effect resizes it,
        // and under CPU throttling that resize repaints taller *after* first
        // paint — a ~0.30 layout shift (CLS). The effect still sets these too.
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Koala's Park — a mini game. Move Koala with the arrow keys or WASD (or turn on Gamer controls in Settings for an on-screen joystick + ability buttons), and catch the food that appears to score points. Press the space bar (or double-tap on touch) to jump and grab floating food."
        className="block cursor-pointer select-none shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        style={{
          // Canvas is rendered near device resolution (see sizeBacking), so let
          // the browser scale it smoothly — no nearest-neighbor pixelation.
          // Recognize taps immediately (no double-tap-zoom delay) on touch.
          touchAction: 'manipulation',
          // Don't let a press/drag select or highlight the canvas, and suppress
          // the iOS long-press callout/selection.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          // Cover the header on any screen size: scale up so the game fills both
          // width and height (whichever needs more), keeping the map ratio.
          // The flex parent centers it and clips the overflow.
          // svh (not dvh) so the size resolves at first paint and stays put: dvh
          // can resolve late on mobile, growing the canvas from ~0 to full screen
          // after paint — a large layout shift (this was ~0.30 CLS). svh is stable.
          width: `max(100%, calc(100svh * ${MAP_COLS} / ${MAP_ROWS}))`,
          height: 'auto',
          aspectRatio: `${MAP_COLS} / ${MAP_ROWS}`,
        }}
      />
      {/* Hotspot tooltip + photo lightbox are portalled to <body>: the fixed hero
          sits in a z-0 stacking context, so rendering them here would trap them
          below the scrolling content. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {hover && (
              <div
                className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-full"
                style={{ left: hover.sx, top: hover.sy - 10 }}
              >
                {hover.kind === 'photo' ? (
                  <img
                    src={HERO_PHOTO}
                    alt="Koala"
                    className="w-40 rounded-lg border-2 border-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:w-52"
                  />
                ) : (
                  <span className="whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-xs text-white shadow-lg backdrop-blur-sm">
                    {hover.label}
                  </span>
                )}
              </div>
            )}
            {lightbox && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Koala photo"
                onClick={closeLightbox}
                className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
              >
                <img
                  src={HERO_PHOTO}
                  alt="Koala"
                  className="max-h-[90vh] max-w-[92vw] rounded-xl shadow-2xl"
                />
                <button
                  type="button"
                  onClick={closeLightbox}
                  aria-label="Close"
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/25"
                >
                  ✕
                </button>
              </div>
            )}
            {/* First-run control hint (desktop only — on touch, play is via the
                Gamer-mode joystick). Dismisses on first move (see updateCat). */}
            <AnimatePresence>
              {showHint && !isTouch && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none fixed inset-x-0 bottom-32 z-30 flex justify-center px-6 sm:bottom-36"
                  initial={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 10 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0.15 : 0.5,
                    delay: prefersReducedMotion ? 0 : 0.7,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <span className="inline-flex select-none items-center gap-2.5 rounded-full bg-black/35 px-4 py-2 text-xs font-medium text-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-white/15 backdrop-blur-md sm:px-5 sm:py-2.5 sm:text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[oklch(0.82_0.13_78)] shadow-[0_0_8px_oklch(0.82_0.13_78_/_0.6)]" />
                    {/* Arrow cluster hides on narrow widths so the chip never
                        overflows — WASD alone carries it. */}
                    <span className="hidden items-center gap-1 sm:inline-flex">
                      {['↑', '↓', '←', '→'].map((k) => (
                        <kbd
                          key={k}
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white/10 px-1.5 text-[11px] font-medium text-white/85 ring-1 ring-white/15"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="hidden text-white/30 sm:inline">/</span>
                    <span className="inline-flex items-center gap-1">
                      {['W', 'A', 'S', 'D'].map((k) => (
                        <kbd
                          key={k}
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white/10 px-1.5 text-[11px] font-medium text-white/85 ring-1 ring-white/15"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="text-white/55">to move Koala</span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body,
        )}
    </div>
  )
}
