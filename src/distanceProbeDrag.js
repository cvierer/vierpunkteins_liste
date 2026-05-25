/** Mindest-Verschiebung (px) fuer Map-Drag der Dist-Probe. */
export const PROBE_MAP_DRAG_MOVE_EPS = 0.5

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{
 *   lastCenter: Point,
 *   dragActive: boolean,
 *   dragAnchor: Point | null,
 *   movementAnchor: Point | null,
 * }} ProbeMapDragState
 */

/**
 * Erkennt Karten-Drag: Anker = letztes Zentrum vor Bewegung (Abhebepunkt).
 * @param {Point | null} lastCenter
 * @param {Point} currentCenter
 * @param {boolean} dragActive
 * @param {Point | null} dragAnchor
 * @param {number} [epsilon]
 * @returns {ProbeMapDragState}
 */
export function advanceProbeMapDragState(
  lastCenter,
  currentCenter,
  dragActive,
  dragAnchor,
  epsilon = PROBE_MAP_DRAG_MOVE_EPS
) {
  const moved =
    lastCenter != null &&
    Math.hypot(
      currentCenter.x - lastCenter.x,
      currentCenter.y - lastCenter.y
    ) > epsilon

  let nextActive = dragActive
  let nextAnchor = dragAnchor

  if (moved) {
    if (!dragActive) {
      nextActive = true
      nextAnchor = lastCenter
    }
  } else {
    nextActive = false
  }

  const movementAnchor =
    nextActive && nextAnchor != null ? nextAnchor : null

  return {
    lastCenter: currentCenter,
    dragActive: nextActive,
    dragAnchor: nextAnchor,
    movementAnchor,
  }
}
