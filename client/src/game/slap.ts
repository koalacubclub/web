import { SLAP_DURATION_MS } from '@koala/shared'

// A slap is a purely visual paw-swipe (the koala's tile x/y never change). Given
// the timestamp a slap started and the current time (same clock), return the
// progress through the swing in [0,1) during the window, else 0 (idle).
//
// The "never slapped" sentinel is -Infinity (NOT 0): performance.now()'s origin
// is page load, so a 0 sentinel would read as "slapped at load" and play a
// phantom swipe. -Infinity yields t = Infinity → 0 (idle), mirroring jump.
export function slapPhase(startedAt: number, now: number): number {
  const t = (now - startedAt) / SLAP_DURATION_MS
  return t > 0 && t < 1 ? t : 0
}

// The paw-swing amount in [0,1]: a quick out-and-back (sin(pi·t)) that peaks at
// mid-swing and is 0 outside the window. Callers rotate/extend a foreleg by it.
export function slapSwing(startedAt: number, now: number): number {
  const t = slapPhase(startedAt, now)
  return t > 0 ? Math.sin(Math.PI * t) : 0
}
