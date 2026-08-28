import { useEffect, useMemo, useRef } from 'react'
import { PIXEL } from '@/game/constants'
import { drawShopSprite } from '@/game/sprites'
import type { ShopItem } from '@/game/shopItems'

// Renders a shop item as its REAL procedural art (the same code the game uses)
// on a small canvas, sized so differently-sized items show at real relative
// scale (a 4×4 house is visibly bigger than a 1×1 flower). Static single frame
// (frameCount 0, no `now` → no pop-in/blink).

const PREVIEW_TILE_PX = 28 // css px per tile in the shop

// The box is MEASURED from the art, not padded by a guess.
//
// Art routinely draws outside its tile footprint — a tree's canopy spreads well
// above and beside the 2×2 it occupies. This used to be handled with three
// fixed pads, and the trees outgrew them: every one of the five species was
// having its crown clipped flat, the maple worst of all, overhanging the top by
// 1.25 tiles against a pad of 0.32. Raising the pads is not the fix either,
// since one number has to serve every item and 1.3 tiles of headroom would
// leave a 1×1 flower adrift in a box two and a half times its own height.
//
// So each item is drawn once into a deliberately oversized scratch canvas, its
// ink is measured, and the preview is sized to what it found. Art can change
// freely without anyone remembering to retune a constant.

/** How much room the scratch canvas leaves around the footprint, in tiles. */
const SCRATCH_MARGIN = 2
/** A little air so nothing sits flush against the canvas edge, in tiles. */
const BREATHING = 0.06

/** The art's extent in TILE units, relative to the footprint's top-left. */
interface ArtBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

const footprintBox = (item: ShopItem): ArtBox => ({
  x0: 0,
  y0: 0,
  x1: item.w,
  y1: item.h,
})

// Measured once per catalog key: the art is deterministic for a given key, so
// this never needs redoing (and there are ~20 items, drawn once each).
const boxCache = new Map<string, ArtBox>()

function measureArt(item: ShopItem): ArtBox {
  const cached = boxCache.get(item.key)
  if (cached) return cached
  const fallback = footprintBox(item)
  if (typeof document === 'undefined') return fallback // SSR
  const scratch = document.createElement('canvas')
  const m = SCRATCH_MARGIN * PIXEL
  scratch.width = item.w * PIXEL + m * 2
  scratch.height = item.h * PIXEL + m * 2
  const sctx = scratch.getContext('2d')
  if (!sctx) return fallback // jsdom / unsupported
  sctx.translate(m, m)
  drawShopSprite(
    sctx,
    { type: item.type, key: item.key, x: 0, y: 0, w: item.w, h: item.h },
    0,
  )
  const { data } = sctx.getImageData(0, 0, scratch.width, scratch.height)
  let top = -1
  let bottom = -1
  let left = -1
  let right = -1
  for (let y = 0; y < scratch.height; y++) {
    for (let x = 0; x < scratch.width; x++) {
      // Alpha 8 rather than 0: soft shadows fade to nothing at their edge, and
      // measuring to the last near-invisible pixel pads the box with haze.
      if (data[(y * scratch.width + x) * 4 + 3] <= 8) continue
      if (top < 0) top = y
      bottom = y
      if (left < 0 || x < left) left = x
      if (x > right) right = x
    }
  }
  if (right < 0) return fallback // drew nothing (an unknown type)
  const box: ArtBox = {
    x0: (left - m) / PIXEL - BREATHING,
    y0: (top - m) / PIXEL - BREATHING,
    x1: (right + 1 - m) / PIXEL + BREATHING,
    y1: (bottom + 1 - m) / PIXEL + BREATHING,
  }
  boxCache.set(item.key, box)
  return box
}

export default function ItemPreview({ item }: { item: ShopItem }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const box = useMemo(() => measureArt(item), [item])
  const logicalW = (box.x1 - box.x0) * PIXEL
  const logicalH = (box.y1 - box.y0) * PIXEL
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
    // Shift the footprint origin so the measured box starts at (0, 0).
    ctx.translate(-box.x0 * PIXEL, -box.y0 * PIXEL)
    // `key` matters: it's what tells the sprite which species this entry sells,
    // so the maple in the shop is the maple you get.
    drawShopSprite(
      ctx,
      { type: item.type, key: item.key, x: 0, y: 0, w: item.w, h: item.h },
      0,
    )
  }, [item, box, logicalW, logicalH])

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={item.label}
      style={{ width: `${cssW}px`, height: `${cssH}px` }}
    />
  )
}
