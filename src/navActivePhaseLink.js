/**
 * @typedef {{ kind?: string, ownerId?: string, linkId?: string, sub?: string }} CombatTurnStep
 */

/**
 * Loest eine evtl. veraltete `currentPhaseLinkId` gegen die aktuellen
 * Navigationsschritte auf. Findet sich die exakte Owner+Link-Phase unter den
 * Schritten, bleibt die ID unveraendert. Sonst (Ghost-ID nach UUID-Churn der
 * ephemeren 2.AO-Wurzel) wird auf die erste Phasenzeile desselben Owners
 * gesnappt — analog zum V1289-Highlight-Fallback. Die Mutterzeile
 * (`phaseId == null`) bleibt `null`. Rein, ohne DOM, damit testbar.
 *
 * @param {{ currentItemId?: unknown, currentPhaseLinkId?: unknown } | null | undefined} combat
 * @param {CombatTurnStep[] | null | undefined} steps
 * @returns {string | null}
 */
export function resolveActivePhaseLinkId(combat, steps) {
  const activeId =
    typeof combat?.currentItemId === 'string' ? combat.currentItemId : null
  const phaseId =
    typeof combat?.currentPhaseLinkId === 'string' &&
    combat.currentPhaseLinkId !== ''
      ? combat.currentPhaseLinkId
      : null
  if (!activeId || !phaseId || !Array.isArray(steps)) return phaseId
  const ownerPhaseSteps = steps.filter(
    (s) => s && s.kind === 'phase' && s.ownerId === activeId
  )
  if (ownerPhaseSteps.some((s) => s.linkId === phaseId)) return phaseId
  return ownerPhaseSteps.length > 0 ? ownerPhaseSteps[0].linkId : phaseId
}
