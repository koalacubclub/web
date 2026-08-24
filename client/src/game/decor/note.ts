import type { Ctx } from './types'

// A single music note (head + stem + flag), drawn in a raw bright colour so it
// glows against the night like the fairy lights. Used by the radio when playing.
export function drawNote(
  ctx: Ctx,
  nx: number,
  ny: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(nx, ny, size * 0.6, size * 0.45, -0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(nx + size * 0.45, ny - size * 1.9, size * 0.28, size * 1.9)
  ctx.beginPath()
  ctx.moveTo(nx + size * 0.73, ny - size * 1.9)
  ctx.quadraticCurveTo(
    nx + size * 1.5,
    ny - size * 1.5,
    nx + size * 0.73,
    ny - size * 0.8,
  )
  ctx.fill()
}
