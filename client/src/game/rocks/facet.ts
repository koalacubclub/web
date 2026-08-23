// The faceted stone every rock species is built from. One stone is an angular
// silhouette (never an ellipse — that's what the park draws today) with a lit
// top plane, a shaded flank, a crack or two, and a contact shadow that pins it
// to the ground instead of leaving it floating.

import { SCALE } from '../constants'
import type { Ctx, Ink } from './types'

const TAU = Math.PI * 2

export interface RockTones {
  /** The lit top plane. */
  light: string
  /** The body. */
  mid: string
  /** The shaded flank. */
  dark: string
  moss: string
}

// No drawn lines anywhere in here: the planes are the detail. Cracks and seams
// at this scale read as scratches ON the stone rather than edges OF it.
//
// These are the BRIGHT tones. Their park counterparts are hand-picked in
// parkInk.ts rather than computed — see the note there on why a grading function
// cannot render grey stone.
export const GRANITE: RockTones = {
  light: '#C9C9C9',
  mid: '#9E9E9E',
  dark: '#757575',
  moss: '#5E8F4E',
}

/**
 * A warmer sibling, for variety between neighbours in one arrangement — two
 * stones in a cairn should not look cut from the same block.
 */
export const SANDSTONE: RockTones = {
  light: '#CFC0A6',
  mid: '#B0A088',
  dark: '#877962',
  moss: '#5E8F4E',
}

interface Pt {
  x: number
  y: number
}

export interface StoneOptions {
  /** Centre x and the ground line the stone rests on. */
  cx: number
  baseY: number
  /** Half-width and height of the stone above `baseY`. */
  w: number
  h: number
  rng: () => number
  ink: Ink
  tones?: RockTones
  /** 0–1: how likely moss is to sit on this stone's shoulder. */
  moss?: number
  /** Draw the contact shadow (off for stones stacked on another stone). */
  shadow?: boolean
}

/**
 * One faceted stone. Returns the y of its highest point, so a caller stacking
 * stones knows where the next one sits.
 */
export function facetedStone(ctx: Ctx, opts: StoneOptions): number {
  const {
    cx,
    baseY,
    w,
    h,
    rng,
    ink,
    tones = GRANITE,
    moss = 0.3,
    shadow = true,
  } = opts
  const cy = baseY - h * 0.55

  // Angular silhouette: vertices walked round an ellipse at uneven angles and
  // uneven radii, then anything below the ground line flattened onto it. The
  // angles stay in order so a run of them is always a contiguous arc — facets
  // built from a filtered scatter self-intersect and read as broken glass.
  const n = 7 + Math.floor(rng() * 3)
  const step = TAU / n
  const verts: { p: Pt; a: number }[] = []
  for (let i = 0; i < n; i++) {
    const a = i * step + (rng() - 0.5) * step * 0.5
    const r = 0.74 + rng() * 0.36
    verts.push({
      a,
      p: {
        x: cx + Math.cos(a) * w * r,
        y: Math.min(baseY, cy + Math.sin(a) * h * 0.62 * r),
      },
    })
  }
  const pts = verts.map((v) => v.p)

  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath()
    ctx.ellipse(cx, baseY, w * 1.02, h * 0.12 + SCALE * 0.6, 0, 0, TAU)
    ctx.fill()
  }

  const trace = (list: Pt[]) => {
    ctx.beginPath()
    ctx.moveTo(list[0].x, list[0].y)
    for (let i = 1; i < list.length; i++) ctx.lineTo(list[i].x, list[i].y)
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = ink(tones.mid)
  trace(pts)

  // The seam where the planes turn over, just inside the stone.
  const inner: Pt = { x: cx - w * 0.06, y: cy + h * 0.12 }

  // Lit top plane — the arc above the centre line (canvas y grows downward, so
  // that is sin(a) < 0: one unbroken run between PI and TAU).
  const top = verts.filter((v) => Math.sin(v.a) < -0.1).map((v) => v.p)
  if (top.length >= 2) {
    ctx.fillStyle = ink(tones.light)
    trace([...top, inner])
  }

  // Shaded flank — the arc from the right round to the base, also unbroken.
  const flank = verts
    .filter((v) => Math.sin(v.a) >= -0.1 && Math.cos(v.a) > 0.15)
    .map((v) => v.p)
  if (flank.length >= 2) {
    ctx.fillStyle = ink(tones.dark)
    trace([...flank, inner])
  }

  const peak = pts.reduce((a, b) => (a.y < b.y ? a : b))
  if (rng() < moss) {
    ctx.fillStyle = ink(tones.moss)
    const clumps = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < clumps; i++) {
      ctx.beginPath()
      ctx.ellipse(
        peak.x + (rng() - 0.5) * w * 1.1,
        peak.y + rng() * h * 0.2 + SCALE * 0.4,
        SCALE * (0.9 + rng() * 0.8),
        SCALE * (0.5 + rng() * 0.4),
        0,
        0,
        TAU,
      )
      ctx.fill()
    }
  }

  return peak.y
}
