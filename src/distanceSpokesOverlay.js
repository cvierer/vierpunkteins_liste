import OBR, { buildLabel, buildLine } from '@owlbear-rodeo/sdk'
import {
  computeSchritt,
  formatSchrittWithClass,
  tokenCenter,
} from './tokenDistance.js'

const SPOKE_ID_PREFIX = 'vierpunkteins/dist-spoke/'
const SPOKE_STROKE = '#64748b'

/** @type {Set<string>} */
const lastSpokeOtherIds = new Set()

/** @param {string} otherId @param {'line' | 'label'} kind */
export function spokeItemId(otherId, kind) {
  return `${SPOKE_ID_PREFIX}${kind}/${otherId}`
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
 */
function buildSpokeLine(start, end, otherId) {
  return buildLine()
    .id(spokeItemId(otherId, 'line'))
    .startPosition(start)
    .endPosition(end)
    .strokeColor(SPOKE_STROKE)
    .strokeOpacity(0.75)
    .strokeWidth(1)
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
 */
function buildSpokeLabel(text, position, otherId) {
  return buildLabel()
    .id(spokeItemId(otherId, 'label'))
    .plainText(text)
    .position(position)
    .backgroundColor('#1f2937')
    .backgroundOpacity(0.8)
    .layer('TEXT')
    .locked(true)
    .disableHit(true)
    .zIndex(-997)
    .name(`Distanz ${text}`)
    .build()
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} probeItem
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
    items.push(buildSpokeLine(start, end, other.id))
    items.push(
      buildSpokeLabel(text, spokeLabelPosition(start, end), other.id)
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
