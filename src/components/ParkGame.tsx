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
const MAP_ROWS = 13
const PIXEL = 16 * SCALE
const CANVAS_WIDTH = MAP_COLS * PIXEL
const CANVAS_HEIGHT = MAP_ROWS * PIXEL

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
    const aimAtPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      // Clamp to the canvas box so dragging past an edge keeps steering there.
      const cx = Math.min(Math.max(e.clientX, rect.left), rect.right)
      const cy = Math.min(Math.max(e.clientY, rect.top), rect.bottom)
      const px = ((cx - rect.left) / rect.width) * CANVAS_WIDTH
      const py = ((cy - rect.top) / rect.height) * CANVAS_HEIGHT
      g.target = { x: px / PIXEL - 0.5, y: py / PIXEL - 0.5 }
    }
    const handlePointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      if (window.scrollY > window.innerHeight * 0.5) return
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return
      }
      pointerActive = true
      aimAtPointer(e)
    }
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerActive) aimAtPointer(e)
    }
    // Release / cancel stops the cat wherever it is.
    const handlePointerUp = () => {
      pointerActive = false
      g.target = null
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    let animId: number

    function drawGround() {
      if (!ctx) return
      const skyGrad = ctx.createLinearGradient(0, 0, 0, PIXEL * 1.8)
      skyGrad.addColorStop(0, COLORS.sky)
      skyGrad.addColorStop(0.6, COLORS.skyLight)
      skyGrad.addColorStop(1, 'oklch(0.12 0.008 60)')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, CANVAS_WIDTH, PIXEL * 1.8)

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

    function drawButterflies() {
      if (!ctx) return
      g.butterflies.forEach((b) => {
        b.timer += 0.05
        b.x += b.vx + Math.sin(b.timer) * 0.5
        b.y += b.vy + Math.cos(b.timer * 1.3) * 0.3
        if (b.x > CANVAS_WIDTH) b.x = -10
        if (b.x < -10) b.x = CANVAS_WIDTH
        if (b.y > CANVAS_HEIGHT - PIXEL * 2) b.vy = -Math.abs(b.vy)
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

    function drawPopups() {
      if (!ctx) return
      g.popups = g.popups.filter((p) => p.life > 0)
      g.popups.forEach((p) => {
        p.life--
        p.y -= 0.5
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

    function updateCat() {
      const cat = g.cat
      const speed = 0.035
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
        cat.idleFrames++
        // ~10 seconds at 60fps = 600 frames
        if (cat.idleFrames > 1200) {
          cat.state = 'sleeping'
        } else if (cat.idleFrames > 600) {
          cat.state = 'lying'
        } else {
          cat.state = 'standing'
        }
      }

      newX = Math.max(0, Math.min(MAP_COLS - 1, newX))
      newY = Math.max(1, Math.min(MAP_ROWS - 1.5, newY))

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

    function gameLoop() {
      g.frameCount++
      ctx!.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      drawGround()
      drawObjects()
      drawButterflies()
      updateCat()
      drawCat()

      // Purple overlay with blend mode
      ctx!.save()
      ctx!.globalCompositeOperation = 'multiply'
      ctx!.fillStyle = 'rgba(120, 80, 180, 0.5)'
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx!.restore()

      // Draw above overlay: stars, moon, popups
      drawStarsAndMoon()
      drawDreamBubble()
      drawPopups()

      animId = requestAnimationFrame(gameLoop)
    }

    gameLoop()

    return () => {
      cancelAnimationFrame(animId)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [initObjects])

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        aria-label="Koala's Park — a mini game. Move Koala with the arrow keys or WASD, or press and hold (drag) to walk her toward your pointer."
        className="block cursor-pointer drop-shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        style={{
          imageRendering: 'pixelated',
          // Recognize taps immediately (no double-tap-zoom delay) on touch.
          touchAction: 'manipulation',
          // Cover the header on any screen size: scale up so the game fills both
          // width and height (whichever needs more), keeping the map ratio.
          // The flex parent centers it and clips the overflow.
          width: `max(100%, calc(100dvh * ${MAP_COLS} / ${MAP_ROWS}))`,
          height: 'auto',
          aspectRatio: `${MAP_COLS} / ${MAP_ROWS}`,
        }}
      />
    </div>
  )
}
