import OBR from '@owlbear-rodeo/sdk'
import { computeSchrittFromCenters, tokenCenter } from './tokenDistance.js'

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
  if (measurement === 'EUCLIDEAN') {
    const d = Number(dpi)
    if (!d || d <= 0) return NaN
    return raw / d
  }
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
 * @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} itemA
 * @param {typeof itemA} itemB
 */
export async function computeGridSchritt(itemA, itemB) {
  return computeGridSchrittFromCenters(tokenCenter(itemA), tokenCenter(itemB))
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
