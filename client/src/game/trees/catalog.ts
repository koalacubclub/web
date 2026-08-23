// Renderer for catalog.html — the dev preview of this folder. It draws with the
// exported draw functions themselves (never a copy), so the catalog always shows
// the current art.

import { COLORS, NIGHT, PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
import {
  SPECIES_WEIGHTS,
  TREE_SPECIES,
  drawTree,
  treeFormAt,
  treeSpeciesAt,
} from './index'
import type { Ink, TreeForm, TreeSpecies } from './types'

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

/** Sky, hill ridge and grass — just enough park to judge a tree against. */
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
  // goes through ink(): parkInk only maps the tree palettes. Each surface picks
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
 * Draw the tree belonging to tile (tx, ty) at an arbitrary spot on the canvas —
 * the tile still decides its species, form and jitter, the translate just moves
 * where it lands.
 */
function place(
  ctx: CanvasRenderingContext2D,
  destX: number,
  destY: number,
  tile: { x: number; y: number },
  opts: { species?: TreeSpecies; form?: TreeForm } = {},
): void {
  ctx.save()
  ctx.translate(destX - tile.x * PIXEL, destY - tile.y * PIXEL)
  drawTree(ctx, tile, { ...opts, ink })
  ctx.restore()
}

function renderTreeline(): void {
  const canvas = document.getElementById('treeline') as HTMLCanvasElement
  const cssW = 1080
  // Headroom: at the top of the size range a crown climbs ~190px above its
  // foot, so the canvas has to be taller than the ground band suggests.
  const cssH = 400
  const ctx = setupCanvas(canvas, cssW, cssH)
  drawGround(ctx, cssW, cssH, 262)

  // Uneven X gaps and a staggered Y, per the park's own layout rules — trees in
  // a straight line at a constant pitch read as a fence, not a treeline.
  const xs = [-0.01, 0.115, 0.245, 0.355, 0.5, 0.63, 0.775, 0.885]
  const ys = [184, 170, 192, 162, 188, 166, 194, 174]
  xs.forEach((fx, i) => {
    const tile = { x: seed * 3 + i * 7, y: 2 + (i % 3) }
    place(ctx, fx * cssW, ys[i], tile)
  })
}

function renderGrid(): void {
  const host = document.getElementById('grid')!
  host.innerHTML = ''
  const total = TREE_SPECIES.reduce((sum, k) => sum + SPECIES_WEIGHTS[k], 0)

  TREE_SPECIES.forEach((species, si) => {
    const card = document.createElement('article')
    card.className = 'card'
    const canvas = document.createElement('canvas')
    card.appendChild(canvas)
    const share = Math.round((SPECIES_WEIGHTS[species] / total) * 100)
    const body = document.createElement('div')
    body.className = 'card-body'
    body.innerHTML =
      `<h3>${species}</h3>` +
      `<p class="meta">form 0 · form 1 · form 0 — ${share}% of trees</p>` +
      `<p class="file">trees/${species === 'broadleaf' ? 'broadleaf' : species}.ts</p>`
    card.appendChild(body)
    host.appendChild(card)

    // Wide enough that a top-of-range crown's overhang stays inside the frame.
    const cssW = 380
    const cssH = 300
    const ctx = setupCanvas(canvas, cssW, cssH)
    drawGround(ctx, cssW, cssH, 222)
    ;([0, 1, 0] as TreeForm[]).forEach((form, i) => {
      const tile = { x: seed * 5 + si * 13 + i * 9, y: 3 + i }
      place(ctx, 30 + i * 110, 136 + (i === 1 ? 4 : 0), tile, { species, form })
    })
  })
}

function renderAll(): void {
  renderTreeline()
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

// Log what the map would roll for a few tiles — handy when eyeballing weights.
console.info('tile (4,2) →', treeSpeciesAt(4, 2), 'form', treeFormAt(4, 2))

renderAll()
let resizeTimer: ReturnType<typeof setTimeout>
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(renderAll, 150)
})
