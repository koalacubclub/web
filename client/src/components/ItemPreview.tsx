import { useEffect, useRef } from 'react'
import { PIXEL } from '@/game/constants'
import { drawShopSprite } from '@/game/sprites'
import type { ShopItem } from '@/game/shopItems'

// Renders a shop item as its REAL procedural art (the same code the game uses)
// on a small canvas, sized to the item's true footprint so differently-sized
// items show at real relative scale (a 4×4 house is visibly bigger than a 1×1
// flower). Static single frame (frameCount 0, no `now` → no pop-in/blink).

const PREVIEW_TILE_PX = 28 // css px per tile in the shop
// Tight margins around the footprint; a little extra on top so art that
// overhangs its tile box (e.g. tree leaves) isn't clipped.
const PAD_X = PIXEL * 0.08
const PAD_TOP = PIXEL * 0.32
const PAD_BOTTOM = PIXEL * 0.06

export default function ItemPreview({ item }: { item: ShopItem }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const logicalW = item.w * PIXEL + PAD_X * 2
  const logicalH = item.h * PIXEL + PAD_TOP + PAD_BOTTOM
  const cssW = (logicalW / PIXEL) * PREVIEW_TILE_PX
  const cssH = (logicalH / PIXEL) * PREVIEW_TILE_PX

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / unsupported — the element still renders for a11y
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(logicalW * dpr)
    canvas.height = Math.round(logicalH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, logicalW, logicalH)
    ctx.imageSmoothingEnabled = true
    ctx.translate(PAD_X, PAD_TOP)
    drawShopSprite(
      ctx,
      { type: item.type, x: 0, y: 0, w: item.w, h: item.h },
      0,
    )
  }, [item, logicalW, logicalH])

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={item.label}
      style={{ width: `${cssW}px`, height: `${cssH}px` }}
    />
  )
}
