import OBR, { buildLabel, buildLine } from '@owlbear-rodeo/sdk'
import { readHeroBgColor } from './heroColors.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'
import {
  computeSchritt,
  formatSchrittWithClass,
  tokenCenter,
} from './tokenDistance.js'

const SPOKE_ID_PREFIX = 'vierpunkteins/dist-spoke/'
export const SPOKE_COLOR_FALLBACK = '#9e9e9e'
export const SPOKE_STROKE_WIDTH = 4
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
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 */
export function spokeLabelPosition(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @param {string} otherId
 * @param {string} color
 */
function buildSpokeLine(start, end, otherId, color) {
  return buildLine()
    .id(spokeItemId(otherId, 'line'))
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
 * @param {string} otherId
 * @param {string} color
 */
function buildSpokeLabel(text, position, otherId, color) {
  return buildLabel()
    .id(spokeItemId(otherId, 'label'))
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
  await hideDistanceSpokes()
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
    items.push(buildSpokeLine(start, end, other.id, color))
    items.push(
      buildSpokeLabel(text, spokeLabelPosition(start, end), other.id, color)
    )
    lastSpokeOtherIds.add(other.id)
  }
  if (items.length === 0) return
  await OBR.scene.local.addItems(items)
}

export async function hideDistanceSpokes() {
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
