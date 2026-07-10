/**
 * Helden-Mod-Feature-Fassade: Lifecycle-Registrierung beim Laden.
 */
import { TRACKER_ITEM_META_KEY } from './participants.js'
import { registerAfterCombatUpdate } from './combatLifecycle.js'
import { readHeroExMods, runHeroExModsAfterCombatUpdate } from './heroExMods.js'

function sceneHasHeroExMods(items) {
  if (!Array.isArray(items)) return false
  for (const it of items) {
    const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!m) continue
    if (readHeroExMods(m).length > 0) return true
  }
  return false
}

registerAfterCombatUpdate(
  'heroEx',
  async (items, tieOrderIds, ctx) =>
    runHeroExModsAfterCombatUpdate(items, tieOrderIds, {
      currentRound: ctx.combatRound,
    }),
  { when: sceneHasHeroExMods }
)

export { sceneHasHeroExMods }
