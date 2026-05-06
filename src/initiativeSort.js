/**
 * Reihenfolge wie Battle Board: höhere Ganzzahl zuerst, bei gleicher Ganzzahl
 * kleinere Nachkommastellen zuerst (z. B. 15 → 14 → 13.1 → 13.9 → 12).
 * Leere oder ungültige Werte sortieren ans Ende, danach Name.
 */

export function initiativeRank(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.')
  if (normalized === '') return null
  const n = Number(normalized)
  if (Number.isNaN(n)) return null
  const intPart = Math.trunc(n)
  const frac = Math.abs(n - intPart)
  return { intPart, frac }
}

export function compareInitiativeRows(a, b) {
  const ra = initiativeRank(a.initiative)
  const rb = initiativeRank(b.initiative)
  if (ra === null && rb === null)
    return (a.name || '').localeCompare(b.name || '', undefined, {
      sensitivity: 'base',
    })
  if (ra === null) return 1
  if (rb === null) return -1
  if (ra.intPart !== rb.intPart) return rb.intPart - ra.intPart
  if (ra.frac !== rb.frac) return ra.frac - rb.frac
  return (a.name || '').localeCompare(b.name || '', undefined, {
    sensitivity: 'base',
  })
}

/** Nur INI-Rang (Ganzzahl + Bruch), 0 = gleiche Kampfstufe. */
export function initiativeCompareOnlyIni(a, b) {
  const ra = initiativeRank(a.initiative)
  const rb = initiativeRank(b.initiative)
  if (ra === null && rb === null) return 0
  if (ra === null) return 1
  if (rb === null) return -1
  if (ra.intPart !== rb.intPart) return rb.intPart - ra.intPart
  if (ra.frac !== rb.frac) return ra.frac - rb.frac
  return 0
}

function tieBreakIndex(id, tieOrderIds) {
  const i = tieOrderIds.indexOf(id)
  return i === -1 ? 1e9 : i
}

/** Numerischer IB-Wert eines Row-Objekts oder `null`. */
function ibValueOfRow(row) {
  if (!row) return null
  const v = row.ibValue
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function canonicalPairKeyLocal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return null
  if (a === '' || b === '' || a === b) return null
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Wie compareInitiativeRows. Bei gleicher INI:
 *  1. Liegt für das Heldenpaar (a.id, b.id) ein manueller Reihenfolge-Override
 *     in `opts.overridePairs` vor (Set kanonischer "idA|idB"), wird die
 *     Standard-IB-Prüfung übersprungen — direkt zur tieOrderIds-Reihenfolge.
 *  2. Sonst: haben beide Helden einen gültigen `row.ibValue`, gewinnt der
 *     höhere IB-Wert.
 *  3. Ansonsten gilt die manuelle Listen-Reihenfolge `tieOrderIds`, dann Name.
 *
 * `opts` ist optional und rückwärtskompatibel.
 */
export function compareInitiativeRowsWithTieOrder(
  a,
  b,
  tieOrderIds,
  opts = null
) {
  const iniCmp = initiativeCompareOnlyIni(a, b)
  if (iniCmp !== 0) return iniCmp
  const overridePairs = opts && opts.overridePairs
  let pairOverridden = false
  if (overridePairs && typeof overridePairs.has === 'function') {
    const key = canonicalPairKeyLocal(a.id, b.id)
    pairOverridden = key != null && overridePairs.has(key)
  }
  if (!pairOverridden) {
    const ibA = ibValueOfRow(a)
    const ibB = ibValueOfRow(b)
    if (ibA != null && ibB != null && ibA !== ibB) {
      return ibB - ibA
    }
  }
  const ia = tieBreakIndex(a.id, tieOrderIds)
  const ib = tieBreakIndex(b.id, tieOrderIds)
  if (ia !== ib) return ia - ib
  return (a.name || '').localeCompare(b.name || '', undefined, {
    sensitivity: 'base',
  })
}
