import { describe, expect, it } from 'vitest'
import { drawShopSprite } from './sprites'
import { COLORS, NIGHT } from './constants'
import { SHOP_ITEMS, SHOP_ITEMS_BY_KEY } from './shopItems'
import { FLOWER_SPECIES } from './flowers'
import { TREE_SPECIES } from './trees'
import { parkInk } from './trees/parkInk'

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
    // The pond's water is a vertical ramp, so the stand-in has to hand back
    // something with addColorStop — and the stops are colours like any other, so
    // they get recorded too or a gradient-only sprite looks colourless here.
    createLinearGradient: () => ({
      addColorStop: (_stop: number, color: unknown) => push(color),
    }),
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

/** Paint a catalog entry by key, on a nameable tile. */
function paintKey(key: string, x = 2, y = 2): string[] {
  const item = SHOP_ITEMS_BY_KEY[key]
  const { ctx, colors } = recorder()
  drawShopSprite(ctx, { type: item.type, key, x, y, w: item.w, h: item.h }, 0, {
    night: true,
  })
  return colors
}

/** Paint a type with NO key, so the tile rolls the species itself. */
function paintUnkeyed(
  type: string,
  w: number,
  h: number,
  x: number,
  y: number,
) {
  const { ctx, colors } = recorder()
  drawShopSprite(ctx, { type, x, y, w, h }, 0, { night: true })
  return colors
}

describe('drawShopSprite night tinting', () => {
  it('tints a placed item (night:true) and leaves the preview bright', () => {
    const dark = paint('stone', 1, 1, true)
    const bright = paint('stone', 1, 1)
    // Park render uses the park palette colour, not the raw bright one.
    expect(dark).toContain(NIGHT.stone)
    expect(dark).not.toContain(COLORS.stone)
    // Preview render uses the raw bright palette colour.
    expect(bright).toContain(COLORS.stone)
    expect(bright).not.toContain(NIGHT.stone)
  })

  it('tints tree foliage for placed decor', () => {
    // Trees are the species art in ./trees, which owns its own bright->park lookup
    // (parkInk) rather than sprites' PARK_INK. Which species tile (2, 2) grows is a
    // property of that module, so pinning one species' canopy hex here would make
    // this test fail the day the species weights are retuned. Assert the mapping
    // itself instead: every bright colour parkInk knows about is gone from the park
    // render, and its park counterpart is there in its place.
    const dark = paint('tree', 2, 2, true)
    const bright = paint('tree', 2, 2)
    expect(bright.length).toBeGreaterThan(0)
    const remapped = bright.filter((c) => parkInk(c) !== c)
    expect(remapped.length).toBeGreaterThan(0)
    for (const c of remapped) {
      expect(dark).not.toContain(c)
      expect(dark).toContain(parkInk(c))
    }
  })

  it('draws drifting music notes only when the radio is playing', () => {
    const NOTE = '#FFE97A' // a bright (un-tinted) note colour
    const idle = recorder()
    drawShopSprite(idle.ctx, { type: 'radio', x: 2, y: 2, w: 2, h: 1 }, 0, {
      night: true,
      playing: false,
    })
    const live = recorder()
    // frameCount chosen so a note is mid-rise (alpha > 0).
    drawShopSprite(live.ctx, { type: 'radio', x: 2, y: 2, w: 2, h: 1 }, 20, {
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

  // Every entry that names a species must name one the art actually has. The
  // catalog lives in the shared protocol, which can't import the client's
  // species unions, so `species` is a bare string there — a typo would fail
  // silently, drawing whatever the tile happened to roll.
  it('names only species the art can draw', () => {
    const known: Record<string, readonly string[]> = {
      tree: TREE_SPECIES,
      flowers: FLOWER_SPECIES,
    }
    for (const item of SHOP_ITEMS) {
      if (item.species == null) continue
      expect(
        known[item.type],
        `${item.key}: no species list for ${item.type}`,
      ).toBeDefined()
      expect(known[item.type], item.key).toContain(item.species)
    }
  })

  it('sells one entry per species, for trees and for flowers', () => {
    for (const [type, all] of [
      ['tree', TREE_SPECIES],
      ['flowers', FLOWER_SPECIES],
    ] as const) {
      const sold = SHOP_ITEMS.filter((i) => i.type === type).map(
        (i) => i.species,
      )
      expect(sold.slice().sort(), type).toEqual(all.slice().sort())
    }
  })

  it('pins the species a shop entry sells, whatever the tile would roll', () => {
    // The same key on wildly different tiles must draw the SAME species. Colour
    // is the tell: a maple's canopy palette shares nothing with a pine's.
    for (const item of SHOP_ITEMS) {
      if (item.species == null) continue
      const here = new Set(paintKey(item.key, 3, 4))
      const there = new Set(paintKey(item.key, 40, 11))
      const shared = [...here].filter((c) => there.has(c))
      expect(
        shared.length,
        `${item.key} shares no colour across tiles`,
      ).toBeGreaterThan(2)
    }
  })

  it('still varies form and jitter between two of the same species', () => {
    // The point of pinning only the species: three maples in a row are three
    // different maples. Same key, different tiles → same palette, different art.
    const a = paintKey('tree-maple', 3, 4)
    const b = paintKey('tree-maple', 40, 11)
    expect(new Set(a)).toEqual(new Set(b)) // same species, so same palette
    expect(a).not.toEqual(b) // but not the same tree
  })

  it('lets an item with no key keep rolling its species from the tile', () => {
    // Base objects, and anything placed before the catalog was split by
    // species, carry no usable key — they must still roll per tile rather than
    // all collapsing onto one species.
    const seen = new Set<string>()
    for (let x = 0; x < 24; x++)
      seen.add(paintUnkeyed('tree', 2, 2, x, 3).join())
    expect(seen.size).toBeGreaterThan(1)
  })

  it('ignores a key the catalog no longer has, rather than throwing', () => {
    const { ctx, colors } = recorder()
    expect(() =>
      drawShopSprite(
        ctx,
        { type: 'tree', key: 'tree', x: 2, y: 2, w: 2, h: 2 },
        0,
        { night: true },
      ),
    ).not.toThrow()
    expect(colors.length).toBeGreaterThan(0)
  })
})
