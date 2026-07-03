/**
 * Pure follow-camera math for `ParkGame`, extracted so it can be unit-tested
 * without a DOM or `<canvas>`. One call handles a single axis; `updateCamera()`
 * calls it once for horizontal and once for vertical panning.
 */

export interface CameraPan {
  /** px to translate the (layout-centered) canvas along this axis; 0 if it fits. */
  translate: number
  /** logical-canvas px to counter-translate the HUD so it stays viewport-pinned. */
  hudShift: number
}

/**
 * Compute one axis of the follow camera.
 *
 * @param pointFrac     tracked point (the cat) as a fraction `[0,1]` of the
 *                      canvas along this axis
 * @param viewport      visible size along this axis — the **scrollbar-excluded**
 *                      box the canvas is centered in (measure the parent, not
 *                      `window.innerWidth`/`innerHeight`)
 * @param display       rendered (CSS) canvas size along this axis
 * @param canvasLogical logical canvas size along this axis (`CANVAS_WIDTH` /
 *                      `CANVAS_HEIGHT`), used to convert the pan into logical px
 *                      for the HUD counter-shift
 *
 * When the canvas fits within the viewport (`display <= viewport`) there is no
 * pan. Otherwise the canvas is panned to center the point, clamped so its
 * leading/trailing edge never leaves a gap (edge stays within
 * `[viewport - display, 0]`).
 */
export function cameraPan(
  pointFrac: number,
  viewport: number,
  display: number,
  canvasLogical: number,
): CameraPan {
  // Sub-px slop mirrors updateCamera's guard and avoids jitter at equality.
  if (display - viewport <= 0.5) return { translate: 0, hudShift: 0 }
  const pointDisplay = pointFrac * display
  // The canvas is laid out centered, so its leading edge sits here by default.
  const centered = (viewport - display) / 2
  // Desired leading edge (screen px): center the point, but clamp so the canvas
  // still fully covers the viewport — never scroll past the map's edges.
  const desired = Math.min(
    0,
    Math.max(viewport - display, viewport / 2 - pointDisplay),
  )
  return {
    translate: desired - centered,
    hudShift: -desired * (canvasLogical / display),
  }
}
