import OBR from '@owlbear-rodeo/sdk'
import { getCombat, getIniTieOrder } from './combatRoom.js'
import { isLhLockingActions, lhCompletionStampReady } from './lhMeta.js'
import {
  motherHasTransferablePrimaryCharge,
  patchKrCounterByDelta,
  patchZaoSlotStampPrimary,
  primaryFieldForKind,
  readKrFirstSlotKind,
  readZaoSlot,
  stampLhCompletion,
} from './krCounters.js'
import { normalizePhases, resolveCurrentNavIniForCombat } from './phaseLinks.js'
import { collectSortedParticipants, TRACKER_ITEM_META_KEY } from './participants.js'
import { getManualIniTieOverridePairs } from './manualIniTieOverrides.js'

function lhLockRoundFromCombat() {
  const c = getCombat()
  if (!c.started) return null
  return Number.isFinite(c.round) ? c.round : null
}

/** Nav-INI aus Kampf-Schritt (wie Initiative-Liste), nicht DOM-Fallback. */
async function resolveNavIniForAutoStamp() {
  const c = getCombat()
  if (!c.started || c.roundIntroPending) return null
  const items = await OBR.scene.items.getItems()
  const tieOrder = getIniTieOrder()
  const rows = collectSortedParticipants(
    items,
    tieOrder,
    getManualIniTieOverridePairs()
  )
  const combatRound =
    c.started && Number.isFinite(Number(c.round)) ? Number(c.round) : null
  return resolveCurrentNavIniForCombat(
    rows,
    items,
    tieOrder,
    combatRound,
    c
  )
}

function lhStampReady(meta, currentNavIni, zaoLhSlot = false) {
  if (currentNavIni == null) return false
  return lhCompletionStampReady(
    meta,
    lhLockRoundFromCombat(),
    currentNavIni,
    { zaoLhSlot }
  )
}

/**
 * @param {unknown} meta
 * @param {string} linkId
 */
function zaoRootCanAutoStamp(meta, linkId) {
  const slot = readZaoSlot(meta, linkId)
  if (!slot || slot.kind === 'uo' || slot.marks !== 1) return false
  if (slot.kind === 'lh') return false
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return false
  return true
}

/**
 * @param {{ kind: string, id?: string, ownerId?: string, linkId?: string, sub?: string }} step
 * @param {unknown} meta
 * @param {{ parentId?: string | null } | null | undefined} [link]
 * @param {number | null | undefined} [currentNavIni]
 */
export async function canAutoStampForCombatStep(
  step,
  meta,
  link = null,
  currentNavIni = undefined
) {
  if (!step || step.sub !== 'action') return false
  const navIni =
    currentNavIni !== undefined ? currentNavIni : await resolveNavIniForAutoStamp()
  if (step.kind === 'token') {
    if (!meta) return false
    const firstKind = readKrFirstSlotKind(meta)
    if (firstKind === 'uo') return false
    if (firstKind === 'lh') return lhStampReady(meta, navIni, false)
    return motherHasTransferablePrimaryCharge(meta)
  }
  if (step.kind === 'phase' && step.ownerId && step.linkId) {
    if (!meta || !link || link.parentId !== null) return false
    const slot = readZaoSlot(meta, step.linkId)
    if (!slot || slot.kind === 'uo') return false
    if (slot.kind === 'lh') return lhStampReady(meta, navIni, true)
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
  const currentNavIni = await resolveNavIniForAutoStamp()

  if (step.kind === 'token' && step.id) {
    const items = await OBR.scene.items.getItems()
    const item = items.find((i) => i.id === step.id)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!(await canAutoStampForCombatStep(step, meta, null, currentNavIni))) {
      return false
    }
    if (readKrFirstSlotKind(meta) === 'lh') {
      await stampLhCompletion(step.id, null)
      return true
    }
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
    if (!(await canAutoStampForCombatStep(step, meta, link, currentNavIni))) {
      return false
    }
    const slot = readZaoSlot(meta, step.linkId)
    if (slot?.kind === 'lh') {
      await stampLhCompletion(step.ownerId, step.linkId)
      return true
    }
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
