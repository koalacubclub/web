// Shared night-sky art — the moon + stars the park draws in its sky, factored out
// so other scenes (e.g. the portal room's windows looking "outside") render the
// exact same moon and stars instead of their own one-off versions.

const TAU = Math.PI * 2

// Tiny seeded PRNG (mulberry32) so a star's sparkle shape is stable frame to frame.
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Crater offsets/radii as fractions of the moon radius (so it scales to any size).
const CRATERS: [number, number, number][] = [
  [-0.35, -0.18, 0.16],
  [0.28, -0.3, 0.1],
  [0.12, 0.3, 0.14],
  [-0.12, 0.16, 0.08],
  [0.4, 0.1, 0.09],
]

// The park's full moon: a soft halo, a warm cream disc, and a few darker craters.
// Centre (cx, cy) + radius r in the caller's current coordinate space.
export function drawMoonAt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.fillStyle = 'rgba(255, 253, 232, 0.12)' // soft halo
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.7, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#FFFDE8' // disc
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(208, 202, 175, 0.55)' // craters
  for (const [dx, dy, cr] of CRATERS) {
    ctx.beginPath()
    ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, TAU)
    ctx.fill()
  }
}

// One of the park's stars: a plain round dot, or — for the bigger ones (s ≥ 2.5) —
// an uneven 4-point sparkle (shape seeded by x so it's stable). `alpha` lets the
// caller drive the twinkle (or pass a constant for a static field).
export function drawStarAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  alpha: number,
) {
  ctx.fillStyle = `rgba(255, 255, 230, ${alpha})`
  if (s >= 2.5) {
    const r = rng(Math.round(x) + 1)
    const inner = s * 0.8
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU - Math.PI / 2
      const rr = i % 2 === 0 ? s * (1.8 + r() * 1.2) : inner
      const px = x + Math.cos(ang) * rr
      const py = y + Math.sin(ang) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(x, y, s, 0, TAU)
    ctx.fill()
  }
}
