import { describe, expect, it } from 'vitest'
import { parkInk } from './parkInk'
import {
  GRANITE,
  ROCK_SPECIES,
  SANDSTONE,
  SPECIES_WEIGHTS,
  drawRock,
  rockFormAt,
  rockSpeciesAt,
} from './index'
import type { RockForm, RockSpecies } from './types'

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
    lineWidth: 1,
    lineCap: 'butt',
  } as unknown as CanvasRenderingContext2D
  const push = (v: unknown) => calls.push('color(' + String(v) + ')')
  Object.defineProperty(ctx, 'fillStyle', { get: () => '', set: push })
  Object.defineProperty(ctx, 'strokeStyle', { get: () => '', set: push })
  return { ctx, calls }
}

function paint(
  x: number,
  y: number,
  opts: { species?: RockSpecies; form?: RockForm; park?: boolean } = {},
): string[] {
  const { ctx, calls } = recorder()
  drawRock(
    ctx,
    { x, y },
    {
      species: opts.species,
      form: opts.form,
      ink: opts.park ? parkInk : undefined,
    },
  )
  return calls
}

function channels(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) throw new Error('expected a hex colour, got ' + hex)
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

/** Channel spread of a colour — 0 is perfectly neutral grey. */
function spread(color: string): number {
  const ch = channels(color)
  return Math.max(...ch) - Math.min(...ch)
}

/** Positive = warm (red over blue); negative is the lilac cast we're avoiding. */
function warmth(color: string): number {
  const [r, , b] = channels(color)
  return r - b
}

describe('species and form selection', () => {
  it('is stable for a tile, and covers every arrangement across the map', () => {
    expect(rockSpeciesAt(6, 9)).toBe(rockSpeciesAt(6, 9))
    expect(rockFormAt(6, 9)).toBe(rockFormAt(6, 9))
    const seen = new Set<string>()
    const forms = new Set<number>()
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 8; y++) {
        seen.add(rockSpeciesAt(x, y))
        forms.add(rockFormAt(x, y))
      }
    }
    expect(seen).toEqual(new Set(ROCK_SPECIES))
    expect(forms).toEqual(new Set([0, 1]))
  })

  it('keeps boulders common and balanced stacks rare', () => {
    const counts: Record<string, number> = {}
    for (let x = 0; x < 60; x++) {
      for (let y = 0; y < 12; y++) {
        const s = rockSpeciesAt(x, y)
        counts[s] = (counts[s] ?? 0) + 1
      }
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
    expect(ranked[0][0]).toBe('boulder')
    // A cairn is something a person built; it should stay the rarest find.
    expect(ranked[ranked.length - 1][0]).toBe('stack')
    expect(Object.keys(SPECIES_WEIGHTS).sort()).toEqual(
      [...ROCK_SPECIES].sort(),
    )
  })
})

describe('stone colour', () => {
  // Park colours are hand-picked in parkInk.ts, not computed. That is the whole
  // reason stone can look like stone here: the old grading function pushed every
  // neutral grey toward violet, which is why the park's existing stone ellipse
  // is mauve. These guard the picked values against drifting back that way.
  it('keeps granite a near-neutral grey in park mode', () => {
    expect(spread(parkInk(GRANITE.mid))).toBeLessThan(16)
    expect(spread(parkInk(GRANITE.dark))).toBeLessThan(16)
  })

  it('keeps sandstone warm rather than lilac', () => {
    // Sandstone should read warmer than granite; the failure to guard is the
    // opposite one — blue over red, which is what makes stone look purple.
    expect(warmth(parkInk(SANDSTONE.mid))).toBeGreaterThan(10)
    expect(warmth(parkInk(SANDSTONE.dark))).toBeGreaterThan(10)
    expect(warmth(parkInk(GRANITE.mid))).toBeGreaterThanOrEqual(0)
  })

  it('re-inks every stone tone for the park', () => {
    // An unmapped colour falls through bright, which in game is a bug — so each
    // tone must actually differ from its bright literal.
    for (const tones of [GRANITE, SANDSTONE]) {
      for (const c of Object.values(tones)) {
        expect(parkInk(c), c + ' has no park counterpart').not.toBe(c)
      }
    }
  })
})

describe('drawing', () => {
  it.each(ROCK_SPECIES)('draws %s in both forms', (species) => {
    const a = paint(4, 7, { species, form: 0 })
    const b = paint(4, 7, { species, form: 1 })
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBeGreaterThan(0)
    expect(a).not.toEqual(b)
  })

  it('stacks more stones in its cairn form than in its pair form', () => {
    // Every stone lays down a fill for its body, so more stones means more
    // fills — a cheap structural check that form 1 really is a third stone.
    const pair = paint(4, 7, { species: 'stack', form: 0 }).filter(
      (c) => c === 'fill()',
    ).length
    const cairn = paint(4, 7, { species: 'stack', form: 1 }).filter(
      (c) => c === 'fill()',
    ).length
    expect(cairn).toBeGreaterThan(pair)
  })

  it.each(ROCK_SPECIES)(
    'gives two %s on different tiles different proportions',
    (species) => {
      expect(paint(3, 7, { species, form: 0 })).not.toEqual(
        paint(15, 7, { species, form: 0 }),
      )
    },
  )

  it.each(ROCK_SPECIES)('re-inks %s for the park', (species) => {
    expect(paint(4, 7, { species, park: true })).not.toEqual(
      paint(4, 7, { species }),
    )
  })

  it('redraws a tile identically every time', () => {
    for (const species of ROCK_SPECIES) {
      expect(paint(9, 4, { species })).toEqual(paint(9, 4, { species }))
    }
  })
})
