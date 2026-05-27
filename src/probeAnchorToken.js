import OBR, { buildShape } from '@owlbear-rodeo/sdk'
import { getGridContext } from './gridDistance.js'
import { imageRenderSize } from './heroOrientationRingsOverlay.js'

export const PROBE_ANCHOR_TOKEN_ID = 'vierpunkteins/dist-probe-anchor'
export const PROBE_ANCHOR_META_KEY = 'vierpunkteinsDistProbeAnchor'

/** @type {{ x: number, y: number } | null} */
let cachedCenter = null
/** @type {string | null} */
let cachedOwnerId = null
/** @type {Record<string, unknown> | null} */
let cachedPseudoItem = null

export function hasProbeAnchorToken() {
  return cachedCenter != null
}

/** @returns {{ x: number, y: number } | null} */
export function getProbeAnchorCenter() {
  if (!cachedCenter) return null
  return { x: cachedCenter.x, y: cachedCenter.y }
}

/** @returns {Record<string, unknown> | null} */
export function getProbeAnchorPseudoItem() {
  return cachedPseudoItem
}

/** @returns {string | null} */
export function getProbeAnchorOwnerId() {
  return cachedOwnerId
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item} heroItem
 * @param {{ x: number, y: number }} anchorCenter
 * @param {import('./gridDistance.js').GridContext | null | undefined} gridContext
 */
export function buildAnchorPseudoItem(heroItem, anchorCenter, gridContext) {
  const dpi = gridContext?.dpi ?? 100
  const { width, height, offsetX, offsetY } = imageRenderSize(heroItem, dpi)
  return {
    id: PROBE_ANCHOR_TOKEN_ID,
    position: {
      x: anchorCenter.x + offsetX - width / 2,
      y: anchorCenter.y + offsetY - height / 2,
    },
    width,
    height,
    image: heroItem?.image,
    scale: heroItem?.scale,
    grid: heroItem?.grid,
    metadata: heroItem?.metadata,
  }
}

/**
 * @param {{ x: number, y: number }} center
 * @param {string} ownerId
 * @param {import('@owlbear-rodeo/sdk').Item | null | undefined} heroItem
 * @param {import('./gridDistance.js').GridContext | null | undefined} gridContext
 */
function buildProbeAnchorItem(center, ownerId, heroItem, gridContext) {
  const dpi = gridContext?.dpi ?? 100
  const { width, height } = heroItem
    ? imageRenderSize(heroItem, dpi)
    : { width: 20, height: 20 }
  const diameter = Math.max(width, height)
  return buildShape()
    .id(PROBE_ANCHOR_TOKEN_ID)
    .shapeType('CIRCLE')
    .position({ x: center.x, y: center.y })
    .width(diameter)
    .height(diameter)
    .strokeOpacity(0)
    .fillOpacity(0)
    .visible(false)
    .locked(true)
    .disableHit(true)
    .layer('DRAWING')
    .zIndex(-2000)
    .name('Dist-Probe-Anker')
    .metadata({
      [PROBE_ANCHOR_META_KEY]: true,
      ownerId,
    })
    .build()
}

/**
 * Legt einen lokalen unsichtbaren Anker an der Greifposition an (idempotent).
 * @param {{ x: number, y: number }} center
 * @param {string} ownerId
 * @param {import('@owlbear-rodeo/sdk').Item | null | undefined} [heroItem]
 */
export async function ensureProbeAnchorToken(center, ownerId, heroItem = null) {
  if (
    cachedCenter &&
    cachedOwnerId === ownerId &&
    Math.abs(cachedCenter.x - center.x) < 1e-9 &&
    Math.abs(cachedCenter.y - center.y) < 1e-9
  ) {
    return
  }
  await removeProbeAnchorToken()
  const gridContext = heroItem ? await getGridContext() : null
  if (heroItem && gridContext) {
    cachedPseudoItem = buildAnchorPseudoItem(heroItem, center, gridContext)
  }
  const item = buildProbeAnchorItem(center, ownerId, heroItem, gridContext)
  try {
    await OBR.scene.local.addItems([item])
    cachedCenter = { x: center.x, y: center.y }
    cachedOwnerId = ownerId
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Dist-Probe-Anker anlegen', e)
    cachedCenter = null
    cachedOwnerId = null
    cachedPseudoItem = null
  }
}

export async function removeProbeAnchorToken() {
  cachedCenter = null
  cachedOwnerId = null
  cachedPseudoItem = null
  try {
    await OBR.scene.local.deleteItems([PROBE_ANCHOR_TOKEN_ID])
  } catch {
    /* item may not exist */
  }
}

/** @internal Vitest */
export function setProbeAnchorStateForTests(center, ownerId = null, pseudoItem = null) {
  cachedCenter = center ? { x: center.x, y: center.y } : null
  cachedOwnerId = ownerId
  cachedPseudoItem = pseudoItem
}
