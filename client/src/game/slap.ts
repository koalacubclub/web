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
