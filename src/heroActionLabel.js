import OBR, { buildLabel } from '@owlbear-rodeo/sdk'
import { getCombat, onCombatChange } from './combatRoom.js'
import { isGmSync } from './editAccess.js'
import {
  readKrFirstSlotKind,
  readZaoSlot,
} from './krCounters.js'
import {
  LH_DONE_STEP_ID,
  normalizePhases,
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
} from './phaseLinks.js'

import { TRACKER_ITEM_META_KEY } from './participants.js'
export const TURN_ACTION_LABEL_ID = 'vierpunkteins/turn-action-label'
const TURN_ACTION_LABEL_META = 'vierpunkteins_kampf.turnActionLabel'

/** @type {Record<string, string>} */
export const KIND_LABEL = Object.freeze({
  ang: 'Angriff',
  sra: 'S.R.A.',
  lh: 'L.H.',
  uo: 'Umwandel-Obj.',
  par: 'Abwehr',
})

/**
 * @param {unknown} meta
 * @param {string | null | undefined} phaseLinkId
 * @returns {string | null}
 */
export function resolveTurnActionLabelText(meta, phaseLinkId) {
  if (!meta || typeof meta !== 'object') return null
  if (!phaseLinkId) {
    const kind = readKrFirstSlotKind(meta)
    return KIND_LABEL[kind] ?? 'Aktion'
  }
  const phases = normalizePhases(meta.phases)
  const link = phases.links.find((l) => l.id === phaseLinkId)
  if (!link) return null
  if (link.heroExtra === 'ang') return KIND_LABEL.ang
  const slot = readZaoSlot(meta, phaseLinkId)
  const kind = slot?.kind ?? 'ang'
  return KIND_LABEL[kind] ?? 'Aktion'
}

/**
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat>} combat
 * @returns {{ ownerId: string, phaseLinkId: string | null, text: string } | null}
 */
export function resolveTurnActionLabelTarget(combat) {
  if (!combat?.started || combat.roundIntroPending) return null
  const rid = combat.currentItemId
  if (typeof rid !== 'string') return null
  if (rid === ROUND_START_STEP_ID || rid === ROUND_END_STEP_ID) return null
  const phaseLinkId =
    typeof combat.currentPhaseLinkId === 'string'
      ? combat.currentPhaseLinkId
      : null
  return { ownerId: rid, phaseLinkId, text: '' }
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {{ ownerId: string }} target
 */
function tokenItemForLabel(items, target) {
  return items.find((i) => i.id === target.ownerId) ?? null
}

/**
 * @param {string} text
 * @param {import('@owlbear-rodeo/sdk').Item} tokenItem
 */
function buildTurnActionLabelItem(text, tokenItem) {
  const pos = tokenItem.position ?? { x: 0, y: 0 }
  return buildLabel()
    .id(TURN_ACTION_LABEL_ID)
    .attachedTo(tokenItem.id)
    .plainText(text)
    .position({ x: pos.x, y: pos.y })
    .backgroundColor('#1f2937')
    .backgroundOpacity(0.85)
    .layer('TEXT')
    .locked(true)
    .disableHit(true)
    .visible(tokenItem.visible !== false)
    .pointerHeight(0)
    .metadata({ [TURN_ACTION_LABEL_META]: true })
    .build()
}

async function deleteTurnActionLabelIfPresent(items) {
  const existing = items.find((i) => i.id === TURN_ACTION_LABEL_ID)
  if (!existing) return
  try {
    await OBR.scene.items.deleteItems([TURN_ACTION_LABEL_ID])
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Aktions-Label entfernen', e)
  }
}

async function refreshTurnActionLabel(itemsIn) {
  if (!isGmSync()) return
  const items =
    itemsIn ?? (await OBR.scene.items.getItems().catch(() => []))
  const combat = getCombat()
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
  const text = resolveTurnActionLabelText(meta, phaseLinkId)
  if (!text) {
    await deleteTurnActionLabelIfPresent(items)
    return
  }
  const label = buildTurnActionLabelItem(text, tokenItem)
  const existing = items.find((i) => i.id === TURN_ACTION_LABEL_ID)
  try {
    if (existing) {
      await OBR.scene.items.updateItems([TURN_ACTION_LABEL_ID], (drafts) => {
        for (const d of drafts) {
          d.plainText = label.plainText
          d.position = label.position
          d.attachedTo = label.attachedTo
          d.visible = label.visible
          d.backgroundColor = label.backgroundColor
          d.backgroundOpacity = label.backgroundOpacity
        }
      })
    } else {
      await OBR.scene.items.addItems([label])
    }
  } catch (e) {
    console.warn('[vierpunkteins_kampf] Aktions-Label aktualisieren', e)
  }
}

export function setupHeroActionLabel() {
  let itemsChangeUnsub = () => {}
  const scheduleRefresh = (items) => {
    void refreshTurnActionLabel(items)
  }
  const unsubCombat = onCombatChange(() => scheduleRefresh())
  if (OBR.isAvailable) {
    itemsChangeUnsub = OBR.scene.items.onChange((items) => scheduleRefresh(items))
  }
  void refreshTurnActionLabel()
  return {
    cleanup: () => {
      unsubCombat()
      itemsChangeUnsub()
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
