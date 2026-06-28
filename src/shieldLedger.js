// Zentrale Schild-Buchung (Renewal): EINE autoritative Reconciliation, die nach
// JEDER Slot-/Kind-/L.H.-Mutation laeuft und die Erhaltungs-Invariante erzwingt.
//
// Modell (reine Erhaltung): Jeder leere Aktionsslot haelt genau 1 Schild, bis
// zur konfigurierten Reaktionszahl (heroActionPoolAbw). Jede gesetzte Aktion an
// einem regulaeren 2.AO holt genau 1 Schild aus dem Speicher; Leeren gibt 1
// zurueck. Die Mutter kann ihr Primaerfeld ebenfalls zu einem Schild umwandeln.
//
// Daraus folgt der Obergrenzen-Deckel fuer den Reihen-Schild-Speicher KR_ABW:
//
//   cap = max(0, abwBudget + (Mutter haelt Schild ? 1 : 0) - #geladene_regulaere_2AO)
//
// "Zwei Schwerter => kein Schild" ist nur der Spezialfall mit abwBudget=1 und
// einem 2.AO. Bei Helden mit mehr Aktionsslots bleiben die Schilde der uebrigen
// leeren Slots erhalten (Fix der V1292-Regression, die KR_ABW bedingungslos auf
// 0 zwang).
//
// WICHTIG: Der Schild wird NICHT aus den Slots neu berechnet und nie ERHOEHT.
// Reaktions-Stempel verbrauchen KR_ABW direkt (consumeOneChargeValue); ein
// Heraufsetzen wuerde verbrauchte Reaktionen zurueckgeben. Es wird ausschliesslich
// nach unten gedeckelt (Drift abfangen).

import {
  chargeValueFromMarks,
  marksFromChargeValue,
} from './krDigit.js'
import { KR_ABW } from './krMetaKeys.js'
import { chargedRegularZaoActionCount } from './krZaoSlots.js'
import { readKrFirstSlotKind } from './krPrimaryField.js'
import { effectiveHeroPoolSplit } from './krActionPool.js'

/**
 * Obergrenze der Reihen-Schilde aus Budget + Mutter-Schild - geladene 2.AO.
 *
 * @param {Record<string, unknown>} m
 * @returns {number}
 */
export function shieldLedgerCap(m) {
  if (!m || typeof m !== 'object') return 0
  const abwBudget = Math.max(0, Math.floor(Number(effectiveHeroPoolSplit(m).abw)) || 0)
  const motherShield = readKrFirstSlotKind(m) === 'uo' ? 1 : 0
  const zaoActions = chargedRegularZaoActionCount(m)
  return Math.max(0, abwBudget + motherShield - zaoActions)
}

/**
 * Erzwingt die Erhaltungs-Invariante in-place: deckelt KR_ABW auf `shieldLedgerCap`.
 *
 * @param {Record<string, unknown>} m Tracker-Metadaten (wird in-place geaendert)
 * @returns {boolean} true, wenn KR_ABW reduziert wurde
 */
export function reconcileShieldLedger(m) {
  if (!m || typeof m !== 'object') return false
  const cap = shieldLedgerCap(m)
  const curMarks = marksFromChargeValue(m[KR_ABW])
  if (curMarks > cap) {
    m[KR_ABW] = chargeValueFromMarks(cap)
    return true
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
