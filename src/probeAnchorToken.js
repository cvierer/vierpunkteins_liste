import OBR, { buildShape } from '@owlbear-rodeo/sdk'

export const PROBE_ANCHOR_TOKEN_ID = 'vierpunkteins/dist-probe-anchor'
export const PROBE_ANCHOR_META_KEY = 'vierpunkteinsDistProbeAnchor'

const ANCHOR_SIZE = 20

/** @type {{ x: number, y: number } | null} */
let cachedCenter = null
/** @type {string | null} */
let cachedOwnerId = null

export function hasProbeAnchorToken() {
  return cachedCenter != null
}

/** @returns {{ x: number, y: number } | null} */
export function getProbeAnchorCenter() {
  if (!cachedCenter) return null
  return { x: cachedCenter.x, y: cachedCenter.y }
}

/**
 * @param {{ x: number, y: number }} center
 * @param {string} ownerId
 */
function buildProbeAnchorItem(center, ownerId) {
  return buildShape()
    .id(PROBE_ANCHOR_TOKEN_ID)
    .shapeType('CIRCLE')
    .position({ x: center.x, y: center.y })
    .width(ANCHOR_SIZE)
    .height(ANCHOR_SIZE)
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
 */
export async function ensureProbeAnchorToken(center, ownerId) {
  if (
    cachedCenter &&
    cachedOwnerId === ownerId &&
    Math.abs(cachedCenter.x - center.x) < 1e-9 &&
    Math.abs(cachedCenter.y - center.y) < 1e-9
  ) {
    return
  }
  await removeProbeAnchorToken()
  const item = buildProbeAnchorItem(center, ownerId)
  try {
    await OBR.scene.local.addItems([item])
    cachedCenter = { x: center.x, y: center.y }
    cachedOwnerId = ownerId
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Dist-Probe-Anker anlegen', e)
    cachedCenter = null
    cachedOwnerId = null
  }
}

export async function removeProbeAnchorToken() {
  cachedCenter = null
  cachedOwnerId = null
  try {
    await OBR.scene.local.deleteItems([PROBE_ANCHOR_TOKEN_ID])
  } catch {
    /* item may not exist */
  }
}

/** @internal Vitest */
export function setProbeAnchorStateForTests(center, ownerId = null) {
  cachedCenter = center ? { x: center.x, y: center.y } : null
  cachedOwnerId = ownerId
}
