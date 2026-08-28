// Where the park's sleeping koalas lie.
//
// A cast member who isn't connected keeps their slot and their items (see
// CAST_SIZE in the shared protocol), so rather than leaving a koala-shaped hole
// where somebody used to be, the park draws them asleep — the owner of that
// maple, napping under it. It is the same idea as Splatoon's plaza: the crowd
// you walk through is mostly not live, and it costs nothing to show.
//
// The server sends only WHO is asleep. Placing them is the client's job because
// the client is the only side that knows where the park's own scenery stands
// (the trees and rocks are procedural, generated from the tile). So this module
// answers one question — which free tile does each sleeper get — under three
// rules:
//
//   1. Nobody overlaps. Not another sleeper, not a tree, bench, pond, or a
//      placed item. A sleeping koala is a 1x1 footprint like any other.
//   2. Lie down where you last stood. A koala that logs off in front of you
//      curls up on the spot rather than teleporting off across the park. Only
//      cast members who were never seen this session need placing: they go
//      beside the first item they planted, or — owning nothing — on a tile
//      picked from their id, arbitrary but always the same one.
//   3. Elbow room for the ones you didn't see leave. A koala you watched go
//      lies down exactly where it was — that's the whole point of rule 2, and
//      nudging it "for looks" would just move someone you were standing next
//      to. The rest — asleep before you arrived, placed by their items or by
//      their id — are strewn across the whole park, most of a screen apart, so
//      finding one is a walk rather than a glance.
//   4. Once placed, stay placed. Spots are carried across re-layouts (a
//      purchase, a ball rolling by, a peer waking up), so the park doesn't
//      rearrange its nappers every time something else moves.
//
// Pure and DOM-free, so the rules can be tested directly.

import { VIEW_COLS } from './constants'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** A cast member who is offline, as the server names them — plus, when the park
 *  watched them go, where they were standing at the time. */
export interface Sleeper {
  id: string
  name: string
  x?: number
  y?: number
}

/** Anything in the park with a footprint: the scenery a sleeper must not lie on,
 *  and — when it carries an owner — the thing its owner gets put to sleep beside.
 *  Structurally ParkGame's GameObject, so the park's own object list goes
 *  straight in (base scenery simply has no ownerId). */
export interface SleepAnchor extends Rect {
  ownerId?: string
  placedAt?: number
  id?: string
}

export interface SleepSpot extends Sleeper {
  x: number
  y: number
  dir: 'left' | 'right'
}

export interface SleepWorld {
  /** Everything standing in the park — scenery and placed items alike. */
  objects: readonly SleepAnchor[]
  cols: number
  rows: number
}

// Keep sleepers off the very bottom rows: those sit under the on-screen
// controls, and a name tag down there is half-hidden. Matches the margin the
// shop's own placement search reserves.
const BOTTOM_MARGIN = 2
// Row 0 is the horizon strip, not walkable ground.
const TOP_ROW = 1
// How far apart the koalas who were already asleep are strewn — most of a
// screenful of park (the camera shows VIEW_COLS columns), so you rarely have
// two of them in view at once and finding one means walking there.
//
// It is a preference, not a rule: 58 columns only hold so many at that spacing,
// so a park with nowhere left to lie down relaxes the gap step by step rather
// than turning anyone away. A full cast still ends up strewn across the map,
// just closer together.
export const SLEEP_GAP = Math.round(VIEW_COLS * 0.7)
const RELAXED_GAPS = [SLEEP_GAP, 10, 7, 5, 3, 2, 1]
// A koala you watched log off asks for nothing but its own tile: it lies down
// where it was standing, even if that is right beside someone else.
const WITNESSED_GAPS = [1]

/** FNV-1a. Any stable string→int will do; this one is short and well-spread. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function overlaps(x: number, y: number, r: Rect): boolean {
  return x < r.x + r.w && x + 1 > r.x && y < r.y + r.h && y + 1 > r.y
}

/** The item a sleeper naps beside: the first one they planted (ties broken by
 *  id, so it never depends on map order). Undefined if they own nothing here. */
function ownItem(
  id: string,
  objects: readonly SleepAnchor[],
): SleepAnchor | undefined {
  let best: SleepAnchor | undefined
  for (const it of objects) {
    if (it.ownerId !== id) continue
    if (
      !best ||
      (it.placedAt ?? 0) < (best.placedAt ?? 0) ||
      ((it.placedAt ?? 0) === (best.placedAt ?? 0) &&
        (it.id ?? '') < (best.id ?? ''))
    ) {
      best = it
    }
  }
  return best
}

/** Where to start looking for this sleeper's tile. */
function anchorFor(
  sleeper: Sleeper,
  world: SleepWorld,
): { x: number; y: number } {
  const id = sleeper.id
  const maxY = world.rows - BOTTOM_MARGIN - 1
  // Watched them go: they lie down on the spot.
  if (sleeper.x != null && sleeper.y != null) {
    return {
      x: clamp(Math.round(sleeper.x), 0, world.cols - 1),
      y: clamp(Math.round(sleeper.y), TOP_ROW, maxY),
    }
  }
  const item = ownItem(id, world.objects)
  if (item) {
    // Just off the item's left edge, on its bottom row — the search spirals out
    // from here, so a crowded corner simply pushes them a tile or two further.
    return {
      x: clamp(item.x - 1, 0, world.cols - 1),
      y: clamp(item.y + item.h - 1, TOP_ROW, maxY),
    }
  }
  const h = hash(id)
  return {
    x: h % world.cols,
    y: TOP_ROW + ((h >>> 8) % Math.max(1, maxY - TOP_ROW + 1)),
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Nearest tile to (ax, ay) that a koala can lie on: clear of the park's
 * furniture, and at least `gap` tiles from every koala already lying down.
 * Spirals outward, so a huddle is pushed apart rather than stacked up. Null if
 * nowhere in the park satisfies it.
 */
function findFree(
  ax: number,
  ay: number,
  objects: readonly Rect[],
  lying: readonly { x: number; y: number }[],
  gap: number,
  world: SleepWorld,
): { x: number; y: number } | null {
  const maxY = world.rows - BOTTOM_MARGIN - 1
  const free = (x: number, y: number) =>
    x >= 0 &&
    x <= world.cols - 1 &&
    y >= TOP_ROW &&
    y <= maxY &&
    !objects.some((r) => overlaps(x, y, r)) &&
    !lying.some((s) => Math.hypot(s.x - x, s.y - y) < gap)

  if (free(ax, ay)) return { x: ax, y: ay }
  const maxR = world.cols + world.rows
  // Ring by ring outward, walking each ring's PERIMETER rather than re-scanning
  // the square inside it: the gap reaches most of a screen, so the search runs
  // far and the difference is O(r) per ring instead of O(r²).
  for (let r = 1; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      if (free(ax + dx, ay - r)) return { x: ax + dx, y: ay - r }
      if (free(ax + dx, ay + r)) return { x: ax + dx, y: ay + r }
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      if (free(ax - r, ay + dy)) return { x: ax - r, y: ay + dy }
      if (free(ax + r, ay + dy)) return { x: ax + r, y: ay + dy }
    }
  }
  return null
}

/**
 * Lay out the sleeping koalas. `previous` (the last layout) keeps everyone who
 * is still asleep exactly where they were — pass it every time, or the park's
 * nappers will shuffle whenever anything else in it moves.
 *
 * A sleeper the park has no room for is left out rather than stacked on someone.
 */
export function layoutSleepers(
  sleepers: readonly Sleeper[],
  world: SleepWorld,
  previous?: ReadonlyMap<string, SleepSpot>,
): Map<string, SleepSpot> {
  const out = new Map<string, SleepSpot>()
  const objects: Rect[] = world.objects.map((r) => ({
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  }))
  const lying: { x: number; y: number }[] = []

  // Rule 4 first: everyone already lying down keeps their tile (their name can
  // still change — a rename reaches items and sleepers alike).
  for (const s of sleepers) {
    const prev = previous?.get(s.id)
    if (!prev) continue
    out.set(s.id, { ...prev, name: s.name })
    lying.push({ x: prev.x, y: prev.y })
  }

  // Then the new arrivals. Anyone the park watched go is laid down first, since
  // they have a claim on one particular tile and nobody else does; the rest
  // follow in a stable order, so a layout never depends on the order the server
  // happened to list them in.
  const witnessed = (s: Sleeper) => s.x != null && s.y != null
  const pending = sleepers
    .filter((s) => !out.has(s.id))
    .sort((a, b) => {
      if (witnessed(a) !== witnessed(b)) return witnessed(a) ? -1 : 1
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
  for (const s of pending) {
    const anchor = anchorFor(s, world)
    // Ask for room first; settle for less only where the park has none left.
    // A koala you saw leave skips this and simply takes its tile.
    let spot: { x: number; y: number } | null = null
    for (const gap of witnessed(s) ? WITNESSED_GAPS : RELAXED_GAPS) {
      spot = findFree(anchor.x, anchor.y, objects, lying, gap, world)
      if (spot) break
    }
    if (!spot) continue
    out.set(s.id, {
      id: s.id,
      name: s.name,
      x: spot.x,
      y: spot.y,
      // Which way they face is arbitrary but fixed, so a sleeper never flips.
      dir: (hash(s.id) & 1) === 0 ? 'left' : 'right',
    })
    lying.push({ x: spot.x, y: spot.y })
  }
  return out
}
