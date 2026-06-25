// Reine LE-/Gauge-Mathematik des Heldenblocks (kein DOM, kein Closure-State).
// Blatt-Modul: hängt nur an heroAutoMods (leBand/leAtPaMalusForBand). Aus der
// mountHeroExpandBlock-Closure in iniModMeta.js ausgelagert und dort über das
// Barrel re-exportiert (verhaltensneutral) — Etappe 4, Gauge-Mathematik.

import { leAtPaMalusForBand, leBand } from './heroAutoMods.js'

/** Minus-Skala 0 … −1,6·KO (ab LE≤0 mit gültigem KO). */
export const NEG_LE_KO_RANGE = 1.6

/**
 * Parst eine ganze Zahl (signiert) oder `null` bei leer/ungültig.
 * Ersetzt die früheren, identischen Closure-Parser
 * `parseSignedIntLoose`/`parseLeIntSafe`/`parseKoIntSafe`/`parseWsIntSafe`.
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseIntOrNull(raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Wie {@link parseIntOrNull}, aber negative Werte ergeben `null`.
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseNonNegIntOrNull(raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/**
 * AT/PA-Malus aus LE-Schwellenband (reine Variante von `computeLeThresholdMalus`).
 * @param {number | null} leVal
 * @param {number | null} leMaxVal
 * @param {unknown} customLeThreshold
 * @returns {number}
 */
export function leThresholdMalusForValues(leVal, leMaxVal, customLeThreshold) {
  if (leVal === null || leMaxVal === null || leMaxVal <= 0) return 0
  const band = leBand(leVal, leMaxVal, customLeThreshold)
  return leAtPaMalusForBand(band)
}

/**
 * Normalisiert den Todes-Modus eines Hero-Snapshots (inkl. Legacy-Feld).
 * @param {{ deathMode?: unknown, deathAtMinusOnePointFiveKo?: unknown } | null | undefined} curSnap
 * @returns {'lt0'|'minusKo'|'minusOnePointFiveKo'}
 */
export function resolveDeathModeForLeUi(curSnap) {
  const v = String(curSnap?.deathMode ?? '')
    .trim()
    .toLowerCase()
  if (v === 'lt0' || v === 'minusko' || v === 'minusonepointfiveko') {
    return v === 'minusko'
      ? 'minusKo'
      : v === 'minusonepointfiveko'
        ? 'minusOnePointFiveKo'
        : 'lt0'
  }
  const legacy = String(curSnap?.deathAtMinusOnePointFiveKo ?? '')
    .trim()
    .toLowerCase()
  if (['1', 'true', 'on', 'yes', 'ja'].includes(legacy)) {
    return 'minusOnePointFiveKo'
  }
  return 'minusKo'
}

/**
 * @param {number | null} leNum
 * @param {number | null} koNum
 * @param {'lt0'|'minusKo'|'minusOnePointFiveKo'} deathMode
 * @returns {boolean}
 */
export function isDeathTriggeredForLeUi(leNum, koNum, deathMode) {
  if (leNum === null) return false
  if (deathMode === 'lt0') return leNum <= 0
  if (!(koNum != null && koNum > 0)) return false
  const depth = -leNum
  const threshold = deathMode === 'minusOnePointFiveKo' ? 1.5 * koNum : koNum
  return depth >= threshold
}

/**
 * Blinkgrenze in LE (nicht in Tiefe), ab der der Negativ-Puls endet.
 * @param {number | null} koNum
 * @param {'lt0'|'minusKo'|'minusOnePointFiveKo'} deathMode
 * @returns {number}
 */
export function blinkStopLeBoundaryForMode(koNum, deathMode) {
  if (deathMode === 'lt0') return 0
  if (!(koNum != null && koNum > 0)) return Number.NEGATIVE_INFINITY
  return deathMode === 'minusOnePointFiveKo' ? -1.5 * koNum : -koNum
}
