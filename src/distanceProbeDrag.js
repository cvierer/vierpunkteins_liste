/** Mindest-Verschiebung (px) bis die Bewegungslinie erscheint. */
export const PROBE_MAP_DRAG_MOVE_EPS = 0.5

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ mapDragging: boolean, showLine: boolean }} ProbeMovementLatch
 */

/**
 * Feste Referenz = Dist-Klick-Position. Linie ab erster Bewegung bis pointerup (mapDragging).
 * @param {boolean} mapDragging bereits gezogen (latched bis Loslassen)
 * @param {Point | null} movementAnchor Referenz beim Dist-Anklicken
 * @param {Point} currentCenter aktuelles Token-Zentrum
 * @param {number} [epsilon]
 * @param {boolean} [dragReleased] nach pointerup: keine erneute Latch bis pointerdown
 * @returns {ProbeMovementLatch}
 */
export function latchProbeMapDrag(
  mapDragging,
  movementAnchor,
  currentCenter,
  epsilon = PROBE_MAP_DRAG_MOVE_EPS,
  dragReleased = false
) {
  if (!movementAnchor || dragReleased) {
    return { mapDragging: false, showLine: false }
  }
  if (mapDragging) {
    return { mapDragging: true, showLine: true }
  }
  const moved =
    Math.hypot(
      currentCenter.x - movementAnchor.x,
      currentCenter.y - movementAnchor.y
    ) > epsilon
  return { mapDragging: moved, showLine: moved }
}

/** @deprecated Nur Tests — alte Abhebepunkt-Logik. */
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
