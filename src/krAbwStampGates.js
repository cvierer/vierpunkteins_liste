import { getCombat } from './combatRoom.js'
import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'

/**
 * Abwehr/Parade stempelbar: Kampf läuft, kein Runden-Intro, nicht an KR-Grenze.
 *
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat> | null | undefined} [combat]
 */
export function liveAbwCombatAllowsStamp(combat = null) {
  const c = combat ?? getCombat()
  if (!c?.started || c.roundIntroPending) return false
  const cid = c.currentItemId
  if (cid === ROUND_START_STEP_ID || cid === ROUND_END_STEP_ID) return false
  return true
}

/**
 * Freie Aktion stempelbar: Kampf läuft, nicht an KR-Grenze.
 *
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat> | null | undefined} [combat]
 */
export function liveFaLadungAllowed(combat = null) {
  const c = combat ?? getCombat()
  if (!c?.started) return false
  const cid = c.currentItemId
  if (cid === ROUND_START_STEP_ID || cid === ROUND_END_STEP_ID) return false
  return true
}

/**
 * Stempel-Anker für Abwehr/Parade aus aktueller Navigation.
 *
 * @param {string} ownerItemId
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat> | null | undefined} [combat]
 */
export function liveAbwStampAnchor(ownerItemId, combat = null) {
  const c = combat ?? getCombat()
  const rowActiveId =
    typeof c?.currentItemId === 'string' ? c.currentItemId : ownerItemId
  const phaseLinkId =
    typeof c?.currentPhaseLinkId === 'string' ? c.currentPhaseLinkId : null
  return { rowId: rowActiveId, phaseLinkId }
}
