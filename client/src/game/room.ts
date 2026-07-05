// ── "Meow house" interior ──────────────────────────────────────────────────
// A separate warm room, drawn as a lit rectangle floating in a black void
// "outside" the park. The player enters it by meowing next to a house and
// leaves by meowing again (wired up in ParkGame). Its coordinates live in the
// SAME world-tile space as the park (below the sky), so ParkGame's follow-
// camera, tap-to-walk, and pointer hit-testing all reuse the park's math
// unchanged — this module only owns the room's geometry, its movement clamp,
// and how it looks. It sits around the map's horizontal centre so the camera
// frames the whole room without hitting a map-edge clamp.

import { drawMoonAt, drawStarAt } from './sky'

type Ctx = CanvasRenderingContext2D

// Tiny deterministic PRNG (mulberry32) — seeded per floor row so the plank
// rhythm is irregular yet identical every frame (no flicker).
function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Single warm golden-oak floor colour; the boards are defined only by their seams.
const FLOOR_WOOD = '#C99E63'

// High-pile coral rug, baked ONCE to an offscreen sprite (its hundreds of fibre
// strokes are deterministic + static, so we blit the sprite each frame instead of
// re-stroking). Cached by size; supersampled ×2 so it stays crisp when the room's
// device-resolution transform scales it back up. `over` = top overhang for the
// strands that poke past the ellipse rim. No-op (null) without a DOM (SSR/tests).
let rugSprite: HTMLCanvasElement | null = null
let rugKey = ''
function getRugSprite(
  rx: number,
  ry: number,
  scale: number,
  over: number,
): HTMLCanvasElement | null {
  const key = `${rx}x${ry}x${scale}x${over}`
  if (rugSprite && rugKey === key) return rugSprite
  if (typeof document === 'undefined') return null
  const ss = 2 // supersample factor
  const wLogic = rx * 2
  const hLogic = ry * 2 + over
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(wLogic * ss)
  cv.height = Math.ceil(hLogic * ss)
  const c = cv.getContext('2d')
  if (!c) return null
  c.scale(ss, ss)
  const cx = rx // ellipse centre within the sprite
  const cy = ry + over
  // dark lavender · light pinkish-purple (base/mid) · pale lavender · mid violet.
  const furShades = ['#4A3E78', '#B98AC8', '#D6C8EE', '#7E64B4']
  c.fillStyle = furShades[1] // base oval (light pinkish purple)
  c.beginPath()
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  c.fill()
  c.lineCap = 'round'
  c.lineWidth = Math.max(1, scale * 0.55) // match the floor plank-divider width
  const rng = mulberry(97)
  const tufts = Math.round(rx * ry * 0.3)
  for (let i = 0; i < tufts; i++) {
    const a = rng() * Math.PI * 2
    const rr = Math.sqrt(rng()) // uniform over the disc
    const px = cx + rx * rr * Math.cos(a)
    const py = cy + ry * rr * Math.sin(a)
    const len = scale * (0.5 + rng() * 1.2)
    const tilt = (rng() - 0.5) * scale * 0.7
    c.strokeStyle = furShades[Math.floor(rng() * furShades.length)]
    c.beginPath()
    c.moveTo(px, py)
    c.lineTo(px + tilt, py - len) // strand poking "up" out of the pile
    c.stroke()
  }
  rugSprite = cv
  rugKey = key
  return cv
}

// Room extents, in world tiles (the y row where walls meet the floor, etc.).
// A compact room centred on map column 29 so it reads as a lit box floating in
// the black void rather than filling the screen.
export const ROOM_LEFT = 24
export const ROOM_RIGHT = 34
const ROOM_TOP = 0.5 // top of the walls (world-tile row)
const ROOM_FLOOR_Y = 4 // world-tile row where the walls meet the floor
const ROOM_BOTTOM = 8.5

// The floor patch the koala may walk on (a margin inside the room).
const WALK_MINX = ROOM_LEFT + 1.5
const WALK_MAXX = ROOM_RIGHT - 2.5
const WALK_MINY = ROOM_FLOOR_Y + 0.5
const WALK_MAXY = ROOM_BOTTOM - 1.5

// Where the koala stands the moment it steps inside (bottom-centre of the floor).
export const ROOM_ENTRY = {
  x: (ROOM_LEFT + ROOM_RIGHT) / 2 - 0.5,
  y: WALK_MAXY,
}

// The room's geometric centre (world-tile coords) — the camera frames this so
// the room sits still in the middle of the viewport while the koala walks.
export const ROOM_CENTER = {
  x: (ROOM_LEFT + ROOM_RIGHT) / 2,
  y: (ROOM_TOP + ROOM_BOTTOM) / 2,
}

// How close (tiles, box distance) the koala must be to a house to meow inside.
export const HOUSE_REACH = 1.6

// The subset of the cat's state the room needs to move + animate.
export interface RoomCat {
  x: number
  y: number
  dir: 'left' | 'right'
  idle: boolean
  interacting: boolean
  idleFrames: number
  state: 'standing' | 'lying' | 'sleeping'
}

/**
 * Walk the koala around the room for one frame. Mirrors ParkGame's updateCat but
 * with no world objects/collisions — just the room's floor bounds. Mutates
 * `cat` and returns the (possibly cleared) tap-to-walk target.
 */
export function updateRoomCat(
  cat: RoomCat,
  dt: number,
  keys: Record<string, boolean>,
  move: { x: number; y: number } | null,
  target: { x: number; y: number } | null,
): { x: number; y: number } | null {
  const speed = 0.0021 * dt // same tiles/ms as the park
  let moving = false
  let nx = cat.x
  let ny = cat.y

  if (keys['arrowleft'] || keys['a']) {
    nx -= speed
    cat.dir = 'left'
    moving = true
  }
  if (keys['arrowright'] || keys['d']) {
    nx += speed
    cat.dir = 'right'
    moving = true
  }
  if (keys['arrowup'] || keys['w']) {
    ny -= speed
    moving = true
  }
  if (keys['arrowdown'] || keys['s']) {
    ny += speed
    moving = true
  }

  // Analog joystick (Gamer mode) — a continuous 2D vector, same as the park.
  if (move && (move.x !== 0 || move.y !== 0)) {
    nx += move.x * speed
    ny += move.y * speed
    if (Math.abs(move.x) > 0.2) cat.dir = move.x < 0 ? 'left' : 'right'
    moving = true
  }

  // Direct input overrides tap-to-walk; otherwise head to the tapped target.
  if (moving) {
    target = null
  } else if (target) {
    const dx = target.x - cat.x
    const dy = target.y - cat.y
    const dist = Math.hypot(dx, dy)
    if (dist <= speed) {
      nx = target.x
      ny = target.y
      target = null
    } else {
      nx += (dx / dist) * speed
      ny += (dy / dist) * speed
      if (Math.abs(dx) > 0.01) cat.dir = dx < 0 ? 'left' : 'right'
      moving = true
    }
  }

  // Clamp to the walkable floor (the walls block the rest).
  cat.x = Math.max(WALK_MINX, Math.min(WALK_MAXX, nx))
  cat.y = Math.max(WALK_MINY, Math.min(WALK_MAXY, ny))

  // Idle → lying → sleeping, frame-rate independent (same timings as the park).
  if (moving) {
    cat.idleFrames = 0
    cat.state = 'standing'
  } else {
    cat.idleFrames += dt * 0.06
    cat.state =
      cat.idleFrames > 1200
        ? 'sleeping'
        : cat.idleFrames > 600
          ? 'lying'
          : 'standing'
  }
  cat.idle = !moving
  cat.interacting = false
  return target
}

/**
 * Draw the room — two warm walls meeting at a corner over a wooden floor, with a
 * glowing window and a little rug. Drawn in world-tile coords (the caller has
 * already translated the context down by WORLD_OFFSET), so it lines up with the
 * koala. `pixel` = px per tile, `scale` = the game's art scale.
 */
export function drawRoom(ctx: Ctx, pixel: number, scale: number) {
  const L = ROOM_LEFT * pixel
  const R = ROOM_RIGHT * pixel
  const top = ROOM_TOP * pixel
  const floorY = ROOM_FLOOR_Y * pixel
  const bottom = ROOM_BOTTOM * pixel
  const W = R - L
  const wallH = floorY - top
  // Corner seam: a left wall takes ~a third, the back wall the rest.
  const seam = L + W * 0.32

  // ── Two walls (a cosy inside corner) in one unified warm cream ──
  ctx.fillStyle = '#F0E2C0'
  ctx.fillRect(L, top, W, wallH)
  // A single faint corner line so it still reads as two walls (no gradient).
  ctx.strokeStyle = 'rgba(120,70,30,0.22)'
  ctx.lineWidth = scale * 0.5
  ctx.beginPath()
  ctx.moveTo(seam, top)
  ctx.lineTo(seam, floorY)
  ctx.stroke()

  // ── Windows + a door on the back wall, echoing the exterior house ──
  // The panes look OUT onto the night: a dark sky, stars, and (in one) a moon,
  // framed by the house's bright white casing + cross mullion.
  const trim = '#EFEFEE' // bright white casing/mullions
  const winW = W * 0.21
  const winH = wallH * 0.52
  const winY = top + wallH * 0.16
  const drawWindow = (winX: number, withMoon: boolean) => {
    // White casing.
    ctx.fillStyle = trim
    ctx.fillRect(winX - scale, winY - scale, winW + scale * 2, winH + scale * 2)
    // Night sky outside — dark navy, a touch lighter toward the horizon.
    const sky = ctx.createLinearGradient(0, winY, 0, winY + winH)
    sky.addColorStop(0, '#0a1030')
    sky.addColorStop(1, '#1c2550')
    ctx.fillStyle = sky
    ctx.fillRect(winX, winY, winW, winH)
    // Clip to the pane so the moon/stars can't spill over the casing.
    ctx.save()
    ctx.beginPath()
    ctx.rect(winX, winY, winW, winH)
    ctx.clip()
    // The moon + stars are the SAME art the park draws in its sky (game/sky.ts),
    // so the view "outside" matches the exterior night.
    if (withMoon) {
      drawMoonAt(ctx, winX + winW * 0.66, winY + winH * 0.3, winW * 0.16)
    }
    // A handful of stars, at stable (seeded) positions.
    const rng = mulberry(Math.round(winX) * 40503 + 7)
    for (let i = 0; i < 7; i++) {
      const sx = winX + rng() * winW
      const sy = winY + rng() * winH * 0.85
      const sr = scale * (0.35 + rng() * 0.5)
      drawStarAt(ctx, sx, sy, sr, 0.85)
    }
    ctx.restore()
    // White cross mullion (over the night view).
    ctx.strokeStyle = trim
    ctx.lineWidth = scale * 0.7
    ctx.beginPath()
    ctx.moveTo(winX + winW / 2, winY)
    ctx.lineTo(winX + winW / 2, winY + winH)
    ctx.moveTo(winX, winY + winH / 2)
    ctx.lineTo(winX + winW, winY + winH / 2)
    ctx.stroke()
  }
  // Two windows on the right (back) wall — spread a bit so the larger panes don't
  // crowd each other.
  const rightW = R - seam
  drawWindow(seam + rightW * 0.3 - winW / 2, false)
  drawWindow(seam + rightW * 0.7 - winW / 2, true)

  // The door (the way back out) — on the left wall, sitting on the floor: a
  // wooden plank door in the same warm browns as the floor, framed by white casing.
  const leftW = seam - L
  const doorW = W * 0.14
  const doorH = wallH * 0.6
  const doorX = L + leftW * 0.5 - doorW / 2
  const doorY = floorY - doorH
  ctx.fillStyle = trim // white casing
  ctx.fillRect(
    doorX - scale * 1.4,
    doorY - scale * 1.4,
    doorW + scale * 2.8,
    doorH + scale * 1.4,
  )
  // Modern flush door: a clean single-colour slab in the floor's pale wood tone
  // with a slim vertical bar handle.
  ctx.fillStyle = FLOOR_WOOD // golden oak, matching the floor
  ctx.fillRect(doorX, doorY, doorW, doorH)
  // Threshold line at the base so the door reads separate from the same-toned floor.
  ctx.strokeStyle = 'rgba(95,62,28,0.5)'
  ctx.lineWidth = Math.max(1, scale * 0.4)
  ctx.beginPath()
  ctx.moveTo(doorX, doorY + doorH)
  ctx.lineTo(doorX + doorW, doorY + doorH)
  ctx.stroke()
  // Slim vertical bar handle near the opening edge (matte dark bronze).
  ctx.fillStyle = '#33291C'
  const hw = Math.max(1.5, scale * 0.6)
  const hh = doorH * 0.22
  ctx.fillRect(
    doorX + doorW * 0.83 - hw / 2,
    doorY + doorH * 0.5 - hh / 2,
    hw,
    hh,
  )

  // ── Wooden floor (long, narrow planks with a random rhythm) ──
  const rows = 12 // more rows → slimmer (narrower) planks
  const plankH = (bottom - floorY) / rows
  const boardW = W / 2.5 // long boards
  ctx.lineWidth = Math.max(1, scale * 0.55)
  ctx.strokeStyle = 'rgba(105,70,90,0.45)' // purpleish-brown plank dividers
  for (let r = 0; r < rows; r++) {
    const y = floorY + r * plankH
    const rng = mulberry((r + 1) * 2654435761)
    // Walk the row left→right laying boards of varied length, so seams never
    // line up between rows — an irregular, natural rhythm.
    let x = L
    let first = true
    while (x < R) {
      let w = boardW * (0.7 + rng() * 0.9)
      if (first) {
        w *= 0.35 + rng() * 0.6 // random first board → staggers each row's start
        first = false
      }
      const x2 = Math.min(R, x + w)
      ctx.fillStyle = FLOOR_WOOD
      ctx.fillRect(x, y, x2 - x, plankH)
      // Seam on this board's right edge (skip the room's outer wall).
      if (x2 < R) {
        ctx.beginPath()
        ctx.moveTo(x2, y)
        ctx.lineTo(x2, y + plankH)
        ctx.stroke()
      }
      x = x2
    }
  }
  // Horizontal seams between rows.
  ctx.strokeStyle = 'rgba(105,70,90,0.35)' // purpleish-brown plank dividers
  for (let r = 1; r < rows; r++) {
    const y = floorY + r * plankH
    ctx.beginPath()
    ctx.moveTo(L, y)
    ctx.lineTo(R, y)
    ctx.stroke()
  }
  // Divide line where the wall meets the floor (replaces the old skirting board).
  ctx.strokeStyle = 'rgba(60,45,30,0.4)'
  ctx.lineWidth = Math.max(1, scale * 0.4)
  ctx.beginPath()
  ctx.moveTo(L, floorY)
  ctx.lineTo(R, floorY)
  ctx.stroke()
  // ── High-pile coral rug: an oval base flecked with hundreds of short fibre
  // strokes in three coral shades, so it reads as a fuzzy, tufted carpet. ──
  const rugX = (L + R) / 2
  const rugY = floorY + (bottom - floorY) * 0.62
  const rugRx = W * 0.2
  const rugRy = rugRx * 0.5 // flattened to sit on the floor
  // The rug's hundreds of fibre strokes never change, so bake them once to an
  // offscreen sprite and just blit it each frame (see getRugSprite). `over` is the
  // top overhang the poking-up strands need beyond the ellipse.
  const over = scale * 2
  const rugSpr = getRugSprite(rugRx, rugRy, scale, over)
  if (rugSpr) {
    ctx.drawImage(
      rugSpr,
      rugX - rugRx,
      rugY - rugRy - over,
      rugRx * 2,
      rugRy * 2 + over,
    )
  }

  // ── Warm ambient glow over the whole room ──
  const amb = ctx.createRadialGradient(
    (L + R) / 2,
    floorY,
    pixel,
    (L + R) / 2,
    floorY,
    W * 0.85,
  )
  amb.addColorStop(0, 'rgba(255,220,150,0.16)')
  amb.addColorStop(1, 'rgba(255,220,150,0)')
  ctx.fillStyle = amb
  ctx.fillRect(L, top, W, bottom - top)
}
