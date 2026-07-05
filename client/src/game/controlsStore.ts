// controlsStore — the input bridge between the React control overlay (joystick +
// ability buttons) and the imperative canvas game loop. Kept separate from
// parkStore so the 60fps loop's lean snapshot isn't polluted.
//
// The on-screen controls are ALWAYS shown — Gamer mode is the default now, with no
// toggle — so this module only carries input:
//   • the joystick writes an analog move vector imperatively (like g.keys) — no
//     re-render per frame; the game loop reads getMove() each tick.
//   • ability buttons call fireAbility(a); ParkGame registers the handler.
//   • the game marks when an ability fired (markFired) so buttons can draw a
//     cooldown sweep (polled via rAF, not reactive).

import type { AbilityKind } from '@koala/shared'

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

// ── Global cooldown (game → UI) ────────────────────────────────────────────
// The game sets when the shared GCD ends so every ability button can draw the
// same short recovery sweep (WoW-style), polled via rAF alongside per-ability CDs.
let gcdUntil = -Infinity
/** Called by the game when a GCD ability fires, with performance.now()+GCD. */
export function markGcd(until: number): void {
  gcdUntil = until
}
/** performance.now() at which the global cooldown ends (−Infinity if none). */
export function getGcdUntil(): number {
  return gcdUntil
}

// Test-only: reset module state between tests.
export function __resetForTests(): void {
  clearMove()
  abilityFn = null
  gcdUntil = -Infinity
  for (const k of Object.keys(firedAt)) delete firedAt[k]
}
