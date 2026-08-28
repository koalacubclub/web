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

// The minimal shape pickSlapTarget needs (GameObject is a structural superset).
export interface SlapTarget {
  type: string
  x: number
  y: number
  w: number
  h: number
}

// Choose which object a slap hits from the cat centre (cx, cy), within `reach`
// tiles. Distance is measured to each object's BOX (not its centre), so big
// objects like the pond/house are reachable when the cat is beside an edge; UI
// hotspots (social/photo) are skipped. A reachable BALL takes priority over
// everything else — even a closer item — so a ball overlapping another object
// stays kickable. Returns the chosen object, or null on a whiff.
export function pickSlapTarget<T extends SlapTarget>(
  objects: readonly T[],
  cx: number,
  cy: number,
  reach: number,
): T | null {
  let best: T | null = null
  let bestD = Infinity
  let bestBall: T | null = null
  let bestBallD = Infinity
  for (const o of objects) {
    if (o.type === 'social' || o.type === 'photo') continue
    const nx = Math.max(o.x, Math.min(cx, o.x + o.w))
    const ny = Math.max(o.y, Math.min(cy, o.y + o.h))
    const d = Math.hypot(cx - nx, cy - ny)
    if (d >= reach) continue
    if (d < bestD) {
      best = o
      bestD = d
    }
    if (o.type === 'ball' && d < bestBallD) {
      bestBall = o
      bestBallD = d
    }
  }
  return bestBall ?? best
}

// How close (tiles) a ball has to be to a map edge to count as against it, and
// how close the two centres have to be to count as the cat standing ON it.
const EDGE = 0.05
const COINCIDENT = 0.05

/**
 * The unit direction a slap knocks a ball in: away from the cat, except where
 * that would just shove it into an edge it is already flush against — there the
 * outward component is flipped so the ball comes back into the park.
 *
 * Both special cases are why a ball got stuck along an edge. The cat's own
 * clamp stops level with the ball's (both cap x at the last column; she can't
 * get below the bottom row either), so once a ball is against a wall she can
 * never stand on the far side of it: every kick pointed further into the wall.
 * And reaching one usually means standing ON it, where "away from the cat" is
 * the zero vector — the ball took a velocity of 0, which the integrator then
 * cleared as "at rest". Slap after slap, nothing moved.
 *
 * The bounds are `updateSlappables`': x in [0, mapCols - w], y in [1,
 * groundRows - h].
 */
export function kickDirection(
  ball: { x: number; y: number; w: number; h: number },
  cx: number,
  cy: number,
  facing: 'left' | 'right',
  mapCols: number,
  groundRows: number,
): { x: number; y: number } {
  let dx = ball.x + ball.w / 2 - cx
  let dy = ball.y + ball.h / 2 - cy
  const d = Math.hypot(dx, dy)
  if (d < COINCIDENT) {
    // She is standing on it — the usual way to reach a ball pinned against an
    // edge, since there is no walking round it. Kick it the way she is looking.
    dx = facing === 'left' ? -1 : 1
    dy = 0
  } else {
    dx /= d
    dy /= d
  }
  // Flipping one component keeps the vector a unit one, so the kick lands with
  // the same strength wherever it is taken.
  const atLeft = ball.x <= EDGE
  const atRight = ball.x >= mapCols - ball.w - EDGE
  const atTop = ball.y <= 1 + EDGE
  const atBottom = ball.y >= groundRows - ball.h - EDGE
  if ((atLeft && dx < 0) || (atRight && dx > 0)) dx = -dx
  if ((atTop && dy < 0) || (atBottom && dy > 0)) dy = -dy
  return { x: dx, y: dy }
}

// A short-lived slap impact burst (impact stars, or a pond splash), in canvas px.
// `born` is a frameCount stamp; `life` counts down in frame-units.
export interface SlapEffect {
  kind: 'stars' | 'splash'
  x: number
  y: number
  born: number
  life: number
}

// The minimal shape updateSlappables needs (GameObject is a structural superset).
interface Slappable {
  x: number
  y: number
  w: number
  h: number
  vx?: number
  vy?: number
}

// How long (ms) an object jitters after being slapped.
export const SLAP_SHAKE_MS = 350

// A decaying horizontal wobble (canvas px) for the first SLAP_SHAKE_MS after an
// object was hit; 0 outside that window. Wrap an object's draw in translate(x,0).
export function slapShake(hitAt: number, now: number, pixel: number): number {
  const age = now - hitAt
  if (age < 0 || age > SLAP_SHAKE_MS) return 0
  const k = 1 - age / SLAP_SHAKE_MS
  return Math.sin(age * 0.05) * k * pixel * 0.12
}

// Integrate objects knocked by a slap (currently the ball): move by velocity
// (tiles/ms × dt), decelerate with friction, bounce off the map edges, and clear
// the velocity once slow so it drops out of this loop. Mutates in place.
export function updateSlappables(
  objects: Slappable[],
  dt: number,
  mapCols: number,
  groundRows: number,
): void {
  for (const o of objects) {
    if (o.vx == null || o.vy == null) continue
    o.x += o.vx * dt
    o.y += o.vy * dt
    const fr = Math.max(0, 1 - 0.006 * dt)
    o.vx *= fr
    o.vy *= fr
    if (o.x < 0) {
      o.x = 0
      o.vx = -o.vx * 0.6
    } else if (o.x > mapCols - o.w) {
      o.x = mapCols - o.w
      o.vx = -o.vx * 0.6
    }
    if (o.y < 1) {
      o.y = 1
      o.vy = -o.vy * 0.6
    } else if (o.y > groundRows - o.h) {
      o.y = groundRows - o.h
      o.vy = -o.vy * 0.6
    }
    if (Math.hypot(o.vx, o.vy) < 0.0003) {
      o.vx = undefined
      o.vy = undefined
    }
  }
}

// Draw + age the slap impact bursts (impact stars + pond droplet splash), fading
// out. Returns the still-alive effects (caller reassigns its list).
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: SlapEffect[],
  frameCount: number,
  pixel: number,
  fr: number,
): SlapEffect[] {
  const alive = effects.filter((e) => e.life > 0)
  alive.forEach((e) => {
    e.life -= fr
    const total = e.kind === 'splash' ? 28 : 20
    const p = Math.min(1, (frameCount - e.born) / total)
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - p)
    if (e.kind === 'stars') {
      ctx.fillStyle = '#FFE97A'
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        const r = p * pixel * 0.5
        ctx.beginPath()
        ctx.arc(
          e.x + Math.cos(a) * r,
          e.y + Math.sin(a) * r,
          2 + (1 - p) * 2,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
    } else {
      // Splash: a ring of droplets arcing up/out (no ripple ring).
      ctx.fillStyle = 'rgba(200,235,255,0.95)'
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const rr = p * pixel * 1.1
        const lift = -Math.sin(p * Math.PI) * pixel * 0.5
        ctx.beginPath()
        ctx.arc(
          e.x + Math.cos(a) * rr,
          e.y + Math.sin(a) * rr * 0.5 + lift,
          2.5 * (1 - p) + 1,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
    }
    ctx.restore()
  })
  return alive
}
