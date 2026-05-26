/** Mindest-Verschiebung (px) bis die Bewegungslinie erscheint. */
export const PROBE_MAP_DRAG_MOVE_EPS = 0.5

/** Frames mit unverändertem Zentrum nach Bewegung = Token abgesetzt. */
export const PROBE_PLACE_STABLE_FRAMES = 2

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ mapDragging: boolean, showLine: boolean }} ProbeMovementLatch
 * @typedef {{
 *   lastCenter: Point | null,
 *   mapDragging: boolean,
 *   unchangedFrames: number,
 * }} ProbePlacementState
 * @typedef {{
 *   nextState: ProbePlacementState,
 *   mapDragging: boolean,
 *   placed: boolean,
 *   currentCenter: Point,
 * }} ProbePlacementTickResult
 */

/** @returns {ProbePlacementState} */
export function createProbePlacementState() {
  return { lastCenter: null, mapDragging: false, unchangedFrames: 0 }
}

/**
 * Erkennt Karten-Drag/Absetzen über Token-Zentrum (ohne document-pointerup).
 * @param {Point} currentCenter
 * @param {ProbePlacementState} state
 * @param {{ epsilon?: number, stableFrames?: number }} [options]
 * @returns {ProbePlacementTickResult}
 */
export function trackProbePlacementCenter(currentCenter, state, options = {}) {
  const epsilon = options.epsilon ?? PROBE_MAP_DRAG_MOVE_EPS
  const stableFrames = options.stableFrames ?? PROBE_PLACE_STABLE_FRAMES
  const lastCenter = state.lastCenter

  if (!lastCenter) {
    return {
      nextState: {
        lastCenter: currentCenter,
        mapDragging: false,
        unchangedFrames: 0,
      },
      mapDragging: false,
      placed: false,
      currentCenter,
    }
  }

  const frameMoved =
    Math.hypot(currentCenter.x - lastCenter.x, currentCenter.y - lastCenter.y) >
    epsilon

  if (frameMoved) {
    return {
      nextState: {
        lastCenter: currentCenter,
        mapDragging: true,
        unchangedFrames: 0,
      },
      mapDragging: true,
      placed: false,
      currentCenter,
    }
  }

  let mapDragging = state.mapDragging
  let unchangedFrames = state.unchangedFrames + 1
  let placed = false
  if (mapDragging && unchangedFrames >= stableFrames) {
    placed = true
    mapDragging = false
    unchangedFrames = 0
  }

  return {
    nextState: {
      lastCenter: currentCenter,
      mapDragging,
      unchangedFrames,
    },
    mapDragging,
    placed,
    currentCenter,
  }
}

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
