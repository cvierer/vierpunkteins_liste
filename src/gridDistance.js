import OBR from '@owlbear-rodeo/sdk'
import { tokenCenterScene } from './heroOrientationRingsOverlay.js'
import {
  computeSchrittFromCenters,
  formatSchrittWithClass,
  tokenCenter,
} from './tokenDistance.js'

/** @typedef {'SQUARE' | 'HEX_VERTICAL' | 'HEX_HORIZONTAL' | 'DIMETRIC' | 'ISOMETRIC'} GridType */
/** @typedef {'CHEBYSHEV' | 'ALTERNATING' | 'EUCLIDEAN' | 'MANHATTAN'} GridMeasurement */

/**
 * @typedef {{ dpi: number, measurement: GridMeasurement, type: GridType }} GridContext
 */

/** @type {GridContext | null} */
let cachedGridContext = null

/** @type {Set<() => void>} */
const gridChangeListeners = new Set()

/**
 * @param {number} raw
 * @param {GridMeasurement | null | undefined} measurement
 * @param {number | null | undefined} dpi
 */
export function normalizeGridDistanceRaw(raw, measurement, dpi) {
  if (!Number.isFinite(raw)) return NaN
  void dpi
  return raw
}

export function invalidateGridContextCache() {
  cachedGridContext = null
}

/**
 * @param {{ forceRefresh?: boolean } | undefined} [options]
 * @returns {Promise<GridContext | null>}
 */
export async function getGridContext(options) {
  const forceRefresh = options?.forceRefresh === true
  if (cachedGridContext && !forceRefresh) return cachedGridContext
  try {
    const [dpi, measurement, type] = await Promise.all([
      OBR.scene.grid.getDpi(),
      OBR.scene.grid.getMeasurement(),
      OBR.scene.grid.getType(),
    ])
    if (!Number.isFinite(dpi) || dpi <= 0) return null
    cachedGridContext = {
      dpi,
      measurement: /** @type {GridMeasurement} */ (measurement),
      type: /** @type {GridType} */ (type),
    }
    return cachedGridContext
  } catch {
    return null
  }
}

/**
 * Token-Mittelpunkt fuer Distanzmessung: Bounds → tokenCenterScene → tokenCenter.
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @param {GridContext | null | undefined} [gridContext]
 * @returns {Promise<{ x: number, y: number }>}
 */
export async function resolveDistanceCenter(item, gridContext) {
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
  const dpi = gridContext?.dpi ?? (await getGridContext())?.dpi
  if (dpi && item) {
    return tokenCenterScene(item, dpi)
  }
  return tokenCenter(item)
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 */
export async function computeGridSchrittFromCenters(a, b) {
  const ctx = await getGridContext()
  try {
    const raw = await OBR.scene.grid.getDistance(a, b)
    if (ctx) {
      return normalizeGridDistanceRaw(raw, ctx.measurement, ctx.dpi)
    }
    const dpi = await OBR.scene.grid.getDpi()
    return normalizeGridDistanceRaw(raw, 'EUCLIDEAN', dpi)
  } catch (err) {
    console.warn(
      '[vierpunkteins] grid.getDistance failed, fallback euclidean',
      err
    )
    const dpi = ctx?.dpi
    if (!dpi) return NaN
    return computeSchrittFromCenters(a, b, dpi)
  }
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} itemA
 * @param {typeof itemA} itemB
 */
export async function computeGridSchritt(itemA, itemB) {
  const ctx = await getGridContext()
  const [a, b] = await Promise.all([
    resolveDistanceCenter(itemA, ctx),
    resolveDistanceCenter(itemB, ctx),
  ])
  return computeGridSchrittFromCenters(a, b)
}

/** @param {number} cx @param {number} cy */
function cellKey(cx, cy) {
  return `${cx},${cy}`
}

/** @param {string} key */
function parseCellKey(key) {
  const [cx, cy] = key.split(',').map(Number)
  return { cx, cy }
}

/** @param {GridType} gridType */
function neighborDeltas(gridType) {
  if (gridType === 'HEX_VERTICAL' || gridType === 'HEX_HORIZONTAL') {
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, -1],
      [-1, 1],
    ]
  }
  return [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ]
}

/**
 * @param {Set<string>} cellsA
 * @param {Set<string>} cellsB
 * @param {GridType} gridType
 */
export function cellSetsTouching(cellsA, cellsB, gridType) {
  for (const key of cellsA) {
    if (cellsB.has(key)) return true
  }
  const deltas = neighborDeltas(gridType)
  for (const key of cellsA) {
    const { cx, cy } = parseCellKey(key)
    for (const [dx, dy] of deltas) {
      if (cellsB.has(cellKey(cx + dx, cy + dy))) return true
    }
  }
  return false
}

/**
 * Eine Rasterzelle am Token-Mittelpunkt (für Handnah/Berührung).
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @param {GridContext} gridContext
 */
async function getTokenCenterGridCell(item, gridContext) {
  const dpi = gridContext.dpi
  const center = await resolveDistanceCenter(item, gridContext)
  let snapped = center
  try {
    snapped = await OBR.scene.grid.snapPosition(center)
  } catch {
    /* fallback */
  }
  return cellKey(Math.round(snapped.x / dpi), Math.round(snapped.y / dpi))
}

/**
 * Berührung = Zellen überlappen oder Nachbarzellen (Handnah/H).
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} itemA
 * @param {typeof itemA} itemB
 */
export async function areTokensTouching(itemA, itemB) {
  if (!itemA || !itemB) return false
  const ctx = await getGridContext()
  if (!ctx) return false
  try {
    const [cellA, cellB, centerA, centerB] = await Promise.all([
      getTokenCenterGridCell(itemA, ctx),
      getTokenCenterGridCell(itemB, ctx),
      resolveDistanceCenter(itemA, ctx),
      resolveDistanceCenter(itemB, ctx),
    ])
    const cellsA = new Set([cellA])
    const cellsB = new Set([cellB])
    if (cellSetsTouching(cellsA, cellsB, ctx.type)) return true
    const dist = await computeGridSchrittFromCenters(centerA, centerB)
    if (!Number.isFinite(dist)) return false
    return dist < 0.01
  } catch {
    return false
  }
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} itemA
 * @param {typeof itemA} itemB
 * @param {number | null | undefined} [classXSchritt]
 */
export async function formatGridDistWithClass(itemA, itemB, classXSchritt = null) {
  const [schritt, touching] = await Promise.all([
    computeGridSchritt(itemA, itemB),
    areTokensTouching(itemA, itemB),
  ])
  return formatSchrittWithClass(schritt, classXSchritt, { isTouching: touching })
}

/** @param {() => void} callback */
export function onGridDistanceChange(callback) {
  gridChangeListeners.add(callback)
  return () => gridChangeListeners.delete(callback)
}

function notifyGridChangeListeners() {
  for (const cb of gridChangeListeners) {
    try {
      cb()
    } catch (err) {
      console.error('[vierpunkteins] grid distance listener failed', err)
    }
  }
}

export function initGridDistance() {
  try {
    OBR.scene.grid.onChange((grid) => {
      if (Number.isFinite(grid.dpi) && grid.dpi > 0) {
        cachedGridContext = {
          dpi: grid.dpi,
          measurement: /** @type {GridMeasurement} */ (grid.measurement),
          type: /** @type {GridType} */ (grid.type),
        }
      } else {
        invalidateGridContextCache()
      }
      notifyGridChangeListeners()
    })
  } catch {
    /* ignore outside Owlbear */
  }
  void getGridContext()
}
