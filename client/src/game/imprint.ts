// The "koala" flower-bed ground imprint drawn under the IG/TikTok billboards.
// Pulled out of ParkGame.tsx (which is already huge) since it's self-contained:
// it only needs a 2D context, the tile/scale sizes, and the park palette. Baked
// once into the static background, so it takes no tile/collision space.

// The subset of the park palette the imprint reads from.
export interface ImprintPalette {
  grassDark: string
  grassLight: string
  treeLeaves: string
  treeLeavesLight: string
  flower2: string // soft yellow eye of the white blossoms
  white: string
}

// A tiny seeded PRNG (mulberry32) so the scatter is stable frame to frame and
// across reloads — a local copy keeps this module free of ParkGame imports.
function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One little foliage leaf: a rotated ellipse with a central vein. Densely
// scattered to build up the "koala" flower-bed lettering.
function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
  fill: string,
  vein: string,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = vein
  ctx.lineWidth = Math.max(0.5, r * 0.14)
  ctx.beginPath()
  ctx.moveTo(-r * 0.85, 0)
  ctx.lineTo(r * 0.85, 0)
  ctx.stroke()
  ctx.restore()
}

// A little five-petal blossom (a camellia-ish bloom) around a bright centre.
function drawBlossom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  petal: string,
  center: string,
) {
  ctx.fillStyle = petal
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ctx.beginPath()
    ctx.ellipse(
      x + Math.cos(a) * r * 0.5,
      y + Math.sin(a) * r * 0.5,
      r * 0.5,
      r * 0.34,
      a,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.fillStyle = center
  ctx.beginPath()
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2)
  ctx.fill()
}

// "koala" spelled out on the grass as a dense bed of leaves + camellia blossoms
// clustered into the letter shapes, then projected onto the ground plane
// (vertical squash + near/far size gradient + a uniform right-lean) so the word
// reads as if lying flat on the floor, tilted a touch. Draws at the caller's
// current transform origin, so translate to the world before calling. No-ops if
// there's no offscreen canvas available (SSR / tests).
export function drawKoalaImprint(
  ctx: CanvasRenderingContext2D,
  pixel: number,
  scale: number,
  colors: ImprintPalette,
  tint: (c: string) => string = (c) => c,
): void {
  if (typeof document === 'undefined') return
  // 1. Rasterise the word offscreen so we can sample where its letters are.
  // Bold (not black) + generous letter-spacing keeps the strokes slim and the
  // counters/gaps open, so the foliage traces readable letterforms.
  const fontPx = 140
  const off = document.createElement('canvas')
  const octx = off.getContext('2d')
  if (!octx) return
  // Italic so every letter leans to the right; weight 600 keeps the strokes
  // slim so the counters (holes in o/a) stay open.
  const font = `italic 600 ${fontPx}px "Arial", "Helvetica", sans-serif`
  octx.font = font
  octx.letterSpacing = `${Math.round(fontPx * 0.04)}px`
  // Extra horizontal padding: the italic slant overhangs past the advance width.
  const W = Math.ceil(octx.measureText('koala').width) + Math.ceil(fontPx * 0.7)
  const H = Math.ceil(fontPx * 1.35)
  off.width = W
  off.height = H
  octx.font = font
  octx.letterSpacing = `${Math.round(fontPx * 0.04)}px`
  octx.textAlign = 'center'
  octx.textBaseline = 'middle'
  octx.fillStyle = '#fff'
  octx.fillText('koala', W / 2, H / 2)
  const px = octx.getImageData(0, 0, W, H).data

  // 2. Collect jittered sample points inside the glyphs — sparse enough that the
  // grass shows through between elements (a cluster, not a solid slab).
  const rng = makeRng(0x0a1a)
  const step = 5
  const pts: [number, number][] = []
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (px[(y * W + x) * 4 + 3] > 128 && rng() < 0.97) {
        // Small jitter only — large jitter smears leaves into the o/a holes.
        pts.push([
          x + (rng() - 0.5) * step * 0.5,
          y + (rng() - 0.5) * step * 0.5,
        ])
      }
    }
  }
  // Draw far (top) points first so nearer foliage overlaps them.
  pts.sort((a, b) => a[1] - b[1])

  // 3. Project onto the ground plane and scatter foliage.
  const cx = pixel * 12.9 // shifted right, under/right of the billboards
  const cy = pixel * 10.6
  const spanX = pixel * 7.4 // word width (wide, letters set close)
  const spanY = pixel * 2.1 // squashed height (foreshortened → lies flat)
  // Near/far only scales element SIZE (a depth cue) — NOT horizontal x. Tapering
  // x per row would shear the outer letters (making "ala" lean the wrong way);
  // the flat-on-ground read comes from the vertical squash + this size gradient.
  const farS = 0.72 // element scale at the far (top) edge
  const nearS = 1.08 // …and at the near (bottom) edge
  // Park-palette greens, but weighted DARK (tree greens + a deep green) so the
  // word reads against the light grass patch it sits on. A little grassLight is
  // kept for highlight sparkle. All baked with the same night tint as the park.
  // Night-grade every colour with the same `tint` the objects use (so the imprint
  // reads consistently with the park, and its white blossoms still stay bright).
  const leafGreens = [
    '#2E7D48', // deep green, nudged a touch bluer
    '#2E7D48',
    colors.treeLeaves,
    colors.treeLeaves,
    colors.grassDark,
    colors.treeLeavesLight,
    colors.grassLight, // occasional highlight
    '#8CC152', // a few yellow-green leaves for variety
  ].map(tint)
  const leafVein = 'rgba(55,70,64,0.45)'
  // White blossoms only (a soft yellow eye for a little definition).
  const petals = [colors.white].map(tint)
  const centers = [colors.flower2].map(tint)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.06) // slight slant
  for (const [lx, ly] of pts) {
    const u = lx / W - 0.5
    const v = ly / H // 0 far(top) … 1 near(bottom)
    const depth = farS + (nearS - farS) * v
    const wy = (v - 0.5) * spanY
    // Uniform right-lean: shift the top rightward, bottom leftward, by the same
    // slope for every letter (on top of the italic font) — no per-column taper,
    // so all 5 letters lean the same way rather than fanning out.
    const lean = 0.45
    const wx = u * spanX - lean * wy
    const r = scale * (1.25 + rng() * 1.0) * depth
    if (rng() < 0.07) {
      // greener overall: white blossoms are just occasional accents
      const i = (rng() * petals.length) | 0
      const c = (rng() * centers.length) | 0
      drawBlossom(ctx, wx, wy, r * 1.3, petals[i], centers[c])
    } else {
      const i = (rng() * leafGreens.length) | 0
      drawLeaf(ctx, wx, wy, r, (rng() - 0.5) * Math.PI, leafGreens[i], leafVein)
    }
  }
  ctx.restore()
}
