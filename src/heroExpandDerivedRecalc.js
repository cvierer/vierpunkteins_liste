/**
 * DSA-Ableitung AT/PA/FK/IB/MR/WS aus Eigenschaften (Snapshot-Fixwerte).
 * Kein DOM — reine Mathematik für Mod-Overlay „abgeleitete Werte neu berechnen“.
 */

/** @type {readonly ['at', 'pa', 'fk', 'ib', 'mr', 'ws']} */
export const DERIVED_RECALC_FIELDS = Object.freeze([
  'at',
  'pa',
  'fk',
  'ib',
  'mr',
  'ws',
])

const MIN_FIX = -99
const MAX_FIX = 99

/**
 * @param {number} n
 * @returns {number}
 */
function clampFix(n) {
  return Math.min(MAX_FIX, Math.max(MIN_FIX, Math.round(n)))
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function parseAttr(raw) {
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Fixwerte aus Eigenschaften (IN = `inn`).
 *
 * @param {{
 *   mu?: unknown,
 *   kl?: unknown,
 *   inn?: unknown,
 *   ff?: unknown,
 *   ge?: unknown,
 *   kk?: unknown,
 *   ko?: unknown,
 * }} attrs
 * @returns {{
 *   at: number,
 *   pa: number,
 *   fk: number,
 *   ib: number,
 *   mr: number,
 *   ws: number,
 * } | null} null wenn ein benötigtes Attribut fehlt
 */
export function computeDerivedRecalcFixes(attrs) {
  const mu = parseAttr(attrs?.mu)
  const kl = parseAttr(attrs?.kl)
  const inn = parseAttr(attrs?.inn)
  const ff = parseAttr(attrs?.ff)
  const ge = parseAttr(attrs?.ge)
  const kk = parseAttr(attrs?.kk)
  const ko = parseAttr(attrs?.ko)
  if (
    mu == null ||
    kl == null ||
    inn == null ||
    ff == null ||
    ge == null ||
    kk == null ||
    ko == null
  ) {
    return null
  }
  return {
    at: clampFix((mu + ge + kk) / 5),
    pa: clampFix((inn + ge + kk) / 5),
    fk: clampFix((inn + ff + kk) / 5),
    ib: clampFix((mu + mu + inn + ge) / 5),
    mr: clampFix((mu + kl + ko) / 5),
    ws: clampFix(ko / 2),
  }
}

/**
 * Erkennung eines Ableitungs-Bundles (Edit-Prefill der Checkbox).
 * Genau die sechs Felder aus {@link DERIVED_RECALC_FIELDS}, alle absolut.
 *
 * @param {readonly { field?: unknown, absolute?: unknown }[]} mods
 * @returns {boolean}
 */
export function isDerivedRecalcBundle(mods) {
  if (!Array.isArray(mods) || mods.length !== DERIVED_RECALC_FIELDS.length) {
    return false
  }
  const fields = new Set()
  for (const m of mods) {
    if (!m || m.absolute !== true) return false
    const f = String(m.field ?? '')
    if (!DERIVED_RECALC_FIELDS.includes(/** @type {any} */ (f))) return false
    if (fields.has(f)) return false
    fields.add(f)
  }
  return fields.size === DERIVED_RECALC_FIELDS.length
}

/** Tooltip-/Popover-Text mit Formeln. */
export const DERIVED_RECALC_EXPLAIN =
  'Beim Anlegen werden AT, PA, FK, IB, MR und WS einmalig aus den aktuellen Eigenschaften berechnet (Fixwerte). Entfernen des Mod-Chips stellt die Basiswerte wieder her.\n\n' +
  'AT = (MU + GE + KK) / 5\n' +
  'PA = (IN + GE + KK) / 5\n' +
  'FK = (IN + FF + KK) / 5\n' +
  'IB = (MU + MU + IN + GE) / 5\n' +
  'MR = (MU + KL + KO) / 5\n' +
  'WS = KO / 2\n\n' +
  'Ergebnisse werden kaufmännisch gerundet.'
