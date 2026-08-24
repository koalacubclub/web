import { COLORS, PIXEL, SCALE, makeRng } from '../constants'
import type { Ctx, LightTreeDrawArgs } from './types'

// A dark evergreen strung with twinkling colored fairy lights + a gold star.
// The foliage/trunk go through the palette (dark in-game), but the lights and
// star are drawn in raw bright colors so they glow against the night.
export function drawLightTree(
  ctx: Ctx,
  px: number,
  py: number,
  { w, frameCount, seed, ink }: LightTreeDrawArgs,
) {
  const cx = px + w / 2
  const cyc = py + PIXEL * 0.85 // canopy centre
  const R = PIXEL * 0.95

  // Trunk.
  ctx.fillStyle = ink(COLORS.treeTrunk)
  ctx.fillRect(cx - PIXEL * 0.14, cyc + R * 0.55, PIXEL * 0.28, PIXEL * 0.7)

  // Dark evergreen canopy (overlapping blobs; two deep-green tones).
  const dark = ink('#2E5E3A')
  const darker = ink('#244B30')
  ctx.fillStyle = darker
  ctx.beginPath()
  ctx.arc(cx, cyc, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = dark
  for (const [dx, dy, r] of [
    [-0.45, 0.2, 0.62],
    [0.45, 0.15, 0.64],
    [0, -0.42, 0.6],
  ] as const) {
    ctx.beginPath()
    ctx.arc(cx + R * dx, cyc + R * dy, R * r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Twinkling colored lights, seeded by tile position (stable placement).
  const lights = ['#FF5A5A', '#FFD93D', '#7CFF9E', '#6EC6FF', '#FF8AD1']
  const rng = makeRng(seed)
  ctx.save()
  for (let i = 0; i < 16; i++) {
    const ang = rng() * Math.PI * 2
    const rad = R * (0.25 + rng() * 0.72)
    const lx = cx + Math.cos(ang) * rad
    const ly = cyc + Math.sin(ang) * rad * 0.95
    const col = lights[i % lights.length]
    const tw = 0.55 + 0.45 * Math.sin(frameCount * 0.08 + i * 1.7)
    ctx.fillStyle = col
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

  // Gold star topper (bright).
  const sy = cyc - R
  ctx.fillStyle = '#FFE97A'
  ctx.beginPath()
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2
    const r = k % 2 === 0 ? SCALE * 2.6 : SCALE * 1.05
    const px = cx + Math.cos(a) * r
    const py = sy + Math.sin(a) * r
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}
