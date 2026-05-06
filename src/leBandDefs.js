/**
 * LE-Band-Definitionen (dynamisch konfigurierbar).
 *
 * Architektur:
 * - Globaler Standard pro Raum: `roomSettings.leBandDefs` (Array, max 16).
 * - Pro Held: optional vollständige Override-Liste (`heroExLeBandsOverride`);
 *   wenn null/undefined, gilt die Raum-Liste.
 * - Legacy: `heroExLeThreshold` (eine zusätzliche absolute Schwelle pro Held)
 *   wird in `effectiveLeBandsForHero` zusätzlich als synthetisches Band
 *   eingefügt — bestehende Helden verlieren keine Funktionalität.
 *
 * Default-Set entspricht 1:1 dem heutigen Verhalten (siehe
 * [`heroAutoMods.leBand` / `leAtPaMalusForBand`](./heroAutoMods.js)).
 *
 * @typedef {{
 *   field: string,
 *   delta: number,
 * }} LeBandMod
 *
 * @typedef {(
 *   { type: 'fraction', num: number, den: number } |
 *   { type: 'absolute', value: number } |
 *   { type: 'negKoDepth', factor: number }
 * )} LeBandThreshold
 *
 * @typedef {{
 *   id: string,
 *   active: boolean,
 *   label: string,
 *   tooltip: string,
 *   threshold: LeBandThreshold,
 *   mods: LeBandMod[],
 * }} LeBandDef
 */

const MAX_LE_BANDS = 16

const VALID_THRESHOLD_TYPES = new Set(['fraction', 'absolute', 'negKoDepth'])

/** Felder, die in der Editor-UI per Dropdown wählbar sind. */
export const LE_BAND_MOD_FIELDS = Object.freeze([
  'at',
  'pa',
  'a',
  'fk',
  'mu',
  'kl',
  'inn',
  'ib',
  'ko',
  'kk',
  'ff',
  'gs',
  'ge',
])

/** Tracker-Meta-Key für die Helden-Override-Liste. */
export const HERO_EX_LE_BANDS_OVERRIDE = 'heroExLeBandsOverride'

/** Legacy: zusätzliche absolute LE-Schwelle pro Held (Integer, "≤ Wert"). */
const HERO_EX_LE_THRESHOLD_KEY = 'heroExLeThreshold'

/**
 * Default-Set: spiegelt das alte hartkodierte Schema 1:1.
 * - <-1,5KO / <-KO / <-1/2KO / ≤0 → at/pa/a/fk je −3.
 * - <1/4 → −3 ; <1/3 → −2 ; <1/2 → −1.
 *
 * Reihenfolge = Schweregrad (oben = am schwersten); das erste passende
 * Band gewinnt.
 */
const DEFAULT_LE_BAND_DEFS_RAW = [
  {
    id: 'le-neg-15ko',
    label: '<-1,5KO',
    tooltip: 'LE liegt mehr als 1,5 × KO unter 0 — kritischer Bereich.',
    threshold: { type: 'negKoDepth', factor: 1.5 },
    mods: [
      { field: 'at', delta: -3 },
      { field: 'pa', delta: -3 },
      { field: 'a', delta: -3 },
      { field: 'fk', delta: -3 },
    ],
  },
  {
    id: 'le-neg-ko',
    label: '<-KO',
    tooltip: 'LE liegt mehr als KO unter 0 — kritischer Bereich.',
    threshold: { type: 'negKoDepth', factor: 1.0 },
    mods: [
      { field: 'at', delta: -3 },
      { field: 'pa', delta: -3 },
      { field: 'a', delta: -3 },
      { field: 'fk', delta: -3 },
    ],
  },
  {
    id: 'le-neg-05ko',
    label: '<-1/2KO',
    tooltip: 'LE liegt mehr als 0,5 × KO unter 0 — kritischer Bereich.',
    threshold: { type: 'negKoDepth', factor: 0.5 },
    mods: [
      { field: 'at', delta: -3 },
      { field: 'pa', delta: -3 },
      { field: 'a', delta: -3 },
      { field: 'fk', delta: -3 },
    ],
  },
  {
    id: 'le-zero',
    label: '<=0',
    tooltip: 'LE ist 0 oder negativ — kampfunfähig.',
    threshold: { type: 'absolute', value: 0 },
    mods: [
      { field: 'at', delta: -3 },
      { field: 'pa', delta: -3 },
      { field: 'a', delta: -3 },
      { field: 'fk', delta: -3 },
    ],
  },
  {
    id: 'le-quarter',
    label: '<1/4',
    tooltip: 'LE liegt unter 1/4 LE-Maximum.',
    threshold: { type: 'fraction', num: 1, den: 4 },
    mods: [
      { field: 'at', delta: -3 },
      { field: 'pa', delta: -3 },
      { field: 'a', delta: -3 },
      { field: 'fk', delta: -3 },
    ],
  },
  {
    id: 'le-third',
    label: '<1/3',
    tooltip: 'LE liegt unter 1/3 LE-Maximum.',
    threshold: { type: 'fraction', num: 1, den: 3 },
    mods: [
      { field: 'at', delta: -2 },
      { field: 'pa', delta: -2 },
      { field: 'a', delta: -2 },
      { field: 'fk', delta: -2 },
    ],
  },
  {
    id: 'le-half',
    label: '<1/2',
    tooltip: 'LE liegt unter 1/2 LE-Maximum.',
    threshold: { type: 'fraction', num: 1, den: 2 },
    mods: [
      { field: 'at', delta: -1 },
      { field: 'pa', delta: -1 },
      { field: 'a', delta: -1 },
      { field: 'fk', delta: -1 },
    ],
  },
]

/**
 * Eingefrorene Default-Liste.
 * @type {readonly LeBandDef[]}
 */
export const DEFAULT_LE_BAND_DEFS = Object.freeze(
  DEFAULT_LE_BAND_DEFS_RAW.map((d) =>
    Object.freeze({
      ...d,
      active: true,
      threshold: Object.freeze({ ...d.threshold }),
      mods: Object.freeze(d.mods.map((m) => Object.freeze({ ...m }))),
    })
  )
)

/** Liefert eine veränderbare Tiefenkopie der Defaults. */
export function cloneDefaultLeBandDefs() {
  return DEFAULT_LE_BAND_DEFS.map((d) => ({
    ...d,
    threshold: { ...d.threshold },
    mods: d.mods.map((m) => ({ ...m })),
  }))
}

function clampInt(n, lo, hi, fallback) {
  const x = Math.floor(Number(n))
  if (!Number.isFinite(x)) return fallback
  return Math.max(lo, Math.min(hi, x))
}

function clampFloat(n, lo, hi, fallback) {
  const x = Number(n)
  if (!Number.isFinite(x)) return fallback
  return Math.max(lo, Math.min(hi, x))
}

function strOr(v, fallback) {
  if (v === undefined || v === null) return fallback
  return String(v)
}

function safeId(raw, idx) {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
  return t || `le-band-${idx + 1}`
}

function normalizeThreshold(raw) {
  if (!raw || typeof raw !== 'object') return null
  const type = String(raw.type ?? '').trim()
  if (!VALID_THRESHOLD_TYPES.has(type)) return null
  if (type === 'fraction') {
    const num = clampInt(raw.num, 1, 99, 1)
    const den = clampInt(raw.den, 1, 999, 2)
    if (num >= den) return null
    return { type, num, den }
  }
  if (type === 'absolute') {
    const value = clampInt(raw.value, 0, 9999, 0)
    return { type, value }
  }
  if (type === 'negKoDepth') {
    const factor = Math.round(clampFloat(raw.factor, 0, 10, 0.5) * 1000) / 1000
    return { type, factor }
  }
  return null
}

function normalizeMod(raw) {
  if (!raw || typeof raw !== 'object') return null
  const field = String(raw.field ?? '').trim().toLowerCase()
  if (!field) return null
  const delta = clampInt(raw.delta, -99, 99, 0)
  if (delta === 0) return null
  return { field, delta }
}

/**
 * Bringt eine rohe LE-Band-Liste in das normalisierte Schema.
 * Reihenfolge bleibt erhalten (= Schweregrad). Maximal 16 Einträge.
 *
 * @param {unknown} raw
 * @returns {LeBandDef[]}
 */
export function normalizeLeBandDefs(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return cloneDefaultLeBandDefs()
  }
  const arr = raw.slice(0, MAX_LE_BANDS)
  /** @type {LeBandDef[]} */
  const out = []
  const usedIds = new Set()
  arr.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return
    const threshold = normalizeThreshold(entry.threshold)
    if (!threshold) return
    let id = safeId(entry.id, idx)
    let suffix = 1
    while (usedIds.has(id)) {
      id = `${safeId(entry.id, idx)}-${++suffix}`
    }
    usedIds.add(id)
    const label = strOr(entry.label, '').trim().slice(0, 64)
    const tooltip = strOr(entry.tooltip, '').trim().slice(0, 1024)
    const active = entry.active === undefined ? true : Boolean(entry.active)
    const modsRaw = Array.isArray(entry.mods) ? entry.mods : []
    const mods = modsRaw.map(normalizeMod).filter((m) => m !== null)
    out.push({ id, active, label, tooltip, threshold, mods })
  })
  if (out.length === 0) return cloneDefaultLeBandDefs()
  return out
}

/**
 * Liest die Legacy-Schwelle aus dem Tracker-Meta.
 *
 * @param {Record<string, unknown> | undefined | null} meta
 * @returns {number | null}
 */
function readLegacyLeThresholdFromMeta(meta) {
  const raw = String(meta?.[HERO_EX_LE_THRESHOLD_KEY] ?? '')
    .trim()
    .toLowerCase()
  if (!raw || ['off', 'none', 'false', '0'].includes(raw)) return null
  const n = Math.floor(Number(raw.replace(',', '.')))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * Liefert ein synthetisches Legacy-Band für einen positiven absoluten Wert.
 *
 * @param {number} value
 * @returns {LeBandDef}
 */
function legacyAbsoluteBand(value) {
  return {
    id: 'legacy-le-threshold',
    active: true,
    label: `<=${value}`,
    tooltip: `Zusätzliche LE-Schwelle (heroExLeThreshold = ${value}).`,
    threshold: { type: 'absolute', value },
    mods: [
      { field: 'at', delta: -3 },
      { field: 'pa', delta: -3 },
      { field: 'a', delta: -3 },
      { field: 'fk', delta: -3 },
    ],
  }
}

/**
 * Fügt das Legacy-Band an einer sinnvollen Position ein:
 * - Direkt vor dem ersten `fraction`-Band (= zwischen ≤0 und Bruch-Bändern),
 *   da das alte Schema die Schwelle vor den Bruch-Bändern prüft.
 * - Wenn es keine Bruch-Bänder gibt, wird angefügt.
 *
 * @param {LeBandDef[]} bands
 * @param {LeBandDef} legacy
 */
function injectLegacyBand(bands, legacy) {
  const idx = bands.findIndex((b) => b.threshold && b.threshold.type === 'fraction')
  if (idx < 0) bands.push(legacy)
  else bands.splice(idx, 0, legacy)
}

/**
 * Liefert die effektive LE-Band-Liste für einen Helden:
 * - meta.heroExLeBandsOverride (falls Liste) → normalisiert.
 * - Sonst room.leBandDefs (oder Default).
 * - Plus Legacy heroExLeThreshold → synthetisches `absolute`-Band (eingefügt
 *   vor den Bruch-Bändern, wie es das alte `leBand`-Schema tat).
 *
 * @param {Record<string, unknown> | undefined | null} meta
 * @param {{ leBandDefs?: unknown } | undefined | null} room
 * @returns {LeBandDef[]}
 */
export function effectiveLeBandsForHero(meta, room) {
  const ov = meta?.[HERO_EX_LE_BANDS_OVERRIDE]
  /** @type {LeBandDef[]} */
  let base
  if (Array.isArray(ov) && ov.length > 0) {
    base = normalizeLeBandDefs(ov)
  } else if (
    room &&
    Array.isArray(room.leBandDefs) &&
    room.leBandDefs.length > 0
  ) {
    base = normalizeLeBandDefs(room.leBandDefs)
  } else {
    base = cloneDefaultLeBandDefs()
  }
  const legacy = readLegacyLeThresholdFromMeta(meta)
  if (legacy != null) {
    injectLegacyBand(base, legacyAbsoluteBand(legacy))
  }
  return base
}

/**
 * Prüft, ob `(le, leMax, ko)` zu einer Schwelle passt.
 *
 * @param {LeBandThreshold} t
 * @param {number} le
 * @param {number} leMax
 * @param {number | null} ko
 */
function matchesThreshold(t, le, leMax, ko) {
  if (!t || typeof t !== 'object') return false
  if (t.type === 'fraction') {
    if (le <= 0) return false
    if (!Number.isFinite(le) || !Number.isFinite(leMax)) return false
    return le * t.den < leMax * t.num
  }
  if (t.type === 'absolute') {
    if (!Number.isFinite(le)) return false
    return le <= t.value
  }
  if (t.type === 'negKoDepth') {
    if (le > 0) return false
    if (ko == null || !Number.isFinite(ko) || ko <= 0) return false
    const depth = -le
    return depth > t.factor * ko
  }
  return false
}

function toIntOrNull(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.floor(raw) : null
  }
  const t = String(raw).trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

function toNonNegIntOrNull(raw) {
  const n = toIntOrNull(raw)
  if (n === null) return null
  return n >= 0 ? n : null
}

/**
 * Findet das erste passende LE-Band (Reihenfolge = Schwere, top zuerst).
 *
 * @param {{ le: unknown, leMax: unknown, ko?: unknown }} ctx
 * @param {LeBandDef[]} defs
 * @returns {{ def: LeBandDef, index: number } | null}
 */
export function matchLeBand(ctx, defs) {
  if (!Array.isArray(defs) || defs.length === 0) return null
  const le = toIntOrNull(ctx?.le)
  const leMax = toNonNegIntOrNull(ctx?.leMax)
  const ko = toIntOrNull(ctx?.ko)
  if (le === null || leMax === null || leMax <= 0) return null
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]
    if (!def || !def.active) continue
    if (matchesThreshold(def.threshold, le, leMax, ko)) {
      return { def, index: i }
    }
  }
  return null
}

/**
 * Aggregiert alle Mod-Deltas eines Bands je Feld (mehrfache Einträge werden
 * summiert).
 *
 * @param {LeBandDef | null | undefined} def
 * @returns {Record<string, number>}
 */
export function aggregateLeBandModsByField(def) {
  /** @type {Record<string, number>} */
  const out = {}
  if (!def || !Array.isArray(def.mods)) return out
  for (const m of def.mods) {
    if (!m || !m.field || !m.delta) continue
    out[m.field] = (out[m.field] ?? 0) + m.delta
  }
  return out
}

/**
 * Bildet ein getroffenes Band auf das alte `computeAutoTriggerSignature`-
 * Schema (0..4 plus 401..403 für Negativ-KO-Tiefe) ab. Wird von
 * `heroAutoMods.computeAutoTriggerSignature` verwendet, damit bestehende
 * Suppression-Daten weiter gültig bleiben.
 *
 * @param {LeBandDef} def
 * @returns {number}
 */
export function legacyTriggerSignatureForLeBand(def) {
  const t = def?.threshold
  if (!t) return 0
  if (t.type === 'fraction') {
    if (t.num === 1 && t.den === 2) return 0
    if (t.num === 1 && t.den === 3) return 1
    if (t.num === 1 && t.den === 4) return 2
    return 100 + t.den * 10 + t.num
  }
  if (t.type === 'absolute') {
    if (t.value <= 0) return 400
    return 3
  }
  if (t.type === 'negKoDepth') {
    if (Math.abs(t.factor - 0.5) < 1e-6) return 401
    if (Math.abs(t.factor - 1.0) < 1e-6) return 402
    if (Math.abs(t.factor - 1.5) < 1e-6) return 403
    return 410 + Math.round(t.factor * 100)
  }
  return 0
}

/**
 * Liefert ein hübsches Standard-Label, falls `def.label` leer ist.
 *
 * @param {LeBandDef} def
 * @returns {string}
 */
export function defaultLeBandLabel(def) {
  if (def?.label) return def.label
  const t = def?.threshold
  if (!t) return ''
  if (t.type === 'fraction') return `<${t.num}/${t.den}`
  if (t.type === 'absolute') {
    if (t.value <= 0) return '<=0'
    return `<=${t.value}`
  }
  if (t.type === 'negKoDepth') {
    const f = t.factor
    if (Math.abs(f - 0.5) < 1e-6) return '<-1/2KO'
    if (Math.abs(f - 1.0) < 1e-6) return '<-KO'
    if (Math.abs(f - 1.5) < 1e-6) return '<-1,5KO'
    return `<-${f}KO`
  }
  return ''
}
