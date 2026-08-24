import { describe, expect, it } from 'vitest'
import { COLORS, NIGHT } from '../constants'
import { drawDecor, isDecor, parkInk, type DecorType } from './index'

const FOOTPRINT: Record<DecorType, { w: number; h: number }> = {
  ball: { w: 1, h: 1 },
  mushroom: { w: 1, h: 1 },
  snowcat: { w: 1, h: 1 },
  cardbox: { w: 2, h: 1 },
  house: { w: 4, h: 3 },
  lighttree: { w: 2, h: 2 },
  radio: { w: 2, h: 1 },
}

const ALL = Object.keys(FOOTPRINT) as DecorType[]

function recorder() {
  const calls: string[] = []
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(
        name +
          '(' +
          args
            .map((a) => (typeof a === 'number' ? a.toFixed(2) : String(a)))
            .join(',') +
          ')',
      )
    }
  const ctx = {
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    fill: record('fill'),
    stroke: record('stroke'),
    clip: record('clip'),
    arc: record('arc'),
    ellipse: record('ellipse'),
    fillRect: record('fillRect'),
    roundRect: record('roundRect'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    save: record('save'),
    restore: record('restore'),
    lineWidth: 1,
    lineCap: 'butt',
  } as unknown as CanvasRenderingContext2D
  const push = (v: unknown) => calls.push('color(' + String(v) + ')')
  Object.defineProperty(ctx, 'fillStyle', { get: () => '', set: push })
  Object.defineProperty(ctx, 'strokeStyle', { get: () => '', set: push })
  // A real backing field, not a stub: the twinkling lights and the drifting
  // notes say nothing else per frame — alpha IS their animation — and the radio
  // reads it back (`globalAlpha *= alpha`), so a fixed getter would lie.
  let alpha = 1
  Object.defineProperty(ctx, 'globalAlpha', {
    get: () => alpha,
    set: (v: number) => {
      alpha = v
      calls.push('alpha(' + v.toFixed(3) + ')')
    },
  })
  return { ctx, calls }
}

function paint(
  type: DecorType,
  opts: {
    x?: number
    y?: number
    park?: boolean
    frameCount?: number
    playing?: boolean
  } = {},
): string[] {
  const { ctx, calls } = recorder()
  drawDecor(
    ctx,
    type,
    { x: opts.x ?? 3, y: opts.y ?? 4, ...FOOTPRINT[type] },
    {
      ink: opts.park ? parkInk : undefined,
      frameCount: opts.frameCount ?? 0,
      playing: opts.playing,
    },
  )
  return calls
}

const colours = (calls: string[]) =>
  calls.filter((c) => c.startsWith('color(')).map((c) => c.slice(6, -1))

/** A call list with every number stripped — the shape, independent of position. */
const shape = (calls: string[]) =>
  calls.map((c) => c.replace(/-?\d+\.\d+/g, '#'))

describe('decor', () => {
  it('draws every type it claims to', () => {
    for (const type of ALL) {
      expect(isDecor(type), type).toBe(true)
      expect(paint(type).length, type).toBeGreaterThan(0)
    }
  })

  it('draws nothing for a type it does not own', () => {
    expect(isDecor('tree')).toBe(false)
    expect(paint('tree' as DecorType)).toEqual([])
  })

  it('is deterministic — the same tile paints the same thing twice', () => {
    for (const type of ALL) {
      expect(paint(type), type).toEqual(paint(type))
    }
  })

  it('moves with its tile without changing shape', () => {
    for (const type of ALL) {
      const here = paint(type, { x: 3, y: 4 })
      const there = paint(type, { x: 21, y: 9 })
      expect(shape(there), type).toEqual(shape(here))
      expect(there, type).not.toEqual(here)
    }
  })

  it('gives the light tree a different lamp scatter per tile', () => {
    const a = paint('lighttree', { x: 3, y: 4 })
    const b = paint('lighttree', { x: 4, y: 3 })
    expect(shape(a)).toEqual(shape(b))
    expect(a).not.toEqual(b)
  })

  it('inks every palette colour it uses, so nothing renders bright at night', () => {
    // Any COLORS value the art reaches for must have a park counterpart, or it
    // would light up in the middle of the night park.
    //
    // Two wrinkles. NIGHT.white is white, so an unchanged white is correct
    // rather than a miss. And a bright hex can belong to more than one palette
    // name with DIFFERENT night values — #FFD93D is both fishBowl (#D3B034) and
    // flower2 (#CC963E) — so all this can fairly ask is that the ink lands on
    // one of them, not on which.
    const used = new Set<string>()
    for (const type of ALL) for (const c of colours(paint(type))) used.add(c)
    const palette = Object.entries(COLORS) as [keyof typeof COLORS, string][]
    for (const bright of used) {
      const names = palette.filter(([, v]) => v === bright).map(([n]) => n)
      if (names.length === 0) continue // a literal, not a palette entry
      const darks = names.map((n) => NIGHT[n])
      if (darks.includes(bright)) continue // e.g. white
      expect(darks, `${names.join('/')} (${bright})`).toContain(parkInk(bright))
    }
  })

  it('darkens the decor at night, but leaves the glowing bits alone', () => {
    // The lit windows, fairy lights, star topper and music notes are drawn in
    // raw bright colours on purpose — they are meant to glow, not to be dimmed.
    const GLOW = [
      '#FFE39A',
      '#FFE97A',
      '#FF5A5A',
      '#7CFF9E',
      '#6EC6FF',
      '#FF8AD1',
    ]
    for (const type of ALL) {
      const bright = colours(paint(type))
      const park = colours(paint(type, { park: true }))
      expect(park.length, type).toBe(bright.length)
      let changed = 0
      bright.forEach((c, i) => {
        if (GLOW.includes(c)) expect(park[i], `${type} glow ${c}`).toBe(c)
        if (park[i] !== c) changed++
      })
      expect(changed, `${type} has no park-toned colour`).toBeGreaterThan(0)
    }
  })

  it('animates the pieces that move, and only those', () => {
    const moving: DecorType[] = ['ball', 'snowcat', 'lighttree']
    const still: DecorType[] = ['mushroom', 'cardbox', 'house']
    for (const type of moving) {
      expect(paint(type, { frameCount: 40 }), type).not.toEqual(
        paint(type, { frameCount: 0 }),
      )
    }
    for (const type of still) {
      expect(paint(type, { frameCount: 40 }), type).toEqual(
        paint(type, { frameCount: 0 }),
      )
    }
  })

  it('only pulses and puffs notes out of the radio while it plays', () => {
    const off = paint('radio', { frameCount: 40 })
    const on = paint('radio', { frameCount: 40, playing: true })
    expect(on).not.toEqual(off)
    expect(on.length).toBeGreaterThan(off.length)
    // Silent, it is the same box whatever the clock says.
    expect(paint('radio', { frameCount: 90 })).toEqual(off)
  })
})
