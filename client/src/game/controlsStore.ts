// controlsStore — the "gamer mode" preference plus the input bridge between the
// React control overlay (joystick + ability buttons) and the imperative canvas
// game loop. Kept separate from parkStore so the 60fps loop's lean snapshot isn't
// polluted with UI-preference churn.
//
//   • gamerMode is a persisted, reactive flag (useSyncExternalStore) toggled from
//     Settings; the overlay + game loop both read it.
//   • the joystick writes an analog move vector imperatively (like g.keys) — no
//     re-render per frame; the game loop reads getMove() each tick.
//   • ability buttons call fireAbility(a); ParkGame registers the handler.
//   • the game marks when an ability fired (markFired) so buttons can draw a
//     cooldown sweep (polled via rAF, not reactive).

import type { AbilityKind } from '@koala/shared'
import { lsGet, lsSet } from './parkStore'

const KEY = 'kcc-gamer-mode'

let gamer = lsGet(KEY) === '1'
const listeners = new Set<() => void>()

export function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
/** Snapshot getter for useSyncExternalStore (a stable primitive). */
export function getGamerMode(): boolean {
  return gamer
}
export function setGamerMode(on: boolean): void {
  if (on === gamer) return
  gamer = on
  lsSet(KEY, on ? '1' : '0')
  if (!on) clearMove() // drop any held stick when leaving gamer mode
  for (const cb of listeners) cb()
}

// ── Movement (imperative: joystick → game loop) ────────────────────────────
let moveX = 0
let moveY = 0
let moving = false
/** Set the analog move vector (components in [-1,1]); marks the stick active. */
export function setMove(x: number, y: number): void {
  moveX = x
  moveY = y
  moving = true
}
/** Release the stick (koala stops). */
export function clearMove(): void {
  moveX = 0
  moveY = 0
  moving = false
}
/** The active move vector, or null when the stick is centered/released. */
export function getMove(): { x: number; y: number } | null {
  return moving ? { x: moveX, y: moveY } : null
}

// ── Ability bridge (UI button → game) ──────────────────────────────────────
let abilityFn: ((a: AbilityKind) => void) | null = null
/** ParkGame registers its ability dispatcher here (null on teardown). */
export function registerAbility(fn: ((a: AbilityKind) => void) | null): void {
  abilityFn = fn
}
export function fireAbility(a: AbilityKind): void {
  abilityFn?.(a)
}

// ── Cooldown feedback (game → UI, polled) ──────────────────────────────────
const firedAt: Record<string, number> = {}
/** Called by the game when an ability actually fires (passed its cooldown). */
export function markFired(a: AbilityKind): void {
  firedAt[a] = performance.now()
}
/** performance.now() of the last successful fire (−Infinity if never). */
export function getFiredAt(a: AbilityKind): number {
  return firedAt[a] ?? -Infinity
}

// Test-only: reset module state between tests.
export function __resetForTests(): void {
  gamer = false
  clearMove()
  abilityFn = null
  for (const k of Object.keys(firedAt)) delete firedAt[k]
  listeners.clear()
}
