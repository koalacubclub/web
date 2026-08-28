// Renderer for catalog.html — the dev preview of this folder. It draws with the
// exported draw functions themselves (never a copy), so the catalog always shows
// the current art.
//
// Unlike the scenery catalogs this one runs an animation loop: half these
// pieces only exist in motion — the ball bounces, the snowcat bobs, the fairy
// lights twinkle, the radio pulses and puffs notes.
//
// The mushroom's and the snow-cat's cards show every build side by side, drawn
// with an explicit `form`; everywhere else (the bank across the top, the game
// itself) the build comes from the tile, as it does in the park.

import { COLORS, NIGHT, PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
import {
  MUSHROOM_FORMS,
  SNOWCAT_FORMS,
  drawDecor,
  type DecorType,
} from './index'
import type { Ink } from './types'

const identity: Ink = (c) => c
let ink: Ink = parkInk
let seed = 3
let playing = true
let frameCount = 0

/** Every piece, with the footprint the shop sells it at. */
const PIECES: Array<{
  type: DecorType
  w: number
  h: number
  title: string
  meta: string
  /** The builds this piece comes in, when the tile rolls its shape. */
  forms?: readonly number[]
}> = [
  {
    type: 'ball',
    w: 1,
    h: 1,
    title: 'ball',
    meta: '1×1 — the park seeds these too, and they are the same ball',
  },
  {
    type: 'mushroom',
    w: 1,
    h: 1,
    title: 'mushroom',
    meta: '1×1 — button, parasol, bell, cluster: the cap is rolled by tile',
    forms: MUSHROOM_FORMS,
  },
  {
    type: 'snowcat',
    w: 1,
    h: 1,
    title: 'snowcat',
    meta: '1×1 — classic, tower or loaf: the stack is rolled by tile, bobbing',
    forms: SNOWCAT_FORMS,
  },
  {
    type: 'cardbox',
    w: 2,
    h: 1,
    title: 'cardbox',
    meta: '2×1 — open flaps, because cats love boxes',
  },
  {
    type: 'house',
    w: 4,
    h: 3,
    title: 'house',
    meta: '4×3 — cedar shingle, brick chimney, someone is home',
  },
  {
    type: 'lighttree',
    w: 2,
    h: 2,
    title: 'light tree',
    meta: '2×2 — lamp scatter seeded by tile, so each tree differs',
  },
  {
    type: 'radio',
    w: 2,
    h: 1,
    title: 'radio',
    meta: '2×1 — pulses and puffs notes while a koala is near',
  },
]

function setupCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.aspectRatio = `${cssW} / ${cssH}`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)
  return ctx
}

/** Sky, hill ridge and grass — just enough park to judge a prop against. */
function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  horizon: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  const isNight = ink === parkInk
  sky.addColorStop(0, isNight ? '#12100e' : '#2a3550')
  sky.addColorStop(1, isNight ? '#1b1726' : '#4d5a7d')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, horizon)
  // This backdrop is the catalog's own scenery, not species art, so none of it
  // goes through ink(): parkInk only maps the prop palettes. Each surface picks
  // its park counterpart directly — from NIGHT where the colour is a palette
  // entry, and from a literal where it isn't.
  ctx.fillStyle = isNight ? NIGHT.grass : COLORS.grass
  ctx.fillRect(0, horizon - 14, w, h - horizon + 14)
  ctx.fillStyle = isNight ? '#4F695F' : '#5E9A5A'
  ctx.beginPath()
  ctx.moveTo(0, horizon)
  for (let px = 0; px <= w; px += 8) {
    ctx.lineTo(
      px,
      horizon + Math.sin(px * 0.012) * 7 + Math.sin(px * 0.031) * 4,
    )
  }
  ctx.lineTo(w, horizon + 22)
  ctx.lineTo(0, horizon + 22)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = isNight ? NIGHT.grassDark : COLORS.grassDark
  const rng = makeRng(99)
  for (let i = 0; i < 24; i++) {
    const gx = rng() * w
    const gy = horizon + 26 + rng() * (h - horizon - 32)
    ctx.beginPath()
    ctx.ellipse(gx, gy, 12 + rng() * 22, 4 + rng() * 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Draw a piece at an arbitrary spot — the tile still seeds whatever it seeds. */
function place(
  ctx: CanvasRenderingContext2D,
  destX: number,
  destY: number,
  tile: { x: number; y: number; w: number; h: number },
  type: DecorType,
  form?: number,
): void {
  ctx.save()
  ctx.translate(destX - tile.x * PIXEL, destY - tile.y * PIXEL)
  drawDecor(ctx, type, tile, { ink, frameCount, playing, form })
  ctx.restore()
}

function renderScatter(): void {
  const canvas = document.getElementById('scatter') as HTMLCanvasElement
  const cssW = 1080
  const cssH = 250
  const ctx = setupCanvas(canvas, cssW, cssH)
  drawGround(ctx, cssW, cssH, 96)

  // Every piece along one bank, at uneven gaps so it reads as a park rather
  // than a shelf. The taller ones sit further back.
  let x = 40
  PIECES.forEach((p, i) => {
    const tile = { x: seed * 3 + i * 9, y: 4 + (i % 3), w: p.w, h: p.h }
    // Anchored by the feet, with a small stagger so the row isn't a shelf.
    const y = 214 - p.h * PIXEL + (i % 2) * 10
    place(ctx, x, y, tile, p.type)
    x += p.w * PIXEL + 46
  })
}

function renderGrid(): void {
  const host = document.getElementById('grid')!
  if (host.childElementCount !== PIECES.length) {
    host.innerHTML = ''
    PIECES.forEach((p) => {
      const card = document.createElement('article')
      card.className = 'card'
      card.appendChild(document.createElement('canvas'))
      const body = document.createElement('div')
      body.className = 'card-body'
      body.innerHTML =
        `<h3>${p.title}</h3>` +
        `<p class="meta">${p.meta}</p>` +
        `<p class="file">decor/${p.type === 'lighttree' ? 'lightTree' : p.type}.ts</p>`
      card.appendChild(body)
      host.appendChild(card)
    })
  }

  PIECES.forEach((p, i) => {
    const canvas = host.children[i].querySelector('canvas') as HTMLCanvasElement
    // Tall enough for the tallest piece, and every card the same height so the
    // grid doesn't jump. Pieces are anchored by their FEET, not their top-left,
    // or the house and the light tree run off the bottom edge.
    const cssW = 520
    const cssH = 250
    const baseline = 214
    const ctx = setupCanvas(canvas, cssW, cssH)
    drawGround(ctx, cssW, cssH, 118)
    // Three of each, on different tiles — which matters for the light tree and
    // is worth showing anyway: these are meant to sit next to each other. A
    // piece with builds shows one of each instead, so the card is the full set.
    const gap = p.w * PIXEL + 34
    // Three side by side, or two when the piece is too wide for three to fit.
    const count = p.forms ? p.forms.length : gap * 3 <= cssW - 40 ? 3 : 2
    const startX = (cssW - (count - 1) * gap - p.w * PIXEL) / 2
    for (let n = 0; n < count; n++) {
      const tile = { x: seed * 5 + n * 13 + i, y: 3 + n, w: p.w, h: p.h }
      place(
        ctx,
        startX + n * gap,
        baseline - p.h * PIXEL,
        tile,
        p.type,
        p.forms?.[n],
      )
    }
  })
}

function renderAll(): void {
  renderScatter()
  renderGrid()
}

const btnNight = document.getElementById('btn-night') as HTMLButtonElement
const btnDay = document.getElementById('btn-day') as HTMLButtonElement
function setInk(next: Ink): void {
  ink = next
  btnNight.setAttribute('aria-pressed', String(next === parkInk))
  btnDay.setAttribute('aria-pressed', String(next === identity))
}
btnNight.addEventListener('click', () => setInk(parkInk))
btnDay.addEventListener('click', () => setInk(identity))
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement
btnPlay.addEventListener('click', () => {
  playing = !playing
  btnPlay.setAttribute('aria-pressed', String(playing))
})
document.getElementById('btn-reroll')!.addEventListener('click', () => {
  seed = (seed * 7 + 13) % 499
})

// The park's own clock runs in 60fps-frame units; match it so the twinkle and
// the bounce here run at the speed they will in the game.
function tick(): void {
  frameCount += 1
  renderAll()
  requestAnimationFrame(tick)
}
tick()
