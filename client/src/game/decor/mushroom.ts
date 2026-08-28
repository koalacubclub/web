// A red-capped mushroom with a white stem (1×1). The cap is what varies: which
// of four builds a mushroom grows is rolled from the tile it stands on, so a
// given spot is always the same mushroom, and two placed side by side rarely
// match.
//
//   form 0 — button:  the classic domed toadstool, two fat spots.
//   form 1 — parasol: a wide flat cap on a tall thin stem, underside showing.
//   form 2 — bell:    a tall narrow cap hunched over a leaning stem.
//   form 3 — cluster: three little ones sharing the tile.
//
// The colours don't change with the form — the same red cap and white stem
// throughout — and neither does the element COUNT within a form: the seeded rng
// only ever scales and nudges, so a mushroom is the same drawing wherever it
// stands, just a slightly different one.

import { COLORS, PIXEL, SCALE } from '../constants'
import type { Ctx, Ink, MushroomDrawArgs } from './types'

const CAP = '#FF6B6B'

/** How the cap's outline is drawn. */
type CapKind = 'dome' | 'flat' | 'bell'

interface Build {
  /** Cap half-width and height, in logical px. */
  capR: number
  capH: number
  /** Stem height above the foot, and its width. */
  stemH: number
  stemW: number
  /** How far the stem's top leans off its foot. */
  bend: number
  kind: CapKind
  /** Spots across the cap. Fixed per form — the rng only sizes them. */
  spots: number
}

/** The stem: a tapered column, curved when the build leans. */
function drawStem(ctx: Ctx, cx: number, foot: number, b: Build): void {
  const topX = cx + b.bend
  const topY = foot - b.stemH
  const half = b.stemW * 0.5
  const waist = (foot + topY) / 2
  ctx.beginPath()
  ctx.moveTo(cx - half, foot)
  ctx.quadraticCurveTo(cx - half + b.bend * 0.5, waist, topX - half * 0.8, topY)
  ctx.lineTo(topX + half * 0.8, topY)
  ctx.quadraticCurveTo(cx + half + b.bend * 0.5, waist, cx + half, foot)
  ctx.closePath()
  ctx.fill()
}

/** The cap, sitting with its rim on (cx, rimY). */
function drawCap(ctx: Ctx, cx: number, rimY: number, b: Build): void {
  const { capR: r, capH: h } = b
  ctx.beginPath()
  if (b.kind === 'bell') {
    // Tall and narrow, shoulders tucked in — a shape that reads as a different
    // species rather than a smaller toadstool.
    ctx.moveTo(cx - r, rimY)
    ctx.quadraticCurveTo(cx - r * 1.05, rimY - h * 0.6, cx, rimY - h)
    ctx.quadraticCurveTo(cx + r * 1.05, rimY - h * 0.6, cx + r, rimY)
    ctx.quadraticCurveTo(cx, rimY + h * 0.1, cx - r, rimY)
  } else if (b.kind === 'flat') {
    // A wide plate with the rim turned down, and a shallow underside so the
    // cap has a bottom edge to it rather than sitting on nothing.
    ctx.moveTo(cx - r, rimY)
    ctx.quadraticCurveTo(cx - r * 0.5, rimY - h * 1.6, cx, rimY - h)
    ctx.quadraticCurveTo(cx + r * 0.5, rimY - h * 1.6, cx + r, rimY)
    ctx.quadraticCurveTo(cx, rimY + h * 0.6, cx - r, rimY)
  } else {
    ctx.ellipse(cx, rimY, r, h, 0, Math.PI, 0)
  }
  ctx.closePath()
  ctx.fill()
}

/** One whole mushroom: stem, cap, spots. */
function drawShroom(
  ctx: Ctx,
  cx: number,
  foot: number,
  b: Build,
  ink: Ink,
  rng: () => number,
): void {
  const white = ink(COLORS.white)
  const rimY = foot - b.stemH + b.capH * 0.12
  const capX = cx + b.bend

  ctx.fillStyle = white // white stem, pops like the spots + other whites
  drawStem(ctx, cx, foot, b)

  ctx.fillStyle = ink(CAP)
  drawCap(ctx, capX, rimY, b)

  // The parasol shows its underside: a sliver of white along the rim, which is
  // the gill line read at this size.
  if (b.kind === 'flat') {
    ctx.fillStyle = white
    ctx.beginPath()
    ctx.ellipse(capX, rimY, b.capR * 0.78, b.capH * 0.22, 0, 0, Math.PI)
    ctx.fill()
  }

  ctx.fillStyle = white
  for (let i = 0; i < b.spots; i++) {
    const f = b.spots === 1 ? 0.5 : i / (b.spots - 1)
    const sx = capX + (f - 0.5) * b.capR * 1.15
    const arch = 1 - Math.abs(f - 0.5) * 1.2 // spots follow the cap's curve
    const sy = rimY - b.capH * (0.3 + arch * 0.36)
    ctx.beginPath()
    ctx.arc(sx, sy, SCALE * (0.62 + rng() * 0.42), 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawMushroom(
  ctx: Ctx,
  px: number,
  py: number,
  { rng, form, ink }: MushroomDrawArgs,
): void {
  const foot = py + PIXEL * 0.9
  // Deliberately narrow: a mushroom twice its neighbour's size reads as a
  // mistake, where a differently shaped cap reads as a different mushroom.
  const w = 0.88 + rng() * 0.26
  const h = 0.86 + rng() * 0.3
  const cx = px + PIXEL * 0.5 + (rng() - 0.5) * PIXEL * 0.1
  const tilt = (rng() - 0.5) * PIXEL * 0.12

  switch (form) {
    case 1: // parasol
      drawShroom(
        ctx,
        cx,
        foot,
        {
          capR: PIXEL * 0.44 * w,
          capH: PIXEL * 0.17 * h,
          stemH: PIXEL * 0.58 * h,
          stemW: PIXEL * 0.16,
          bend: tilt * 0.5,
          kind: 'flat',
          spots: 3,
        },
        ink,
        rng,
      )
      break
    case 2: // bell
      drawShroom(
        ctx,
        cx,
        foot,
        {
          capR: PIXEL * 0.21 * w,
          capH: PIXEL * 0.5 * h,
          stemH: PIXEL * 0.32 * h,
          stemW: PIXEL * 0.15,
          bend: tilt,
          kind: 'bell',
          spots: 2,
        },
        ink,
        rng,
      )
      break
    case 3: {
      // A cluster: one grown one with two smaller ones crowding it. Drawn
      // back-to-front so the tallest overlaps the pair at its feet.
      const small = (scale: number, lean: number, spots: number): Build => ({
        capR: PIXEL * 0.19 * w * scale,
        capH: PIXEL * 0.16 * h * scale,
        stemH: PIXEL * 0.26 * h * scale,
        stemW: PIXEL * 0.1 * scale,
        bend: PIXEL * 0.02 * lean,
        kind: 'dome',
        spots,
      })
      drawShroom(
        ctx,
        cx + PIXEL * 0.3,
        foot - PIXEL * 0.02,
        small(1, 1, 2),
        ink,
        rng,
      )
      drawShroom(ctx, cx - PIXEL * 0.3, foot, small(0.8, -1, 1), ink, rng)
      drawShroom(
        ctx,
        cx - PIXEL * 0.02,
        foot - PIXEL * 0.01,
        {
          capR: PIXEL * 0.24 * w,
          capH: PIXEL * 0.22 * h,
          stemH: PIXEL * 0.38 * h,
          stemW: PIXEL * 0.15,
          bend: tilt * 0.4,
          kind: 'dome',
          spots: 2,
        },
        ink,
        rng,
      )
      break
    }
    default: // button — the mushroom this piece has always been
      drawShroom(
        ctx,
        cx,
        foot,
        {
          capR: PIXEL * 0.35 * w,
          capH: PIXEL * 0.3 * h,
          stemH: PIXEL * 0.42 * h,
          stemW: PIXEL * 0.28,
          bend: tilt * 0.3,
          kind: 'dome',
          spots: 2,
        },
        ink,
        rng,
      )
  }
}
