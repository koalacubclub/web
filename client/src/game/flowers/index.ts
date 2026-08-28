// The park's flower art, one species per file in this folder — the same shape as
// `../trees`: a patch is (species, form, jitter), all three rolled from the tile
// it grows on, so it looks identical on every frame and every reload.
//
// The park draws its patches with `drawNightFlowers`; `sprites.ts` still has its
// own little flower for the shop previews.
//
// A patch only sways while Koala is near it: the park's flowers are still until
// she walks up to them. How near is near is the park's business, not the art's
// — see `../proximity.ts` — so all this module takes is a `sway` amplitude.

import { PIXEL, makeRng } from '../constants'
import { parkInk } from './parkInk'
import { drawBluebell } from './bluebell'
import { drawDaisy } from './daisy'
import { drawLavender } from './lavender'
import { drawPoppy } from './poppy'
import { drawTulip } from './tulip'
import type {
  Ctx,
  FlowerForm,
  FlowerSpecies,
  FlowerTile,
  Ink,
  SpeciesDraw,
} from './types'

export type {
  Ctx,
  FlowerForm,
  FlowerSpecies,
  FlowerTile,
  Ink,
  SpeciesDraw,
} from './types'
export type { Jitter } from './variance'
export { parkInk } from './parkInk'
export { BLUEBELL_TONES, drawBluebell } from './bluebell'
export { DAISY_TONES, drawDaisy } from './daisy'
export { LAVENDER_TONES, drawLavender } from './lavender'
export { POPPY_TONES, drawPoppy } from './poppy'
export { TULIP_TONES, drawTulip } from './tulip'

export const FLOWER_SPECIES = [
  'daisy',
  'tulip',
  'poppy',
  'lavender',
  'bluebell',
] as const satisfies readonly FlowerSpecies[]

export const FLOWER_DRAW: Record<FlowerSpecies, SpeciesDraw> = {
  daisy: drawDaisy,
  tulip: drawTulip,
  poppy: drawPoppy,
  lavender: drawLavender,
  bluebell: drawBluebell,
}

/**
 * How often each species comes up. Daisies stay the common wildflower; tulips
 * are the rarest because a bed of them reads as planted, and the park should
 * only look tended here and there.
 */
export const SPECIES_WEIGHTS: Record<FlowerSpecies, number> = {
  daisy: 32,
  poppy: 22,
  bluebell: 18,
  lavender: 16,
  tulip: 12,
}

// Distinct salts, so the species roll, the form roll and the art's own jitter
// are independent. `SEED_ART` matches the salt the park already uses for its
// flower patches.
const SEED_SPECIES = 307
const SEED_FORM = 401
const SEED_ART = 7

const seedAt = (x: number, y: number, salt: number) =>
  makeRng(x * 73856093 + y * 19349663 + salt)

/** The species a patch at tile (x, y) grows as. Stable for that tile, forever. */
export function flowerSpeciesAt(x: number, y: number): FlowerSpecies {
  const total = FLOWER_SPECIES.reduce((sum, k) => sum + SPECIES_WEIGHTS[k], 0)
  let roll = seedAt(x, y, SEED_SPECIES)() * total
  for (const species of FLOWER_SPECIES) {
    roll -= SPECIES_WEIGHTS[species]
    if (roll < 0) return species
  }
  return 'daisy'
}

/** Which of the species' two builds a patch at tile (x, y) takes. */
export function flowerFormAt(x: number, y: number): FlowerForm {
  return seedAt(x, y, SEED_FORM)() < 0.5 ? 0 : 1
}

export interface DrawFlowersOptions {
  species?: FlowerSpecies
  form?: FlowerForm
  /**
   * Stems and foliage pass through this (`parkInk` in the park); petals stay
   * bright either way. Default identity.
   */
  ink?: Ink
  /** Game frame counter, for the bloom bob. Default 0 (static). */
  frameCount?: number
  /**
   * How hard the patch sways, 0–1 — `idleMotion` of Koala's distance in the
   * park (see `../proximity.ts`), 0 for dead still. Default 1: the art bobs
   * unless something asks it not to, and it is the park that does the asking.
   */
  sway?: number
}

/**
 * Draw the patch growing on `tile`, with the top-left of its 1×1 footprint at
 * (tile.x · PIXEL, tile.y · PIXEL). The caller sets up any world translate.
 */
export function drawFlowers(
  ctx: Ctx,
  tile: FlowerTile,
  opts: DrawFlowersOptions = {},
): void {
  const species = opts.species ?? flowerSpeciesAt(tile.x, tile.y)
  const form = opts.form ?? flowerFormAt(tile.x, tile.y)
  FLOWER_DRAW[species](ctx, tile.x * PIXEL, tile.y * PIXEL, {
    rng: seedAt(tile.x, tile.y, SEED_ART),
    form,
    ink: opts.ink ?? ((c) => c),
    frameCount: opts.frameCount ?? 0,
    sway: opts.sway ?? 1,
  })
}

/** Convenience for the park itself: the same draw, park-inked stems. */
export function drawNightFlowers(
  ctx: Ctx,
  tile: FlowerTile,
  opts: Omit<DrawFlowersOptions, 'ink'> = {},
): void {
  drawFlowers(ctx, tile, { ...opts, ink: parkInk })
}
