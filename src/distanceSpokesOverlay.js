import OBR, { buildLabel, buildLine } from '@owlbear-rodeo/sdk'
import { readHeroBgColor } from './heroColors.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'
import {
  computeSchritt,
  computeSchrittFromCenters,
  formatSchrittWithClass,
  tokenCenter,
} from './tokenDistance.js'

const SPOKE_ID_PREFIX = 'vierpunkteins/dist-spoke/'
export const MOVEMENT_SPOKE_LINE_ID = `${SPOKE_ID_PREFIX}move/line`
export const MOVEMENT_SPOKE_LABEL_ID = `${SPOKE_ID_PREFIX}move/label`
export const SPOKE_COLOR_FALLBACK = '#9e9e9e'
export const SPOKE_STROKE_WIDTH = 4
export const MOVEMENT_MIN_SCHRITT = 0.05
const SPOKE_LABEL_BG_OPACITY = 0.88

/** @type {Set<string>} */
const lastSpokeOtherIds = new Set()

/** @param {string} otherId @param {'line' | 'label'} kind */
export function spokeItemId(otherId, kind) {
  return `${SPOKE_ID_PREFIX}${kind}/${otherId}`
}

/**
 * @param {unknown} meta
 */
export function resolveSpokeColor(meta) {
  return readHeroBgColor(meta) ?? SPOKE_COLOR_FALLBACK
}

/**
 * @param {number} schritt
 */
export function shouldShowMovementSpoke(schritt) {
  return Number.isFinite(schritt) && schritt >= MOVEMENT_MIN_SCHRITT
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 */
export function spokeLabelPosition(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @param {string} id
 * @param {string} color
 */
function buildSpokeLine(start, end, id, color) {
  return buildLine()
    .id(id)
    .startPosition(start)
    .endPosition(end)
    .strokeColor(color)
    .strokeOpacity(0.95)
    .strokeWidth(SPOKE_STROKE_WIDTH)
    .layer('DRAWING')
    .locked(true)
    .disableHit(true)
    .zIndex(-998)
    .name('Distanz')
    .build()
}

/**
 * @param {string} text
 * @param {{ x: number, y: number }} position
 * @param {string} id
 * @param {string} color
 */
function buildSpokeLabel(text, position, id, color) {
  return buildLabel()
    .id(id)
    .plainText(text)
    .position(position)
    .fillColor('#111827')
    .backgroundColor(color)
    .backgroundOpacity(SPOKE_LABEL_BG_OPACITY)
    .layer('TEXT')
    .locked(true)
    .disableHit(true)
    .zIndex(-997)
    .name(`Distanz ${text}`)
    .build()
}

async function hideOtherDistanceSpokes() {
  const ids = []
  for (const otherId of lastSpokeOtherIds) {
    ids.push(spokeItemId(otherId, 'line'), spokeItemId(otherId, 'label'))
  }
  lastSpokeOtherIds.clear()
  if (ids.length === 0) return
  try {
    await OBR.scene.local.deleteItems(ids)
  } catch {
    /* ignore */
  }
}

export async function hideDistanceMovementLine() {
  try {
    await OBR.scene.local.deleteItems([
      MOVEMENT_SPOKE_LINE_ID,
      MOVEMENT_SPOKE_LABEL_ID,
    ])
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number, metadata?: Record<string, unknown> } | null | undefined} probeItem
 * @param {{ x: number, y: number } | null | undefined} dragStartCenter
 * @param {number} dpi
 * @param {number | null | undefined} classXSchritt
 */
export async function syncDistanceMovementLine(
  probeItem,
  dragStartCenter,
  dpi,
  classXSchritt = null
) {
  if (!probeItem || !dragStartCenter || !Number.isFinite(dpi) || dpi <= 0) {
    await hideDistanceMovementLine()
    return
  }
  const end = tokenCenter(probeItem)
  const schritt = computeSchrittFromCenters(dragStartCenter, end, dpi)
  if (!shouldShowMovementSpoke(schritt)) {
    await hideDistanceMovementLine()
    return
  }
  const meta = probeItem.metadata?.[TRACKER_ITEM_META_KEY]
  const color = resolveSpokeColor(meta)
  const text = formatSchrittWithClass(schritt, classXSchritt)
  if (!text) {
    await hideDistanceMovementLine()
    return
  }
  await hideDistanceMovementLine()
  await OBR.scene.local.addItems([
    buildSpokeLine(dragStartCenter, end, MOVEMENT_SPOKE_LINE_ID, color),
    buildSpokeLabel(
      text,
      spokeLabelPosition(dragStartCenter, end),
      MOVEMENT_SPOKE_LABEL_ID,
      color
    ),
  ])
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number, metadata?: Record<string, unknown> } | null | undefined} probeItem
 * @param {typeof probeItem[]} otherItems
 * @param {number} dpi
 * @param {number | null | undefined} classXSchritt
 */
export async function showDistanceSpokesFor(
  probeItem,
  otherItems,
  dpi,
  classXSchritt = null
) {
  if (!probeItem || !Number.isFinite(dpi) || dpi <= 0) return
  await hideOtherDistanceSpokes()
  const start = tokenCenter(probeItem)
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const items = []
  lastSpokeOtherIds.clear()
  for (const other of otherItems) {
    if (!other?.id || other.id === probeItem.id) continue
    const end = tokenCenter(other)
    const n = computeSchritt(probeItem, other, dpi)
    const text = formatSchrittWithClass(n, classXSchritt)
    if (!text) continue
    const meta = other.metadata?.[TRACKER_ITEM_META_KEY]
    const color = resolveSpokeColor(meta)
    items.push(buildSpokeLine(start, end, spokeItemId(other.id, 'line'), color))
    items.push(
      buildSpokeLabel(
        text,
        spokeLabelPosition(start, end),
        spokeItemId(other.id, 'label'),
        color
      )
    )
    lastSpokeOtherIds.add(other.id)
  }
  if (items.length === 0) return
  await OBR.scene.local.addItems(items)
}

export async function hideDistanceSpokes() {
  await hideOtherDistanceSpokes()
  await hideDistanceMovementLine()
}
