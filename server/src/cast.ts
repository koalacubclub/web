// Who each viewer is shown — the park's answer to "what if thousands join?".
//
// Every connection gets a CAST: a random sample of at most CAST_SIZE other
// users, drawn once when it joins (see the CAST_SIZE note in shared/protocol).
// The cast bounds BOTH ends of the cost curve — the Durable Object relays a
// koala's movement only to the viewers showing them (instead of to everyone),
// and a client never draws more than CAST_SIZE koalas or their items.
//
// The rules, in the order they matter:
//   1. online-first — a live park is the point, so live koalas are sampled
//      before the owners of items left behind by offline ones;
//   2. never evict — a member who logs off keeps their slot, so their items
//      stay put and they're simply not drawn until they come back;
//   3. no backfill — a slot doesn't reopen when its member leaves, so the park
//      you're shown doesn't quietly reshuffle underneath you;
//   4. grow into free slots — a newcomer joins the casts that still have room,
//      which is what makes "fewer than CAST_SIZE online → you see everyone" true;
//   5. per-viewer and asymmetric — seeing someone doesn't put you in their cast.
//
// This module is pure bookkeeping (no Cloudflare, no I/O) so the sampling rules
// can be tested directly; GameWorld owns the sockets and the messages.
import { CAST_SIZE } from '@koala/shared'

/** A viewer's cast changed: `viewer` is now shown `added`. */
export interface Admission {
  viewer: string
  added: string
}

export class Casting {
  // viewer → the users it is shown. Capped at CAST_SIZE; only ever grows.
  private shown = new Map<string, Set<string>>()
  // user → the viewers showing them. The reverse index of `shown`, and the
  // reason a state relay is O(viewers of one koala) instead of O(park).
  private viewers = new Map<string, Set<string>>()

  /** Injected for tests; production leaves it as Math.random. */
  constructor(
    private readonly random: () => number = Math.random,
    private readonly limit: number = CAST_SIZE,
  ) {}

  /**
   * Draw a viewer's cast: a random sample of `online`, topped up from `owners`
   * (users with items in the park, typically offline) if there's room left.
   * Both may contain the viewer itself and may overlap — neither is a problem.
   * Returns the sampled ids. Re-opening an existing viewer re-rolls it.
   */
  open(
    viewer: string,
    online: Iterable<string>,
    owners: Iterable<string> = [],
  ): string[] {
    this.close(viewer)
    const cast = new Set<string>()
    for (const pool of [online, owners]) {
      if (cast.size >= this.limit) break
      for (const id of this.sample(pool, viewer, cast)) cast.add(id)
    }
    this.shown.set(viewer, cast)
    for (const id of cast) this.watchersFor(id).add(viewer)
    return [...cast]
  }

  /** Forget a viewer (its socket is gone). Does not touch anyone else's cast. */
  close(viewer: string): void {
    const cast = this.shown.get(viewer)
    if (!cast) return
    for (const id of cast) {
      const set = this.viewers.get(id)
      if (!set) continue
      set.delete(viewer)
      if (set.size === 0) this.viewers.delete(id)
    }
    this.shown.delete(viewer)
  }

  /**
   * Offer a newcomer to every viewer, in place: they join the casts that still
   * have a free slot (rule 4) and are skipped by the full ones. A viewer that
   * already shows them is left alone — that's the returning-member case, where
   * the slot was held open for them all along.
   *
   * Returns one Admission per viewer that took them, so the caller can send the
   * `join` (and their items) to exactly those clients.
   */
  admit(user: string): Admission[] {
    const out: Admission[] = []
    for (const [viewer, cast] of this.shown) {
      if (viewer === user || cast.has(user) || cast.size >= this.limit) continue
      cast.add(user)
      this.watchersFor(user).add(viewer)
      out.push({ viewer, added: user })
    }
    return out
  }

  /** Whether this viewer already holds a cast (a second tab of a live session
   *  shares the one its session drew, rather than re-rolling it). */
  hasViewer(viewer: string): boolean {
    return this.shown.has(viewer)
  }

  /** Whether `viewer` is shown `user` (its koala and its items). */
  shows(viewer: string, user: string): boolean {
    return this.shown.get(viewer)?.has(user) === true
  }

  /** The viewers to relay `user`'s traffic to — empty if nobody is shown them. */
  watchersOf(user: string): ReadonlySet<string> {
    return this.viewers.get(user) ?? EMPTY
  }

  /** The users `viewer` is shown, for building its welcome / resync payload. */
  castOf(viewer: string): ReadonlySet<string> {
    return this.shown.get(viewer) ?? EMPTY
  }

  /** Every viewer with a cast (i.e. every live connection). */
  viewerIds(): Iterable<string> {
    return this.shown.keys()
  }

  /** Partial Fisher–Yates: up to the free slots, skipping self and duplicates. */
  private sample(
    pool: Iterable<string>,
    viewer: string,
    taken: ReadonlySet<string>,
  ): string[] {
    const seen = new Set<string>()
    const ids: string[] = []
    for (const id of pool) {
      if (!id || id === viewer || taken.has(id) || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
    const want = Math.min(this.limit - taken.size, ids.length)
    for (let i = 0; i < want; i++) {
      const j = i + Math.floor(this.random() * (ids.length - i))
      const tmp = ids[i]
      ids[i] = ids[j]
      ids[j] = tmp
    }
    return ids.slice(0, want)
  }

  private watchersFor(id: string): Set<string> {
    let set = this.viewers.get(id)
    if (!set) {
      set = new Set()
      this.viewers.set(id, set)
    }
    return set
  }
}

const EMPTY: ReadonlySet<string> = new Set()
