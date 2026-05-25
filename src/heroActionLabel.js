import OBR, { buildImage } from '@owlbear-rodeo/sdk'
import { getCombat, onCombatChange } from './combatRoom.js'
import { isGmSync } from './editAccess.js'
import {
  combatOverlayKey,
  KIND_LABEL,
  MAP_PRIMARY_ICON_H,
  MAP_PRIMARY_ICON_W,
  primaryKindPngDataUrl,
  resolvePrimaryKindForNav,
} from './krPrimaryKindIcons.js'
import {
  LH_DONE_STEP_ID,
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
} from './phaseLinks.js'

import { TRACKER_ITEM_META_KEY } from './participants.js'

export const TURN_ACTION_LABEL_ID = 'vierpunkteins/turn-action-label'
const TURN_ACTION_LABEL_META = 'vierpunkteins_kampf.turnActionLabel'

const ICON_W = MAP_PRIMARY_ICON_W
const ICON_H = MAP_PRIMARY_ICON_H
const ICON_GAP = 10

export { KIND_LABEL }

/**
 * @param {unknown} meta
 * @param {string | null | undefined} phaseLinkId
 * @returns {string | null}
 */
export function resolveTurnActionLabelText(meta, phaseLinkId) {
  const kind = resolvePrimaryKindForNav(meta, phaseLinkId)
  if (!kind) return null
  return KIND_LABEL[kind] ?? 'Aktion'
}

/**
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat>} combat
 * @returns {{ ownerId: string, phaseLinkId: string | null } | null}
 */
export function resolveTurnActionLabelTarget(combat) {
  if (!combat?.started || combat.roundIntroPending) return null
  const rid = combat.currentItemId
  if (typeof rid !== 'string') return null
  if (rid === ROUND_START_STEP_ID || rid === ROUND_END_STEP_ID) return null
  if (rid === LH_DONE_STEP_ID) return null
  const phaseLinkId =
    typeof combat.currentPhaseLinkId === 'string'
      ? combat.currentPhaseLinkId
      : null
  return { ownerId: rid, phaseLinkId }
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {{ ownerId: string }} target
 */
function tokenItemForLabel(items, target) {
  return items.find((i) => i.id === target.ownerId) ?? null
}

/** @returns {Promise<number>} */
async function sceneDpi() {
  try {
    const dpi = await OBR.scene.grid.getDpi()
    if (Number.isFinite(dpi) && dpi > 0) return dpi
  } catch {
    /* fallback */
  }
  return 100
}

/**
 * @param {{ center: { x: number, y: number }, height?: number }} bounds
 */
function iconPositionAboveToken(bounds) {
  const tokenHalfH = (bounds.height ?? 0) / 2
  return {
    x: bounds.center.x - ICON_W / 2,
    y: bounds.center.y - tokenHalfH - ICON_H - ICON_GAP,
  }
}

/**
 * @param {string} tokenId
 * @returns {Promise<{ x: number, y: number } | null>}
 */
async function resolveIconPosition(tokenId) {
  try {
    const bounds = await OBR.scene.items.getItemBounds([tokenId])
    if (bounds?.center) return iconPositionAboveToken(bounds)
  } catch {
    /* fallback */
  }
  return null
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par'} kind
 * @param {import('@owlbear-rodeo/sdk').Item} tokenItem
 * @param {{ x: number, y: number }} position
 * @param {number} dpi
 * @param {string} url
 */
function buildTurnActionImageItem(kind, tokenItem, position, dpi, url) {
  const label = KIND_LABEL[kind] ?? 'Aktion'
  return buildImage(
    { width: ICON_W, height: ICON_H, url, mime: 'image/png' },
    { dpi, offset: { x: 0, y: 0 } }
  )
    .id(TURN_ACTION_LABEL_ID)
    .position(position)
    .layer('TEXT')
    .locked(true)
    .disableHit(true)
    .visible(tokenItem.visible !== false)
    .name(label)
    .metadata({
      [TURN_ACTION_LABEL_META]: true,
      turnActionOwnerId: tokenItem.id,
    })
    .build()
}

let lastOverlayKey = ''
let lastOverlayOwnerId = ''

async function deleteTurnActionLabelIfPresent(items) {
  const existing = items.find((i) => i.id === TURN_ACTION_LABEL_ID)
  if (!existing) return
  try {
    await OBR.scene.items.deleteItems([TURN_ACTION_LABEL_ID])
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Aktions-Icon entfernen', e)
  }
  lastOverlayKey = ''
  lastOverlayOwnerId = ''
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {{ ownerId: string }} target
 */
async function updateTurnActionLabelPositionOnly(items, target) {
  if (!isGmSync()) return
  const existing = items.find((i) => i.id === TURN_ACTION_LABEL_ID)
  if (!existing) return
  const tokenItem = tokenItemForLabel(items, target)
  if (!tokenItem) return
  const position = await resolveIconPosition(target.ownerId)
  if (!position) return
  try {
    await OBR.scene.items.updateItems([TURN_ACTION_LABEL_ID], (drafts) => {
      for (const d of drafts) {
        d.position = position
        d.visible = tokenItem.visible !== false
      }
    })
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Aktions-Icon Position', e)
  }
}

async function refreshTurnActionLabel(itemsIn) {
  if (!isGmSync()) return
  const items =
    itemsIn ?? (await OBR.scene.items.getItems().catch(() => []))
  const combat = getCombat()
  const overlayKey = combatOverlayKey(combat)
  const target = resolveTurnActionLabelTarget(combat)
  if (!target) {
    await deleteTurnActionLabelIfPresent(items)
    return
  }
  const tokenItem = tokenItemForLabel(items, target)
  if (!tokenItem) {
    await deleteTurnActionLabelIfPresent(items)
    return
  }
  const meta = tokenItem.metadata?.[TRACKER_ITEM_META_KEY]
  const phaseLinkId =
    typeof combat.currentPhaseLinkId === 'string'
      ? combat.currentPhaseLinkId
      : null
  const kind = resolvePrimaryKindForNav(meta, phaseLinkId)
  if (!kind) {
    await deleteTurnActionLabelIfPresent(items)
    return
  }
  const pngUrl = await primaryKindPngDataUrl(kind)
  if (!pngUrl) {
    console.warn('[vierpunkteins_kampf] Aktions-Icon Raster fehlgeschlagen', kind)
    return
  }
  const position =
    (await resolveIconPosition(target.ownerId)) ??
    tokenItem.position ??
    { x: 0, y: 0 }
  const dpi = await sceneDpi()
  const imageItem = buildTurnActionImageItem(
    kind,
    tokenItem,
    position,
    dpi,
    pngUrl
  )
  const existing = items.find((i) => i.id === TURN_ACTION_LABEL_ID)
  const ownerChanged =
    lastOverlayOwnerId !== '' && lastOverlayOwnerId !== target.ownerId
  const keyChanged = lastOverlayKey !== '' && lastOverlayKey !== overlayKey

  try {
    if (existing && (ownerChanged || keyChanged)) {
      await OBR.scene.items.deleteItems([TURN_ACTION_LABEL_ID])
      await OBR.scene.items.addItems([imageItem])
    } else if (existing) {
      await OBR.scene.items.updateItems([TURN_ACTION_LABEL_ID], (drafts) => {
        for (const d of drafts) {
          if (d.image) {
            d.image.url = imageItem.image.url
            d.image.mime = imageItem.image.mime
            d.image.width = imageItem.image.width
            d.image.height = imageItem.image.height
          }
          d.position = imageItem.position
          d.visible = imageItem.visible
          d.name = imageItem.name
          d.metadata = imageItem.metadata
        }
      })
    } else {
      await OBR.scene.items.addItems([imageItem])
    }
    lastOverlayKey = overlayKey
    lastOverlayOwnerId = target.ownerId
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Aktions-Icon aktualisieren', e)
  }
}

/** GM-Refresh nach Kampf-Navigation (unabhängig von onChange-Races). */
export function scheduleTurnActionMapRefresh() {
  void refreshTurnActionLabel()
}

export function setupHeroActionLabel() {
  let itemsChangeUnsub = () => {}
  const scheduleRefresh = (items) => {
    const combat = getCombat()
    const key = combatOverlayKey(combat)
    if (
      items &&
      key !== '' &&
      key === lastOverlayKey &&
      resolveTurnActionLabelTarget(combat)
    ) {
      const target = resolveTurnActionLabelTarget(combat)
      if (target) {
        void updateTurnActionLabelPositionOnly(items, target)
        return
      }
    }
    void refreshTurnActionLabel(items)
  }
  const unsubCombat = onCombatChange(() => {
    void refreshTurnActionLabel()
  })
  if (OBR.isAvailable) {
    itemsChangeUnsub = OBR.scene.items.onChange((items) => scheduleRefresh(items))
  }
  void refreshTurnActionLabel()
  return {
    cleanup: () => {
      unsubCombat()
      itemsChangeUnsub()
      lastOverlayKey = ''
      lastOverlayOwnerId = ''
      void (async () => {
        if (!isGmSync()) return
        try {
          await OBR.scene.items.deleteItems([TURN_ACTION_LABEL_ID])
        } catch {
          /* ignore */
        }
      })()
    },
  }
}
