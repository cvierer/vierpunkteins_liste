import OBR, { buildLabel } from '@owlbear-rodeo/sdk'
import { getCombat, onCombatChange } from './combatRoom.js'
import { isGmSync } from './editAccess.js'
import {
  combatOverlayKey,
  KIND_LABEL,
  primaryKindMapStyle,
  primaryKindMapSymbol,
  primaryKindMapFontWeight,
  primaryKindMapFontSize,
  resolvePrimaryKindForNav,
  shouldShowTurnActionMapBadge,
} from './krPrimaryKindIcons.js'
import {
  LH_DONE_STEP_ID,
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
} from './phaseLinks.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'
import { readHeroBgColor } from './heroColors.js'

export const TURN_ACTION_LABEL_ID = 'vierpunkteins/turn-action-label'
/** Legacy split-overlay; beim Refresh mit entfernen. */
export const TURN_ACTION_GLYPH_ID = 'vierpunkteins/turn-action-glyph'
const TURN_ACTION_LABEL_META = 'vierpunkteins_kampf.turnActionLabel'
const TURN_ACTION_OVERLAY_IDS = [TURN_ACTION_LABEL_ID, TURN_ACTION_GLYPH_ID]

const LABEL_EST_HEIGHT = 40
const LABEL_GAP = 10

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

/**
 * @param {{ center: { x: number, y: number }, height?: number }} bounds
 */
function labelPositionAboveToken(bounds) {
  const tokenHalfH = (bounds.height ?? 0) / 2
  return {
    x: bounds.center.x,
    y: bounds.center.y - tokenHalfH - LABEL_EST_HEIGHT - LABEL_GAP,
  }
}

/**
 * @param {string} tokenId
 * @returns {Promise<{ x: number, y: number } | null>}
 */
async function resolveLabelPosition(tokenId) {
  try {
    const bounds = await OBR.scene.items.getItemBounds([tokenId])
    if (bounds?.center) return labelPositionAboveToken(bounds)
  } catch {
    /* fallback */
  }
  return null
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par'} kind
 * @param {import('@owlbear-rodeo/sdk').Item} tokenItem
 * @param {{ x: number, y: number }} position
 * @param {string | null} [heroColor]
 */
/**
 * Glyph-spezifische Rotation in Grad fuer das Kampfschritt-Label. Das Dagger-
 * Symbol (U+1F5E1) zeigt in Standard-Emoji-Fonts (Segoe UI Emoji, Apple Color
 * Emoji) mit der Klinge diagonal nach oben rechts (≈ 45° im Uhrzeigersinn von
 * der Vertikalen). Rotation -45° dreht die Klinge senkrecht nach oben.
 */
function turnActionLabelRotation(kind) {
  if (kind === 'ang') return -45
  return 0
}

function buildTurnActionLabelItem(kind, tokenItem, position, heroColor) {
  const style = primaryKindMapStyle(kind, heroColor)
  const ariaName = KIND_LABEL[kind] ?? 'Aktion'
  return buildLabel()
    .id(TURN_ACTION_LABEL_ID)
    .plainText(primaryKindMapSymbol(kind))
    .position(position)
    .fontSize(primaryKindMapFontSize(kind))
    .fontWeight(primaryKindMapFontWeight(kind))
    .textAlign('CENTER')
    .textAlignVertical('MIDDLE')
    .fillColor(style.fillColor)
    .backgroundColor(style.backgroundColor)
    .backgroundOpacity(style.backgroundOpacity)
    .cornerRadius(6)
    .padding(4)
    .layer('TEXT')
    .rotation(turnActionLabelRotation(kind))
    .locked(true)
    .disableHit(true)
    .visible(tokenItem.visible !== false)
    .name(ariaName)
    .metadata({
      [TURN_ACTION_LABEL_META]: true,
      turnActionOwnerId: tokenItem.id,
      turnActionKind: kind,
    })
    .build()
}

let lastOverlayKey = ''
let lastOverlayOwnerId = ''

async function deleteTurnActionLabelIfPresent(items) {
  const existing = TURN_ACTION_OVERLAY_IDS.some((id) =>
    items.some((i) => i.id === id)
  )
  if (!existing) return
  try {
    await OBR.scene.items.deleteItems(TURN_ACTION_OVERLAY_IDS)
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Aktions-Symbol entfernen', e)
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
  if (!items.some((i) => i.id === TURN_ACTION_LABEL_ID)) return
  const tokenItem = tokenItemForLabel(items, target)
  if (!tokenItem) return
  const position = await resolveLabelPosition(target.ownerId)
  if (!position) return
  try {
    await OBR.scene.items.updateItems([TURN_ACTION_LABEL_ID], (drafts) => {
      for (const d of drafts) {
        d.position = position
        d.visible = tokenItem.visible !== false
      }
    })
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Aktions-Symbol Position', e)
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
  if (!kind || !shouldShowTurnActionMapBadge(kind)) {
    await deleteTurnActionLabelIfPresent(items)
    return
  }
  const heroColor = readHeroBgColor(meta)
  const position =
    (await resolveLabelPosition(target.ownerId)) ??
    tokenItem.position ??
    { x: 0, y: 0 }
  const labelItem = buildTurnActionLabelItem(kind, tokenItem, position, heroColor)
  const existingBadge = items.find((i) => i.id === TURN_ACTION_LABEL_ID)
  const existingGlyph = items.find((i) => i.id === TURN_ACTION_GLYPH_ID)
  const ownerChanged =
    lastOverlayOwnerId !== '' && lastOverlayOwnerId !== target.ownerId
  const keyChanged = lastOverlayKey !== '' && lastOverlayKey !== overlayKey
  const needsRecreate =
    existingGlyph != null || ownerChanged || keyChanged || !existingBadge

  try {
    if (needsRecreate) {
      await OBR.scene.items.deleteItems(TURN_ACTION_OVERLAY_IDS)
      await OBR.scene.items.addItems([labelItem])
    } else {
      const style = primaryKindMapStyle(kind, heroColor)
      const fontSize = primaryKindMapFontSize(kind)
      const fontWeight = primaryKindMapFontWeight(kind)
      const symbol = primaryKindMapSymbol(kind)
      await OBR.scene.items.updateItems([TURN_ACTION_LABEL_ID], (drafts) => {
        for (const d of drafts) {
          d.position = labelItem.position
          d.visible = labelItem.visible
          d.name = labelItem.name
          d.metadata = labelItem.metadata
          d.rotation = 0
          if (d.text) {
            d.text.plainText = symbol
            d.text.fillColor = style.fillColor
            d.text.fontSize = fontSize
            d.text.fontWeight = fontWeight
          }
          if (d.style) {
            d.style.backgroundColor = style.backgroundColor
            d.style.backgroundOpacity = style.backgroundOpacity
          }
        }
      })
    }
    lastOverlayKey = overlayKey
    lastOverlayOwnerId = target.ownerId
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Aktions-Symbol aktualisieren', e)
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
          await OBR.scene.items.deleteItems(TURN_ACTION_OVERLAY_IDS)
        } catch {
          /* ignore */
        }
      })()
    },
  }
}
