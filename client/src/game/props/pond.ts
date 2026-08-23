// The park's pond, in two builds.
//
//   form 0 — pool: one broad basin, stones the whole way round.
//   form 1 — inlet: two lobes pinched in the middle, with a pebble shore at one
//            end instead of a stone rim, and more planting.
//
// The rim is drawn with the rocks module's `facetedStone`, so a pond's stones
// are the same stones as everything else in the park rather than a second,
// slightly different pebble.
//
// `pondPath` builds the water's outline as a path. Fill and clip both go through
// it, which is what makes the reflection work when this is wired in: ParkGame
// clips reflections to the water, and that clip has to be the pond's real shape,
// not an ellipse that happens to be close.

import { PIXEL, SCALE } from '../constants'
import { GRANITE, SANDSTONE, facetedStone } from '../rocks'
import { jitter } from './variance'
import type { Ctx, Ink, Lobe, PondDrawArgs } from './types'

const TAU = Math.PI * 2

export const POND_TONES = {
  deep: '#4E8FE0',
  water: '#64B5F6',
  shallow: '#8FD0FA',
  glint: '#BFE6FF',
  bank: '#9C7C5A',
  reed: '#4E9150',
  pad: '#5EA855',
  padLight: '#7CBE63',
  /** Lily flowers stay bright in the park, like every other bloom. */
  lily: '#FFD9E6',
}

/**
 * The lobes making up a pond on a 3×2 footprint at (px, py). One for the pool,
 * two overlapping for the inlet — filled as a single path, so where they overlap
 * they read as one body of water.
 */
export function pondLobes(
  px: number,
  py: number,
  form: 0 | 1,
  j: { w: number; h: number; lean: number },
): Lobe[] {
  const cx = px + PIXEL * 1.5 + j.lean
  const cy = py + PIXEL
  if (form === 0) {
    return [{ cx, cy, rx: PIXEL * 1.4 * j.w, ry: PIXEL * 0.8 * j.h }]
  }
  return [
    {
      cx: cx - PIXEL * 0.42 * j.w,
      cy: cy + PIXEL * 0.06,
      rx: PIXEL * 0.92 * j.w,
      ry: PIXEL * 0.62 * j.h,
    },
    {
      cx: cx + PIXEL * 0.52 * j.w,
      cy: cy - PIXEL * 0.04,
      rx: PIXEL * 0.78 * j.w,
      ry: PIXEL * 0.7 * j.h,
    },
  ]
}

/**
 * Trace the water's outline. Callers fill it, and — once this is wired in —
 * clip reflections to the same path.
 */
export function pondPath(ctx: Ctx, lobes: Lobe[]): void {
  ctx.beginPath()
  for (const l of lobes) {
    ctx.ellipse(l.cx, l.cy, l.rx, l.ry, 0, 0, TAU)
  }
}

/** Outer bounds of a set of lobes — used for the water's depth ramp. */
function bounds(lobes: Lobe[]) {
  return {
    top: Math.min(...lobes.map((l) => l.cy - l.ry)),
    bottom: Math.max(...lobes.map((l) => l.cy + l.ry)),
    left: Math.min(...lobes.map((l) => l.cx - l.rx)),
    right: Math.max(...lobes.map((l) => l.cx + l.rx)),
  }
}

/** A reed clump: a few blades fanning up out of the water's edge. */
function reeds(
  ctx: Ctx,
  x: number,
  y: number,
  count: number,
  rng: () => number,
  ink: Ink,
): void {
  ctx.strokeStyle = ink(POND_TONES.reed)
  ctx.lineCap = 'round'
  ctx.lineWidth = SCALE * 0.6
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const h = PIXEL * (0.3 + rng() * 0.34)
    const bx = x + (rng() - 0.5) * PIXEL * 0.36
    ctx.beginPath()
    ctx.moveTo(bx, y)
    ctx.quadraticCurveTo(
      bx + side * SCALE * 1.6,
      y - h * 0.6,
      bx + side * SCALE * (2.4 + rng() * 2),
      y - h,
    )
    ctx.stroke()
  }
}

/** A lily pad, with the notch that makes it read as a pad and not a coin. */
function lilyPad(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  rng: () => number,
  ink: Ink,
): void {
  ctx.fillStyle = ink(rng() < 0.4 ? POND_TONES.padLight : POND_TONES.pad)
  ctx.beginPath()
  ctx.ellipse(x, y, r, r * 0.62, 0, 0.5, TAU + 0.1)
  ctx.closePath()
  ctx.fill()
  if (rng() < 0.4) {
    // A bloom sitting on the pad — bright, un-inked, like the park's other blooms.
    ctx.fillStyle = POND_TONES.lily
    ctx.beginPath()
    ctx.arc(x + r * 0.25, y - r * 0.2, SCALE * 0.9, 0, TAU)
    ctx.fill()
  }
}

export function drawPond(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: PondDrawArgs,
): void {
  const t = POND_TONES
  const j = jitter(rng)
  const lobes = pondLobes(px, py, form, j)
  const b = bounds(lobes)

  // Wet earth just outside the waterline, so the pond sits IN the ground rather
  // than on top of it. Kept narrow — a thick ring reads as a plastic paddling
  // pool rather than as a bank.
  ctx.fillStyle = ink(t.bank)
  ctx.beginPath()
  for (const l of lobes) {
    ctx.ellipse(l.cx, l.cy, l.rx + SCALE * 0.9, l.ry + SCALE * 0.7, 0, 0, TAU)
  }
  ctx.fill()

  // Water: deep at the far edge, shallower toward the near rim.
  const grad = ctx.createLinearGradient(0, b.top, 0, b.bottom)
  grad.addColorStop(0, ink(t.deep))
  grad.addColorStop(1, ink(t.water))
  ctx.fillStyle = grad
  pondPath(ctx, lobes)
  ctx.fill()

  // Everything inside the water is clipped to it — the shallow shelf runs right
  // up to the rim, and clipping is what keeps it from spilling over.
  ctx.save()
  pondPath(ctx, lobes)
  ctx.clip()
  ctx.fillStyle = ink(t.shallow)
  for (const l of lobes) {
    ctx.beginPath()
    ctx.ellipse(l.cx, l.cy + l.ry * 0.72, l.rx * 0.86, l.ry * 0.42, 0, 0, TAU)
    ctx.fill()
  }
  // Surface glints: a couple of flat strokes catching the light.
  ctx.strokeStyle = ink(t.glint)
  ctx.lineCap = 'round'
  ctx.lineWidth = SCALE * 0.7
  const glints = 2 + Math.floor(j.d * 3)
  for (let i = 0; i < glints; i++) {
    const l = lobes[i % lobes.length]
    const gy = l.cy + (rng() - 0.6) * l.ry * 0.9
    const gx = l.cx + (rng() - 0.5) * l.rx * 0.9
    const len = l.rx * (0.16 + rng() * 0.22)
    ctx.beginPath()
    ctx.moveTo(gx - len / 2, gy)
    ctx.lineTo(gx + len / 2, gy)
    ctx.stroke()
  }
  ctx.restore()

  // Rim: the rocks module's own faceted stones, walked round the waterline at
  // uneven angular steps so they bunch and gap the way a real rim does.
  const stones = form === 0 ? 7 + Math.round(j.d * 3) : 4 + Math.round(j.d * 2)
  const base = rng() * TAU
  const gaps: number[] = []
  let gapTotal = 0
  for (let i = 0; i < stones; i++) {
    const gp = 0.25 + rng() ** 2 * 2
    gaps.push(gp)
    gapTotal += gp
  }
  let acc = 0
  for (let i = 0; i < stones; i++) {
    acc += gaps[i]
    const a = base + (acc / gapTotal) * TAU
    // The inlet keeps its stones off the right-hand lobe — that end is shore.
    if (form === 1 && Math.cos(a) > 0.35) continue
    const l = lobes[form === 1 && Math.cos(a) < 0 ? 0 : lobes.length - 1]
    const spread = 0.96 + rng() * 0.12
    const sx = l.cx + Math.cos(a) * l.rx * spread
    const sy = l.cy + Math.sin(a) * l.ry * spread
    // Big enough to read as a stone at the park's zoom: at PIXEL*0.15 they were
    // gravel scattered on the bank.
    const size = 0.85 + rng() * 0.55
    facetedStone(ctx, {
      cx: sx,
      baseY: sy + SCALE * 1.6 * size,
      w: PIXEL * 0.23 * size,
      h: PIXEL * 0.17 * size,
      rng,
      ink,
      tones: rng() < 0.3 ? SANDSTONE : GRANITE,
      moss: 0.25,
    })
  }

  if (form === 1) {
    // Pebble shore: small stones scattered on the bank at the open end.
    const pebbles = 4 + Math.round(j.d * 3)
    const l = lobes[1]
    for (let i = 0; i < pebbles; i++) {
      const a = (rng() - 0.5) * 1.5
      const rad = 1.02 + rng() * 0.3
      facetedStone(ctx, {
        cx: l.cx + Math.cos(a) * l.rx * rad,
        baseY: l.cy + Math.sin(a) * l.ry * rad + SCALE * 1.4,
        w: PIXEL * (0.09 + rng() * 0.07),
        h: PIXEL * (0.06 + rng() * 0.05),
        rng,
        ink,
        tones: rng() < 0.5 ? SANDSTONE : GRANITE,
        moss: 0.1,
      })
    }
  }

  // Planting: reeds at one end, lily pads floating on the water.
  const left = lobes[0]
  reeds(
    ctx,
    left.cx - left.rx * 0.72,
    left.cy + left.ry * 0.5,
    form === 0 ? 3 + Math.round(j.d * 2) : 4 + Math.round(j.d * 3),
    rng,
    ink,
  )
  const pads = form === 0 ? 2 + Math.round(j.d) : 1 + Math.round(j.d)
  for (let i = 0; i < pads; i++) {
    const l = lobes[i % lobes.length]
    lilyPad(
      ctx,
      l.cx + (rng() - 0.4) * l.rx * 0.7,
      l.cy + (rng() - 0.3) * l.ry * 0.55,
      PIXEL * (0.13 + rng() * 0.07),
      rng,
      ink,
    )
  }
}
