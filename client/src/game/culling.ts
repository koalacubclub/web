// Pure visibility math for the ParkGame object pass. The camera pans the (wide)
// canvas via a CSS transform, so only a horizontal slice is ever on screen —
// objects outside it are culled instead of drawing the whole 58-column map every
// frame. Extracted (like parkCamera.ts) so it can be unit-tested without a DOM.
import { CANVAS_WIDTH } from './constants'

export interface VisibleRange {
  /** left edge of the on-screen slice, in logical-canvas px */
  left: number
  /** right edge of the on-screen slice, in logical-canvas px */
  right: number
}

/**
 * The visible slice of the map in logical-x. `hudShift` is the camera's left
 * edge (see cameraPan); the slice is as wide as the viewport, scaled from CSS px
 * back into logical px. When the canvas isn't panned (`displayW <= 0`) the whole
 * map is treated as visible.
 */
export function visibleRange(
  hudShift: number,
  viewportW: number,
  displayW: number,
): VisibleRange {
  const w = displayW > 0 ? viewportW * (CANVAS_WIDTH / displayW) : CANVAS_WIDTH
  return { left: hudShift, right: hudShift + w }
}

/**
 * Whether an object spanning `[leftPx, rightPx]` (logical-x) overlaps the visible
 * range, allowing `pad` px of slack on each side for art that overhangs its
 * footprint (tree canopy, pond rim stones).
 */
export function isVisibleX(
  leftPx: number,
  rightPx: number,
  range: VisibleRange,
  pad = 0,
): boolean {
  return rightPx >= range.left - pad && leftPx <= range.right + pad
}
