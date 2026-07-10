/**
 * L.H.-Feature-Fassade: Lifecycle-Registrierung beim Laden.
 */
import { TRACKER_ITEM_META_KEY } from './participants.js'
import { registerAfterCombatUpdate } from './combatLifecycle.js'
import { isLhActive } from './lhMeta.js'
import { readKrFirstSlotKind } from './krPrimaryField.js'
import { runLongHandlungAfterCombatUpdate } from './longHandlung.js'

function sceneHasLhContext(items) {
  if (!Array.isArray(items)) return false
  for (const it of items) {
    const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!m) continue
    if (isLhActive(m) || readKrFirstSlotKind(m) === 'lh') return true
  }
  return false
}

registerAfterCombatUpdate(
  'lh',
  async (items, tieOrderIds) => runLongHandlungAfterCombatUpdate(items, tieOrderIds),
  { when: sceneHasLhContext }
)

export { sceneHasLhContext }
