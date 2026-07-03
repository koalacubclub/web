import { useEffect, useRef, useCallback } from 'react'

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
const BEST_SCORE_KEY = 'kcc-park-best'

interface GameObject {
  type: string
  x: number
  y: number
  w: number
  h: number
  interactMsg?: string
  solid?: boolean
  _shown?: boolean
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
}

export default function ParkGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
    keys: {} as Record<string, boolean>,
    // Tap/click target the cat walks toward (top-left tile coords), or null.
    target: null as { x: number; y: number } | null,
    objects: [] as GameObject[],
    butterflies: [] as Butterfly[],
    popups: [] as Popup[],
    foods: [] as Food[],
    foodImages: {} as Record<string, HTMLImageElement>,
    score: 0,
    best: 0,
    nextFoodAt: 180,
    hudShift: 0, // canvas-px offset to keep the HUD pinned against the camera pan
    frameCount: 0,
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
        type: 'foodbowl',
        x: 12,
        y: 7,
        w: 1,
        h: 1,
        interactMsg: '♥ Yummy chicken!',
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
      {
        type: 'mushroom',
        x: 17,
        y: 8,
        w: 1,
        h: 1,
        interactMsg: '? Mysterious...',
      },
    ]
    g.butterflies = [
      { x: 100, y: 80, vx: 0.5, vy: 0.3, timer: 0, color: COLORS.butterfly },
      {
        x: 300,
        y: 120,
        vx: -0.3,
        vy: 0.5,
        timer: Math.PI,
        color: COLORS.flower1,
      },
      {
        x: 500,
        y: 60,
        vx: 0.4,
        vy: -0.2,
        timer: Math.PI / 2,
        color: COLORS.fishBowl,
      },
    ]
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    initObjects()

    const g = gameRef.current

    // Restore best score; preload food sprites (emoji fallback until PNGs exist).
    try {
      g.best = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0
    } catch {
      /* localStorage unavailable — ignore */
    }
    FOODS.forEach((f) => {
      const img = new Image()
      img.src = `/game/food/${f.key}.png`
      g.foodImages[f.key] = img
    })

    // Offscreen canvas holding the fully static sky + ground. Rendered once,
    // then blitted each frame instead of recomputing the grass blobs, sand
    // texture, and gradients every frame.
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = CANVAS_WIDTH
    bgCanvas.height = CANVAS_HEIGHT
    const bgCtx = bgCanvas.getContext('2d')

    const handleKeyDown = (e: KeyboardEvent) => {
      g.keys[e.key.toLowerCase()] = true
      if (
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(
          e.key.toLowerCase(),
        )
      ) {
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

    // ── Mouse / pen: engage immediately (no page-scroll gesture to conflict). ──
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return // touch handled below (hold-to-grab)
      if (!canEngageAt(e.target, e.clientX, e.clientY)) return
      engage(e.clientX, e.clientY)
    }
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (pointerActive) aimAt(e.clientX, e.clientY)
    }
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      disengage()
    }

    // ── Touch: a quick swipe scrolls the page; a brief hold "grabs" the cat,
    // after which dragging steers her and the page won't scroll. ──
    const HOLD_MS = 150 // press this long (without moving) to grab the cat
    const MOVE_TOL = 10 // px of movement before the hold that counts as a swipe
    let touchId: number | null = null
    let touchStartX = 0
    let touchStartY = 0
    let touchMoved = false
    let touchEngaged = false
    let holdTimer = 0
    const touchById = (list: TouchList) => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === touchId) return list[i]
      }
      return null
    }
    const clearHold = () => {
      if (holdTimer) {
        clearTimeout(holdTimer)
        holdTimer = 0
      }
    }
    const handleTouchStart = (e: TouchEvent) => {
      if (touchId !== null) return // already tracking one touch
      const t = e.changedTouches[0]
      if (!t || !canEngageAt(e.target, t.clientX, t.clientY)) return
      touchId = t.identifier
      touchStartX = t.clientX
      touchStartY = t.clientY
      touchMoved = false
      touchEngaged = false
      holdTimer = window.setTimeout(() => {
        holdTimer = 0
        // Held still long enough → grab the cat.
        if (!touchMoved && touchId !== null) {
          touchEngaged = true
          engage(touchStartX, touchStartY)
        }
      }, HOLD_MS)
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (touchId === null) return
      const t = touchById(e.changedTouches)
      if (!t) return
      if (touchEngaged) {
        e.preventDefault() // steering the cat — don't let the page scroll
        aimAt(t.clientX, t.clientY)
        return
      }
      // Not engaged yet: real movement means it's a scroll gesture — bail so the
      // browser scrolls normally.
      if (
        Math.abs(t.clientX - touchStartX) > MOVE_TOL ||
        Math.abs(t.clientY - touchStartY) > MOVE_TOL
      ) {
        touchMoved = true
        clearHold()
      }
    }
    const endTouch = () => {
      clearHold()
      if (touchEngaged) disengage()
      touchId = null
      touchMoved = false
      touchEngaged = false
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchId === null) return
      if (!touchById(e.changedTouches)) return
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
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchEnd)
    document.addEventListener('selectstart', handleSelectStart)

    let animId = 0

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

      // Dirt path
      ctx.fillStyle = '#D4A574'
      ctx.fillRect(PIXEL * 5, PIXEL * 6, PIXEL * 10, PIXEL * 0.4)
      ctx.fillStyle = '#C4A06A'
      ctx.fillRect(PIXEL * 5, PIXEL * 6.15, PIXEL * 10, PIXEL * 0.2)
    }

    function drawStarsAndMoon() {
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
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.s, 0, Math.PI * 2)
        ctx.fill()
      })

      // Moon (crescent)
      const moonX = CANVAS_WIDTH - PIXEL * 1.2
      const moonY = PIXEL * 0.35
      const moonR = PIXEL * 0.5
      ctx.fillStyle = '#FFFDE8'
      ctx.beginPath()
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 253, 232, 0.15)'
      ctx.beginPath()
      ctx.arc(moonX, moonY, moonR * 1.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = COLORS.sky
      ctx.beginPath()
      ctx.arc(
        moonX + moonR * 0.4,
        moonY - moonR * 0.1,
        moonR * 0.8,
        0,
        Math.PI * 2,
      )
      ctx.fill()
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
      ctx.fillStyle = COLORS.treeTrunk
      ctx.fillRect(x + PIXEL * 0.7, y + PIXEL * 1, PIXEL * 0.6, PIXEL * 1)
      ctx.fillStyle = COLORS.treeLeaves
      ctx.beginPath()
      ctx.arc(x + PIXEL, y + PIXEL * 0.6, PIXEL * 0.9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = COLORS.treeLeavesLight
      ctx.beginPath()
      ctx.arc(x + PIXEL * 0.7, y + PIXEL * 0.5, PIXEL * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + PIXEL * 1.3, y + PIXEL * 0.4, PIXEL * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawBench(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      ctx.fillStyle = COLORS.bench
      ctx.fillRect(x + SCALE * 3, y + PIXEL * 0.5, SCALE * 3, PIXEL * 0.5)
      ctx.fillRect(x + PIXEL * 1.5, y + PIXEL * 0.5, SCALE * 3, PIXEL * 0.5)
      ctx.fillStyle = COLORS.benchLight
      ctx.fillRect(x, y + PIXEL * 0.3, PIXEL * 2, SCALE * 4)
      ctx.fillStyle = COLORS.bench
      ctx.fillRect(x, y + PIXEL * 0.2, PIXEL * 2, SCALE * 2)
      ctx.fillRect(x, y, PIXEL * 2, SCALE * 3)
    }

    function drawFlowers(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      const colors = [COLORS.flower1, COLORS.flower2, COLORS.flower3]
      const bobOffset = Math.sin(g.frameCount * 0.05 + obj.x) * 2
      for (let i = 0; i < 3; i++) {
        const fx = x + i * SCALE * 5
        const fy = y + PIXEL * 0.4 + bobOffset
        ctx.fillStyle = COLORS.grassDark
        ctx.fillRect(fx + SCALE * 2, fy + SCALE * 3, SCALE, SCALE * 4)
        ctx.fillStyle = colors[i]
        ctx.beginPath()
        ctx.arc(fx + SCALE * 2.5, fy + SCALE * 2, SCALE * 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = COLORS.fishBowl
        ctx.beginPath()
        ctx.arc(fx + SCALE * 2.5, fy + SCALE * 2, SCALE, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawFoodBowl(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      ctx.fillStyle = COLORS.catOrange
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
      ctx.fillStyle = COLORS.fishBowl
      ctx.beginPath()
      ctx.ellipse(
        x + PIXEL * 0.5,
        y + PIXEL * 0.5,
        PIXEL * 0.2,
        PIXEL * 0.12,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.strokeStyle = COLORS.catDark
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(
        x + PIXEL * 0.5,
        y + PIXEL * 0.45,
        PIXEL * 0.4,
        PIXEL * 0.15,
        0,
        0,
        Math.PI,
      )
      ctx.stroke()
    }

    function drawPond(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      const wobble = Math.sin(g.frameCount * 0.03) * 2
      ctx.fillStyle = COLORS.water
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
      ctx.fillStyle = COLORS.waterLight
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
        ctx.fillStyle = i % 2 === 0 ? COLORS.stone : COLORS.stoneDark
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
      ctx.fillStyle = '#FF6B6B'
      ctx.beginPath()
      ctx.arc(
        x + PIXEL * 0.5,
        y + PIXEL * 0.5 - bounce,
        PIXEL * 0.25,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.fillStyle = COLORS.fishBowl
      ctx.beginPath()
      ctx.arc(x + PIXEL * 0.4, y + PIXEL * 0.4 - bounce, SCALE, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawStone(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      ctx.fillStyle = COLORS.stone
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

    function drawMushroom(obj: GameObject) {
      if (!ctx) return
      const x = obj.x * PIXEL
      const y = obj.y * PIXEL
      ctx.fillStyle = '#F5F5DC'
      ctx.fillRect(x + PIXEL * 0.35, y + PIXEL * 0.5, PIXEL * 0.3, PIXEL * 0.4)
      ctx.fillStyle = '#FF6B6B'
      ctx.beginPath()
      ctx.arc(x + PIXEL * 0.5, y + PIXEL * 0.45, PIXEL * 0.35, Math.PI, 0)
      ctx.fill()
      ctx.fillStyle = COLORS.white
      ctx.beginPath()
      ctx.arc(x + PIXEL * 0.4, y + PIXEL * 0.35, SCALE, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + PIXEL * 0.6, y + PIXEL * 0.38, SCALE * 0.8, 0, Math.PI * 2)
      ctx.fill()
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
        ctx.fillStyle = COLORS.charcoal
        ctx.fillRect(b.x - 1, b.y - 2, 2, 4)
      })
    }

    function drawCat() {
      if (!ctx) return
      const cat = g.cat
      const x = cat.x * PIXEL
      const y = cat.y * PIXEL
      const flip = cat.dir === 'left' ? -1 : 1
      const s = SCALE

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
        ctx.fillStyle = COLORS.catLight
        ctx.beginPath()
        ctx.ellipse(0, s * 3, s * 6, s * 3, 0, 0, Math.PI * 2)
        ctx.fill()

        // White belly (underside visible when lying)
        ctx.fillStyle = COLORS.white
        ctx.beginPath()
        ctx.ellipse(0, s * 4.5, s * 4, s * 1.8, 0, 0, Math.PI * 2)
        ctx.fill()

        // Tabby stripes on body
        ctx.fillStyle = COLORS.catStripe
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(-s * 4 + i * s * 3, s * 1.5, s * 1.5, s * 2.5)
        }

        // Head (resting on paws)
        ctx.fillStyle = COLORS.catLight
        ctx.beginPath()
        ctx.arc(s * 5, s * 1.5, s * 3.5, 0, Math.PI * 2)
        ctx.fill()

        // White muzzle/chin
        ctx.fillStyle = COLORS.white
        ctx.beginPath()
        ctx.ellipse(s * 5.2, s * 2.8, s * 2, s * 1.5, 0, 0, Math.PI * 2)
        ctx.fill()

        // Ears
        ctx.fillStyle = COLORS.catOrange
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

        // Inner ears
        ctx.fillStyle = COLORS.heart
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
        ctx.strokeStyle = COLORS.charcoal
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
          ctx.fillStyle = '#8B9B2A'
          ctx.beginPath()
          ctx.ellipse(s * 4, s * 1.5, s * 0.6, s * 0.3, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.ellipse(s * 6.2, s * 1.5, s * 0.6, s * 0.3, 0, 0, Math.PI * 2)
          ctx.fill()
        }

        // Nose
        ctx.fillStyle = COLORS.heart
        ctx.beginPath()
        ctx.moveTo(s * 5.1, s * 2.2)
        ctx.lineTo(s * 4.8, s * 2.6)
        ctx.lineTo(s * 5.4, s * 2.6)
        ctx.fill()

        // Tail curled around body
        const tailWag = Math.sin(g.frameCount * 0.03) * s * 0.5
        ctx.strokeStyle = COLORS.catOrange
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
        ctx.fillStyle = COLORS.white
        ctx.fillRect(s * 3, s * 3.5, s * 1.5, s * 1)
        ctx.fillRect(s * 5, s * 3.5, s * 1.5, s * 1)

        ctx.restore()

        return
      }

      // Standing/walking cat (original code)
      const bobY = cat.idle ? Math.sin(g.frameCount * 0.05) * 2 : 0
      const walkBob = !cat.idle ? Math.sin(g.frameCount * 0.2) * 2 : 0

      ctx.save()
      ctx.translate(x + PIXEL * 0.5, y + PIXEL * 0.5 + bobY + walkBob)
      ctx.scale(flip, 1)

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.beginPath()
      ctx.ellipse(0, PIXEL * 0.35, PIXEL * 0.35, PIXEL * 0.1, 0, 0, Math.PI * 2)
      ctx.fill()

      // Body
      ctx.fillStyle = COLORS.catLight
      ctx.beginPath()
      ctx.ellipse(0, s * 2, s * 5, s * 4, 0, 0, Math.PI * 2)
      ctx.fill()

      // White belly (bottom half of body)
      ctx.fillStyle = COLORS.white
      ctx.beginPath()
      ctx.ellipse(0, s * 4, s * 3.5, s * 2.5, 0, 0, Math.PI * 2)
      ctx.fill()

      // Tabby stripes
      ctx.fillStyle = COLORS.catStripe
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-s * 3 + i * s * 3, s * 0.5, s * 1.5, s * 2)
      }

      // Head
      ctx.fillStyle = COLORS.catLight
      ctx.beginPath()
      ctx.arc(s * 4, -s * 1, s * 4, 0, Math.PI * 2)
      ctx.fill()

      // White muzzle/chin area
      ctx.fillStyle = COLORS.white
      ctx.beginPath()
      ctx.ellipse(s * 4.3, s * 1, s * 2.5, s * 2, 0, 0, Math.PI * 2)
      ctx.fill()

      // Ears
      ctx.fillStyle = COLORS.catOrange
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

      // Inner ears
      ctx.fillStyle = '#FFE4D6'
      ctx.beginPath()
      ctx.moveTo(s * 1.5, -s * 4.8)
      ctx.lineTo(s * 2.7, -s * 3.3)
      ctx.lineTo(s * 0.5, -s * 3.3)
      ctx.fill()

      // Head stripes
      ctx.fillStyle = COLORS.catStripe
      ctx.fillRect(s * 3, -s * 3, s * 1, s * 1.5)
      ctx.fillRect(s * 4.5, -s * 2.8, s * 0.8, s * 1.2)

      // Eyes
      ctx.fillStyle = COLORS.white
      ctx.beginPath()
      ctx.arc(s * 3, -s * 0.5, s * 1.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s * 5.5, -s * 0.5, s * 1.2, 0, Math.PI * 2)
      ctx.fill()

      // Pupils
      ctx.fillStyle = '#8B9B2A'
      ctx.beginPath()
      ctx.arc(s * 3.2, -s * 0.4, s * 0.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s * 5.7, -s * 0.4, s * 0.7, 0, Math.PI * 2)
      ctx.fill()

      // Pupil highlights
      ctx.fillStyle = COLORS.white
      ctx.beginPath()
      ctx.arc(s * 3.4, -s * 0.7, s * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s * 5.9, -s * 0.7, s * 0.3, 0, Math.PI * 2)
      ctx.fill()

      // Nose
      ctx.fillStyle = COLORS.heart
      ctx.beginPath()
      ctx.moveTo(s * 4.3, s * 0.5)
      ctx.lineTo(s * 4, s * 1)
      ctx.lineTo(s * 4.6, s * 1)
      ctx.fill()

      // Whiskers
      ctx.strokeStyle = COLORS.charcoal
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
      ctx.strokeStyle = COLORS.catOrange
      ctx.lineWidth = s * 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-s * 5, s * 1)
      ctx.quadraticCurveTo(-s * 7, -s * 2 + tailWag, -s * 6, -s * 4 + tailWag)
      ctx.stroke()

      // Tail stripes
      ctx.strokeStyle = COLORS.catStripe
      ctx.lineWidth = s * 0.8
      ctx.beginPath()
      ctx.moveTo(-s * 5.5, 0)
      ctx.lineTo(-s * 6, -s * 0.5)
      ctx.moveTo(-s * 6, -s * 1.5 + tailWag * 0.5)
      ctx.lineTo(-s * 6.2, -s * 2.5 + tailWag * 0.5)
      ctx.stroke()

      // Legs
      const legOffset = !cat.idle ? Math.sin(g.frameCount * 0.2) * s * 1.5 : 0
      ctx.fillStyle = COLORS.white
      ctx.fillRect(s * 2, s * 4 + legOffset, s * 2, s * 3)
      ctx.fillRect(s * 4, s * 4 - legOffset, s * 2, s * 3)
      ctx.fillRect(-s * 3, s * 4 - legOffset, s * 2, s * 3)
      ctx.fillRect(-s * 1, s * 4 + legOffset, s * 2, s * 3)

      // Paws
      ctx.fillStyle = COLORS.white
      ctx.fillRect(s * 2, s * 6.5 + legOffset, s * 2, s * 1)
      ctx.fillRect(s * 4, s * 6.5 - legOffset, s * 2, s * 1)
      ctx.fillRect(-s * 3, s * 6.5 - legOffset, s * 2, s * 1)
      ctx.fillRect(-s * 1, s * 6.5 + legOffset, s * 2, s * 1)

      ctx.restore()

      // Hearts when interacting
      if (cat.interacting) {
        const heartY = y - PIXEL * 0.3 + Math.sin(g.frameCount * 0.1) * 3
        ctx.fillStyle = COLORS.heart
        ctx.beginPath()
        const hx = x + PIXEL * 0.5
        const hy = heartY
        const hs = s * 2
        ctx.moveTo(hx, hy + hs * 0.3)
        ctx.bezierCurveTo(hx, hy, hx - hs, hy, hx - hs, hy + hs * 0.3)
        ctx.bezierCurveTo(
          hx - hs,
          hy + hs * 0.7,
          hx,
          hy + hs,
          hx,
          hy + hs * 1.2,
        )
        ctx.bezierCurveTo(
          hx,
          hy + hs,
          hx + hs,
          hy + hs * 0.7,
          hx + hs,
          hy + hs * 0.3,
        )
        ctx.bezierCurveTo(hx + hs, hy, hx, hy, hx, hy + hs * 0.3)
        ctx.fill()
      }
    }

    function drawObjects() {
      const sorted = [...g.objects].sort((a, b) => a.y - b.y)
      sorted.forEach((obj) => {
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
          case 'foodbowl':
            drawFoodBowl(obj)
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
          case 'mushroom':
            drawMushroom(obj)
            break
        }
      })
    }

    function drawPopups(f: number) {
      if (!ctx) return
      g.popups = g.popups.filter((p) => p.life > 0)
      g.popups.forEach((p) => {
        p.life -= f
        p.y -= 0.5 * f
        const alpha = Math.min(1, p.life / 30)
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
        g.foods.push({ key: pick.key, x, y, born: g.frameCount, life: 900 })
        return
      }
    }

    function updateFoods() {
      // Spawn cadence: up to 3 on screen, every ~4–9s.
      if (g.frameCount >= g.nextFoodAt && g.foods.length < 3) {
        spawnFood()
        g.nextFoodAt = g.frameCount + 240 + Math.floor(Math.random() * 300)
      }
      // Lifespan + collection.
      const cat = g.cat
      g.foods = g.foods.filter((f) => {
        const age = g.frameCount - f.born
        if (age > f.life) return false
        if (age > 8 && Math.hypot(cat.x - f.x, cat.y - f.y) < 0.85) {
          const def = FOODS_BY_KEY[f.key]
          g.score += def.points
          if (g.score > g.best) {
            g.best = g.score
            try {
              localStorage.setItem(BEST_SCORE_KEY, String(g.best))
            } catch {
              /* ignore */
            }
          }
          g.popups.push({
            text: `+${def.points} ${def.label}`,
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

    function drawFoods() {
      if (!ctx) return
      g.foods.forEach((f) => {
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
        const cy = baseY + bob
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

        // Ground shadow.
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.beginPath()
        ctx.ellipse(
          cx,
          baseY + size * 0.42,
          size * 0.3,
          size * 0.1,
          0,
          0,
          Math.PI * 2,
        )
        ctx.fill()

        // Sprite if the PNG loaded, else emoji fallback.
        const img = g.foodImages[f.key]
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
        } else {
          ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(def.emoji, cx, cy)
          ctx.textBaseline = 'alphabetic'
        }

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

    function drawHUD() {
      if (!ctx) return
      ctx.save()
      ctx.translate(g.hudShift, 0)
      const pad = PIXEL * 0.28
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const scoreText = `${g.score}`
      ctx.font = "600 22px 'Cormorant Garamond', Georgia, serif"
      const scoreW = ctx.measureText(scoreText).width
      ctx.font = "500 13px 'Inter', system-ui, sans-serif"
      const bestText = `Best ${g.best}`
      const bestW = ctx.measureText(bestText).width
      const pillW = Math.max(scoreW + 30, bestW) + 22

      ctx.fillStyle = 'rgba(20,16,12,0.5)'
      ctx.beginPath()
      ctx.roundRect(pad, pad, pillW, 46, 12)
      ctx.fill()

      ctx.font = "600 22px 'Cormorant Garamond', Georgia, serif"
      ctx.fillStyle = COLORS.fishBowl
      ctx.fillText('★', pad + 12, pad + 16)
      ctx.fillStyle = COLORS.white
      ctx.fillText(scoreText, pad + 30, pad + 16)

      ctx.font = "500 13px 'Inter', system-ui, sans-serif"
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillText(bestText, pad + 12, pad + 34)
      ctx.textBaseline = 'alphabetic'
      ctx.restore()
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

      // Keyboard input overrides tap-to-walk; otherwise head toward the tapped
      // target and stop once we arrive.
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
            if (!obj._shown) {
              obj._shown = true
              g.popups.push({
                text: obj.interactMsg,
                x: obj.x * PIXEL + (obj.w * PIXEL) / 2,
                y: obj.y * PIXEL - 20,
                life: 90,
              })
              setTimeout(() => {
                obj._shown = false
              }, 3000)
            }
          }
        }
      })
    }

    // Camera measurements are cached and only refreshed on resize, so panning
    // doesn't force a layout reflow (offsetWidth read) every frame.
    let viewportW = window.innerWidth
    let displayW = canvas.offsetWidth
    let lastTx = NaN
    const measure = () => {
      viewportW = window.innerWidth
      displayW = canvas.offsetWidth
    }

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

    // Horizontal camera: when the canvas is wider than the viewport (its sides
    // are cropped), pan it to keep the cat centered — clamped so we never scroll
    // past the map's left/right edge. No-op when the whole width already fits.
    function updateCamera() {
      if (!canvas) return
      let tx = 0
      if (displayW - viewportW > 0.5) {
        const catDisplayX = ((g.cat.x + 0.5) / MAP_COLS) * displayW
        const centeredLeft = (viewportW - displayW) / 2
        // Put the cat at viewport center, clamped so the canvas still covers it.
        const desiredLeft = Math.min(
          0,
          Math.max(viewportW - displayW, viewportW / 2 - catDisplayX),
        )
        tx = desiredLeft - centeredLeft
        // Shift the HUD by the canvas left edge (in canvas px) so it stays
        // pinned to the viewport's left.
        g.hudShift = -desiredLeft * (CANVAS_WIDTH / displayW)
      } else {
        g.hudShift = 0
      }
      // Only touch the DOM when the pan actually changes.
      if (tx !== lastTx) {
        canvas.style.transform = `translateX(${tx}px)`
        lastTx = tx
      }
    }

    // Bake the fully static sky + ground into the offscreen canvas once.
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
      ctx!.save()
      ctx!.translate(0, WORLD_OFFSET)
      drawGround()
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
      // Draw in logical 960x816 coords scaled up to the high-res backing.
      ctx!.setTransform(RS, 0, 0, RS, 0, 0)
      ctx!.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Pre-rendered static sky + ground (blitted, smoothly upscaled).
      ctx!.drawImage(bgCanvas, 0, 0)

      // Dynamic world, pushed down so the sky has room above it.
      ctx!.save()
      ctx!.translate(0, WORLD_OFFSET)
      drawObjects()
      drawButterflies(f)
      updateCat(dt)
      updateFoods()
      drawCat()
      ctx!.restore()

      // Purple overlay with blend mode
      ctx!.save()
      ctx!.globalCompositeOperation = 'multiply'
      ctx!.fillStyle = 'rgba(120, 80, 180, 0.5)'
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx!.restore()

      // Above overlay, in the shifted world space (stars/moon just above ground).
      ctx!.save()
      ctx!.translate(0, WORLD_OFFSET)
      drawStarsAndMoon()
      drawDreamBubble()
      drawFoods()
      drawPopups(f)
      ctx!.restore()

      updateCamera()
      // HUD last, pinned against the horizontal camera pan (see updateCamera).
      drawHUD()

      if (active()) animId = requestAnimationFrame(gameLoop)
    }

    const ensureRunning = () => {
      if (active() && !animId) animId = requestAnimationFrame(gameLoop)
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
    const handleScroll = () => updateOnScreen()
    const handleResize = () => {
      measure()
      sizeBacking()
      updateOnScreen()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    ensureRunning()

    return () => {
      cancelAnimationFrame(animId)
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
      clearHold()
      document.body.classList.remove('kcc-dragging')
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
        aria-label="Koala's Park — a mini game. Move Koala with the arrow keys or WASD, or press and hold (drag) to walk her toward your pointer, and catch the food that appears to score points."
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
    </div>
  )
}
