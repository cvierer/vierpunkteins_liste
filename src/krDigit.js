// Reine KR-Ladungs-Ziffer-/Markierungs-Kodierung.
// Blatt-Modul (hängt nur an KR_COUNTER_MAX); aus krCounters.js ausgelagert.
//
// UI-/Speicher-Kodierung der Ladungen:
// 1 => 0 Markierungen (leer), 0 => 1 Markierung (geladen), >=2 => Anzahl Markierungen.

import { KR_COUNTER_MAX } from './krMetaKeys.js'

/** Ziffer 0…max aus gespeichertem Wert (Standard max 10). */
export function normalizeKrDigit(raw, max = KR_COUNTER_MAX) {
  const cap = Math.max(0, Math.floor(Number(max)) || KR_COUNTER_MAX)
  let n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return 0
  if (n < 0) n = 0
  if (n > cap) n = cap
  return n
}

export function marksFromChargeValue(v) {
  const n = normalizeKrDigit(v)
  if (n === 1) return 0
  if (n === 0) return 1
  return n
}

export function chargeValueFromMarks(marksRaw) {
  const marks = Math.max(0, Math.min(KR_COUNTER_MAX, Math.floor(Number(marksRaw)) || 0))
  if (marks <= 0) return 1
  if (marks === 1) return 0
  return marks
}

export function addOneChargeValue(v) {
  const marks = marksFromChargeValue(v)
  return chargeValueFromMarks(marks + 1)
}

export function consumeOneChargeValue(v) {
  const marks = marksFromChargeValue(v)
  if (marks <= 0) return normalizeKrDigit(v)
  return chargeValueFromMarks(marks - 1)
}
