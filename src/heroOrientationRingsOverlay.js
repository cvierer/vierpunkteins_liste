import OBR, { buildShape, isImage } from '@owlbear-rodeo/sdk'
import { canEditSceneItem, isGmSync } from './editAccess.js'
import { readHeroBgColor } from './heroColors.js'
import {
  getHideForeignHeroColorsForViewer,
  getShowHeroOrientationRings,
  onHideForeignHeroColorsForViewerChange,
  onShowHeroOrientationRingsChange,
} from './localUiPrefs.js'
import {
  filterItemsForListViewer,
  isSceneItemVisibleOnMap,
  TRACKER_ITEM_META_KEY,
} from './participants.js'

const ORIENTATION_ID_PREFIX = 'vierpunkteins/hero-orientation/'
export const ORIENTATION_RING_COLOR_FALLBACK = '#9e9e9e'

export const MARKER_W = 24
export const MARKER_H = 30
const RING_DIAMETER_PAD = 1.04
const RING_STROKE_WIDTH = 6
/** Abstand Dreieck-Mitte zum aeusseren Ringrand (px). */
export const MARKER_OUTSIDE_PADDING = 8
/** DRAWING unter CHARACTER — Name (item.text) bleibt im Vordergrund. */
const RING_Z_INDEX = -1000
const MARKER_Z_INDEX = -999

/** @type {Set<string>} */
const lastTokenIds = new Set()

/** @type {Map<string, { x: number, y: number }>} */
const lastOrientationCenterByTokenId = new Map()

/**
 * @param {string} tokenId
 * @returns {{ x: number, y: number } | null}
 */
export function getOrientationRingDrawCenter(tokenId) {
  const c = lastOrientationCenterByTokenId.get(tokenId)
  return c ? { x: c.x, y: c.y } : null
}

/**
 * @param {string} tokenId
 * @param {{ x: number, y: number }} tokenCenter
 * @param {number} [epsilon]
 */
export function areOrientationRingsAtTokenCenter(tokenId, tokenCenter, epsilon = 1) {
  const draw = lastOrientationCenterByTokenId.get(tokenId)
  if (!draw || !tokenCenter) return false
  return (
    Math.hypot(draw.x - tokenCenter.x, draw.y - tokenCenter.y) <= epsilon
  )
}

/** @internal Vitest */
export function setOrientationRingCenterForTests(tokenId, center) {
  if (center) {
    lastOrientationCenterByTokenId.set(tokenId, { x: center.x, y: center.y })
  } else {
    lastOrientationCenterByTokenId.delete(tokenId)
  }
}

/** @internal Vitest */
export function clearOrientationRingCentersForTests() {
  lastOrientationCenterByTokenId.clear()
}

/**
 * @param {string} tokenId
 */
export function orientationRingIds(tokenId) {
  return {
    ring: `${ORIENTATION_ID_PREFIX}ring/${tokenId}`,
    marker: `${ORIENTATION_ID_PREFIX}marker/${tokenId}`,
  }
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item} item
 * @param {number} sceneDpi
 */
export function imageRenderSize(item, sceneDpi) {
  const imgW = Number(item?.image?.width) || Number(item?.width) || 100
  const imgH = Number(item?.image?.height) || Number(item?.height) || 100
  const gridDpi = Number(item?.grid?.dpi) || sceneDpi || 100
  const dpiScale = sceneDpi / gridDpi
  const sx = Number(item?.scale?.x) || 1
  const sy = Number(item?.scale?.y) || 1
  const width = imgW * dpiScale * sx
  const height = imgH * dpiScale * sy
  const offsetX = ((Number(item?.grid?.offset?.x) || 0) / imgW) * width
  const offsetY = ((Number(item?.grid?.offset?.y) || 0) / imgH) * height
  return { width, height, offsetX, offsetY }
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item} item
 * @param {number} sceneDpi
 */
export function tokenCenterScene(item, sceneDpi) {
  const { width, height, offsetX, offsetY } = imageRenderSize(item, sceneDpi)
  const px = Number(item?.position?.x) || 0
  const py = Number(item?.position?.y) || 0
  return {
    x: px - offsetX + width / 2,
    y: py - offsetY + height / 2,
  }
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item} item
 * @param {number} sceneDpi
 */
export function ringDiameter(item, sceneDpi) {
  const { width, height } = imageRenderSize(item, sceneDpi)
  return Math.max(40, Math.min(width, height) * RING_DIAMETER_PAD)
}

/**
 * Zusaetzlicher Abstand Ringradius → Dreieck-Mitte (Stroke, Dreieck-Hoehe, Luft).
 * @param {number} [strokeWidth]
 * @param {number} [markerHeight]
 * @param {number} [padding]
 */
export function markerOutsideOffset(
  strokeWidth = RING_STROKE_WIDTH,
  markerHeight = MARKER_H,
  padding = MARKER_OUTSIDE_PADDING
) {
  return strokeWidth / 2 + markerHeight / 2 + padding
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} radius Ringradius (ohne Stroke)
 * @param {number} rotationDeg
 * @param {number} [outsideOffset] Abstand Ringmitte → Dreieck-Mitte (0 = am Ringrand)
 */
export function markerScenePosition(center, radius, rotationDeg, outsideOffset = 0) {
  const dist = radius + outsideOffset
  const rad = (Number(rotationDeg) || 0) * (Math.PI / 180)
  return {
    x: center.x + Math.sin(rad) * dist,
    y: center.y - Math.cos(rad) * dist,
  }
}

/**
 * @param {unknown} meta
 */
export function resolveRingStrokeColor(meta) {
  return readHeroBgColor(meta) ?? ORIENTATION_RING_COLOR_FALLBACK
}

/**
 * @param {string} hex
 * @param {number} [factor]
 */
export function darkenHexColor(hex, factor = 0.72) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return '#3e2723'
  const n = parseInt(m[1], 16)
  const r = Math.round(((n >> 16) & 255) * factor)
  const g = Math.round(((n >> 8) & 255) * factor)
  const b = Math.round((n & 255) * factor)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item} item
 * @param {{ x: number, y: number }} center
 * @param {number} diameter
 * @param {string} color
 */
function buildOrientationRing(item, center, diameter, color) {
  const ids = orientationRingIds(item.id)
  return buildShape()
    .id(ids.ring)
    .shapeType('CIRCLE')
    .width(diameter)
    .height(diameter)
    .position(center)
    .strokeColor(color)
    .strokeOpacity(0.95)
    .strokeWidth(RING_STROKE_WIDTH)
    .fillColor(color)
    .fillOpacity(0)
    .layer('DRAWING')
    .zIndex(RING_Z_INDEX)
    .locked(true)
    .disableHit(true)
    .visible(item.visible !== false)
    .name('Orientierungsring')
    .build()
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item} item
 * @param {{ x: number, y: number }} center
 * @param {number} diameter
 * @param {string} color
 */
function buildOrientationMarker(item, center, diameter, color) {
  const ids = orientationRingIds(item.id)
  const radius = diameter / 2
  const rotation = Number(item.rotation) || 0
  const pos = markerScenePosition(
    center,
    radius,
    rotation,
    markerOutsideOffset()
  )
  return buildShape()
    .id(ids.marker)
    .shapeType('TRIANGLE')
    .width(MARKER_W)
    .height(MARKER_H)
    .position(pos)
    .rotation(rotation)
    .fillColor(color)
    .fillOpacity(1)
    .strokeColor(darkenHexColor(color))
    .strokeOpacity(1)
    .strokeWidth(1)
    .layer('DRAWING')
    .zIndex(MARKER_Z_INDEX)
    .locked(true)
    .disableHit(true)
    .visible(item.visible !== false)
    .name('Blickrichtung')
    .build()
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {{
 *   show?: boolean,
 *   hideForeignHeroColors?: boolean,
 *   isGm?: boolean,
 *   sceneDpi?: number,
 * }} [options]
 */
export async function syncHeroOrientationRings(items, options = {}) {
  const show = options.show ?? getShowHeroOrientationRings()
  if (!show) {
    await hideHeroOrientationRings()
    return
  }
  await hideHeroOrientationRings()
  const hideForeign =
    options.hideForeignHeroColors ?? getHideForeignHeroColorsForViewer()
  const isGm = options.isGm ?? isGmSync()
  const listItems = isGm ? items : filterItemsForListViewer(items, false)

  let sceneDpi = options.sceneDpi ?? 100
  if (options.sceneDpi == null && OBR.isAvailable) {
    try {
      sceneDpi = await OBR.scene.grid.getDpi()
    } catch {
      /* fallback */
    }
  }

  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const overlayItems = []
  lastTokenIds.clear()

  for (const item of listItems) {
    if (!item?.id) continue
    if (!isImage(item)) continue
    if (item.layer !== 'CHARACTER') continue
    const meta = item.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    if (!isSceneItemVisibleOnMap(item)) continue
    const canEdit = canEditSceneItem(item)

    const center = tokenCenterScene(item, sceneDpi)
    const diameter = ringDiameter(item, sceneDpi)
    let color = resolveRingStrokeColor(meta)
    // "Fremde Heldenfarben ausblenden" soll nur die Farbe ausblenden,
    // aber Ring + Dreieck weiterhin sichtbar lassen.
    if (hideForeign && !canEdit) color = ORIENTATION_RING_COLOR_FALLBACK
    overlayItems.push(
      buildOrientationRing(item, center, diameter, color),
      buildOrientationMarker(item, center, diameter, color)
    )
    lastTokenIds.add(item.id)
    lastOrientationCenterByTokenId.set(item.id, { x: center.x, y: center.y })
  }

  if (overlayItems.length === 0) return
  await OBR.scene.local.addItems(overlayItems)
}

export async function hideHeroOrientationRings() {
  const ids = []
  for (const tokenId of lastTokenIds) {
    const { ring, marker } = orientationRingIds(tokenId)
    ids.push(ring, marker)
  }
  lastTokenIds.clear()
  lastOrientationCenterByTokenId.clear()
  if (ids.length === 0) return
  try {
    await OBR.scene.local.deleteItems(ids)
  } catch {
    /* ignore */
  }
}

export function setupHeroOrientationRings() {
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  let lastItems = []
  const refresh = (items) => {
    if (items) lastItems = items
    void syncHeroOrientationRings(lastItems).catch((err) => {
      console.warn('[vierpunkteins_kampf] Orientierungsringe', err)
    })
  }
  const unsubPref = onShowHeroOrientationRingsChange(() => refresh())
  const unsubForeign = onHideForeignHeroColorsForViewerChange(() => refresh())
  let itemsChangeUnsub = () => {}
  if (OBR.isAvailable) {
    itemsChangeUnsub = OBR.scene.items.onChange((items) => refresh(items))
    void OBR.scene.items.getItems().then((items) => refresh(items))
  }
  return {
    refresh,
    cleanup: () => {
      unsubPref()
      unsubForeign()
      itemsChangeUnsub()
      void hideHeroOrientationRings()
    },
  }
}
