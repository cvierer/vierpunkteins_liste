// Zentrale Schild-Buchung (Renewal): EINE autoritative Reconciliation, die nach
// JEDER Slot-/Kind-/L.H.-Mutation laufen soll. Sie erzwingt die kanonische
// Invariante:
//
//   Mutter UND ein regulaeres 2.AO haben beide ein geladenes Schwert (Angriff)
//   => das Reihen-Schild (KR_ABW) wird zwingend auf 0 gesetzt.
//
// Frueher steckte diese Regel nur in `syncReactionShieldForDualAng` und wurde
// von fast allen L.H.-Bahnen umgangen (Schild-Drift: "zwei Schwerter + Rest-
// schild"). `reconcileShieldLedger` ist der einzige Einstiegspunkt, der ueberall
// aufgerufen wird.
//
// WICHTIG: Der Schild wird NICHT aus den Slots neu berechnet. Reaktions-Stempel
// verbrauchen `KR_ABW` direkt (consumeOneChargeValue); ein Neuberechnen wuerde
// verbrauchte Reaktionen zurueckgeben. Daher nur die Dual-Schwert-Nullung.

import { chargeValueFromMarks } from './krDigit.js'
import { KR_ABW } from './krMetaKeys.js'
import { hasChargedRegularZaoAng, motherHasChargedAng } from './krZaoSlots.js'

/**
 * Erzwingt die kanonische Schild-Invariante in-place.
 *
 * @param {Record<string, unknown>} m Tracker-Metadaten (wird in-place geaendert)
 * @returns {boolean} true, wenn `KR_ABW` geaendert wurde
 */
export function reconcileShieldLedger(m) {
  if (!m || typeof m !== 'object') return false
  if (motherHasChargedAng(m) && hasChargedRegularZaoAng(m)) {
    const next = chargeValueFromMarks(0)
    if (m[KR_ABW] !== next) {
      m[KR_ABW] = next
      return true
    }
  }
  return false
}

/**
 * Symmetrische Schild-Buchung beim Verlassen eines 2.AO-Slots: ein eingelagertes
 * (leeres / lodgedAbw) Schild wird zurueckgebucht, sobald der Slot zu einer
 * geladenen Aktion wird (z. B. L.H.-Start aus einem 2.AO heraus, uo->lh). Reine
 * Entscheidungsfunktion (kein Meta-Zugriff), damit testbar.
 *
 * @param {{ kind?: string, lodgedAbw?: boolean } | null | undefined} prevSlot
 * @param {'ang'|'sra'|'lh'|'uo'} nextKind
 * @param {boolean} nextLodged
 * @returns {boolean} true, wenn ein Schild aus KR_ABW abgebucht werden soll
 */
export function shouldDebitLodgedShieldOnLeave(prevSlot, nextKind, nextLodged) {
  const prevWasLodged = prevSlot?.kind === 'uo' || prevSlot?.lodgedAbw === true
  return prevWasLodged && nextKind !== 'uo' && nextLodged !== true
}
