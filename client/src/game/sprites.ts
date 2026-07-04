// Procedural sprites for shop items — drawn with `ctx` primitives in the game's
// flat cartoon night-park style. Used by BOTH the shop's item previews
// (src/components/ItemPreview.tsx) and the placed decorations the game renders
// (ParkGame routes placed items here via drawShopSprite). The reused decor
// (tree/bench/flowers/pond/ball/stone) mirrors ParkGame's own base-object art so
// a bought tree looks like a park tree; snowcat/cardbox/house are shop-only.
// Each fn draws with the object's top-left at (obj.x*PIXEL, obj.y*PIXEL); the
// caller sets up any world translate / device-resolution transform.

import { COLORS, NIGHT, PIXEL, SCALE, night } from './constants'

// Active palette + ink for the current draw: night-tinted for the in-game park,
// bright for shop previews. Set at the top of drawShopSprite; the internal draw
// helpers read these module-level values so their signatures stay unchanged.
let PAL: typeof COLORS = COLORS
let INK: (c: string) => string = (c) => c

export interface SpriteObject {
  type: string
  x: number
  y: number
  w: number
  h: number
  // Set on shop-placed decorations (absent for shop previews):
  placedAt?: number // Date.now() at purchase — drives the pop-in flourish
  expiresAt?: number // Date.now() TTL — drives the pre-expiry blink
}

type Ctx = CanvasRenderingContext2D

// How long (ms, wall-clock) a freshly-placed item takes to pop in to full size.
export const PLACED_POP_MS = 260
// How long before expiry (ms) a placed item starts blinking.
const BLINK_LEAD_MS = 8000

// Tiny deterministic PRNG (mulberry32) so procedural art varies per instance
// (seeded by tile position) yet stays identical frame-to-frame — no flicker.
function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawTree(ctx: Ctx, obj: SpriteObject) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  const rng = makeRng(obj.x * 73856093 + obj.y * 19349663 + 1)
  const s = 0.9 + rng() * 0.22
  const jx = (rng() - 0.5) * PIXEL * 0.16
  const jy = (rng() - 0.5) * PIXEL * 0.12
  ctx.fillStyle = PAL.treeTrunk
  ctx.fillRect(x + PIXEL * 0.7, y + PIXEL, PIXEL * 0.6, PIXEL)
  ctx.fillStyle = PAL.treeLeaves
  ctx.beginPath()
  ctx.arc(x + PIXEL + jx, y + PIXEL * 0.6 + jy, PIXEL * 0.9 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = PAL.treeLeavesLight
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

function drawBench(ctx: Ctx, obj: SpriteObject) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  ctx.fillStyle = PAL.bench
  ctx.fillRect(x + SCALE * 3, y + PIXEL * 0.5, SCALE * 3, PIXEL * 0.5)
  ctx.fillRect(x + PIXEL * 1.5, y + PIXEL * 0.5, SCALE * 3, PIXEL * 0.5)
  ctx.fillStyle = PAL.benchLight
  ctx.fillRect(x, y + PIXEL * 0.3, PIXEL * 2, SCALE * 4)
  ctx.fillStyle = PAL.bench
  ctx.fillRect(x, y + PIXEL * 0.2, PIXEL * 2, SCALE * 2)
  ctx.fillRect(x, y, PIXEL * 2, SCALE * 3)
}

function drawFlowers(ctx: Ctx, obj: SpriteObject, frameCount: number) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  const palette = [
    PAL.flower1,
    PAL.flower2,
    PAL.flower3,
    PAL.heart,
    PAL.butterfly,
  ]
  const rng = makeRng(obj.x * 73856093 + obj.y * 19349663 + 7)
  const bobOffset = Math.sin(frameCount * 0.05 + obj.x) * 2
  const count = 3 + Math.floor(rng() * 2)
  let fx = x + PIXEL * 0.08
  for (let i = 0; i < count; i++) {
    const cxp = fx + SCALE * 2.5
    const cyp = y + PIXEL * (0.28 + rng() * 0.28) + bobOffset
    const petalR = SCALE * 2.5
    const stemH = SCALE * 4
    ctx.fillStyle = PAL.grassDark
    ctx.fillRect(cxp - SCALE * 0.5, cyp + petalR * 0.4, SCALE, stemH)
    ctx.fillStyle = palette[Math.floor(rng() * palette.length)]
    ctx.beginPath()
    ctx.arc(cxp, cyp, petalR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PAL.fishBowl
    ctx.beginPath()
    ctx.arc(cxp, cyp, petalR * 0.42, 0, Math.PI * 2)
    ctx.fill()
    fx += SCALE * (3.6 + rng() * 1.8)
  }
}

function drawPond(ctx: Ctx, obj: SpriteObject, frameCount: number) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  const wobble = Math.sin(frameCount * 0.03) * 2
  ctx.fillStyle = PAL.water
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
  ctx.fillStyle = PAL.waterLight
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
    ctx.fillStyle = i % 2 === 0 ? PAL.stone : PAL.stoneDark
    ctx.beginPath()
    ctx.arc(sx, sy, SCALE * 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawBall(ctx: Ctx, obj: SpriteObject, frameCount: number) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  const bounce = Math.abs(Math.sin(frameCount * 0.06)) * SCALE * 2
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
  ctx.fillStyle = INK('#FF6B6B')
  ctx.beginPath()
  ctx.arc(
    x + PIXEL * 0.5,
    y + PIXEL * 0.5 - bounce,
    PIXEL * 0.25,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.fillStyle = PAL.fishBowl
  ctx.beginPath()
  ctx.arc(x + PIXEL * 0.4, y + PIXEL * 0.4 - bounce, SCALE, 0, Math.PI * 2)
  ctx.fill()
}

function drawStone(ctx: Ctx, obj: SpriteObject) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  ctx.fillStyle = PAL.stone
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

function drawMushroom(ctx: Ctx, obj: SpriteObject) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  ctx.fillStyle = INK('#F5F5DC')
  ctx.fillRect(x + PIXEL * 0.35, y + PIXEL * 0.5, PIXEL * 0.3, PIXEL * 0.4)
  ctx.fillStyle = INK('#FF6B6B')
  ctx.beginPath()
  ctx.arc(x + PIXEL * 0.5, y + PIXEL * 0.45, PIXEL * 0.35, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = PAL.white
  ctx.beginPath()
  ctx.arc(x + PIXEL * 0.4, y + PIXEL * 0.35, SCALE, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + PIXEL * 0.6, y + PIXEL * 0.38, SCALE * 0.8, 0, Math.PI * 2)
  ctx.fill()
}

// A little snow-cat companion (1×1): two stacked snow spheres with big cat ears.
function drawSnowcat(ctx: Ctx, obj: SpriteObject, frameCount: number) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  const cx = x + PIXEL * 0.5
  const s = SCALE
  const bob = Math.sin(frameCount * 0.04) * s * 0.3

  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.ellipse(
    cx,
    y + PIXEL * 0.92,
    PIXEL * 0.32,
    PIXEL * 0.08,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.fillStyle = PAL.white
  ctx.beginPath()
  ctx.arc(cx, y + PIXEL * 0.68 + bob, PIXEL * 0.3, 0, Math.PI * 2)
  ctx.fill()
  const hy = y + PIXEL * 0.36 + bob
  ctx.beginPath()
  ctx.arc(cx, hy, PIXEL * 0.22, 0, Math.PI * 2)
  ctx.fill()

  // Big pointy cat ears with pink inners
  const earBaseY = hy - PIXEL * 0.13
  const earTipY = hy - PIXEL * 0.36
  ctx.fillStyle = PAL.white
  ctx.beginPath()
  ctx.moveTo(cx - PIXEL * 0.21, earBaseY)
  ctx.lineTo(cx - PIXEL * 0.12, earTipY)
  ctx.lineTo(cx - PIXEL * 0.02, earBaseY)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + PIXEL * 0.21, earBaseY)
  ctx.lineTo(cx + PIXEL * 0.12, earTipY)
  ctx.lineTo(cx + PIXEL * 0.02, earBaseY)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = PAL.heart
  ctx.beginPath()
  ctx.moveTo(cx - PIXEL * 0.16, earBaseY - PIXEL * 0.01)
  ctx.lineTo(cx - PIXEL * 0.12, earTipY + PIXEL * 0.07)
  ctx.lineTo(cx - PIXEL * 0.08, earBaseY - PIXEL * 0.01)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + PIXEL * 0.16, earBaseY - PIXEL * 0.01)
  ctx.lineTo(cx + PIXEL * 0.12, earTipY + PIXEL * 0.07)
  ctx.lineTo(cx + PIXEL * 0.08, earBaseY - PIXEL * 0.01)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = PAL.charcoal
  ctx.beginPath()
  ctx.arc(cx - PIXEL * 0.08, hy - PIXEL * 0.02, s * 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + PIXEL * 0.08, hy - PIXEL * 0.02, s * 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = PAL.fishBowl
  ctx.beginPath()
  ctx.moveTo(cx, hy + PIXEL * 0.02)
  ctx.lineTo(cx + PIXEL * 0.09, hy + PIXEL * 0.05)
  ctx.lineTo(cx, hy + PIXEL * 0.08)
  ctx.closePath()
  ctx.fill()
}

// An open cardboard box (2×1) — cats love boxes.
function drawCardbox(ctx: Ctx, obj: SpriteObject) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  const W = obj.w * PIXEL

  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.beginPath()
  ctx.ellipse(
    x + W / 2,
    y + PIXEL * 0.92,
    W * 0.4,
    PIXEL * 0.09,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  const bx = x + W * 0.18
  const bw = W * 0.64
  const by = y + PIXEL * 0.36
  const bh = PIXEL * 0.52

  ctx.fillStyle = PAL.dirt
  ctx.fillRect(bx, by, bw, bh)
  ctx.fillStyle = INK('#C4A06A')
  ctx.fillRect(bx + bw * 0.78, by, bw * 0.22, bh)
  ctx.fillStyle = INK('#A87B4A')
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx + bw, by)
  ctx.lineTo(bx + bw * 0.82, by + PIXEL * 0.12)
  ctx.lineTo(bx + bw * 0.18, by + PIXEL * 0.12)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = PAL.dirtLight
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx - PIXEL * 0.16, by - PIXEL * 0.18)
  ctx.lineTo(bx + bw * 0.2, by - PIXEL * 0.04)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(bx + bw, by)
  ctx.lineTo(bx + bw + PIXEL * 0.16, by - PIXEL * 0.14)
  ctx.lineTo(bx + bw * 0.8, by - PIXEL * 0.03)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = INK('#B5895A')
  ctx.lineWidth = SCALE * 0.5
  ctx.beginPath()
  ctx.moveTo(bx + bw * 0.5, by + PIXEL * 0.12)
  ctx.lineTo(bx + bw * 0.5, by + bh)
  ctx.stroke()
  ctx.strokeStyle = PAL.dirtLight
  ctx.lineWidth = SCALE
  ctx.beginPath()
  ctx.moveTo(bx + bw * 0.5, by)
  ctx.lineTo(bx + bw * 0.5, by + PIXEL * 0.12)
  ctx.stroke()
}

// A simple grey cedar-shingle cottage (Cape Cod): low gable roof with white
// rake/eave trim, a brick chimney, white-cased windows, and a pale front door.
// Fills its footprint (sized from obj.w/obj.h), so it scales with the catalog.
function drawHouse(ctx: Ctx, obj: SpriteObject) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  const W = obj.w * PIXEL
  const H = obj.h * PIXEL

  const trim = INK('#EFEBE0')
  const wall = INK('#8C9096')
  const wallLine = INK('#767A80')
  const roof = INK('#A6A29A')
  const roofLine = INK('#8C877E')
  // Windows glow: a warm lit pane drawn in a raw bright colour (not through INK),
  // so it stays lit against the night-tinted house — "someone's home".
  const glass = '#FFE39A'
  const door = INK('#E2D896')
  const brick = INK('#A5503F')

  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.beginPath()
  ctx.ellipse(
    x + W / 2,
    y + H * 0.96,
    W * 0.42,
    PIXEL * 0.14,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  const wallX = x + W * 0.1
  const wallW = W * 0.8
  const wallY = y + H * 0.44
  const wallH = y + H * 0.95 - wallY
  const eaveY = y + H * 0.46
  const ridgeX = x + W * 0.5
  const ridgeY = y + H * 0.08
  const roofL = x + W * 0.02
  const roofR = x + W * 0.98

  const chimX = x + W * 0.34
  const chimW = W * 0.08
  ctx.fillStyle = brick
  ctx.fillRect(chimX, y + H * 0.02, chimW, H * 0.26)
  ctx.fillStyle = PAL.charcoal
  ctx.fillRect(chimX - W * 0.01, y + H * 0.02, chimW + W * 0.02, H * 0.03)

  ctx.fillStyle = wall
  ctx.fillRect(wallX, wallY, wallW, wallH)
  ctx.strokeStyle = wallLine
  ctx.lineWidth = SCALE * 0.3
  for (let i = 1; i < 5; i++) {
    const cy = wallY + (wallH / 5) * i
    ctx.beginPath()
    ctx.moveTo(wallX, cy)
    ctx.lineTo(wallX + wallW, cy)
    ctx.stroke()
  }

  const winW = W * 0.12
  const winH = wallH * 0.4
  const winY = wallY + wallH * 0.16
  for (const fx of [0.26, 0.42, 0.74]) {
    const wx = x + W * fx - winW / 2
    // Soft warm glow spilling from the lit window.
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.fillStyle = glass
    ctx.fillRect(
      wx - SCALE * 2.5,
      winY - SCALE * 2.5,
      winW + SCALE * 5,
      winH + SCALE * 5,
    )
    ctx.restore()
    ctx.fillStyle = trim
    ctx.fillRect(wx - SCALE, winY - SCALE, winW + SCALE * 2, winH + SCALE * 2)
    ctx.fillStyle = glass
    ctx.fillRect(wx, winY, winW, winH)
    ctx.strokeStyle = trim
    ctx.lineWidth = SCALE * 0.5
    ctx.beginPath()
    ctx.moveTo(wx + winW / 2, winY)
    ctx.lineTo(wx + winW / 2, winY + winH)
    ctx.moveTo(wx, winY + winH / 2)
    ctx.lineTo(wx + winW, winY + winH / 2)
    ctx.stroke()
  }

  const doorW = W * 0.1
  const doorH = wallH * 0.55
  const doorX = x + W * 0.56 - doorW / 2
  const doorY = wallY + wallH - doorH
  ctx.fillStyle = trim
  ctx.fillRect(
    doorX - SCALE * 1.4,
    doorY - SCALE * 1.4,
    doorW + SCALE * 2.8,
    doorH + SCALE * 1.4,
  )
  ctx.fillStyle = door
  ctx.fillRect(doorX, doorY, doorW, doorH)
  ctx.fillStyle = PAL.charcoal
  ctx.beginPath()
  ctx.arc(doorX + doorW * 0.8, doorY + doorH * 0.5, SCALE * 0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = roof
  ctx.beginPath()
  ctx.moveTo(roofL, eaveY)
  ctx.lineTo(ridgeX, ridgeY)
  ctx.lineTo(roofR, eaveY)
  ctx.closePath()
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = roofLine
  ctx.lineWidth = SCALE * 0.3
  for (let i = 1; i < 4; i++) {
    const cy = eaveY + ((ridgeY - eaveY) / 4) * i
    ctx.beginPath()
    ctx.moveTo(roofL, cy)
    ctx.lineTo(roofR, cy)
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = trim
  ctx.lineWidth = SCALE * 0.9
  ctx.beginPath()
  ctx.moveTo(roofL, eaveY)
  ctx.lineTo(ridgeX, ridgeY)
  ctx.lineTo(roofR, eaveY)
  ctx.stroke()
  ctx.fillStyle = trim
  ctx.fillRect(
    wallX - W * 0.04,
    eaveY - SCALE * 0.7,
    wallW + W * 0.08,
    SCALE * 1.6,
  )
}

// A dark evergreen strung with twinkling colored fairy lights + a gold star.
// The foliage/trunk go through the palette (dark in-game), but the lights and
// star are drawn in raw bright colors so they glow against the night.
function drawLightTree(ctx: Ctx, obj: SpriteObject, frameCount: number) {
  const x = obj.x * PIXEL
  const y = obj.y * PIXEL
  const cx = x + (obj.w * PIXEL) / 2
  const cyc = y + PIXEL * 0.85 // canopy centre
  const R = PIXEL * 0.95

  // Trunk.
  ctx.fillStyle = PAL.treeTrunk
  ctx.fillRect(cx - PIXEL * 0.14, cyc + R * 0.55, PIXEL * 0.28, PIXEL * 0.7)

  // Dark evergreen canopy (overlapping blobs; two deep-green tones).
  const dark = INK('#2E5E3A')
  const darker = INK('#244B30')
  ctx.fillStyle = darker
  ctx.beginPath()
  ctx.arc(cx, cyc, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = dark
  for (const [dx, dy, r] of [
    [-0.45, 0.2, 0.62],
    [0.45, 0.15, 0.64],
    [0, -0.42, 0.6],
  ] as const) {
    ctx.beginPath()
    ctx.arc(cx + R * dx, cyc + R * dy, R * r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Twinkling colored lights, seeded by tile position (stable placement).
  const lights = ['#FF5A5A', '#FFD93D', '#7CFF9E', '#6EC6FF', '#FF8AD1']
  const rng = makeRng(obj.x * 73856093 + obj.y * 19349663 + 31)
  ctx.save()
  for (let i = 0; i < 16; i++) {
    const ang = rng() * Math.PI * 2
    const rad = R * (0.25 + rng() * 0.72)
    const lx = cx + Math.cos(ang) * rad
    const ly = cyc + Math.sin(ang) * rad * 0.95
    const col = lights[i % lights.length]
    const tw = 0.55 + 0.45 * Math.sin(frameCount * 0.08 + i * 1.7)
    ctx.fillStyle = col
    ctx.globalAlpha = 0.35 * tw // soft glow
    ctx.beginPath()
    ctx.arc(lx, ly, SCALE * 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = tw // bright core
    ctx.beginPath()
    ctx.arc(lx, ly, SCALE * 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Gold star topper (bright).
  const sy = cyc - R
  ctx.fillStyle = '#FFE97A'
  ctx.beginPath()
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2
    const r = k % 2 === 0 ? SCALE * 2.6 : SCALE * 1.05
    const px = cx + Math.cos(a) * r
    const py = sy + Math.sin(a) * r
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

export interface DrawSpriteOptions {
  // Wall-clock time (Date.now()) — drives the pop-in + pre-expiry blink for
  // placed items. Omit (previews) for a static, full-size, fully-opaque draw.
  now?: number
  reducedMotion?: boolean
  // In-game placed decor draws night-tinted; shop previews (omit) stay bright.
  night?: boolean
}

// Draw a shop sprite, wrapping placed items in a pop-in scale and a pre-expiry
// blink (both wall-clock based, correct even though the game loop pauses
// off-screen). Previews (no placedAt/now) draw static at full size.
export function drawShopSprite(
  ctx: Ctx,
  obj: SpriteObject,
  frameCount: number,
  opts: DrawSpriteOptions = {},
) {
  const { now, reducedMotion } = opts
  PAL = opts.night ? NIGHT : COLORS
  INK = opts.night ? night : (c) => c
  let scale = 1
  let alpha = 1
  if (now != null && !reducedMotion) {
    if (obj.placedAt != null) {
      const age = now - obj.placedAt
      if (age < PLACED_POP_MS) {
        const t = Math.min(1, Math.max(0, age / PLACED_POP_MS))
        scale = 1 - Math.pow(1 - t, 3)
      }
    }
    if (obj.expiresAt != null) {
      const remaining = obj.expiresAt - now
      if (remaining > 0 && remaining < BLINK_LEAD_MS) {
        alpha = Math.floor(now / 180) % 2 === 0 ? 0.5 : 1
      }
    }
  }

  const wrap = scale !== 1 || alpha !== 1
  if (wrap) {
    ctx.save()
    ctx.globalAlpha = alpha
    if (scale !== 1) {
      const cx = (obj.x + obj.w / 2) * PIXEL
      const cy = (obj.y + obj.h / 2) * PIXEL
      ctx.translate(cx, cy)
      ctx.scale(scale, scale)
      ctx.translate(-cx, -cy)
    }
  }

  switch (obj.type) {
    case 'tree':
      drawTree(ctx, obj)
      break
    case 'bench':
      drawBench(ctx, obj)
      break
    case 'flowers':
      drawFlowers(ctx, obj, frameCount)
      break
    case 'pond':
      drawPond(ctx, obj, frameCount)
      break
    case 'ball':
      drawBall(ctx, obj, frameCount)
      break
    case 'stone':
      drawStone(ctx, obj)
      break
    case 'mushroom':
      drawMushroom(ctx, obj)
      break
    case 'snowcat':
      drawSnowcat(ctx, obj, frameCount)
      break
    case 'cardbox':
      drawCardbox(ctx, obj)
      break
    case 'house':
      drawHouse(ctx, obj)
      break
    case 'lighttree':
      drawLightTree(ctx, obj, frameCount)
      break
  }

  if (wrap) ctx.restore()
}
