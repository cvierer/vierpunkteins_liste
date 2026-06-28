import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'

/**
 * @typedef {(
 *   | { kind: 'roundStart' }
 *   | { kind: 'roundEnd' }
 *   | { kind: 'phase', activeId: string, phaseId: string }
 *   | { kind: 'token', activeId: string }
 * )} NavHighlightSelector
 */

/**
 * Loest aus dem Kampfzustand das anzusteuernde Navigations-Ziel auf. Rein
 * (kein DOM), damit testbar. Die DOM-Aufloesung (mit Fallback-Kette
 * phase -> owner-phase -> token) passiert beim Aufrufer.
 *
 * @param {{ started?: boolean, currentItemId?: unknown, currentPhaseLinkId?: unknown } | null | undefined} combat
 * @returns {NavHighlightSelector | null}
 */
export function resolveNavHighlightSelector(combat) {
  if (!combat?.started) return null
  const activeId =
    typeof combat.currentItemId === 'string' ? combat.currentItemId : null
  const phaseId =
    typeof combat.currentPhaseLinkId === 'string'
      ? combat.currentPhaseLinkId
      : null
  if (activeId === ROUND_START_STEP_ID && !phaseId) return { kind: 'roundStart' }
  if (activeId === ROUND_END_STEP_ID && !phaseId) return { kind: 'roundEnd' }
  if (activeId && phaseId) return { kind: 'phase', activeId, phaseId }
  if (activeId) return { kind: 'token', activeId }
  return null
}
