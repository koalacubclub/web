import { describe, expect, it } from 'vitest'
import { drawShopSprite } from './sprites'
import { COLORS, night } from './constants'
import { SHOP_ITEMS } from './shopItems'

// A minimal CanvasRenderingContext2D stand-in that records every colour assigned
// to fillStyle / strokeStyle (and no-ops the actual drawing) so we can assert how
// a sprite is coloured without a real canvas.
function recorder() {
  const colors: string[] = []
  const noop = () => {}
  const ctx = {
    beginPath: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fillRect: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    roundRect: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    clip: noop,
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
  } as unknown as CanvasRenderingContext2D & { _c: string[] }
  const push = (v: unknown) => {
    if (typeof v === 'string') colors.push(v)
  }
  Object.defineProperty(ctx, 'fillStyle', { get: () => '', set: push })
  Object.defineProperty(ctx, 'strokeStyle', { get: () => '', set: push })
  return { ctx, colors }
}

function paint(type: string, w: number, h: number, night?: boolean): string[] {
  const { ctx, colors } = recorder()
  drawShopSprite(ctx, { type, x: 2, y: 2, w, h }, 0, night ? { night } : {})
  return colors
}

describe('drawShopSprite night tinting', () => {
  it('tints a placed item (night:true) and leaves the preview bright', () => {
    const dark = paint('stone', 1, 1, true)
    const bright = paint('stone', 1, 1)
    // Night render uses the baked colour, not the raw palette one.
    expect(dark).toContain(night(COLORS.stone))
    expect(dark).not.toContain(COLORS.stone)
    // Preview render uses the raw bright palette colour.
    expect(bright).toContain(COLORS.stone)
    expect(bright).not.toContain(night(COLORS.stone))
  })

  it('tints tree foliage for placed decor', () => {
    const dark = paint('tree', 2, 2, true)
    expect(dark).toContain(night(COLORS.treeLeaves))
    expect(dark).not.toContain(COLORS.treeLeaves)
  })

  it('draws drifting music notes only when the radio is playing', () => {
    const NOTE = '#FFE97A' // a bright (un-tinted) note colour
    const idle = recorder()
    drawShopSprite(idle.ctx, { type: 'radio', x: 2, y: 2, w: 1, h: 1 }, 0, {
      night: true,
      playing: false,
    })
    const live = recorder()
    // frameCount chosen so a note is mid-rise (alpha > 0).
    drawShopSprite(live.ctx, { type: 'radio', x: 2, y: 2, w: 1, h: 1 }, 20, {
      night: true,
      playing: true,
    })
    expect(idle.colors).not.toContain(NOTE)
    expect(live.colors).toContain(NOTE)
  })

  it('renders every catalog item differently in night vs preview mode', () => {
    for (const item of SHOP_ITEMS) {
      const dark = paint(item.type, item.w, item.h, true)
      const bright = paint(item.type, item.w, item.h)
      expect(dark.length, `${item.key} produced no colours`).toBeGreaterThan(0)
      // Each item has at least one palette-driven colour, so night ≠ preview.
      expect(dark, `${item.key} not tinted in night mode`).not.toEqual(bright)
    }
  })
})
