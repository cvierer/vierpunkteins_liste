import OBR, { buildLabel, buildLine, buildShape } from '@owlbear-rodeo/sdk'
import { getGridContext, normalizeGridDistanceRaw } from './gridDistance.js'
import {
  defaultDistRingVisible,
  isClassRingVisible,
  isCustomRingsEnabled,
  isMovementRingVisible,
} from './heroDistRingPrefs.js'
import { DIST_CLASS_THRESHOLDS, tokenCenter } from './tokenDistance.js'

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
 * @param {{ x: number, y: number }} center
 * @param {{ x: number, y: number }} dir
 * @param {number} schritt
 * @param {number} dpi
 * @param {(from: { x: number, y: number }, to: { x: number, y: number }) => Promise<number>} getDistanceFn
 */
export async function findManhattanVertexOnAxis(
  center,
  dir,
  schritt,
  dpi,
  getDistanceFn
) {
  const stepPx = Math.max(1, dpi / 4)
  const maxPx = (schritt + 2) * dpi
  let best = { ...center }
  for (let px = stepPx; px <= maxPx; px += stepPx) {
    const p = { x: center.x + dir.x * px, y: center.y + dir.y * px }
    const raw = await getDistanceFn(center, p)
    if (raw <= schritt) {
      best = p
    } else {
      break
    }
  }
  return best
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
    const pts = await manhattanRingVerticesFromObr(center, schritt, dpi)
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
    return {
      items: edges,
      labelPos: ringLabelPosition(center, r, gridContext, pts[0]),
    }
  }

  if (measurement !== 'EUCLIDEAN' && isHexGridType(gridContext)) {
    const diameter = r * 2
    const rotation = type === 'HEX_HORIZONTAL' ? 0 : 30
    return {
      items: [
        commonShape(ringShapePosition(center, r, 'HEXAGON'))
          .id(ringId('c', code))
          .shapeType('HEXAGON')
          .width(diameter)
          .height(diameter)
          .rotation(rotation)
          .build(),
      ],
      labelPos: ringLabelPosition(center, r, gridContext),
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
    const diameter = r * 2
    const rotation = type === 'HEX_HORIZONTAL' ? 0 : 30
    return [
      commonShape(ringShapePosition(center, r, 'HEXAGON'))
        .id(ringId('c', code))
        .shapeType('HEXAGON')
        .width(diameter)
        .height(diameter)
        .rotation(rotation)
        .build(),
    ]
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
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @returns {Promise<{ x: number, y: number }>}
 */
async function resolveTokenRingCenter(item) {
  if (item?.id) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id])
      if (bounds?.center) {
        return bounds.center
      }
    } catch {
      /* fallback */
    }
  }
  return tokenCenter(item)
}

/**
 * Ring-Mittelpunkt: EUCLIDEAN/MANHATTAN = Token-Bounds; CHEBYSHEV/ALTERNATING = Grid-Snap.
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @param {import('./gridDistance.js').GridContext} gridContext
 * @returns {Promise<{ x: number, y: number }>}
 */
export async function resolveRingCenter(item, gridContext) {
  const center = await resolveTokenRingCenter(item)
  if (
    gridContext.measurement === 'EUCLIDEAN' ||
    gridContext.measurement === 'MANHATTAN'
  ) {
    return center
  }
  try {
    return await OBR.scene.grid.snapPosition(center, undefined, true)
  } catch {
    return center
  }
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
  const gridContext = await getGridContext()
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
}

export async function hideDistanceRings() {
  const ids = []
  for (const { code } of DIST_CLASS_THRESHOLDS) {
    ids.push(ringId('c', code), ringId('l', code))
    for (let i = 0; i < 4; i++) ids.push(ringId('e', code, i))
  }
  ids.push(ringId('c', 'X'), ringId('l', 'X'))
  for (let i = 0; i < 4; i++) ids.push(ringId('e', 'X', i))
  for (const { code } of MOVEMENT_RING_SPECS) {
    ids.push(ringId('c', code), ringId('l', code))
    for (let i = 0; i < 4; i++) ids.push(ringId('e', code, i))
  }
  for (const code of lastShownRingCodes) {
    if (code.startsWith('cd-')) {
      ids.push(ringId('c', code), ringId('l', code))
      for (let i = 0; i < 4; i++) ids.push(ringId('e', code, i))
    }
  }
  lastShownRingCodes.clear()
  try {
    await OBR.scene.local.deleteItems(ids)
  } catch {
    /* ignore: local API oder Items evtl. nicht vorhanden */
  }
}
