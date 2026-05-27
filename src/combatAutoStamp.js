import OBR from '@owlbear-rodeo/sdk'
import { getCombat } from './combatRoom.js'
import { isLhLockingActions } from './lhMeta.js'
import {
  KR_ANG,
  KR_LH_ACTION,
  KR_SRA,
  motherHasTransferablePrimaryCharge,
  patchKrCounterByDelta,
  patchZaoSlotStampPrimary,
  primaryFieldForKind,
  readKrFirstSlotKind,
  readZaoSlot,
} from './krCounters.js'
import { normalizePhases } from './phaseLinks.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

function lhLockRoundFromCombat() {
  const c = getCombat()
  if (!c.started) return null
  return Number.isFinite(c.round) ? c.round : null
}

/**
 * @param {unknown} meta
 * @param {string} linkId
 */
function zaoRootCanAutoStamp(meta, linkId) {
  const slot = readZaoSlot(meta, linkId)
  if (!slot || slot.kind === 'uo' || slot.marks !== 1) return false
  const field =
    slot.kind === 'sra'
      ? KR_SRA
      : slot.kind === 'lh'
        ? KR_LH_ACTION
        : KR_ANG
  if (field === KR_LH_ACTION) return false
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return false
  return true
}

/**
 * @param {{ kind: string, id?: string, ownerId?: string, linkId?: string, sub?: string }} step
 * @param {unknown} meta
 * @param {{ parentId?: string | null } | null | undefined} [link]
 */
export function canAutoStampForCombatStep(step, meta, link = null) {
  if (!step || step.sub !== 'action') return false
  if (step.kind === 'token') {
    if (!meta) return false
    if (readKrFirstSlotKind(meta) === 'uo') return false
    return motherHasTransferablePrimaryCharge(meta)
  }
  if (step.kind === 'phase' && step.ownerId && step.linkId) {
    if (!meta || !link || link.parentId !== null) return false
    return zaoRootCanAutoStamp(meta, step.linkId)
  }
  return false
}

/**
 * Stempelt die eingestellte Primäraktion der Zeile (Navigation „Weiter“).
 * @returns {Promise<boolean>} true wenn ein Stempel gesetzt wurde
 */
export async function autoStampForCombatStep(step) {
  if (!step || step.sub !== 'action') return false

  if (step.kind === 'token' && step.id) {
    const items = await OBR.scene.items.getItems()
    const item = items.find((i) => i.id === step.id)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!canAutoStampForCombatStep(step, meta)) return false
    const field = primaryFieldForKind(meta)
    await patchKrCounterByDelta(step.id, field, 1, {
      stampAnchor: { rowId: step.id, phaseLinkId: null },
    })
    return true
  }

  if (step.kind === 'phase' && step.ownerId && step.linkId) {
    const items = await OBR.scene.items.getItems()
    const item = items.find((i) => i.id === step.ownerId)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) return false
    const phases = normalizePhases(meta.phases)
    const link = phases.links.find((l) => l.id === step.linkId)
    if (!canAutoStampForCombatStep(step, meta, link)) return false
    await patchZaoSlotStampPrimary(step.ownerId, step.linkId)
    return true
  }

  return false
}

/**
 * @param {object | null | undefined} cur
 * @param {object | null | undefined} next
 */
export function shouldAutoStampActionToReaction(cur, next) {
  if (!cur || !next) return false
  if (cur.sub !== 'action' || next.sub !== 'reaction') return false
  if (cur.kind !== next.kind) return false
  if (cur.kind === 'token') return cur.id === next.id
  if (cur.kind === 'phase') {
    return cur.ownerId === next.ownerId && cur.linkId === next.linkId
  }
  return false
}
