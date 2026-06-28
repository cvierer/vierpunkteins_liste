/**
 * @typedef {{ kind?: string, ownerId?: string, linkId?: string, sub?: string }} CombatTurnStep
 */

/**
 * Modul-Cache der zuletzt gerenderten Navigationsschritte. Wird in `renderList`
 * gesetzt und z. B. vom Stempel-Anker genutzt, um eine veraltete
 * `currentPhaseLinkId` (UUID-Churn der ephemeren 2.AO-Wurzel) gegen die aktuell
 * sichtbaren Schritte aufzuloesen.
 *
 * @type {CombatTurnStep[] | null}
 */
let cachedNavSteps = null

/** @param {CombatTurnStep[] | null | undefined} steps */
export function setNavStepsCache(steps) {
  cachedNavSteps = Array.isArray(steps) ? steps : null
}

/** @returns {CombatTurnStep[] | null} */
export function getNavStepsCache() {
  return cachedNavSteps
}

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
