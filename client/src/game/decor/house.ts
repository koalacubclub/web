import { COLORS, PIXEL, SCALE } from '../constants'
import type { Ctx, DrawArgs } from './types'

// A simple grey cedar-shingle cottage (Cape Cod): low gable roof with white
// rake/eave trim, a brick chimney, white-cased windows, and a pale front door.
// Fills its footprint (sized from the tile), so it scales with the catalog.
export function drawHouse(
  ctx: Ctx,
  px: number,
  py: number,
  { w, h, ink }: DrawArgs,
) {
  const W = w
  const H = h

  // Near-neutral white (low saturation) so the night grade's whiteness recovery
  // keeps it bright — the casings/trim pop like the other objects' whites.
  const trim = ink('#EFEFEE')
  const wall = ink('#8C9096')
  const wallLine = ink('#767A80')
  const roof = ink('#A6A29A')
  const roofLine = ink('#8C877E')
  // Windows glow: a warm lit pane drawn in a raw bright colour (not through INK),
  // so it stays lit against the night-tinted house — "someone's home".
  const glass = '#FFE39A'
  const door = ink('#E2D896')
  const brick = ink('#A5503F')

  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.beginPath()
  ctx.ellipse(
    px + W / 2,
    py + H * 0.96,
    W * 0.42,
    PIXEL * 0.14,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  const wallX = px + W * 0.1
  const wallW = W * 0.8
  const wallY = py + H * 0.44
  const wallH = py + H * 0.95 - wallY
  const eaveY = py + H * 0.46
  const ridgeX = px + W * 0.5
  const ridgeY = py + H * 0.08
  const roofL = px + W * 0.02
  const roofR = px + W * 0.98

  const chimX = px + W * 0.34
  const chimW = W * 0.08
  ctx.fillStyle = brick
  ctx.fillRect(chimX, py + H * 0.02, chimW, H * 0.26)
  ctx.fillStyle = ink(COLORS.charcoal)
  ctx.fillRect(chimX - W * 0.01, py + H * 0.02, chimW + W * 0.02, H * 0.03)

  ctx.fillStyle = wall
  ctx.fillRect(wallX, wallY, wallW, wallH)
  ctx.strokeStyle = wallLine
  ctx.lineWidth = SCALE * 0.3
  for (let i = 1; i < 5; i++) {
    const cy = wallY + (wallH / 5) * i
    ctx.beginPath()
    ctx.moveTo(wallX, cy)
    ctx.lineTo(wallX + wallW, cy)
    ctx.stroke()
  }

  const winW = W * 0.12
  const winH = wallH * 0.4
  const winY = wallY + wallH * 0.16
  for (const fx of [0.26, 0.42, 0.74]) {
    const wx = px + W * fx - winW / 2
    // Soft warm glow spilling from the lit window.
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.fillStyle = glass
    ctx.fillRect(
      wx - SCALE * 2.5,
      winY - SCALE * 2.5,
      winW + SCALE * 5,
      winH + SCALE * 5,
    )
    ctx.restore()
    ctx.fillStyle = trim
    ctx.fillRect(wx - SCALE, winY - SCALE, winW + SCALE * 2, winH + SCALE * 2)
    ctx.fillStyle = glass
    ctx.fillRect(wx, winY, winW, winH)
    ctx.strokeStyle = trim
    ctx.lineWidth = SCALE * 0.5
    ctx.beginPath()
    ctx.moveTo(wx + winW / 2, winY)
    ctx.lineTo(wx + winW / 2, winY + winH)
    ctx.moveTo(wx, winY + winH / 2)
    ctx.lineTo(wx + winW, winY + winH / 2)
    ctx.stroke()
  }

  const doorW = W * 0.1
  const doorH = wallH * 0.55
  const doorX = px + W * 0.56 - doorW / 2
  const doorY = wallY + wallH - doorH
  ctx.fillStyle = trim
  ctx.fillRect(
    doorX - SCALE * 1.4,
    doorY - SCALE * 1.4,
    doorW + SCALE * 2.8,
    doorH + SCALE * 1.4,
  )
  ctx.fillStyle = door
  ctx.fillRect(doorX, doorY, doorW, doorH)
  ctx.fillStyle = ink(COLORS.charcoal)
  ctx.beginPath()
  ctx.arc(doorX + doorW * 0.8, doorY + doorH * 0.5, SCALE * 0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = roof
  ctx.beginPath()
  ctx.moveTo(roofL, eaveY)
  ctx.lineTo(ridgeX, ridgeY)
  ctx.lineTo(roofR, eaveY)
  ctx.closePath()
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = roofLine
  ctx.lineWidth = SCALE * 0.3
  for (let i = 1; i < 4; i++) {
    const cy = eaveY + ((ridgeY - eaveY) / 4) * i
    ctx.beginPath()
    ctx.moveTo(roofL, cy)
    ctx.lineTo(roofR, cy)
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = trim
  ctx.lineWidth = SCALE * 0.9
  ctx.beginPath()
  ctx.moveTo(roofL, eaveY)
  ctx.lineTo(ridgeX, ridgeY)
  ctx.lineTo(roofR, eaveY)
  ctx.stroke()
  ctx.fillStyle = trim
  ctx.fillRect(
    wallX - W * 0.04,
    eaveY - SCALE * 0.7,
    wallW + W * 0.08,
    SCALE * 1.6,
  )
}
