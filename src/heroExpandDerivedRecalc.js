/**
 * DSA-Ableitung AT/PA/FK/IB/MR/WS aus Eigenschaften.
 * Kein DOM — reine Mathematik für Mod-Overlay „abgeleitete Werte neu berechnen“.
 * Neu: signierte Deltas (Formel danach − Formel davor), keine Fixwerte.
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

/** Eigenschaften, die in die Ableitungsformeln eingehen. */
export const ATTR_FIELDS_FOR_DERIVED = Object.freeze([
  'mu',
  'kl',
  'inn',
  'ff',
  'ge',
  'kk',
  'ko',
])

export const DERIVED_RECALC_NEST_LABEL = 'Ableitung'

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
 * @typedef {{
 *   mu?: unknown,
 *   kl?: unknown,
 *   inn?: unknown,
 *   ff?: unknown,
 *   ge?: unknown,
 *   kk?: unknown,
 *   ko?: unknown,
 * }} DerivedAttrSnap
 */

/**
 * @typedef {{
 *   at: number,
 *   pa: number,
 *   fk: number,
 *   ib: number,
 *   mr: number,
 *   ws: number,
 * }} DerivedFixes
 */

/**
 * Fixwerte aus Eigenschaften (IN = `inn`).
 *
 * @param {DerivedAttrSnap} attrs
 * @returns {DerivedFixes | null} null wenn ein benötigtes Attribut fehlt
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
 * Signierte Deltas: Formel(danach) − Formel(davor).
 * Enthält alle sechs Felder (auch 0), damit ein Sync-Paket bei späterer
 * Akkumulation wieder nicht-null werden kann.
 *
 * @param {DerivedAttrSnap} attrsBefore
 * @param {DerivedAttrSnap} attrsAfter
 * @returns {DerivedFixes | null}
 */
export function computeDerivedRecalcDeltas(attrsBefore, attrsAfter) {
  const prev = computeDerivedRecalcFixes(attrsBefore)
  const next = computeDerivedRecalcFixes(attrsAfter)
  if (!prev || !next) return null
  /** @type {DerivedFixes} */
  const out = {
    at: next.at - prev.at,
    pa: next.pa - prev.pa,
    fk: next.fk - prev.fk,
    ib: next.ib - prev.ib,
    mr: next.mr - prev.mr,
    ws: next.ws - prev.ws,
  }
  return out
}

/**
 * Nur Felder mit Delta ≠ 0 (für Chip-Kurztext).
 *
 * @param {DerivedFixes | null | undefined} deltas
 * @returns {Partial<DerivedFixes>}
 */
export function nonZeroDerivedRecalcDeltas(deltas) {
  /** @type {Partial<DerivedFixes>} */
  const out = {}
  if (!deltas) return out
  for (const field of DERIVED_RECALC_FIELDS) {
    const v = deltas[field]
    if (typeof v === 'number' && v !== 0) out[field] = v
  }
  return out
}

/**
 * Eigenschaften um Delta-Beiträge anpassen (nur ATTR_FIELDS_FOR_DERIVED).
 *
 * @param {DerivedAttrSnap} baseAttrs
 * @param {Readonly<Partial<Record<string, number>>>} attrDeltas
 * @returns {DerivedAttrSnap | null}
 */
export function applyAttrDeltasToSnap(baseAttrs, attrDeltas) {
  /** @type {DerivedAttrSnap} */
  const out = {}
  for (const field of ATTR_FIELDS_FOR_DERIVED) {
    const base = parseAttr(baseAttrs?.[field])
    if (base == null) return null
    const d = Number(attrDeltas?.[field] ?? 0)
    out[field] = base + (Number.isFinite(d) ? d : 0)
  }
  return out
}

/**
 * Erkennung eines Ableitungs-Bundles (Edit-Prefill der Checkbox).
 * Dynamische Pakete: `derivedDynamic === true` auf allen sechs Feldern.
 * Legacy: genau die sechs Felder, alle absolut (nicht migrieren).
 *
 * @param {readonly { field?: unknown, absolute?: unknown, derivedDynamic?: unknown }[]} mods
 * @returns {boolean}
 */
export function isDerivedRecalcBundle(mods) {
  if (!Array.isArray(mods) || mods.length !== DERIVED_RECALC_FIELDS.length) {
    return false
  }
  const fields = new Set()
  let allDynamic = true
  let allAbsolute = true
  for (const m of mods) {
    if (!m) return false
    const f = String(m.field ?? '')
    if (!DERIVED_RECALC_FIELDS.includes(/** @type {any} */ (f))) return false
    if (fields.has(f)) return false
    fields.add(f)
    if (m.derivedDynamic !== true) allDynamic = false
    if (m.absolute !== true) allAbsolute = false
  }
  if (fields.size !== DERIVED_RECALC_FIELDS.length) return false
  return allDynamic || allAbsolute
}

/**
 * @param {readonly { derivedDynamic?: unknown }[]} mods
 * @returns {boolean}
 */
export function isDynamicDerivedRecalcBundle(mods) {
  if (!Array.isArray(mods) || mods.length === 0) return false
  return mods.every((m) => m && m.derivedDynamic === true)
}

/** Tooltip-/Popover-Text mit Formeln. */
export const DERIVED_RECALC_EXPLAIN =
  'Beim Anlegen werden AT, PA, FK, IB, MR und WS aus den Eigenschaften neu abgeleitet. ' +
  'Im Mod-Band erscheint nur die Änderung (+/−) durch den auslösenden Mod; ' +
  'bereits eingetragene Abstände zur Formel bleiben erhalten. ' +
  'Bei Aktion-/KR-Akkumulation werden die Werte laufend nachgeführt. ' +
  'Entfernen des Ableitungs-Chips stellt die Werte wieder her.\n\n' +
  'AT = (MU + GE + KK) / 5\n' +
  'PA = (IN + GE + KK) / 5\n' +
  'FK = (IN + FF + KK) / 5\n' +
  'IB = (MU + MU + IN + GE) / 5\n' +
  'MR = (MU + KL + KO) / 5\n' +
  'WS = KO / 2\n\n' +
  'Ergebnisse werden kaufmännisch gerundet.'
