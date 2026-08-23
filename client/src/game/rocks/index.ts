// The park's rock art, one arrangement per file in this folder — the same shape
// as `../trees` and `../flowers`. A rock is (species, form, jitter), all three
// rolled from the tile it sits on, so it looks identical on every frame and
// every reload.
//
// Everything is built from `facetedStone`: an angular silhouette with a lit top
// plane and a shaded flank. The park's current stone is a single flat ellipse.
//
// Colours are bright literals re-inked through `parkInk` for the park, the same
// convention as ../trees and ../sprites.
//
// Nothing here is wired into the scene yet.

import { PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
import { drawBoulder } from './boulder'
import { drawCluster } from './cluster'
import { drawSlab } from './slab'
import { drawStack } from './stack'
import type {
  Ctx,
  Ink,
  RockForm,
  RockSpecies,
  RockTile,
  SpeciesDraw,
} from './types'

export type {
  Ctx,
  Ink,
  RockForm,
  RockSpecies,
  RockTile,
  SpeciesDraw,
} from './types'
export type { Jitter } from './variance'
export type { RockTones, StoneOptions } from './facet'
export { parkInk } from './parkInk'
export { GRANITE, SANDSTONE, facetedStone } from './facet'
export { drawBoulder } from './boulder'
export { drawCluster } from './cluster'
export { drawSlab } from './slab'
export { drawStack } from './stack'

export const ROCK_SPECIES = [
  'boulder',
  'stack',
  'cluster',
  'slab',
] as const satisfies readonly RockSpecies[]

export const ROCK_DRAW: Record<RockSpecies, SpeciesDraw> = {
  boulder: drawBoulder,
  stack: drawStack,
  cluster: drawCluster,
  slab: drawSlab,
}

/**
 * How often each arrangement comes up. Boulders and clusters are what a park
 * actually has lying about; a balanced cairn is something a person built, so
 * it stays rare enough to feel found rather than placed.
 */
export const SPECIES_WEIGHTS: Record<RockSpecies, number> = {
  boulder: 38,
  cluster: 28,
  slab: 20,
  stack: 14,
}

const SEED_SPECIES = 503
const SEED_FORM = 601
const SEED_ART = 11

const seedAt = (x: number, y: number, salt: number) =>
  makeRng(x * 73856093 + y * 19349663 + salt)

/** The arrangement a rock at tile (x, y) takes. Stable for that tile, forever. */
export function rockSpeciesAt(x: number, y: number): RockSpecies {
  const total = ROCK_SPECIES.reduce((sum, k) => sum + SPECIES_WEIGHTS[k], 0)
  let roll = seedAt(x, y, SEED_SPECIES)() * total
  for (const species of ROCK_SPECIES) {
    roll -= SPECIES_WEIGHTS[species]
    if (roll < 0) return species
  }
  return 'boulder'
}

/** Which of the species' two builds a rock at tile (x, y) takes. */
export function rockFormAt(x: number, y: number): RockForm {
  return seedAt(x, y, SEED_FORM)() < 0.5 ? 0 : 1
}

export interface DrawRockOptions {
  species?: RockSpecies
  form?: RockForm
  ink?: Ink
}

/**
 * Draw the rock sitting on `tile`, with the top-left of its 1×1 footprint at
 * (tile.x · PIXEL, tile.y · PIXEL). The caller sets up any world translate.
 */
export function drawRock(
  ctx: Ctx,
  tile: RockTile,
  opts: DrawRockOptions = {},
): void {
  const species = opts.species ?? rockSpeciesAt(tile.x, tile.y)
  const form = opts.form ?? rockFormAt(tile.x, tile.y)
  ROCK_DRAW[species](ctx, tile.x * PIXEL, tile.y * PIXEL, {
    rng: seedAt(tile.x, tile.y, SEED_ART),
    form,
    ink: opts.ink ?? ((c) => c),
  })
}

/** Convenience for the park itself: the same draw, park-inked. */
export function drawNightRock(
  ctx: Ctx,
  tile: RockTile,
  opts: Omit<DrawRockOptions, 'ink'> = {},
): void {
  drawRock(ctx, tile, { ...opts, ink: parkInk })
}
