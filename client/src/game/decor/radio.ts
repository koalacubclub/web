import { PIXEL, SCALE } from '../constants'
import { drawNote } from './note'
import type { Ctx, RadioDrawArgs } from './types'

// A retro boombox (2×1): a wide rounded body with two big grille speakers, a
// cassette-deck console between them, a carry handle and a stubby antenna. Sized
// from the tile so it fills its footprint. When `playing` (a koala is near) the
// speaker cones pulse and little notes drift up out of it.
export function drawRadio(
  ctx: Ctx,
  px: number,
  py: number,
  { w, frameCount, playing, ink }: RadioDrawArgs,
) {
  const W = w
  const cx = px + W * 0.5
  const s = SCALE

  const bx = px + W * 0.07
  const bw = W * 0.86
  const by = py + PIXEL * 0.34
  const bh = PIXEL * 0.56

  // Ground shadow (spans the wide body).
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.beginPath()
  ctx.ellipse(cx, py + PIXEL * 0.94, bw * 0.5, PIXEL * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()

  // Carry handle (a semicircular arch whose two ends land on the body's top
  // edge) + antenna, both behind the body so the shell covers where they join.
  ctx.strokeStyle = ink('#6E6E6E')
  ctx.lineWidth = s * 1.3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, by, bw * 0.2, Math.PI, Math.PI * 2)
  ctx.stroke()
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(bx + bw * 0.9, by)
  ctx.lineTo(bx + bw * 1.0, by - PIXEL * 0.42)
  ctx.stroke()
  ctx.fillStyle = ink('#C9C9C9')
  ctx.beginPath()
  ctx.arc(bx + bw * 1.0, by - PIXEL * 0.42, s, 0, Math.PI * 2)
  ctx.fill()

  // Body shell.
  ctx.fillStyle = ink('#C0554B')
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, s * 1.8)
  ctx.fill()
  ctx.fillStyle = ink('#8E3E37')
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh * 0.2, s * 1.8)
  ctx.fill()

  // Two big grille speakers with cones that pulse while playing.
  const spY = by + bh * 0.56
  const spR = bh * 0.36
  const pulse = playing ? 1 + Math.sin(frameCount * 0.35) * 0.14 : 1
  for (const fx of [0.2, 0.8]) {
    const sxp = bx + bw * fx
    ctx.fillStyle = ink('#2E2E2E')
    ctx.beginPath()
    ctx.arc(sxp, spY, spR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink('#4A4A4A')
    ctx.beginPath()
    ctx.arc(sxp, spY, spR * 0.62 * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink('#6E6E6E')
    ctx.beginPath()
    ctx.arc(sxp, spY, spR * 0.24 * pulse, 0, Math.PI * 2)
    ctx.fill()
  }

  // Centre cassette-deck console.
  const cw = bw * 0.3
  const cx0 = cx - cw / 2
  const cy0 = by + bh * 0.2
  const ch = bh * 0.44
  ctx.fillStyle = ink('#3A2E2C')
  ctx.beginPath()
  ctx.roundRect(cx0, cy0, cw, ch, s * 0.8)
  ctx.fill()
  ctx.fillStyle = ink('#E8C9A0') // tape window
  ctx.beginPath()
  ctx.roundRect(cx0 + cw * 0.14, cy0 + ch * 0.16, cw * 0.72, ch * 0.44, s * 0.5)
  ctx.fill()
  ctx.fillStyle = ink('#8E3E37') // two reels
  ctx.beginPath()
  ctx.arc(cx0 + cw * 0.34, cy0 + ch * 0.38, s * 0.9, 0, Math.PI * 2)
  ctx.arc(cx0 + cw * 0.66, cy0 + ch * 0.38, s * 0.9, 0, Math.PI * 2)
  ctx.fill()
  // Button row beneath the tape window.
  ctx.fillStyle = ink('#E8C9A0')
  for (const bf of [0.28, 0.5, 0.72]) {
    ctx.beginPath()
    ctx.arc(cx0 + cw * bf, cy0 + ch * 0.82, s * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }

  if (!playing) return

  // Music notes drifting up out of the deck (bright, so they glow).
  const noteCols = ['#FFE97A', '#7CFF9E', '#6EC6FF']
  for (let i = 0; i < 3; i++) {
    const phase = (((frameCount * 0.012 + i / 3) % 1) + 1) % 1
    const alpha = Math.sin(phase * Math.PI)
    if (alpha <= 0.02) continue
    const nx =
      cx + Math.sin(frameCount * 0.05 + i * 2) * W * 0.12 + (i - 1) * s * 2
    const ny = by - phase * PIXEL * 0.9
    ctx.save()
    ctx.globalAlpha *= alpha
    drawNote(ctx, nx, ny, s * 1.6, noteCols[i % noteCols.length])
    ctx.restore()
  }
}
