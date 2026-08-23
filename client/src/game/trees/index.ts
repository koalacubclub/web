// The park's tree art, one species per file in this folder.
//
// A tree is (species, form, jitter). All three are derived from the tile it
// stands on via the same seeded PRNG the park already uses for flower patches
// and pond stones, so a tree looks identical on every frame and every reload —
// no flicker, and no re-roll when the camera pans away and back. Map data can
// also name a species and/or form outright to override the roll.
//
// This is the park's only tree art. `ParkGame` draws its base-map trees through
// `drawNightTree`, and `sprites.ts` routes both shop previews and placed decor
// here too, so a tree in the shop is the tree you get when you place it.

import { PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
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
 * The species the PARK actually grows. A deliberate subset of TREE_SPECIES: the
 * maple and crabapple are strong feature trees — a red canopy and a blossoming
 * one — and scattered through a small park they read as a sampler of the art
 * rather than as a place. They stay in TREE_SPECIES so the catalog still shows
 * them and callers can still ask for one by name via DrawTreeOptions.species.
 */
export const PARK_SPECIES = [
  'broadleaf',
  'pine',
  'willow',
] as const satisfies readonly TreeSpecies[]

/**
 * How often each park species comes up. NOT an even split: the broadleaf stays
 * the park's backbone and the other two read as accents — equally common species
 * look like a sampler, not a park.
 */
export const SPECIES_WEIGHTS: Record<(typeof PARK_SPECIES)[number], number> = {
  broadleaf: 58,
  pine: 27,
  willow: 15,
}

// Distinct salts so the species roll, the form roll and the art's own jitter are
// independent — otherwise picking a species would shift every tree's shape.
//
// SEED_SPECIES is not arbitrary: with only a handful of groves on the map, the
// weights above are a long-run distribution that a five-grove sample need not
// match, and some salts hand every grove the same species. This one deals the
// current map 6 broadleaf / 3 pine / 1 willow, which is the intended read. If the
// tree layout changes, re-check the mix — a different salt may deal it better.
const SEED_SPECIES = 16
const SEED_FORM = 211
const SEED_ART = 1

const seedAt = (x: number, y: number, salt: number) =>
  makeRng(x * 73856093 + y * 19349663 + salt)

/**
 * How many tiles wide/tall a grove is. Species is rolled per GROVE rather than
 * per tile, so neighbouring trees come up the same kind and the park reads as
 * stands of one species instead of one-of-each noise. Widen it for larger, more
 * uniform stands; narrow it toward 1 to go back to every tree rolling alone.
 */
const GROVE_TILES = 6

/**
 * The species a tree at tile (x, y) grows as. Stable for that tile, forever, and
 * shared with every other tree in the same grove — see GROVE_TILES. Only the
 * species clusters: form and the art's own jitter are still rolled per tile, so
 * trees standing together match in kind while still differing in build, size,
 * density and lean.
 */
export function treeSpeciesAt(x: number, y: number): TreeSpecies {
  const gx = Math.floor(x / GROVE_TILES)
  const gy = Math.floor(y / GROVE_TILES)
  const total = PARK_SPECIES.reduce((sum, k) => sum + SPECIES_WEIGHTS[k], 0)
  let roll = seedAt(gx, gy, SEED_SPECIES)() * total
  for (const species of PARK_SPECIES) {
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
   * Colour pass-through: `parkInk` for trees in the park, identity (the default)
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

/** Convenience for the park itself: the same draw, re-inked to the park palette. */
export function drawNightTree(
  ctx: Ctx,
  tile: TreeTile,
  opts: Omit<DrawTreeOptions, 'ink'> = {},
): void {
  drawTree(ctx, tile, { ...opts, ink: parkInk })
}
