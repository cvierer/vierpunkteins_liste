import OBR from '@owlbear-rodeo/sdk'
import {
  patchKrCounterByDelta,
  patchZaoSlotStampPrimary,
  primaryFieldForKind,
  readKrFirstSlotKind,
  readZaoSlot,
} from './krCounters.js'
import { normalizePhases } from './phaseLinks.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

/**
 * Stempelt beim Übergang Aktion → Reaktion die eingestellte Primäraktion der Zeile.
 * Bei `uo` (Umwandel-Objekt) wird nichts gestempelt.
 *
 * @param {{ kind: string, id?: string, ownerId?: string, linkId?: string, sub?: string }} step
 */
export async function autoStampForCombatStep(step) {
  if (!step || step.sub !== 'action') return

  if (step.kind === 'token' && step.id) {
    const items = await OBR.scene.items.getItems()
    const item = items.find((i) => i.id === step.id)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) return
    if (readKrFirstSlotKind(meta) === 'uo') return
    const field = primaryFieldForKind(meta)
    await patchKrCounterByDelta(step.id, field, 1, {
      stampAnchor: { rowId: step.id, phaseLinkId: null },
    })
    return
  }

  if (step.kind === 'phase' && step.ownerId && step.linkId) {
    const items = await OBR.scene.items.getItems()
    const item = items.find((i) => i.id === step.ownerId)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) return
    const phases = normalizePhases(meta.phases)
    const link = phases.links.find((l) => l.id === step.linkId)
    if (!link || link.parentId !== null) return
    if (link.heroExtra === 'ang') {
      await patchZaoSlotStampPrimary(step.ownerId, step.linkId)
      return
    }
    const slot = readZaoSlot(meta, step.linkId)
    if (slot?.kind === 'uo') return
    await patchZaoSlotStampPrimary(step.ownerId, step.linkId)
  }
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
