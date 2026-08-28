import { COLORS, PIXEL, SCALE } from '../constants'
import type { Ctx, Ink, SnowcatDrawArgs } from './types'

// A little snow-cat companion (1×1): snow spheres stacked up, with cat ears.
// How it is stacked is rolled from the tile it sits on, so a given snow-cat is
// always the same one and a pair placed together doesn't read as a copy.
//
//   form 0 — classic: two spheres, tall pointy ears.
//   form 1 — tower:   three spheres, a small head on top, ears to match.
//   form 2 — loaf:    one wide squat body, head sunk into it, round folded
//                     ears and a tail curled round the side.
//
// Nothing about the colours changes with the form, and neither does the piece's
// bob: the rng only ever scales and nudges what a form already draws.

/** How the ears are cut. */
type EarKind = 'pointy' | 'round'

interface Build {
  /** Snowballs bottom-up: centre offset from the tile top, and radii. */
  balls: Array<{ y: number; rx: number; ry: number }>
  /** Head centre, and its radius. */
  headY: number
  headR: number
  ears: EarKind
  /** A tail curled out beside the base. */
  tail: boolean
}

function ball(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

/** One ear, drawn from its base corners — pointy is a triangle, round an arc. */
function ear(
  ctx: Ctx,
  x: number,
  baseY: number,
  tipY: number,
  half: number,
  kind: EarKind,
): void {
  ctx.beginPath()
  if (kind === 'round') {
    // A folded ear: a low arc that sits on the head rather than spiking off it.
    ctx.moveTo(x - half, baseY)
    ctx.quadraticCurveTo(x - half * 0.9, tipY, x, tipY)
    ctx.quadraticCurveTo(x + half * 0.9, tipY, x + half, baseY)
  } else {
    ctx.moveTo(x - half, baseY)
    ctx.lineTo(x, tipY)
    ctx.lineTo(x + half, baseY)
  }
  ctx.closePath()
  ctx.fill()
}

/** The ear pair: white outer, pink inner, mirrored about `cx`. */
function drawEars(
  ctx: Ctx,
  cx: number,
  hy: number,
  headR: number,
  kind: EarKind,
  ink: Ink,
): void {
  const out = headR * 0.55 // how far the ears sit off the head's centre line
  const half = headR * 0.44
  const baseY = hy - headR * 0.6
  const tipY = hy - headR * (kind === 'round' ? 1.15 : 1.62)
  for (const side of [-1, 1]) {
    ctx.fillStyle = ink(COLORS.white)
    ear(ctx, cx + side * out, baseY, tipY, half, kind)
    ctx.fillStyle = ink(COLORS.heart)
    ear(
      ctx,
      cx + side * out,
      baseY - headR * 0.05,
      tipY + (baseY - tipY) * 0.3,
      half * 0.5,
      kind,
    )
  }
}

export function drawSnowcat(
  ctx: Ctx,
  px: number,
  py: number,
  { frameCount, motion, rng, form, ink }: SnowcatDrawArgs,
): void {
  const s = SCALE
  // `motion` scales the bob rather than the clock: a snow-cat Koala has walked
  // away from sinks back onto the snow instead of freezing mid-hover.
  const bob = Math.sin(frameCount * 0.04) * s * 0.3 * motion
  // Narrow rolls: a snow-cat is a snow-cat, only rounder or leaner.
  const plump = 0.94 + rng() * 0.14
  const lift = 0.96 + rng() * 0.09
  const cx = px + PIXEL * 0.5 + (rng() - 0.5) * PIXEL * 0.05

  let b: Build
  switch (form) {
    case 1: // tower
      // Stacked to stand a good head taller than the classic — the ears clear
      // the top of the tile, the way the light tree's canopy does.
      b = {
        balls: [
          { y: 0.75, rx: 0.26, ry: 0.22 },
          { y: 0.48, rx: 0.2, ry: 0.2 },
        ],
        headY: 0.21,
        headR: 0.17,
        ears: 'pointy',
        tail: false,
      }
      break
    case 2: // loaf
      b = {
        balls: [{ y: 0.74, rx: 0.36, ry: 0.26 }],
        headY: 0.42,
        headR: 0.24,
        ears: 'round',
        tail: true,
      }
      break
    default: // classic
      b = {
        balls: [{ y: 0.68, rx: 0.3, ry: 0.3 }],
        headY: 0.36,
        headR: 0.22,
        ears: 'pointy',
        tail: false,
      }
  }

  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.ellipse(
    cx,
    py + PIXEL * 0.92,
    PIXEL * 0.32 * plump,
    PIXEL * 0.08,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.fillStyle = ink(COLORS.white)
  if (b.tail) {
    // A stubby tail curled out from behind the base, drawn first so the body
    // laps over where it joins.
    const base = b.balls[0]
    ctx.beginPath()
    ctx.ellipse(
      cx + PIXEL * (base.rx * plump + 0.06),
      py + PIXEL * (base.y * lift + 0.04),
      PIXEL * 0.13,
      PIXEL * 0.07,
      -0.7,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  for (const bl of b.balls) {
    ball(
      ctx,
      cx,
      py + PIXEL * bl.y * lift + bob,
      PIXEL * bl.rx * plump,
      PIXEL * bl.ry,
    )
  }

  const headR = PIXEL * b.headR * plump
  const hy = py + PIXEL * b.headY * lift + bob
  ball(ctx, cx, hy, headR, headR)

  drawEars(ctx, cx, hy, headR, b.ears, ink)

  ctx.fillStyle = ink(COLORS.charcoal)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(
      cx + side * headR * 0.36,
      hy - headR * 0.09,
      s * 0.7,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.fillStyle = ink(COLORS.fishBowl)
  ctx.beginPath()
  ctx.moveTo(cx, hy + headR * 0.09)
  ctx.lineTo(cx + headR * 0.41, hy + headR * 0.23)
  ctx.lineTo(cx, hy + headR * 0.36)
  ctx.closePath()
  ctx.fill()
}
