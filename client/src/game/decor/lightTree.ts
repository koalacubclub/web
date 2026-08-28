// The fairy-light tree: the park's own pine, strung with twinkling lamps and
// capped with a gold star.
//
// The tree is NOT drawn here — `../trees/pine.ts` draws it, through the same
// `drawPine` the park's wild pines and the shop's `tree-pine` use. So a
// fairy-light tree is a pine that has been decorated, not a second, rounder
// evergreen that happens to stand next to one; retune the pine and this
// retunes with it.
//
// Placing the lamps needs to know where the foliage actually is, so `pineFrame`
// re-rolls the tree's cone from the same seed the draw uses — apex, base, and
// how far the boughs reach on each side — and the lamps are hung on that.
// Guessing at a cone of our own is what would drift: the lamps would creep off
// the boughs the moment the pine's proportions changed.
//
// The pine goes through `ink` (dark in the park, bright on the shop card); the
// lamps and the star are drawn in raw bright colours, so they glow against the
// night rather than being dimmed into it.

import { PIXEL, SCALE, makeRng } from '../constants'
import { drawPine, pineFrame, pineTaper } from '../trees/pine'
import type { Ctx, LightTreeDrawArgs } from './types'

/**
 * Always the spire build (`../trees/types.ts` form 0) — tall, narrow, seven
 * tight boughs. It's the shape a decorated tree is expected to have, and a
 * fixed build keeps every light tree the same tree with a different scatter of
 * lamps rather than two different pieces sharing a name. Everything else about
 * the pine — height, width, lean, how far each bough reaches — still rolls off
 * the tile, so two of them side by side aren't one stamp twice.
 */
const FORM = 0

/** Offsets the lamp scatter from the tree's own roll, so they don't correlate. */
const LAMP_SALT = 977

/** How many lamps a tree carries. */
const LAMPS = 22

/**
 * How many times the garland wraps the tree between apex and skirt. Around
 * three is what reads as a strung tree: fewer looks like a handful of baubles,
 * many more and the lamps merge into a band of colour.
 */
const TURNS = 3.25

const LAMP_COLORS = ['#FF5A5A', '#FFD93D', '#7CFF9E', '#6EC6FF', '#FF8AD1']

const STAR = '#FFE97A'

export function drawLightTree(
  ctx: Ctx,
  px: number,
  py: number,
  { frameCount, motion, seed, ink }: LightTreeDrawArgs,
) {
  // The park's pine, drawn exactly as the park draws it.
  drawPine(ctx, px, py, { rng: makeRng(seed), form: FORM, ink })

  // The same roll again, this time kept: where that pine's cone ended up.
  const { cx, apexX, topY, baseY, coneH, leftR, rightR } = pineFrame(
    px,
    py,
    makeRng(seed),
    FORM,
  )

  // Lamps, hung as one garland spiralling down from the leader to the skirt.
  // `u` runs 0 (apex) → 1 (skirt); the exponent packs more of them low, where
  // the tree is wide, so the spacing along the wrap stays even instead of
  // crowding at the top.
  const rng = makeRng(seed + LAMP_SALT)
  ctx.save()
  for (let i = 0; i < LAMPS; i++) {
    const u = (i + 0.5) / LAMPS
    const f = (1 - u) ** 1.35 // height up the cone, 0 = base, 1 = leader
    const swing = Math.sin(u * TURNS * Math.PI * 2)
    // Out to where the boughs reach at this height — the two sides differ, so
    // the garland has to ask the side it is currently on.
    const reach = pineTaper(f) * (swing < 0 ? leftR : rightR)
    // Kept inside the reach: individual boughs are drawn a little narrower
    // than the frame's nominal reach, so a lamp sent all the way out would
    // hang off the tree.
    const lx =
      cx + swing * reach * (0.6 + rng() * 0.2) + (rng() - 0.5) * PIXEL * 0.06
    // Just below the bough's midline, where a lamp would hang off the foliage
    // rather than float on top of it.
    const ly = baseY - coneH * f * 0.9 + coneH * (0.05 + rng() * 0.03)
    // `motion` scales how far each lamp swings off its mean, so a tree Koala is
    // nowhere near holds a steady glow rather than going dark or freezing some
    // lamps bright and others out.
    const tw = 0.55 + 0.45 * motion * Math.sin(frameCount * 0.08 + i * 1.7)
    ctx.fillStyle = LAMP_COLORS[i % LAMP_COLORS.length]
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

  // Gold star, sitting on the leader — the pine's apex, wherever the roll put
  // it, so the star caps the tree instead of hovering beside it.
  const sy = topY + SCALE * 0.6
  ctx.save()
  ctx.fillStyle = STAR
  ctx.globalAlpha = 0.22
  ctx.beginPath()
  ctx.arc(apexX, sy, SCALE * 3.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  // Five points: ten vertices alternating between the tip radius and the waist.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2
    const r = k % 2 === 0 ? SCALE * 3.1 : SCALE * 1.3
    const vx = apexX + Math.cos(a) * r
    const vy = sy + Math.sin(a) * r
    if (k === 0) ctx.moveTo(vx, vy)
    else ctx.lineTo(vx, vy)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
