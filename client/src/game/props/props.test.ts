import { describe, expect, it } from 'vitest'
import { GRANITE, parkInk as rockInk } from '../rocks'
import {
  BENCH_TONES,
  drawBench,
  drawPond,
  parkInk,
  pondFormAt,
  pondLobes,
} from './index'
import type { PondForm } from './types'

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
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    createLinearGradient: () => ({ addColorStop: record('stop') }),
    lineWidth: 1,
    lineCap: 'butt',
  } as unknown as CanvasRenderingContext2D
  const push = (v: unknown) => calls.push('color(' + String(v) + ')')
  Object.defineProperty(ctx, 'fillStyle', { get: () => '', set: push })
  Object.defineProperty(ctx, 'strokeStyle', { get: () => '', set: push })
  return { ctx, calls }
}

function paintPond(
  x: number,
  y: number,
  opts: { form?: PondForm; park?: boolean } = {},
): string[] {
  const { ctx, calls } = recorder()
  drawPond(
    ctx,
    { x, y },
    { form: opts.form, ink: opts.park ? parkInk : undefined },
  )
  return calls
}

function paintBench(x: number, y: number, park = false): string[] {
  const { ctx, calls } = recorder()
  drawBench(ctx, { x, y }, { ink: park ? parkInk : undefined })
  return calls
}

/** A call list with every number stripped — the shape, independent of position. */
function shape(calls: string[]): string[] {
  return calls.map((c) => c.replace(/-?\d+\.\d+/g, '#'))
}

describe('pond', () => {
  it('picks a stable form per tile, and uses both across the map', () => {
    expect(pondFormAt(6, 4)).toBe(pondFormAt(6, 4))
    const forms = new Set<number>()
    for (let x = 0; x < 30; x++) {
      for (let y = 0; y < 6; y++) forms.add(pondFormAt(x, y))
    }
    expect(forms).toEqual(new Set([0, 1]))
  })

  it('builds one basin for the pool and two lobes for the inlet', () => {
    const j = { w: 1, h: 1, lean: 0 }
    expect(pondLobes(0, 0, 0, j)).toHaveLength(1)
    const inlet = pondLobes(0, 0, 1, j)
    expect(inlet).toHaveLength(2)
    // The lobes must overlap, or the inlet reads as two separate puddles.
    const [a, b] = inlet
    expect(Math.abs(b.cx - a.cx)).toBeLessThan(a.rx + b.rx)
  })

  it('draws the two forms differently', () => {
    expect(paintPond(4, 4, { form: 0 })).not.toEqual(
      paintPond(4, 4, { form: 1 }),
    )
  })

  it('gives two ponds of the same form different proportions', () => {
    expect(paintPond(3, 4, { form: 0 })).not.toEqual(
      paintPond(17, 4, { form: 0 }),
    )
  })

  it('re-inks for the park, and resolves stone through the rocks map', () => {
    expect(paintPond(4, 4, { park: true })).not.toEqual(paintPond(4, 4))
    // The rim is drawn with the rocks module's stones, so its colours must come
    // out of that module's map rather than being duplicated here.
    expect(parkInk(GRANITE.mid)).toBe(rockInk(GRANITE.mid))
    expect(parkInk(GRANITE.mid)).not.toBe(GRANITE.mid)
  })

  it('redraws a tile identically every time', () => {
    expect(paintPond(9, 5)).toEqual(paintPond(9, 5))
  })
})

describe('bench', () => {
  it('is the same bench on every tile', () => {
    // Deliberately NO variance: benches are municipal. Positions differ between
    // tiles, so compare the shape with the coordinates stripped out.
    expect(shape(paintBench(3, 6))).toEqual(shape(paintBench(21, 9)))
  })

  it('re-inks its timber and frame for the park', () => {
    const park = paintBench(3, 6, true)
    expect(park).not.toEqual(paintBench(3, 6))
    for (const tone of Object.values(BENCH_TONES)) {
      expect(parkInk(tone), tone + ' has no park counterpart').not.toBe(tone)
    }
  })
})
