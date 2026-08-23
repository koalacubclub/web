import { describe, expect, it } from 'vitest'
import { parkInk } from './parkInk'
import {
  DAISY_TONES,
  FLOWER_SPECIES,
  SPECIES_WEIGHTS,
  drawFlowers,
  flowerFormAt,
  flowerSpeciesAt,
} from './index'
import type { FlowerForm, FlowerSpecies } from './types'

// Records every drawing call and colour so two patches can be compared without
// a real canvas.
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
  opts: {
    species?: FlowerSpecies
    form?: FlowerForm
    park?: boolean
    frameCount?: number
  } = {},
): string[] {
  const { ctx, calls } = recorder()
  drawFlowers(
    ctx,
    { x, y },
    {
      species: opts.species,
      form: opts.form,
      ink: opts.park ? parkInk : undefined,
      frameCount: opts.frameCount,
    },
  )
  return calls
}

describe('species and form selection', () => {
  it('is stable for a tile, and covers every species across the map', () => {
    expect(flowerSpeciesAt(5, 8)).toBe(flowerSpeciesAt(5, 8))
    expect(flowerFormAt(5, 8)).toBe(flowerFormAt(5, 8))
    const seen = new Set<string>()
    const forms = new Set<number>()
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 8; y++) {
        seen.add(flowerSpeciesAt(x, y))
        forms.add(flowerFormAt(x, y))
      }
    }
    expect(seen).toEqual(new Set(FLOWER_SPECIES))
    expect(forms).toEqual(new Set([0, 1]))
  })

  it('keeps daisies the common wildflower and tulips the rarest', () => {
    const counts: Record<string, number> = {}
    for (let x = 0; x < 60; x++) {
      for (let y = 0; y < 12; y++) {
        const s = flowerSpeciesAt(x, y)
        counts[s] = (counts[s] ?? 0) + 1
      }
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
    expect(ranked[0][0]).toBe('daisy')
    expect(ranked[ranked.length - 1][0]).toBe('tulip')
    expect(Object.keys(SPECIES_WEIGHTS).sort()).toEqual(
      [...FLOWER_SPECIES].sort(),
    )
  })
})

describe('drawing', () => {
  it.each(FLOWER_SPECIES)('draws %s in both forms', (species) => {
    const a = paint(4, 6, { species, form: 0 })
    const b = paint(4, 6, { species, form: 1 })
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBeGreaterThan(0)
    expect(a).not.toEqual(b)
  })

  it.each(FLOWER_SPECIES)(
    'gives two %s patches of the same form different proportions',
    (species) => {
      const a = paint(3, 6, { species, form: 0 })
      const b = paint(14, 6, { species, form: 0 })
      expect(a).not.toEqual(b)
    },
  )

  it.each(FLOWER_SPECIES)('re-inks %s stems in park mode', (species) => {
    expect(paint(4, 6, { species, park: true })).not.toEqual(
      paint(4, 6, { species }),
    )
  })

  it('leaves petals bright in park mode, the way the park treats blooms', () => {
    // The stem must be re-inked and the petal must reach the canvas raw, or
    // blooms stop reading as accents against the dark. parkInk deliberately has
    // no petal entry, so unknown colours fall through unchanged.
    const park = paint(4, 6, { species: 'daisy', park: true })
    expect(park).toContain('color(' + DAISY_TONES.petal + ')')
    expect(park).toContain('color(' + parkInk(DAISY_TONES.stem) + ')')
    expect(parkInk(DAISY_TONES.stem)).not.toBe(DAISY_TONES.stem)
    expect(parkInk(DAISY_TONES.petal)).toBe(DAISY_TONES.petal)
  })

  it('bobs the blooms with the frame counter', () => {
    const still = paint(4, 6, { species: 'daisy', frameCount: 0 })
    const later = paint(4, 6, { species: 'daisy', frameCount: 24 })
    expect(still).not.toEqual(later)
  })

  it('redraws a tile identically every time', () => {
    for (const species of FLOWER_SPECIES) {
      expect(paint(9, 4, { species })).toEqual(paint(9, 4, { species }))
    }
  })
})
