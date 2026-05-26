import OBR, { buildLabel, buildLine, buildShape } from '@owlbear-rodeo/sdk'
import {
  getGridContext,
  normalizeGridDistanceRaw,
  resolveDistanceCenter,
} from './gridDistance.js'
import {
  defaultDistRingVisible,
  isClassRingVisible,
  isCustomRingsEnabled,
  isMovementRingVisible,
} from './heroDistRingPrefs.js'
import { DIST_CLASS_THRESHOLDS } from './tokenDistance.js'

const RING_ID_PREFIX = 'vierpunkteins/dist-ring/'

/** @type {Record<string, string>} */
const RING_COLORS = {
  H: '#d23a3a',
  N: '#e08a1f',
  S: '#e0c020',
  P: '#3aa84a',
  X: '#6b7280',
}

/** @type {Set<string>} */
const lastShownRingCodes = new Set()

/** @type {{ x: number; y: number } | null} */
let lastRingDrawCenter = null

/** @type {string[]} */
let lastRingItemIds = []

/** @type {Record<string, string>} */
export const MOVEMENT_RING_COLORS = {
  m1: '#3d8fd1',
  m2: '#2563eb',
  sp: '#7c3aed',
}

export const MOVEMENT_RING_SPECS = [
  { code: 'm1', label: '1 Akt. Bewegen', mult: 1 },
  { code: 'm2', label: '2 Akt. Bewegen', mult: 2 },
  { code: 'sp', label: 'Sprint', mult: 3 },
]

/** @param {'c' | 'l' | 'e'} kind @param {string} code @param {number} [edgeIndex] */
export function ringId(kind, code, edgeIndex = 0) {
  if (kind === 'e') return `${RING_ID_PREFIX}e-${code}-${edgeIndex}`
  return `${RING_ID_PREFIX}${kind}-${code}`
}

/** Radius in px fuer einen Schwellen-Ring (Mittelpunkt + threshold Schritt). */
export function ringRadiusPx(dpi, thresholdSchritt) {
  return thresholdSchritt * dpi
}

/** Obere linke Ecke der Bounding-Box fuer ein zentriertes Rechteck (radius = halbe Kantenlaenge). */
export function boxTopLeftForCenter(center, radius) {
  return { x: center.x - radius, y: center.y - radius }
}

/** @deprecated Alias fuer boxTopLeftForCenter */
export function circleTopLeftForCenter(center, radius) {
  return boxTopLeftForCenter(center, radius)
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} r
 * @param {'CIRCLE' | 'HEXAGON' | 'RECTANGLE'} shapeType
 */
export function ringShapePosition(center, r, shapeType) {
  if (shapeType === 'RECTANGLE') {
    return boxTopLeftForCenter(center, r)
  }
  return center
}

/**
 * @param {import('./gridDistance.js').GridContext} gridContext
 */
export function isHexGridType(gridContext) {
  return (
    gridContext.type === 'HEX_VERTICAL' ||
    gridContext.type === 'HEX_HORIZONTAL'
  )
}

/** @param {import('./gridDistance.js').GridType} gridType */
export function hexRingDirections(gridType) {
  const startDeg = gridType === 'HEX_VERTICAL' ? 30 : 0
  /** @type {{ x: number, y: number }[]} */
  const dirs = []
  for (let i = 0; i < 6; i++) {
    const rad = ((startDeg + i * 60) * Math.PI) / 180
    dirs.push({ x: Math.sin(rad), y: -Math.cos(rad) })
  }
  return dirs
}

/**
 * @param {import('./gridDistance.js').GridContext} gridContext
 */
export function isIsoGridType(gridContext) {
  return gridContext.type === 'ISOMETRIC' || gridContext.type === 'DIMETRIC'
}

/** @param {import('./gridDistance.js').GridType} gridType */
export function isoRingDirections(gridType) {
  const baseDeg = gridType === 'DIMETRIC' ? 26.56505117707799 : 30
  const angles = [baseDeg, 180 - baseDeg, 180 + baseDeg, 360 - baseDeg]
  return angles.map((deg) => {
    const rad = (deg * Math.PI) / 180
    return { x: Math.sin(rad), y: -Math.cos(rad) }
  })
}

/** @param {{ x: number, y: number }} dir */
export function directionScreenAngle(dir) {
  return Math.atan2(dir.x, -dir.y)
}

/**
 * Chessboard auf Iso/Dimetric: Zellachsen + Bildschirm-Kardinalen (sortiert).
 * @param {import('./gridDistance.js').GridType} gridType
 */
export function chessboardIsoRingDirections(gridType) {
  const cardinals = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]
  const all = [...isoRingDirections(gridType), ...cardinals]
  return all.sort((a, b) => directionScreenAngle(a) - directionScreenAngle(b))
}

export function alternatingRingDirections() {
  /** @type {{ x: number, y: number }[]} */
  const dirs = []
  for (let i = 0; i < 8; i++) {
    const rad = (i * 45 * Math.PI) / 180
    dirs.push({ x: Math.sin(rad), y: -Math.cos(rad) })
  }
  return dirs
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} schritt
 * @param {number} dpi
 */
export async function alternatingRingVerticesFromObr(center, schritt, dpi) {
  return contourRingVerticesFromObr(
    center,
    schritt,
    dpi,
    'ALTERNATING',
    CONTOUR_RAY_COUNT_ALTERNATING
  )
}

/**
 * @param {{ x: number, y: number }} center
 * @param {{ x: number, y: number }} dir
 * @param {number} px
 */
export function rayPoint(center, dir, px) {
  return { x: center.x + dir.x * px, y: center.y + dir.y * px }
}

/**
 * Letzter Punkt auf Strahl mit getDistance <= schritt (Binärsuche).
 * @param {{ x: number, y: number }} center
 * @param {{ x: number, y: number }} dir
 * @param {number} schritt
 * @param {number} dpi
 * @param {(from: { x: number, y: number }, to: { x: number, y: number }) => Promise<number>} getDistanceFn
 * @param {(center: { x: number, y: number }, dir: { x: number, y: number }, px: number) => Promise<{ x: number, y: number }> | { x: number, y: number }} [pointOnRayFn]
 */
export async function findBoundaryOnRay(
  center,
  dir,
  schritt,
  dpi,
  getDistanceFn,
  pointOnRayFn = rayPoint
) {
  const maxPx = Math.ceil((Math.ceil(schritt) + 2) * dpi * 1.5)
  let lo = 0
  let hi = maxPx
  let bestPx = 0
  for (let i = 0; i < 32; i++) {
    if (lo > hi) break
    const mid = Math.floor((lo + hi) / 2)
    const p = await pointOnRayFn(center, dir, mid)
    const raw = await getDistanceFn(center, p)
    if (raw <= schritt) {
      bestPx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return pointOnRayFn(center, dir, bestPx)
}

export const CONTOUR_RAY_COUNT_HEX = 6
export const CONTOUR_RAY_COUNT_ALTERNATING = 8
export const CONTOUR_RAY_COUNT_ISO = 16

/**
 * @param {number} index
 * @param {number} rayCount
 */
export function contourRingDirectionAtIndex(index, rayCount) {
  const deg = (index * 360) / rayCount
  const rad = (deg * Math.PI) / 180
  return { x: Math.sin(rad), y: -Math.cos(rad) }
}

/**
 * Distanz-Kontur: Eckpunkte per getDistance entlang gleichmaessig verteilter Strahlen.
 * @param {{ x: number, y: number }} center
 * @param {number} schritt
 * @param {number} dpi
 * @param {import('./gridDistance.js').GridMeasurement} measurement
 * @param {number} rayCount
 */
export async function contourRingVerticesFromObr(
  center,
  schritt,
  dpi,
  measurement,
  rayCount
) {
  /** @type {{ x: number, y: number }[]} */
  const verts = []
  for (let i = 0; i < rayCount; i++) {
    const dir = contourRingDirectionAtIndex(i, rayCount)
    verts.push(
      await findBoundaryOnRay(center, dir, schritt, dpi, async (from, to) => {
        const raw = await OBR.scene.grid.getDistance(from, to)
        return normalizeGridDistanceRaw(raw, measurement, dpi)
      })
    )
  }
  return verts
}

/**
 * Kanten einschraenken: zusaetzliche Eckpunkte wenn die Kante unter schritt liegt.
 * @param {{ x: number, y: number }} center
 * @param {{ x: number, y: number }[]} verts
 * @param {number} schritt
 * @param {number} dpi
 * @param {import('./gridDistance.js').GridMeasurement} measurement
 */
export async function densifyRingVertices(center, verts, schritt, dpi, measurement) {
  if (verts.length < 3) return verts
  const getDist = async (to) => {
    const raw = await OBR.scene.grid.getDistance(center, to)
    return normalizeGridDistanceRaw(raw, measurement, dpi)
  }
  /** @type {{ x: number, y: number }[]} */
  const out = []
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]
    const b = verts[(i + 1) % verts.length]
    out.push(a)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const dMid = await getDist(mid)
    if (dMid < schritt - 0.001) {
      const dx = mid.x - center.x
      const dy = mid.y - center.y
      const len = Math.hypot(dx, dy) || 1
      const dir = { x: dx / len, y: dy / len }
      out.push(
        await findBoundaryOnRay(center, dir, schritt, dpi, async (from, to) => {
          const raw = await OBR.scene.grid.getDistance(from, to)
          return normalizeGridDistanceRaw(raw, measurement, dpi)
        })
      )
    }
  }
  return out
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} schritt
 * @param {number} dpi
 * @param {import('./gridDistance.js').GridMeasurement} measurement
 * @param {{ x: number, y: number }[]} dirs
 */
async function calibrateVerticesFromDirections(
  center,
  schritt,
  dpi,
  measurement,
  dirs
) {
  /** @type {{ x: number, y: number }[]} */
  const verts = []
  for (const dir of dirs) {
    verts.push(
      await findBoundaryOnRay(center, dir, schritt, dpi, async (from, to) => {
        const raw = await OBR.scene.grid.getDistance(from, to)
        return normalizeGridDistanceRaw(raw, measurement, dpi)
      })
    )
  }
  return densifyRingVertices(center, verts, schritt, dpi, measurement)
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} schritt
 * @param {number} dpi
 * @param {import('./gridDistance.js').GridType} gridType
 * @param {import('./gridDistance.js').GridMeasurement} measurement
 */
export async function isoRingVerticesFromObr(center, schritt, dpi, gridType, measurement) {
  if (measurement === 'CHEBYSHEV') {
    return calibrateVerticesFromDirections(
      center,
      schritt,
      dpi,
      measurement,
      chessboardIsoRingDirections(gridType)
    )
  }
  return contourRingVerticesFromObr(
    center,
    schritt,
    dpi,
    measurement,
    CONTOUR_RAY_COUNT_ISO
  )
}

/**
 * Hex-Ring: 6 Eckpunkte per OBR-Grid-Distanz kalibriert.
 * @param {{ x: number, y: number }} center
 * @param {number} schritt
 * @param {number} dpi
 * @param {import('./gridDistance.js').GridType} gridType
 * @param {import('./gridDistance.js').GridMeasurement} measurement
 */
export async function hexRingVerticesFromObr(center, schritt, dpi, gridType, measurement) {
  return calibrateVerticesFromDirections(
    center,
    schritt,
    dpi,
    measurement,
    hexRingDirections(gridType)
  )
}

/**
 * @param {{ x: number, y: number }[]} pts
 * @param {string} code
 * @param {string} color
 */
function buildCalibratedRingEdges(pts, code, color) {
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const edges = []
  for (let i = 0; i < pts.length; i++) {
    const start = pts[i]
    const end = pts[(i + 1) % pts.length]
    edges.push(
      buildLine()
        .id(ringId('e', code, i))
        .startPosition(start)
        .endPosition(end)
        .strokeColor(color)
        .strokeOpacity(0.85)
        .strokeWidth(2)
        .strokeDash([8, 6])
        .layer('DRAWING')
        .locked(true)
        .disableHit(true)
        .zIndex(-1000)
        .name(`Distanz ${code}`)
        .build()
    )
  }
  return edges
}

/** @param {import('./gridDistance.js').GridType} gridType */
export function hexRingRotation(gridType) {
  if (gridType === 'HEX_HORIZONTAL') return 90
  if (gridType === 'HEX_VERTICAL') return 0
  return 0
}

/**
 * Kalibrierter Rauten-Radius (px): Minimum der vier Achs-Abstaende via getDistance.
 * @param {{ x: number, y: number }} center
 * @param {number} schritt
 * @param {number} dpi
 */
export async function calibrateManhattanRadiusPx(center, schritt, dpi) {
  const verts = await manhattanRingVerticesFromObr(center, schritt, dpi)
  const radii = [
    Math.abs(center.y - verts[0].y),
    Math.abs(verts[1].x - center.x),
    Math.abs(verts[2].y - center.y),
    Math.abs(center.x - verts[3].x),
  ].filter((n) => n > 0)
  if (radii.length === 0) return ringRadiusPx(dpi, schritt)
  return Math.min(...radii)
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} r
 */
export function manhattanDiamondVertices(center, r) {
  return [
    { x: center.x, y: center.y - r },
    { x: center.x + r, y: center.y },
    { x: center.x, y: center.y + r },
    { x: center.x - r, y: center.y },
  ]
}

/**
 * Kandidat auf der Achse, Gitter-Y/X an snapPosition ausgerichtet (Maßband-Konsistenz).
 * @param {{ x: number, y: number }} center
 * @param {{ x: number, y: number }} dir
 * @param {number} px
 */
export async function manhattanAxisPoint(center, dir, px) {
  const raw = { x: center.x + dir.x * px, y: center.y + dir.y * px }
  try {
    const snapped = await OBR.scene.grid.snapPosition(raw, 1, true, true)
    if (dir.x !== 0) return { x: snapped.x, y: center.y }
    return { x: center.x, y: snapped.y }
  } catch {
    return raw
  }
}

/**
 * Letzter Punkt auf der Achse mit getDistance <= schritt (Binärsuche, fein statt dpi/4-Schritte).
 * @param {{ x: number, y: number }} center
 * @param {{ x: number, y: number }} dir
 * @param {number} schritt
 * @param {number} dpi
 * @param {(from: { x: number, y: number }, to: { x: number, y: number }) => Promise<number>} getDistanceFn
 * @param {(center: { x: number, y: number }, dir: { x: number, y: number }, px: number) => Promise<{ x: number, y: number }>} [axisPointFn]
 */
export async function findManhattanVertexOnAxis(
  center,
  dir,
  schritt,
  dpi,
  getDistanceFn,
  axisPointFn = manhattanAxisPoint
) {
  return findBoundaryOnRay(center, dir, schritt, dpi, getDistanceFn, axisPointFn)
}

/**
 * Manhattan-Raute: Eckpunkte per OBR-Grid-Distanz kalibriert (N, O, S, W).
 * @param {{ x: number, y: number }} center
 * @param {number} schritt
 * @param {number} dpi
 */
export async function manhattanRingVerticesFromObr(center, schritt, dpi) {
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]
  /** @type {{ x: number, y: number }[]} */
  const verts = []
  for (const dir of dirs) {
    verts.push(
      await findManhattanVertexOnAxis(center, dir, schritt, dpi, async (from, to) => {
        const raw = await OBR.scene.grid.getDistance(from, to)
        return normalizeGridDistanceRaw(raw, 'MANHATTAN', dpi)
      })
    )
  }
  return verts
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} r
 * @param {import('./gridDistance.js').GridContext} gridContext
 * @param {{ x: number, y: number } | null} [manhattanNorthVertex]
 */
export function ringLabelPosition(center, r, gridContext, manhattanNorthVertex = null) {
  if (gridContext.measurement === 'MANHATTAN' && manhattanNorthVertex) {
    return manhattanNorthVertex
  }
  return { x: center.x, y: center.y - r }
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} dpi
 * @param {number} schritt
 * @param {string} code
 * @param {string} color
 * @param {import('./gridDistance.js').GridContext} gridContext
 * @returns {Promise<{ items: import('@owlbear-rodeo/sdk').Item[], labelPos: { x: number, y: number } }>}
 */
export async function buildRingOutlineItemsAsync(
  center,
  dpi,
  schritt,
  code,
  color,
  gridContext
) {
  const r = ringRadiusPx(dpi, schritt)
  const commonShape = (position) =>
    buildShape()
      .position(position)
      .strokeColor(color)
      .strokeOpacity(0.85)
      .strokeWidth(2)
      .strokeDash([8, 6])
      .fillColor(color)
      .fillOpacity(0)
      .layer('DRAWING')
      .locked(true)
      .disableHit(true)
      .zIndex(-1000)
      .name(`Distanz ${code}`)

  const { measurement, type } = gridContext

  if (measurement === 'MANHATTAN') {
    const pts = isIsoGridType(gridContext)
      ? await contourRingVerticesFromObr(
          center,
          schritt,
          dpi,
          'MANHATTAN',
          CONTOUR_RAY_COUNT_ISO
        )
      : await manhattanRingVerticesFromObr(center, schritt, dpi)
    return {
      items: buildCalibratedRingEdges(pts, code, color),
      labelPos: ringLabelPosition(center, r, gridContext, pts[0]),
    }
  }

  if (measurement !== 'EUCLIDEAN' && isHexGridType(gridContext)) {
    const pts = await hexRingVerticesFromObr(center, schritt, dpi, type, measurement)
    return {
      items: buildCalibratedRingEdges(pts, code, color),
      labelPos: ringLabelPosition(center, r, gridContext, pts[0]),
    }
  }

  if (measurement === 'ALTERNATING' && type === 'SQUARE') {
    const pts = await alternatingRingVerticesFromObr(center, schritt, dpi)
    return {
      items: buildCalibratedRingEdges(pts, code, color),
      labelPos: ringLabelPosition(center, r, gridContext, pts[0]),
    }
  }

  if (
    measurement !== 'EUCLIDEAN' &&
    measurement !== 'MANHATTAN' &&
    isIsoGridType(gridContext)
  ) {
    const pts = await isoRingVerticesFromObr(center, schritt, dpi, type, measurement)
    return {
      items: buildCalibratedRingEdges(pts, code, color),
      labelPos: ringLabelPosition(center, r, gridContext, pts[0]),
    }
  }

  if (measurement === 'CHEBYSHEV' || measurement === 'ALTERNATING') {
    const diameter = r * 2
    return {
      items: [
        commonShape(ringShapePosition(center, r, 'RECTANGLE'))
          .id(ringId('c', code))
          .shapeType('RECTANGLE')
          .width(diameter)
          .height(diameter)
          .build(),
      ],
      labelPos: ringLabelPosition(center, r, gridContext),
    }
  }

  return {
    items: [
      commonShape(ringShapePosition(center, r, 'CIRCLE'))
        .id(ringId('c', code))
        .shapeType('CIRCLE')
        .width(r * 2)
        .height(r * 2)
        .build(),
    ],
    labelPos: ringLabelPosition(center, r, gridContext),
  }
}

/** @deprecated Sync-Fallback ohne Manhattan-OBR-Kalibrierung (Tests). */
export function buildRingOutlineItems(center, r, code, color, gridContext) {
  const commonShape = (position) =>
    buildShape()
      .position(position)
      .strokeColor(color)
      .strokeOpacity(0.85)
      .strokeWidth(2)
      .strokeDash([8, 6])
      .fillColor(color)
      .fillOpacity(0)
      .layer('DRAWING')
      .locked(true)
      .disableHit(true)
      .zIndex(-1000)
      .name(`Distanz ${code}`)

  const { measurement, type } = gridContext

  if (measurement === 'MANHATTAN') {
    const pts = manhattanDiamondVertices(center, r)
    /** @type {import('@owlbear-rodeo/sdk').Item[]} */
    const edges = []
    for (let i = 0; i < pts.length; i++) {
      const start = pts[i]
      const end = pts[(i + 1) % pts.length]
      edges.push(
        buildLine()
          .id(ringId('e', code, i))
          .startPosition(start)
          .endPosition(end)
          .strokeColor(color)
          .strokeOpacity(0.85)
          .strokeWidth(2)
          .strokeDash([8, 6])
          .layer('DRAWING')
          .locked(true)
          .disableHit(true)
          .zIndex(-1000)
          .name(`Distanz ${code}`)
          .build()
      )
    }
    return edges
  }

  if (measurement !== 'EUCLIDEAN' && isHexGridType(gridContext)) {
    const dirs = hexRingDirections(type)
    const pts = dirs.map((dir) => rayPoint(center, dir, r))
    /** @type {import('@owlbear-rodeo/sdk').Item[]} */
    const edges = []
    for (let i = 0; i < pts.length; i++) {
      const start = pts[i]
      const end = pts[(i + 1) % pts.length]
      edges.push(
        buildLine()
          .id(ringId('e', code, i))
          .startPosition(start)
          .endPosition(end)
          .strokeColor(color)
          .strokeOpacity(0.85)
          .strokeWidth(2)
          .strokeDash([8, 6])
          .layer('DRAWING')
          .locked(true)
          .disableHit(true)
          .zIndex(-1000)
          .name(`Distanz ${code}`)
          .build()
      )
    }
    return edges
  }

  if (measurement === 'CHEBYSHEV' || measurement === 'ALTERNATING') {
    const diameter = r * 2
    return [
      commonShape(ringShapePosition(center, r, 'RECTANGLE'))
        .id(ringId('c', code))
        .shapeType('RECTANGLE')
        .width(diameter)
        .height(diameter)
        .build(),
    ]
  }

  return [
    commonShape(ringShapePosition(center, r, 'CIRCLE'))
      .id(ringId('c', code))
      .shapeType('CIRCLE')
      .width(r * 2)
      .height(r * 2)
      .build(),
  ]
}

/**
 * Ring-Mittelpunkt = Token-Mittelpunkt (wie Owlbear-Maßband und Spokes), ohne Grid-Snap.
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @param {import('./gridDistance.js').GridContext} gridContext
 * @returns {Promise<{ x: number, y: number }>}
 */
export async function resolveRingCenter(item, gridContext) {
  return resolveDistanceCenter(item, gridContext)
}

/**
 * @param {string} text
 * @param {string} color
 * @param {{ x: number, y: number }} position
 * @param {string} id
 */
function buildRingLabel(text, color, position, id) {
  return buildLabel()
    .plainText(text)
    .position(position)
    .fillColor('#ffffff')
    .backgroundColor(color)
    .backgroundOpacity(0.85)
    .layer('TEXT')
    .locked(true)
    .disableHit(true)
    .zIndex(-999)
    .id(id)
    .build()
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {{ x: number, y: number }} center
 * @param {number} dpi
 * @param {number} schritt
 * @param {string} code
 * @param {string} labelText
 * @param {string} color
 * @param {import('./gridDistance.js').GridContext} gridContext
 */
async function appendRingPair(
  items,
  center,
  dpi,
  schritt,
  code,
  labelText,
  color,
  gridContext
) {
  const { items: outlineItems, labelPos } = await buildRingOutlineItemsAsync(
    center,
    dpi,
    schritt,
    code,
    color,
    gridContext
  )
  items.push(...outlineItems)
  items.push(buildRingLabel(labelText, color, labelPos, ringId('l', code)))
}

/**
 * Zeigt H/N/S/P-Distanzkreise am Token (nur lokal fuer den aktuellen Nutzer).
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @param {number | null | undefined} [gsSchritt]
 * @param {import('./heroCustomDist.js').CustomDistRingSpec[]} [customRingSpecs]
 * @param {import('./heroDistRingPrefs.js').DistRingVisiblePrefs} [ringVisible]
 * @param {number | null | undefined} [classXSchritt]
 */
export async function showDistanceRingsFor(
  item,
  gsSchritt = null,
  customRingSpecs = [],
  ringVisible = defaultDistRingVisible(),
  classXSchritt = null
) {
  const gridContext = await getGridContext({ forceRefresh: true })
  if (!item || !gridContext) return
  const { dpi } = gridContext
  await hideDistanceRings()
  const prefs = ringVisible ?? defaultDistRingVisible()
  const c = await resolveRingCenter(item, gridContext)
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const items = []
  lastShownRingCodes.clear()
  for (const { max, code } of DIST_CLASS_THRESHOLDS) {
    if (!isClassRingVisible(prefs, code)) continue
    await appendRingPair(items, c, dpi, max, code, code, RING_COLORS[code] ?? '#888888', gridContext)
    lastShownRingCodes.add(code)
  }
  if (
    isClassRingVisible(prefs, 'X') &&
    classXSchritt != null &&
    Number.isFinite(classXSchritt) &&
    classXSchritt > 0
  ) {
    await appendRingPair(items, c, dpi, classXSchritt, 'X', 'X', RING_COLORS.X ?? '#888888', gridContext)
    lastShownRingCodes.add('X')
  }
  if (Number.isFinite(gsSchritt) && gsSchritt > 0) {
    for (const { code, label, mult } of MOVEMENT_RING_SPECS) {
      if (!isMovementRingVisible(prefs, code)) continue
      await appendRingPair(
        items,
        c,
        dpi,
        gsSchritt * mult,
        code,
        label,
        MOVEMENT_RING_COLORS[code] ?? '#888888',
        gridContext
      )
      lastShownRingCodes.add(code)
    }
  }
  if (isCustomRingsEnabled(prefs)) {
    for (const { code, label, schritt, color } of customRingSpecs) {
      await appendRingPair(items, c, dpi, schritt, code, label, color, gridContext)
      lastShownRingCodes.add(code)
    }
  }
  if (items.length === 0) return
  await OBR.scene.local.addItems(items)
  lastRingItemIds = items
    .map((it) => it.id)
    .filter((id) => typeof id === 'string')
  lastRingDrawCenter = { x: c.x, y: c.y }
}

/**
 * Verschiebt sichtbare Distanzringe per updateItems (ohne hide/add) — fuer Drag-rAF.
 * @param {{ x: number; y: number }} newCenter
 * @returns {Promise<boolean>} false wenn keine Ringe zum Verschieben vorhanden
 */
export async function shiftDistanceRingsCenter(newCenter) {
  if (
    !lastRingDrawCenter ||
    lastRingItemIds.length === 0 ||
    lastShownRingCodes.size === 0
  ) {
    return false
  }
  const dx = newCenter.x - lastRingDrawCenter.x
  const dy = newCenter.y - lastRingDrawCenter.y
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return true
  try {
    await OBR.scene.local.updateItems(lastRingItemIds, (drafts) => {
      for (const d of drafts) {
        if (!d) continue
        if (d.type === 'LINE') {
          if (d.startPosition) {
            d.startPosition = {
              x: d.startPosition.x + dx,
              y: d.startPosition.y + dy,
            }
          }
          if (d.endPosition) {
            d.endPosition = {
              x: d.endPosition.x + dx,
              y: d.endPosition.y + dy,
            }
          }
        } else if (d.position) {
          d.position = { x: d.position.x + dx, y: d.position.y + dy }
        }
      }
    })
  } catch {
    return false
  }
  lastRingDrawCenter = { x: newCenter.x, y: newCenter.y }
  return true
}

/** @internal Vitest: Ring-Verschiebe-State setzen */
export function setDistanceRingShiftStateForTests(
  itemIds,
  center,
  codes = ['H']
) {
  lastRingItemIds = [...itemIds]
  lastRingDrawCenter = { x: center.x, y: center.y }
  lastShownRingCodes.clear()
  for (const code of codes) lastShownRingCodes.add(code)
}

export async function hideDistanceRings() {
  const ids = []
  for (const { code } of DIST_CLASS_THRESHOLDS) {
    ids.push(ringId('c', code), ringId('l', code))
    for (let i = 0; i < 6; i++) ids.push(ringId('e', code, i))
  }
  ids.push(ringId('c', 'X'), ringId('l', 'X'))
  for (let i = 0; i < 4; i++) ids.push(ringId('e', 'X', i))
  for (const { code } of MOVEMENT_RING_SPECS) {
    ids.push(ringId('c', code), ringId('l', code))
    for (let i = 0; i < 6; i++) ids.push(ringId('e', code, i))
  }
  for (const code of lastShownRingCodes) {
    if (code.startsWith('cd-')) {
      ids.push(ringId('c', code), ringId('l', code))
      for (let i = 0; i < 6; i++) ids.push(ringId('e', code, i))
    }
  }
  lastShownRingCodes.clear()
  lastRingDrawCenter = null
  lastRingItemIds = []
  try {
    await OBR.scene.local.deleteItems(ids)
  } catch {
    /* ignore: local API oder Items evtl. nicht vorhanden */
  }
}
