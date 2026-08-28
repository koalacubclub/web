import { describe, expect, it } from 'vitest'
import { COLORS, NIGHT } from '../constants'
import {
  MUSHROOM_FORMS,
  SNOWCAT_FORMS,
  drawDecor,
  isDecor,
  mushroomFormAt,
  parkInk,
  snowcatFormAt,
  type DecorType,
} from './index'

/** The builds each piece comes in — one, unless the tile rolls its shape. */
const FORMS: Record<DecorType, readonly number[]> = {
  ball: [0],
  mushroom: MUSHROOM_FORMS,
  snowcat: SNOWCAT_FORMS,
  cardbox: [0],
  house: [0],
  lighttree: [0],
  radio: [0],
}

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
    form?: number
    motion?: number
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
      form: opts.form,
      motion: opts.motion,
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
      for (const form of FORMS[type]) {
        expect(paint(type, { form }), type).toEqual(paint(type, { form }))
      }
    }
  })

  it('moves with its tile without changing shape', () => {
    // Pinned to one build, since the whole point of the other builds is that
    // they are a different shape.
    for (const type of ALL) {
      const here = paint(type, { x: 3, y: 4, form: 0 })
      const there = paint(type, { x: 21, y: 9, form: 0 })
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

  it('draws a different shape for every build of the pieces that have them', () => {
    for (const type of ['mushroom', 'snowcat'] as const) {
      const drawn = FORMS[type].map((form) => shape(paint(type, { form })))
      const distinct = new Set(drawn.map((d) => d.join('|')))
      expect(distinct.size, type).toBe(FORMS[type].length)
    }
  })

  it('falls back to the first build for a form a piece does not have', () => {
    // The mushroom has four caps and the snow-cat three, so form 3 is a
    // snow-cat that doesn't exist. It draws the classic one rather than nothing.
    expect(paint('snowcat', { form: 3 })).toEqual(paint('snowcat', { form: 0 }))
  })

  it('rolls a build from the tile, and the same one every time', () => {
    for (const [x, y] of [
      [3, 4],
      [21, 9],
      [0, 0],
    ]) {
      expect(MUSHROOM_FORMS).toContain(mushroomFormAt(x, y))
      expect(SNOWCAT_FORMS).toContain(snowcatFormAt(x, y))
      expect(mushroomFormAt(x, y)).toBe(mushroomFormAt(x, y))
      expect(paint('mushroom', { x, y })).toEqual(
        paint('mushroom', { x, y, form: mushroomFormAt(x, y) }),
      )
      expect(paint('snowcat', { x, y })).toEqual(
        paint('snowcat', { x, y, form: snowcatFormAt(x, y) }),
      )
    }
  })

  it('shows the plain build on the shop card', () => {
    // ItemPreview draws every shop item at tile (0, 0), so that tile decides
    // what a buyer sees on the card. The form salts are picked to land it on
    // the plain mushroom and the plain snow-cat; changing one without checking
    // here would quietly put a variant on the card.
    expect(mushroomFormAt(0, 0)).toBe(MUSHROOM_FORMS[0])
    expect(snowcatFormAt(0, 0)).toBe(SNOWCAT_FORMS[0])
  })

  it('grows more than one cap and stacks more than one snow-cat across the park', () => {
    // Not a distribution test — just that a stretch of park doesn't come out
    // all one build, which is what a broken roll would look like.
    const caps = new Set<number>()
    const stacks = new Set<number>()
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 14; y++) {
        caps.add(mushroomFormAt(x, y))
        stacks.add(snowcatFormAt(x, y))
      }
    }
    expect(caps.size).toBe(MUSHROOM_FORMS.length)
    expect(stacks.size).toBe(SNOWCAT_FORMS.length)
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
    for (const type of ALL)
      for (const form of FORMS[type])
        for (const c of colours(paint(type, { form }))) used.add(c)
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
      for (const form of FORMS[type]) {
        const bright = colours(paint(type, { form }))
        const park = colours(paint(type, { form, park: true }))
        expect(park.length, type).toBe(bright.length)
        let changed = 0
        bright.forEach((c, i) => {
          if (GLOW.includes(c)) expect(park[i], `${type} glow ${c}`).toBe(c)
          if (park[i] !== c) changed++
        })
        expect(
          changed,
          `${type} form ${form} has no park-toned colour`,
        ).toBeGreaterThan(0)
      }
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
      for (const form of FORMS[type]) {
        expect(paint(type, { frameCount: 40, form }), type).toEqual(
          paint(type, { frameCount: 0, form }),
        )
      }
    }
    // Every snow-cat bobs, however it is stacked.
    for (const form of SNOWCAT_FORMS) {
      expect(
        paint('snowcat', { frameCount: 40, form }),
        `form ${form}`,
      ).not.toEqual(paint('snowcat', { frameCount: 0, form }))
    }
  })

  it('holds the light tree at a steady glow when Koala is not near it', () => {
    // Steady, not dark: the lamps stop swinging off their mean rather than
    // going out, so the tree still reads as lit from across the park.
    const a = paint('lighttree', { frameCount: 0, motion: 0 })
    expect(paint('lighttree', { frameCount: 40, motion: 0 })).toEqual(a)
    expect(paint('lighttree', { frameCount: 40, motion: 1 })).not.toEqual(a)
    expect(
      a.some((c) => c.startsWith('alpha(') && Number(c.slice(6, -1)) > 0.5),
    ).toBe(true)
  })

  it('settles the snow-cat when Koala is not near it', () => {
    for (const form of SNOWCAT_FORMS) {
      const a = paint('snowcat', { frameCount: 0, motion: 0, form })
      expect(
        paint('snowcat', { frameCount: 40, motion: 0, form }),
        `form ${form}`,
      ).toEqual(a)
      expect(paint('snowcat', { frameCount: 40, motion: 1, form })).not.toEqual(
        a,
      )
    }
  })

  it('rests the ball on the grass when Koala is not near it', () => {
    // motion 0 is the park's "she is nowhere near this ball": the clock keeps
    // running, the ball sits still. Anything else animates as it always did.
    const a = paint('ball', { frameCount: 0, motion: 0 })
    expect(paint('ball', { frameCount: 40, motion: 0 })).toEqual(a)
    expect(paint('ball', { frameCount: 91, motion: 0 })).toEqual(a)
    expect(paint('ball', { frameCount: 40, motion: 1 })).not.toEqual(a)
    // Half way through the fade band it hops, but lower than at her feet.
    const half = paint('ball', { frameCount: 40, motion: 0.5 })
    expect(half).not.toEqual(a)
    expect(half).not.toEqual(paint('ball', { frameCount: 40, motion: 1 }))
    // Bouncing is still the default — only the park asks it to stop.
    expect(paint('ball', { frameCount: 40 })).toEqual(
      paint('ball', { frameCount: 40, motion: 1 }),
    )
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
