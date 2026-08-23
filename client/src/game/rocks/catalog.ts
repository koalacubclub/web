// Renderer for catalog.html — the dev preview of this folder. It draws with the
// exported draw functions themselves (never a copy), so the catalog always shows
// the current art.

import { COLORS, NIGHT, PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
import {
  ROCK_SPECIES,
  SPECIES_WEIGHTS,
  drawRock,
  rockFormAt,
  rockSpeciesAt,
} from './index'
import type { Ink, RockForm, RockSpecies } from './types'

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

/** Sky, hill ridge and grass — just enough park to judge a rock against. */
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
  // goes through ink(): parkInk only maps the rock palettes. Each surface picks
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

/**
 * Draw the rock belonging to tile (tx, ty) at an arbitrary spot on the canvas —
 * the tile still decides its arrangement, form and jitter, the translate just
 * moves where it lands.
 */
function place(
  ctx: CanvasRenderingContext2D,
  destX: number,
  destY: number,
  tile: { x: number; y: number },
  opts: { species?: RockSpecies; form?: RockForm } = {},
): void {
  ctx.save()
  ctx.translate(destX - tile.x * PIXEL, destY - tile.y * PIXEL)
  drawRock(ctx, tile, { ...opts, ink })
  ctx.restore()
}

function renderScatter(): void {
  const canvas = document.getElementById('scatter') as HTMLCanvasElement
  const cssW = 1080
  const cssH = 190
  const ctx = setupCanvas(canvas, cssW, cssH)
  drawGround(ctx, cssW, cssH, 80)

  // Uneven gaps and a staggered depth, per the park's own layout rules.
  const xs = [0.03, 0.14, 0.245, 0.35, 0.47, 0.6, 0.71, 0.82, 0.92]
  xs.forEach((fx, i) => {
    const tile = { x: seed * 3 + i * 13, y: 5 + (i % 3) }
    place(ctx, fx * cssW, 96 + (i % 3) * 14, tile)
  })
}

function renderGrid(): void {
  const host = document.getElementById('grid')!
  host.innerHTML = ''
  const total = ROCK_SPECIES.reduce((sum, k) => sum + SPECIES_WEIGHTS[k], 0)

  ROCK_SPECIES.forEach((species, si) => {
    const card = document.createElement('article')
    card.className = 'card'
    const canvas = document.createElement('canvas')
    card.appendChild(canvas)
    const share = Math.round((SPECIES_WEIGHTS[species] / total) * 100)
    const body = document.createElement('div')
    body.className = 'card-body'
    body.innerHTML =
      `<h3>${species}</h3>` +
      `<p class="meta">form 0 · form 1 · form 0 — ${share}% of rocks</p>` +
      `<p class="file">rocks/${species}.ts</p>`
    card.appendChild(body)
    host.appendChild(card)

    // Three of the same arrangement: form 0, form 1, then form 0 again on
    // another tile — so both the builds and the per-rock variance show.
    const cssW = 380
    const cssH = 172
    const ctx = setupCanvas(canvas, cssW, cssH)
    drawGround(ctx, cssW, cssH, 72)
    ;([0, 1, 0] as RockForm[]).forEach((form, i) => {
      const tile = { x: seed * 11 + si * 23 + i * 7, y: 5 + i }
      place(ctx, 58 + i * 106, 96, tile, { species, form })
    })
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

// Log what the map would roll for a tile — handy when eyeballing weights.
console.info('tile (4,7) →', rockSpeciesAt(4, 7), 'form', rockFormAt(4, 7))

renderAll()
let resizeTimer: ReturnType<typeof setTimeout>
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(renderAll, 150)
})
