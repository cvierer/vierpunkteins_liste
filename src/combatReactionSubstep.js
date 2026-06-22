import OBR from '@owlbear-rodeo/sdk'
import { patchCombat } from './combatRoom.js'
import { canAutoStampForCombatStep } from './combatAutoStamp.js'
import { hasPrimaryActionStampAtCombatStep } from './krCounters.js'
import { isStampableCombatStep } from './phaseLinks.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

/**
 * Helden-Mutterzeile: nur Reaktions-Substep wechseln (Stempel passiert in
 * `maybeAutoStampOrAdvanceToReaction` zuerst).
 *
 * @returns {Promise<boolean>} true wenn nur Substep gewechselt wurde
 */
export async function advanceTokenMotherToReactionSubstep(cur, c) {
  if (cur?.kind !== 'token' || c.currentTurnSubStep === 'reaction') return false

  if (hasPrimaryActionStampAtCombatStep(c)) {
    await patchCombat({
      currentItemId: cur.id,
      currentPhaseLinkId: null,
      currentTurnSubStep: 'reaction',
      round: c.round,
    })
    return true
  }

  if (isStampableCombatStep(cur)) {
    let items = await OBR.scene.items.getItems([cur.id])
    let item = items?.[0]
    if (!item) {
      const all = await OBR.scene.items.getItems()
      item = all.find((i) => i.id === cur.id)
    }
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    const couldStamp = await canAutoStampForCombatStep(cur, meta, null)
    if (!couldStamp) {
      await patchCombat({
        currentItemId: cur.id,
        currentPhaseLinkId: null,
        currentTurnSubStep: 'reaction',
        round: c.round,
      })
      return true
    }
    return false
  }

  await patchCombat({
    currentItemId: cur.id,
    currentPhaseLinkId: null,
    currentTurnSubStep: 'reaction',
    round: c.round,
  })
  return true
}
