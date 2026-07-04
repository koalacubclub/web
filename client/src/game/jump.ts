import { JUMP_DURATION_MS, JUMP_PEAK_TILES } from '@koala/shared'

// A jump is a purely visual hop (the koala's tile x/y never change). Given the
// timestamp a jump started and the current time (same clock), return how high the
// koala is lifted, in TILES: a parabola peaking at mid-flight, 0 outside the
// window. Callers multiply by the tile size to get pixels.
//
// The "never jumped" sentinel is -Infinity (NOT 0): performance.now()'s origin is
// page load, so a 0 sentinel would read as "jumped at load" and render a phantom
// hop for the first JUMP_DURATION_MS. -Infinity yields t=Infinity → 0 (grounded).
export function jumpLiftTiles(startedAt: number, now: number): number {
  const t = (now - startedAt) / JUMP_DURATION_MS
  return t > 0 && t < 1 ? JUMP_PEAK_TILES * 4 * t * (1 - t) : 0
}
