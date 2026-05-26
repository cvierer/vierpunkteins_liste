import OBR, { buildLabel, buildLine } from '@owlbear-rodeo/sdk'
import {
  computeGridSchrittFromCenters,
  getGridContext,
  resolveDistanceCenter,
} from './gridDistance.js'
import { readHeroBgColor } from './heroColors.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'
import { formatSchritt, formatSchrittWithClass } from './tokenDistance.js'

const SPOKE_ID_PREFIX = 'vierpunkteins/dist-spoke/'
export const MOVEMENT_SPOKE_LINE_ID = `${SPOKE_ID_PREFIX}move/line`
export const MOVEMENT_SPOKE_LABEL_ID = `${SPOKE_ID_PREFIX}move/label`
export const SPOKE_COLOR_FALLBACK = '#9e9e9e'
export const SPOKE_STROKE_WIDTH = 4
export const MOVEMENT_MIN_SCHRITT = 0.05
const SPOKE_LABEL_BG_OPACITY = 0.88

/** @type {Set<string>} */
const lastSpokeOtherIds = new Set()
let movementLineActive = false

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
    .fillColor('#ffffff')
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
 * @param {string[]} ids
 * @param {(draft: import('@owlbear-rodeo/sdk').Item) => void} mutator
 */
async function updateLocalSpokeItems(ids, mutator) {
  await OBR.scene.local.updateItems(ids, (drafts) => {
    for (const d of drafts) mutator(d)
  })
}

/**
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @param {string} color
 * @param {string} text
 */
async function updateMovementSpokeItems(start, end, color, text) {
  const labelPos = spokeLabelPosition(start, end)
  await updateLocalSpokeItems(
    [MOVEMENT_SPOKE_LINE_ID, MOVEMENT_SPOKE_LABEL_ID],
    (d) => {
      if (d.type === 'LINE') {
        d.startPosition = start
        d.endPosition = end
        d.strokeColor = color
        return
      }
      d.position = labelPos
      if (d.text) {
        d.text.plainText = text
        d.text.backgroundColor = color
      }
    }
  )
}

/**
 * @param {string} otherId
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @param {string} color
 * @param {string} text
 */
async function updateOtherSpokeItems(otherId, start, end, color, text) {
  const labelPos = spokeLabelPosition(start, end)
  await updateLocalSpokeItems(
    [spokeItemId(otherId, 'line'), spokeItemId(otherId, 'label')],
    (d) => {
      if (d.type === 'LINE') {
        d.startPosition = start
        d.endPosition = end
        d.strokeColor = color
        return
      }
      d.position = labelPos
      if (d.text) {
        d.text.plainText = text
        d.text.backgroundColor = color
      }
    }
  )
}

/** @param {string[]} ids */
async function deleteLocalSpokeIds(ids) {
  if (ids.length === 0) return
  try {
    await OBR.scene.local.deleteItems(ids)
  } catch {
    /* ignore */
  }
}

async function hideOtherDistanceSpokes() {
  const ids = []
  for (const otherId of lastSpokeOtherIds) {
    ids.push(spokeItemId(otherId, 'line'), spokeItemId(otherId, 'label'))
  }
  lastSpokeOtherIds.clear()
  await deleteLocalSpokeIds(ids)
}

export async function hideDistanceMovementLine() {
  movementLineActive = false
  await deleteLocalSpokeIds([MOVEMENT_SPOKE_LINE_ID, MOVEMENT_SPOKE_LABEL_ID])
}

/**
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @param {string} color
 * @param {string} text
 */
async function ensureMovementSpokeItems(start, end, color, text) {
  if (movementLineActive) {
    try {
      await updateMovementSpokeItems(start, end, color, text)
      return
    } catch {
      movementLineActive = false
    }
  }
  await hideDistanceMovementLine()
  await OBR.scene.local.addItems([
    buildSpokeLine(start, end, MOVEMENT_SPOKE_LINE_ID, color),
    buildSpokeLabel(
      text,
      spokeLabelPosition(start, end),
      MOVEMENT_SPOKE_LABEL_ID,
      color
    ),
  ])
  movementLineActive = true
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number, metadata?: Record<string, unknown> } | null | undefined} probeItem
 * @param {{ x: number, y: number } | null | undefined} dragStartCenter
 */
export async function syncDistanceMovementLine(probeItem, dragStartCenter) {
  if (!probeItem || !dragStartCenter) {
    await hideDistanceMovementLine()
    return
  }
  const ctx = await getGridContext()
  const end = await resolveDistanceCenter(probeItem, ctx)
  const schritt = await computeGridSchrittFromCenters(dragStartCenter, end)
  if (!shouldShowMovementSpoke(schritt)) {
    await hideDistanceMovementLine()
    return
  }
  const meta = probeItem.metadata?.[TRACKER_ITEM_META_KEY]
  const color = resolveSpokeColor(meta)
  const text = formatSchritt(schritt)
  if (!text) {
    await hideDistanceMovementLine()
    return
  }
  await ensureMovementSpokeItems(dragStartCenter, end, color, text)
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number, metadata?: Record<string, unknown> } | null | undefined} probeItem
 * @param {typeof probeItem[]} otherItems
 * @param {number | null | undefined} classXSchritt
 */
export async function showDistanceSpokesFor(
  probeItem,
  otherItems,
  classXSchritt = null
) {
  if (!probeItem) return
  const ctx = await getGridContext()
  const start = await resolveDistanceCenter(probeItem, ctx)
  const spokePairs = await Promise.all(
    otherItems.map(async (other) => {
      if (!other?.id || other.id === probeItem.id) return null
      const end = await resolveDistanceCenter(other, ctx)
      const n = await computeGridSchrittFromCenters(start, end)
      const text = formatSchrittWithClass(n, classXSchritt)
      if (!text) return null
      const meta = other.metadata?.[TRACKER_ITEM_META_KEY]
      const color = resolveSpokeColor(meta)
      return { otherId: other.id, end, color, text }
    })
  )

  /** @type {Set<string>} */
  const nextIds = new Set()
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const toAdd = []

  for (const pair of spokePairs) {
    if (!pair) continue
    nextIds.add(pair.otherId)
    if (lastSpokeOtherIds.has(pair.otherId)) {
      try {
        await updateOtherSpokeItems(
          pair.otherId,
          start,
          pair.end,
          pair.color,
          pair.text
        )
      } catch {
        toAdd.push(
          buildSpokeLine(
            start,
            pair.end,
            spokeItemId(pair.otherId, 'line'),
            pair.color
          ),
          buildSpokeLabel(
            pair.text,
            spokeLabelPosition(start, pair.end),
            spokeItemId(pair.otherId, 'label'),
            pair.color
          )
        )
      }
    } else {
      toAdd.push(
        buildSpokeLine(
          start,
          pair.end,
          spokeItemId(pair.otherId, 'line'),
          pair.color
        ),
        buildSpokeLabel(
          pair.text,
          spokeLabelPosition(start, pair.end),
          spokeItemId(pair.otherId, 'label'),
          pair.color
        )
      )
    }
  }

  const removeIds = []
  for (const oldId of lastSpokeOtherIds) {
    if (!nextIds.has(oldId)) {
      removeIds.push(spokeItemId(oldId, 'line'), spokeItemId(oldId, 'label'))
    }
  }
  lastSpokeOtherIds.clear()
  for (const id of nextIds) lastSpokeOtherIds.add(id)

  await deleteLocalSpokeIds(removeIds)
  if (toAdd.length > 0) await OBR.scene.local.addItems(toAdd)
}

export async function hideDistanceSpokes() {
  await hideOtherDistanceSpokes()
  await hideDistanceMovementLine()
}

/** Nur fuer Tests: Spoke-/Movement-Tracking zuruecksetzen. */
export function resetDistanceSpokeOverlayStateForTests() {
  lastSpokeOtherIds.clear()
  movementLineActive = false
}
