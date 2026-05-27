/** Mindest-Verschiebung (px) bis die Bewegungslinie erscheint. */
export const PROBE_MAP_DRAG_MOVE_EPS = 0.5

/** Ruhezeit (ms) mit unverändertem Zentrum = Token in Ruheposition. */
export const PROBE_PLACE_STABLE_MS = 500

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ mapDragging: boolean, showLine: boolean }} ProbeMovementLatch
 * @typedef {{
 *   lastCenter: Point | null,
 *   mapDragging: boolean,
 *   lastMoveAt: number,
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
  return { lastCenter: null, mapDragging: false, lastMoveAt: 0 }
}

/**
 * Erkennt Token-Bewegung und Ruheposition (ohne document-pointerup).
 * @param {Point} currentCenter
 * @param {ProbePlacementState} state
 * @param {{ epsilon?: number, stableMs?: number, now?: number }} [options]
 * @returns {ProbePlacementTickResult}
 */
export function trackProbePlacementCenter(currentCenter, state, options = {}) {
  const epsilon = options.epsilon ?? PROBE_MAP_DRAG_MOVE_EPS
  const stableMs = options.stableMs ?? PROBE_PLACE_STABLE_MS
  const now = options.now ?? Date.now()
  const lastCenter = state.lastCenter

  if (!lastCenter) {
    return {
      nextState: {
        lastCenter: currentCenter,
        mapDragging: false,
        lastMoveAt: 0,
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
        lastMoveAt: now,
      },
      mapDragging: true,
      placed: false,
      currentCenter,
    }
  }

  const mapDragging = state.mapDragging
  const settled =
    mapDragging &&
    (stableMs === 0 || state.lastMoveAt > 0) &&
    now - state.lastMoveAt >= stableMs

  return {
    nextState: {
      lastCenter: currentCenter,
      mapDragging: settled ? false : mapDragging,
      lastMoveAt: state.lastMoveAt,
    },
    mapDragging,
    placed: settled,
    currentCenter,
  }
}

/**
 * Linie ab erster Bewegung; mapDragging latched bis Ruheposition (placed).
 * @param {boolean} mapDragging
 * @param {Point | null} movementAnchor
 * @param {Point} currentCenter
 * @param {number} [epsilon]
 * @returns {ProbeMovementLatch}
 */
/**
 * @param {Map<string, Point> | null | undefined} centersById
 * @param {Map<string, Point> | Iterable<[string, Point]>} sceneCenters
 * @param {number} [epsilon]
 */
export function detectTrackerCenterMoves(
  centersById,
  sceneCenters,
  epsilon = PROBE_MAP_DRAG_MOVE_EPS
) {
  const prev = centersById ?? new Map()
  /** @type {Map<string, Point>} */
  const nextCenters = new Map()
  let anyMoved = false

  for (const [id, center] of sceneCenters) {
    nextCenters.set(id, center)
    const last = prev.get(id)
    if (
      last != null &&
      Math.hypot(center.x - last.x, center.y - last.y) > epsilon
    ) {
      anyMoved = true
    }
  }

  return { anyMoved, nextCenters }
}

export function latchProbeMapDrag(
  mapDragging,
  movementAnchor,
  currentCenter,
  epsilon = PROBE_MAP_DRAG_MOVE_EPS
) {
  if (!movementAnchor) {
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
