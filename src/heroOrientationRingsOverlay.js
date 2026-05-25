import OBR, { buildShape } from '@owlbear-rodeo/sdk'
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
import { tokenCenter } from './tokenDistance.js'

const ORIENTATION_ID_PREFIX = 'vierpunkteins/hero-orientation/'
export const ORIENTATION_RING_COLOR_FALLBACK = '#9e9e9e'

const MARKER_W = 14
const MARKER_H = 18
const ATTACHMENT_DISABLED = ['SCALE', 'LOCKED', 'COPY']

/** @type {Set<string>} */
const lastTokenIds = new Set()

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
 * @param {{ width?: number, height?: number } | null | undefined} bounds
 */
export function ringRadiusFromBounds(bounds) {
  const w = Number(bounds?.width) || 0
  const h = Number(bounds?.height) || 0
  const base = Math.max(w, h) / 2
  return Math.max(20, base * 1.08)
}

/**
 * @param {number} ringRadius
 */
export function markerOffsetY(ringRadius) {
  return -ringRadius - MARKER_H / 2
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
 * @param {number} ringRadius
 */
function fallbackRingRadius(item, ringRadius) {
  const w = Number(item.width) || 0
  const h = Number(item.height) || 0
  if (w > 0 || h > 0) {
    return ringRadiusFromBounds({ width: w, height: h })
  }
  return ringRadius
}

/**
 * @param {string} tokenId
 * @param {number} ringRadius
 * @param {string} color
 */
function buildOrientationRing(tokenId, ringRadius, color) {
  const ids = orientationRingIds(tokenId)
  const d = ringRadius * 2
  return buildShape()
    .id(ids.ring)
    .shapeType('CIRCLE')
    .width(d)
    .height(d)
    .position({ x: 0, y: 0 })
    .attachedTo(tokenId)
    .disableAttachmentBehavior(ATTACHMENT_DISABLED)
    .strokeColor(color)
    .strokeOpacity(0.9)
    .strokeWidth(2)
    .fillColor(color)
    .fillOpacity(0)
    .layer('DRAWING')
    .locked(true)
    .disableHit(true)
    .zIndex(-995)
    .name('Orientierungsring')
    .build()
}

/**
 * @param {string} tokenId
 * @param {number} ringRadius
 * @param {string} color
 */
function buildOrientationMarker(tokenId, ringRadius, color) {
  const ids = orientationRingIds(tokenId)
  return buildShape()
    .id(ids.marker)
    .shapeType('TRIANGLE')
    .width(MARKER_W)
    .height(MARKER_H)
    .position({ x: 0, y: markerOffsetY(ringRadius) })
    .attachedTo(tokenId)
    .disableAttachmentBehavior(ATTACHMENT_DISABLED)
    .fillColor(color)
    .fillOpacity(0.95)
    .strokeColor(darkenHexColor(color))
    .strokeOpacity(1)
    .strokeWidth(1)
    .layer('DRAWING')
    .locked(true)
    .disableHit(true)
    .zIndex(-994)
    .name('Blickrichtung')
    .build()
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {{
 *   show?: boolean,
 *   hideForeignHeroColors?: boolean,
 *   isGm?: boolean,
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
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const overlayItems = []
  lastTokenIds.clear()

  for (const item of listItems) {
    if (!item?.id) continue
    const meta = item.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    if (!isSceneItemVisibleOnMap(item)) continue
    if (hideForeign && !canEditSceneItem(item)) continue

    let ringRadius = fallbackRingRadius(item, 24)
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id])
      if (bounds?.width != null && bounds?.height != null) {
        ringRadius = ringRadiusFromBounds(bounds)
      } else if (bounds?.center) {
        const c = tokenCenter(item)
        ringRadius = ringRadiusFromBounds({
          width: Math.abs((bounds.center.x - c.x) * 2) || item.width,
          height: Math.abs((bounds.center.y - c.y) * 2) || item.height,
        })
      }
    } catch {
      /* fallback radius */
    }

    const color = resolveRingStrokeColor(meta)
    overlayItems.push(
      buildOrientationRing(item.id, ringRadius, color),
      buildOrientationMarker(item.id, ringRadius, color)
    )
    lastTokenIds.add(item.id)
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
