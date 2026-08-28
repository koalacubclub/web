// Which of the park's idle animations are running, and how strongly.
//
// The park used to fidget everywhere at once: every flower patch swayed and
// every ball bounced on every frame, whether or not Koala was anywhere near
// them. Now the motion follows her — a patch stirs and a ball starts hopping as
// she comes close, and both settle once she has wandered off. It is the same
// proximity idea a radio already plays on (RADIO_REACH in ParkGame), and it
// also means the park is calm wherever she isn't.
//
// The fade band is the point. A hard on/off at one radius would snap a bloom
// mid-stroke and leave a ball hanging in the air. These return an AMPLITUDE
// instead: the art keeps its phase running underneath and just scales what it
// draws, so a thing eases down to its rest pose and lifts out of it again,
// however fast she walks past.

/** Tiles from Koala within which idle motion runs at full strength. */
export const IDLE_REACH = 2.5

/** Tiles beyond that over which the motion eases off to nothing. */
export const IDLE_FADE = 1.5

/**
 * How much of its idle motion something `distance` tiles from Koala plays:
 * 1 up close, easing to 0 (dead still) out of reach.
 */
export function idleMotion(distance: number): number {
  const t = (IDLE_REACH + IDLE_FADE - distance) / IDLE_FADE
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** Tiles between Koala's centre and the centre of an object's footprint. */
export function tileDistance(
  cat: { x: number; y: number },
  obj: { x: number; y: number; w: number; h: number },
): number {
  return Math.hypot(
    cat.x + 0.5 - (obj.x + obj.w / 2),
    cat.y + 0.5 - (obj.y + obj.h / 2),
  )
}

/** The idle motion an object gets with Koala where she is — the park's one call. */
export function idleMotionNear(
  cat: { x: number; y: number },
  obj: { x: number; y: number; w: number; h: number },
): number {
  return idleMotion(tileDistance(cat, obj))
}
