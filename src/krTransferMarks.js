// Reine Abwehr-Transfer-Markierungs-Helfer (Ang./L.H. → Abw.-Schild-Umwandlung).
// Blatt-Modul: hängt nur an krDigit + krMetaKeys. Aus krCounters.js ausgelagert
// und dort über das Barrel re-exportiert (verhaltensneutral).

import {
  chargeValueFromMarks,
  marksFromChargeValue,
  normalizeKrDigit,
} from './krDigit.js'
import { MAX_HERO_ACTION_POOL_SUM } from './krMetaKeys.js'

/** Max. Abwehr-Schildladungen per Umwandlung (Ang.→Abw bzw. L.H.→Abw). */
export function krAbwTransferMaxMarks() {
  return MAX_HERO_ACTION_POOL_SUM
}

/** Zählerstand 1 = leer; 0 und ≥2 = verschiebbare Markierung (Ang./Abw.-Umwandlung). */
export function krTransferMarkPresent(v) {
  return marksFromChargeValue(v) > 0
}

export function addOneAbwTransferChargeValue(v) {
  const marks = marksFromChargeValue(v)
  if (marks >= krAbwTransferMaxMarks()) return normalizeKrDigit(v)
  return chargeValueFromMarks(marks + 1)
}
