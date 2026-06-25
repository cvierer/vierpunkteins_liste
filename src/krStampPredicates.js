// Reine KR-Stempel-Prädikate (Primäraktions-Stempel am aktuellen Nav-Punkt).
// Blatt-Modul: hängt nur an Meta-Keys, Combat-Step-IDs und getActionStamps —
// keine anderen krCounters-Funktionen. Aus krCounters.js ausgelagert und dort
// über das Barrel re-exportiert (verhaltensneutral).

import { getActionStamps } from './combatRoom.js'
import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'
import { KR_ANG, KR_LH_ACTION, KR_SRA } from './krMetaKeys.js'

const MOTHER_PRIMARY_STAMP_FIELDS = new Set([KR_ANG, KR_SRA, KR_LH_ACTION])

/**
 * Mutter-Primärstempel, angelegt während die Navigation auf der **eigenen**
 * Token-Zeile stand (`anchorRowId === itemId`). Fremde `anchorRowId` (andere
 * Zeile) sperren die Umwandlung am Mutterobjekt nicht.
 *
 * @param {unknown[]} entries
 * @param {string} itemId
 * @returns {boolean}
 */
export function motherPrimarySelfStamped(entries, itemId) {
  if (!Array.isArray(entries) || typeof itemId !== 'string') return false
  return entries.some((e) => {
    if (!e || typeof e !== 'object') return false
    if (e.itemId !== itemId) return false
    if (e.paradeExtra) return false
    if (e.anchorPhaseLinkId != null) return false
    if (e.anchorRowId != null && e.anchorRowId !== itemId) return false
    if (!MOTHER_PRIMARY_STAMP_FIELDS.has(e.field)) return false
    return true
  })
}

/** @param {unknown} field */
export function isPrimaryActionStampField(field) {
  return typeof field === 'string' && MOTHER_PRIMARY_STAMP_FIELDS.has(field)
}

/**
 * @param {unknown} entry
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat>} combat
 */
export function stampEntryMatchesCombatStep(entry, combat) {
  if (!entry || typeof entry !== 'object') return false
  const e = /** @type {{ itemId?: string, anchorRowId?: string, anchorPhaseLinkId?: string | null }} */ (
    entry
  )
  if (!combat?.started || combat.roundIntroPending) return false
  const rid = combat.currentItemId
  if (typeof rid !== 'string') return false
  if (rid === ROUND_START_STEP_ID || rid === ROUND_END_STEP_ID) return false
  const rowAnchor =
    typeof e.anchorRowId === 'string' ? e.anchorRowId : e.itemId
  const phaseCombat =
    typeof combat.currentPhaseLinkId === 'string'
      ? combat.currentPhaseLinkId
      : null
  const phaseStamp =
    typeof e.anchorPhaseLinkId === 'string' ? e.anchorPhaseLinkId : null
  return rowAnchor === rid && phaseStamp === phaseCombat
}

/**
 * Primäraktions-Stempel (Schwert/Stern/L.H.) am aktuellen Nav-Punkt — ohne Abwehr/FA.
 *
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat>} combat
 * @param {unknown[] | null | undefined} [entries]
 */
export function hasPrimaryActionStampAtCombatStep(combat, entries = null) {
  const list = entries ?? getActionStamps().entries
  if (!Array.isArray(list)) return false
  return list.some(
    (e) =>
      stampEntryMatchesCombatStep(e, combat) &&
      !(/** @type {{ paradeExtra?: boolean }} */ (e)).paradeExtra &&
      isPrimaryActionStampField(
        /** @type {{ field?: unknown }} */ (e).field
      )
  )
}
