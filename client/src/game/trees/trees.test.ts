import { describe, expect, it } from 'vitest'
import { parkInk } from './parkInk'
import {
  PARK_SPECIES,
  SPECIES_WEIGHTS,
  TREE_SPECIES,
  drawTree,
  treeFormAt,
  treeSpeciesAt,
} from './index'
import type { TreeForm, TreeSpecies } from './types'

// A minimal CanvasRenderingContext2D stand-in that records every drawing call
// and every colour assigned, so we can compare two trees without a real canvas.
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
  opts: { species?: TreeSpecies; form?: TreeForm; night?: boolean } = {},
): string[] {
  const { ctx, calls } = recorder()
  drawTree(
    ctx,
    { x, y },
    {
      species: opts.species,
      form: opts.form,
      ink: opts.night ? parkInk : undefined,
    },
  )
  return calls
}

describe('species and form selection', () => {
  it('is stable for a tile, and grows only the park species', () => {
    expect(treeSpeciesAt(7, 3)).toBe(treeSpeciesAt(7, 3))
    expect(treeFormAt(7, 3)).toBe(treeFormAt(7, 3))
    // Over a patch of map every PARK species shows up, and nothing else does —
    // the maple and crabapple are drawable art the park does not grow.
    const seen = new Set<string>()
    const forms = new Set<number>()
    for (let x = 0; x < 60; x++) {
      for (let y = 0; y < 10; y++) {
        seen.add(treeSpeciesAt(x, y))
        forms.add(treeFormAt(x, y))
      }
    }
    expect(seen).toEqual(new Set(PARK_SPECIES))
    expect(forms).toEqual(new Set([0, 1]))
  })

  it('grows neighbours as the same species, but varies their form', () => {
    // Species clusters into groves so trees standing together match in kind.
    // Whatever that grove size is, tiles sharing a corner must agree far more
    // often than chance (3 species => ~44% agreement if rolled independently).
    let same = 0
    let total = 0
    for (let x = 0; x < 60; x++) {
      for (let y = 0; y < 10; y++) {
        if (treeSpeciesAt(x, y) === treeSpeciesAt(x + 1, y)) same++
        total++
      }
    }
    expect(same / total).toBeGreaterThan(0.75)

    // ...but the trees themselves must not be clones: within one grove, form
    // still varies per tile, which is what keeps a stand from looking stamped.
    const formsInGrove = new Set<number>()
    for (let x = 0; x < 6; x++) formsInGrove.add(treeFormAt(x, 2))
    expect(formsInGrove.size).toBe(2)
  })

  it('keeps the broadleaf the most common tree', () => {
    const counts: Record<string, number> = {}
    for (let x = 0; x < 60; x++) {
      for (let y = 0; y < 10; y++) {
        const s = treeSpeciesAt(x, y)
        counts[s] = (counts[s] ?? 0) + 1
      }
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
    expect(ranked[0][0]).toBe('broadleaf')
    // Weights are a distribution, not decoration: every park species must draw
    // from them, and only park species should appear in them.
    expect(Object.keys(SPECIES_WEIGHTS).sort()).toEqual(
      [...PARK_SPECIES].sort(),
    )
  })
})

describe('drawing', () => {
  it.each(TREE_SPECIES)('draws %s in both forms', (species) => {
    const a = paint(4, 2, { species, form: 0 })
    const b = paint(4, 2, { species, form: 1 })
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBeGreaterThan(0)
    // The two builds are structurally different, not the same tree rescaled.
    expect(a).not.toEqual(b)
  })

  it.each(TREE_SPECIES)(
    'tints %s at night, leaves the preview bright',
    (species) => {
      const dark = paint(4, 2, { species, night: true })
      const bright = paint(4, 2, { species })
      expect(dark).not.toEqual(bright)
      // Both sets are hex literals now (the old night() grade emitted rgb()
      // strings, which is what this used to key on). What must hold is that the
      // park pass actually re-inked: every bright colour parkInk knows about is
      // gone from the dark pass, and each was replaced by its mapped counterpart.
      const hex = (cs: string[]) =>
        cs.flatMap((c) => c.match(/^color\((#[0-9A-Fa-f]{6})\)$/)?.[1] ?? [])
      const brightHex = hex(bright)
      expect(brightHex.length).toBeGreaterThan(0)
      const remapped = brightHex.filter((c) => parkInk(c) !== c)
      expect(remapped.length).toBeGreaterThan(0)
      const darkHex = new Set(hex(dark))
      for (const c of remapped) {
        expect(darkHex.has(c)).toBe(false)
        expect(darkHex.has(parkInk(c))).toBe(true)
      }
    },
  )

  it.each(TREE_SPECIES)(
    'gives two %s of the same form different proportions',
    (species) => {
      // Same species, same form, different tiles: the per-tree jitter must make
      // them visibly different — three maples in a row can't be one maple
      // stamped three times.
      const a = paint(3, 2, { species, form: 0 })
      const b = paint(11, 2, { species, form: 0 })
      expect(a).not.toEqual(b)
      expect(a.length).toBeGreaterThan(0)
    },
  )

  it('redraws a tile identically every time', () => {
    for (const species of TREE_SPECIES) {
      expect(paint(9, 4, { species })).toEqual(paint(9, 4, { species }))
    }
  })
})
