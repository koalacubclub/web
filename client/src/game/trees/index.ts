// The park's tree art, one species per file in this folder.
//
// A tree is (species, form, jitter). All three are derived from the tile it
// stands on via the same seeded PRNG the park already uses for flower patches
// and pond stones, so a tree looks identical on every frame and every reload —
// no flicker, and no re-roll when the camera pans away and back. Map data can
// also name a species and/or form outright to override the roll.
//
// Nothing here is wired into the scene yet: `ParkGame` and `sprites.ts` still
// draw their own tree. This module is the art, ready to be dropped in.

import { PIXEL, makeRng, night } from '../constants'
import { drawBroadleaf } from './broadleaf'
import { drawCrabapple } from './crabapple'
import { drawMaple } from './maple'
import { drawPine } from './pine'
import { drawWillow } from './willow'
import type {
  Ctx,
  Ink,
  SpeciesDraw,
  TreeForm,
  TreeSpecies,
  TreeTile,
} from './types'

export type {
  Ctx,
  Ink,
  SpeciesDraw,
  TreeForm,
  TreeSpecies,
  TreeTile,
} from './types'
export type { Jitter } from './variance'
export { BROADLEAF_TONES, drawBroadleaf } from './broadleaf'
export { CRABAPPLE_TONES, drawCrabapple } from './crabapple'
export { MAPLE_TONES, drawMaple } from './maple'
export { PINE_TONES, drawPine } from './pine'
export { WILLOW_TONES, drawWillow } from './willow'

/** Every species, in the order they were added. */
export const TREE_SPECIES = [
  'broadleaf',
  'pine',
  'crabapple',
  'maple',
  'willow',
] as const satisfies readonly TreeSpecies[]

export const TREE_DRAW: Record<TreeSpecies, SpeciesDraw> = {
  broadleaf: drawBroadleaf,
  pine: drawPine,
  crabapple: drawCrabapple,
  maple: drawMaple,
  willow: drawWillow,
}

/**
 * How often each species comes up. NOT an even split: the broadleaf stays the
 * park's backbone and the rarer species read as accents — five equally common
 * species look like a sampler, not a park.
 */
export const SPECIES_WEIGHTS: Record<TreeSpecies, number> = {
  broadleaf: 34,
  pine: 18,
  maple: 18,
  crabapple: 16,
  willow: 14,
}

// Distinct salts so the species roll, the form roll and the art's own jitter are
// independent — otherwise picking a species would shift every tree's shape.
const SEED_SPECIES = 101
const SEED_FORM = 211
const SEED_ART = 1

const seedAt = (x: number, y: number, salt: number) =>
  makeRng(x * 73856093 + y * 19349663 + salt)

/** The species a tree at tile (x, y) grows as. Stable for that tile, forever. */
export function treeSpeciesAt(x: number, y: number): TreeSpecies {
  const total = TREE_SPECIES.reduce((sum, k) => sum + SPECIES_WEIGHTS[k], 0)
  let roll = seedAt(x, y, SEED_SPECIES)() * total
  for (const species of TREE_SPECIES) {
    roll -= SPECIES_WEIGHTS[species]
    if (roll < 0) return species
  }
  return 'broadleaf'
}

/** Which of the species' two builds a tree at tile (x, y) takes. */
export function treeFormAt(x: number, y: number): TreeForm {
  return seedAt(x, y, SEED_FORM)() < 0.5 ? 0 : 1
}

export interface DrawTreeOptions {
  /** Override the tile's species roll. */
  species?: TreeSpecies
  /** Override the tile's form roll. */
  form?: TreeForm
  /**
   * Colour pass-through: `night` for trees in the park, identity (the default)
   * for bright shop previews.
   */
  ink?: Ink
}

/**
 * Draw the tree standing on `tile`, with the top-left of its 2×2 footprint at
 * (tile.x · PIXEL, tile.y · PIXEL). The caller sets up any world translate.
 */
export function drawTree(
  ctx: Ctx,
  tile: TreeTile,
  opts: DrawTreeOptions = {},
): void {
  const species = opts.species ?? treeSpeciesAt(tile.x, tile.y)
  const form = opts.form ?? treeFormAt(tile.x, tile.y)
  TREE_DRAW[species](ctx, tile.x * PIXEL, tile.y * PIXEL, {
    rng: seedAt(tile.x, tile.y, SEED_ART),
    form,
    ink: opts.ink ?? ((c) => c),
  })
}

/** Convenience for the park itself: the same draw, night-graded. */
export function drawNightTree(
  ctx: Ctx,
  tile: TreeTile,
  opts: Omit<DrawTreeOptions, 'ink'> = {},
): void {
  drawTree(ctx, tile, { ...opts, ink: night })
}
