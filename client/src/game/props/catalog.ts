// Renderer for catalog.html — the dev preview of this folder. It draws with the
// exported draw functions themselves (never a copy), so the catalog always shows
// the current art.

import { COLORS, NIGHT, PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
import { drawBench, drawPond, pondFormAt } from './index'
import type { Ink, PondForm } from './types'

const identity: Ink = (c) => c
let ink: Ink = parkInk
let seed = 3

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

/** Draw a prop's art at an arbitrary spot — the tile still decides its roll. */
function place(
  ctx: CanvasRenderingContext2D,
  destX: number,
  destY: number,
  tile: { x: number; y: number },
  draw: (t: { x: number; y: number }) => void,
): void {
  ctx.save()
  ctx.translate(destX - tile.x * PIXEL, destY - tile.y * PIXEL)
  draw(tile)
  ctx.restore()
}

function renderScatter(): void {
  const canvas = document.getElementById('scatter') as HTMLCanvasElement
  const cssW = 1080
  const cssH = 230
  const ctx = setupCanvas(canvas, cssW, cssH)
  drawGround(ctx, cssW, cssH, 96)

  // Two ponds and two benches along one bank, at uneven gaps.
  const items: Array<[number, number, 'pond' | 'bench', PondForm]> = [
    [0.02, 118, 'pond', 0],
    [0.28, 132, 'bench', 0],
    [0.42, 112, 'pond', 1],
    [0.72, 128, 'bench', 0],
    [0.84, 122, 'pond', 0],
  ]
  items.forEach(([fx, y, kind, form], i) => {
    const tile = { x: seed * 3 + i * 9, y: 4 + (i % 3) }
    if (kind === 'pond') {
      place(ctx, fx * cssW, y, tile, (t) => drawPond(ctx, t, { form, ink }))
    } else {
      place(ctx, fx * cssW, y, tile, (t) => drawBench(ctx, t, { ink }))
    }
  })
}

function renderGrid(): void {
  const host = document.getElementById('grid')!
  host.innerHTML = ''

  const cards: Array<{
    title: string
    meta: string
    file: string
    draw: (ctx: CanvasRenderingContext2D, cssW: number) => void
  }> = [
    {
      title: 'pond · pool',
      meta: 'form 0 — one broad basin, stones all the way round',
      file: 'props/pond.ts',
      draw: (ctx, cssW) => {
        ;[0, 1].forEach((n) => {
          const tile = { x: seed * 7 + n * 17, y: 4 + n }
          place(ctx, 30 + n * (cssW / 2 - 20), 122, tile, (t) =>
            drawPond(ctx, t, { form: 0, ink }),
          )
        })
      },
    },
    {
      title: 'pond · inlet',
      meta: 'form 1 — two lobes, a pebble shore at the open end',
      file: 'props/pond.ts',
      draw: (ctx, cssW) => {
        ;[0, 1].forEach((n) => {
          const tile = { x: seed * 11 + n * 23, y: 5 + n }
          place(ctx, 30 + n * (cssW / 2 - 20), 122, tile, (t) =>
            drawPond(ctx, t, { form: 1, ink }),
          )
        })
      },
    },
    {
      title: 'bench',
      meta: 'no forms — every bench in the park is the same bench',
      file: 'props/bench.ts',
      draw: (ctx, cssW) => {
        ;[0, 1, 2].forEach((n) => {
          const tile = { x: seed * 5 + n * 13, y: 3 + n }
          place(ctx, 34 + n * (cssW / 3.4), 118, tile, (t) =>
            drawBench(ctx, t, { ink }),
          )
        })
      },
    },
  ]

  cards.forEach((c) => {
    const card = document.createElement('article')
    card.className = 'card'
    const canvas = document.createElement('canvas')
    card.appendChild(canvas)
    const body = document.createElement('div')
    body.className = 'card-body'
    body.innerHTML =
      `<h3>${c.title}</h3>` +
      `<p class="meta">${c.meta}</p>` +
      `<p class="file">${c.file}</p>`
    card.appendChild(body)
    host.appendChild(card)

    const cssW = 520
    const cssH = 200
    const ctx = setupCanvas(canvas, cssW, cssH)
    drawGround(ctx, cssW, cssH, 86)
    c.draw(ctx, cssW)
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
  renderAll()
}
btnNight.addEventListener('click', () => setInk(parkInk))
btnDay.addEventListener('click', () => setInk(identity))
document.getElementById('btn-reroll')!.addEventListener('click', () => {
  seed = (seed * 7 + 13) % 499
  renderAll()
})

// Log what the map would roll for a tile — handy when checking the split.
console.info('pond at tile (4,7) → form', pondFormAt(4, 7))

renderAll()
let resizeTimer: ReturnType<typeof setTimeout>
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(renderAll, 150)
})
