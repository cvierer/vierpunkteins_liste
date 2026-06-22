import { ROUND_END_STEP_ID } from './phaseLinks.js'

/**
 * Kampf steht auf dem „Ende der Kampfrunde“-Marker (unabhängig von steps-Index).
 *
 * @param {{ currentItemId?: string | null, currentPhaseLinkId?: string | null }} combat
 */
export function isCombatAtRoundEndMarker(combat) {
  if (!combat) return false
  const phaseId = combat.currentPhaseLinkId
  return (
    combat.currentItemId === ROUND_END_STEP_ID &&
    (typeof phaseId !== 'string' || !phaseId)
  )
}

/**
 * Patch für roundIntroPending aus aktuellem Kampfstand.
 *
 * @param {{ round?: number, currentItemId?: string | null, currentPhaseLinkId?: string | null }} combat
 * @param {{ kind: string, id: string }} markerStep
 */
export function buildRoundIntroPendingPatch(combat, markerStep) {
  return {
    roundIntroPending: true,
    roundIntroPrevRound: combat.round,
    roundIntroPrevItemId: combat.currentItemId,
    roundIntroPrevPhaseLinkId: combat.currentPhaseLinkId,
    currentItemId: markerStep.id,
    currentPhaseLinkId: null,
    currentTurnSubStep: null,
  }
}
