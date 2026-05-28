/**
 * Wappen-/Trefferzonen-Definitionen (dynamisch konfigurierbar).
 *
 * Architektur:
 * - Globaler Standard pro Raum: roomSettings.wappenDefs (Array, max 8 Pflicht-Slots).
 * - Optionaler 9. Slot pro Held (Platzhalter SW; in Helden-Einstellungen konfigurierbar).
 * - Pro Held: optional vollständige Override-Liste (heroExWappenOverride);
 *   wenn null/undefined, gilt die Raum-Liste.
 * - Wundwerte (`hzKopfRs`, `hzKopfW`, …) bleiben pro Token unter den IDs.
 *
 * Default-Set entspricht 1:1 dem bisherigen Verhalten der hartkodierten
 * Konstanten in [`hitZoneMeta.HIT_ZONE_DEFS`](./hitZoneMeta.js),
 * [`heroBlockAutoMod.HIT_ZONE_WOUND_ONCE_PENALTIES`](./heroBlockAutoMod.js)
 * und der Wapp-Tooltips aus iniModMeta. Konsumenten dürfen daher die
 * bisherigen Konstanten weiterhin als Fallback referenzieren — die Werte
 * sind identisch, sobald `effectiveWappenForHero(...)` genutzt wird.
 *
 * @typedef {{
 *   field: string,
 *   delta: number,
 *   perStufe: 'perStage' | 'perWound' | 'once',
 * }} WappenAutoMod
 *
 * @typedef {{
 *   from: number,
 *   to: number,
 *   parity: 'all' | 'odd' | 'even',
 *   frontalSplit: string | null,
 * }} WappenW20Range
 *
 * @typedef {{
 *   id: string,
 *   active: boolean,
 *   slot: number,
 *   abbr: string,
 *   label: string,
 *   tooltip: string,
 *   woundTooltip: string,
 *   w20Range: WappenW20Range | null,
 *   autoMods: WappenAutoMod[],
 * }} WappenDef
 */

/** Pflicht-Slots 1–8; Slot 9 optional (Heldenblock-Platzhalter SW). */
export const MAX_WAPPEN = 9
/** Kern-Trefferzonen 1–8 (W20 muss 1–20 lückenlos abdecken). */
export const CORE_WAPPEN_SLOTS = 8

const VALID_PERSTUFE = new Set(['perStage', 'perWound', 'once'])
const VALID_PARITY = new Set(['all', 'odd', 'even'])

/** Felder, die in der Editor-UI per Dropdown wählbar sind. */
export const WAPPEN_AUTO_MOD_FIELDS = Object.freeze([
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

const DEFAULT_WAPPEN_DEFS_RAW = [
  {
    id: 'kopf',
    slot: 1,
    abbr: 'KF',
    label: 'Kopf',
    tooltip: 'Kopf und Hals, Trefferzone',
    woundTooltip:
      'Kopf (W20 19 bis 20): 1. und 2. Wunde: je KL, IN, MU, INI-Basis –2, INI –2W6; die 3. Wunde: +2W6 SP, bewusstlos, Blutverlust',
    w20Range: { from: 19, to: 20, parity: 'all', frontalSplit: null },
    autoMods: [
      { field: 'mu', delta: -2, perStufe: 'perStage' },
      { field: 'kl', delta: -2, perStufe: 'perStage' },
      { field: 'inn', delta: -2, perStufe: 'perStage' },
      { field: 'ib', delta: -2, perStufe: 'perStage' },
      { field: 'fk', delta: -2, perStufe: 'perWound' },
    ],
  },
  {
    id: 'brust',
    slot: 2,
    abbr: 'BR',
    label: 'Brust',
    tooltip: 'Brust, Trefferzone',
    woundTooltip:
      'Brust (W20: 15 bis 18): 1. und 2. Wunde: je AT, PA, KK, KO, AW –1, +1W6 SP; 3. Wunde bewusstlos, Blutverlust',
    w20Range: { from: 15, to: 18, parity: 'all', frontalSplit: 'ruecken' },
    autoMods: [
      { field: 'at', delta: -1, perStufe: 'perStage' },
      { field: 'pa', delta: -1, perStufe: 'perStage' },
      { field: 'ko', delta: -1, perStufe: 'perStage' },
      { field: 'kk', delta: -1, perStufe: 'perStage' },
      { field: 'a', delta: -1, perStufe: 'perStage' },
      { field: 'fk', delta: -2, perStufe: 'perWound' },
    ],
  },
  {
    id: 'ruecken',
    slot: 3,
    abbr: 'RÜ',
    label: 'Rücken',
    tooltip: 'Rücken, Trefferzone',
    woundTooltip:
      'Rücken (W20: 15 bis 18): 1. und 2. Wunde: je AT, PA, KK, KO, AW –1, +1W6 SP; 3. Wunde bewusstlos, Blutverlust',
    w20Range: null,
    autoMods: [
      { field: 'at', delta: -1, perStufe: 'perStage' },
      { field: 'pa', delta: -1, perStufe: 'perStage' },
      { field: 'ko', delta: -1, perStufe: 'perStage' },
      { field: 'kk', delta: -1, perStufe: 'perStage' },
      { field: 'a', delta: -1, perStufe: 'perStage' },
      { field: 'fk', delta: -2, perStufe: 'perWound' },
    ],
  },
  {
    id: 'schildarm',
    slot: 4,
    abbr: 'LA',
    label: 'S.-Arm',
    tooltip: 'Linker Arm (Schildarm), Trefferzone',
    woundTooltip:
      'Arme (W20: 9, 11, 13 = Schildarm; 10, 12, 14 = Schwertarm): 1. und 2. Wunde: je AT, PA, FF, KK –2 mit getroffenem Arm; 3. Wunde: Arm handlungsunfähig',
    w20Range: { from: 9, to: 14, parity: 'odd', frontalSplit: null },
    autoMods: [
      { field: 'at', delta: -2, perStufe: 'perStage' },
      { field: 'pa', delta: -2, perStufe: 'perStage' },
      { field: 'kk', delta: -2, perStufe: 'perStage' },
      { field: 'ff', delta: -2, perStufe: 'perStage' },
      { field: 'fk', delta: -2, perStufe: 'perWound' },
    ],
  },
  {
    id: 'schwertarm',
    slot: 5,
    abbr: 'RA',
    label: 'Sw.-Arm',
    tooltip: 'Rechter Arm (Schwertarm), Trefferzone',
    woundTooltip:
      'Arme (W20: 9, 11, 13 = Schildarm; 10, 12, 14 = Schwertarm): 1. und 2. Wunde: je AT, PA, FF, KK –2 mit getroffenem Arm; 3. Wunde: Arm handlungsunfähig',
    w20Range: { from: 9, to: 14, parity: 'even', frontalSplit: null },
    autoMods: [
      { field: 'at', delta: -2, perStufe: 'perStage' },
      { field: 'pa', delta: -2, perStufe: 'perStage' },
      { field: 'kk', delta: -2, perStufe: 'perStage' },
      { field: 'ff', delta: -2, perStufe: 'perStage' },
      { field: 'fk', delta: -2, perStufe: 'perWound' },
    ],
  },
  {
    id: 'bauch',
    slot: 6,
    abbr: 'BA',
    label: 'Bauch',
    tooltip: 'Bauch, Trefferzone',
    woundTooltip:
      'Bauch (W20: 7 bis 8): 1. und 2. Wunde: je AT, PA, GS, KK, KO, INI-Basis, AW –1, +1W6 SP; 3. Wunde: bewusstlos, Blutverlust',
    w20Range: { from: 7, to: 8, parity: 'all', frontalSplit: null },
    autoMods: [
      { field: 'at', delta: -1, perStufe: 'perStage' },
      { field: 'pa', delta: -1, perStufe: 'perStage' },
      { field: 'ko', delta: -1, perStufe: 'perStage' },
      { field: 'kk', delta: -1, perStufe: 'perStage' },
      { field: 'gs', delta: -1, perStufe: 'perStage' },
      { field: 'ib', delta: -1, perStufe: 'perStage' },
      { field: 'a', delta: -1, perStufe: 'perStage' },
      { field: 'fk', delta: -2, perStufe: 'perWound' },
    ],
  },
  {
    id: 'lbein',
    slot: 7,
    abbr: 'LB',
    label: 'L-Bein',
    tooltip: 'Linkes Bein, Trefferzone',
    woundTooltip:
      'Beine (W20: 1, 3, 5 = Bein links; 2, 4, 6 = Bein rechts): 1. und 2. Wunde: je AT, PA, AW, GE, INI-Basis –2, GS –1; 3. Wunde: Sturz, kampfunfähig',
    w20Range: { from: 1, to: 6, parity: 'odd', frontalSplit: null },
    autoMods: [
      { field: 'at', delta: -2, perStufe: 'perStage' },
      { field: 'pa', delta: -2, perStufe: 'perStage' },
      { field: 'a', delta: -2, perStufe: 'perStage' },
      { field: 'ge', delta: -2, perStufe: 'perStage' },
      { field: 'ib', delta: -2, perStufe: 'perStage' },
      { field: 'gs', delta: -1, perStufe: 'perStage' },
      { field: 'fk', delta: -2, perStufe: 'perWound' },
    ],
  },
  {
    id: 'rbein',
    slot: 8,
    abbr: 'RB',
    label: 'R-Bein',
    tooltip: 'Rechtes Bein, Trefferzone',
    woundTooltip:
      'Beine (W20: 1, 3, 5 = Bein links; 2, 4, 6 = Bein rechts): 1. und 2. Wunde: je AT, PA, AW, GE, INI-Basis –2, GS –1; 3. Wunde: Sturz, kampfunfähig',
    w20Range: { from: 1, to: 6, parity: 'even', frontalSplit: null },
    autoMods: [
      { field: 'at', delta: -2, perStufe: 'perStage' },
      { field: 'pa', delta: -2, perStufe: 'perStage' },
      { field: 'a', delta: -2, perStufe: 'perStage' },
      { field: 'ge', delta: -2, perStufe: 'perStage' },
      { field: 'ib', delta: -2, perStufe: 'perStage' },
      { field: 'gs', delta: -1, perStufe: 'perStage' },
      { field: 'fk', delta: -2, perStufe: 'perWound' },
    ],
  },
]

/**
 * Default-Wappen für einen frischen Raum (entsprechen exakt der heutigen
 * Hartkodierung in HIT_ZONE_DEFS + HIT_ZONE_WOUND_ONCE_PENALTIES + den
 * Wapp-Tooltips aus iniModMeta).
 *
 * @type {readonly WappenDef[]}
 */
export const DEFAULT_WAPPEN_DEFS = Object.freeze(
  DEFAULT_WAPPEN_DEFS_RAW.map((d) =>
    Object.freeze({
      ...d,
      active: true,
      autoMods: Object.freeze(d.autoMods.map((m) => Object.freeze({ ...m }))),
      w20Range: d.w20Range ? Object.freeze({ ...d.w20Range }) : null,
    })
  )
)

/** Liefert eine veränderbare Tiefenkopie der Defaults. */
export function cloneDefaultWappenDefs() {
  return DEFAULT_WAPPEN_DEFS.map((d) => ({
    ...d,
    autoMods: d.autoMods.map((m) => ({ ...m })),
    w20Range: d.w20Range ? { ...d.w20Range } : null,
  }))
}

/**
 * Vorlage „Vierbeiner (Tiere)": vier Trefferzonen Rumpf / Beine / Kopf /
 * Schwanz. Die rein narrativen Effekte (`INI –2W6`, `+1W6 SP`) stehen nur
 * in den Tooltips; Code-wirksam sind ausschließlich die `autoMods`-Werte.
 */
const DEFAULT_VIERBEINER_DEFS_RAW = [
  {
    id: 'kopf',
    slot: 5,
    abbr: 'KF',
    label: 'Kopf',
    tooltip: 'Kopf des Vierbeiners, Trefferzone',
    woundTooltip:
      'Kopf (W20: 17 bis 19): pro Wunde INI-Basis –2, AT/PA –2; INI –2W6 (narrativ).',
    w20Range: { from: 17, to: 19, parity: 'all', frontalSplit: null },
    autoMods: [
      { field: 'at', delta: -2, perStufe: 'perStage' },
      { field: 'pa', delta: -2, perStufe: 'perStage' },
      { field: 'ib', delta: -2, perStufe: 'perStage' },
    ],
  },
  {
    id: 'rumpf',
    slot: 6,
    abbr: 'RU',
    label: 'Rumpf',
    tooltip: 'Rumpf des Vierbeiners, Trefferzone',
    woundTooltip:
      'Rumpf (W20: 1 bis 8): pro Wunde AT, PA, KO, KK –1; zusätzlich +1W6 SP (narrativ).',
    w20Range: { from: 1, to: 8, parity: 'all', frontalSplit: null },
    autoMods: [
      { field: 'at', delta: -1, perStufe: 'perStage' },
      { field: 'pa', delta: -1, perStufe: 'perStage' },
      { field: 'ko', delta: -1, perStufe: 'perStage' },
      { field: 'kk', delta: -1, perStufe: 'perStage' },
    ],
  },
  {
    id: 'beine',
    slot: 7,
    abbr: 'BE',
    label: 'Beine',
    tooltip: 'Beine des Vierbeiners, Trefferzone',
    woundTooltip:
      'Beine (W20: 9 bis 16): pro Wunde AT, PA, GE –2; GS –2.',
    w20Range: { from: 9, to: 16, parity: 'all', frontalSplit: null },
    autoMods: [
      { field: 'at', delta: -2, perStufe: 'perStage' },
      { field: 'pa', delta: -2, perStufe: 'perStage' },
      { field: 'ge', delta: -2, perStufe: 'perStage' },
      { field: 'gs', delta: -2, perStufe: 'perStage' },
    ],
  },
  {
    id: 'schwanz',
    slot: 8,
    abbr: 'SW',
    label: 'Schwanz',
    tooltip: 'Schwanz des Vierbeiners, Trefferzone',
    woundTooltip:
      'Schwanz (W20: 20): keine automatischen Mods; Effekte rein narrativ.',
    w20Range: { from: 20, to: 20, parity: 'all', frontalSplit: null },
    autoMods: [],
  },
]

/**
 * Standard-Vorlage „Vierbeiner (Tiere)" (eingefroren).
 * @type {readonly WappenDef[]}
 */
export const DEFAULT_VIERBEINER_DEFS = Object.freeze(
  DEFAULT_VIERBEINER_DEFS_RAW.map((d) =>
    Object.freeze({
      ...d,
      active: true,
      autoMods: Object.freeze(d.autoMods.map((m) => Object.freeze({ ...m }))),
      w20Range: d.w20Range ? Object.freeze({ ...d.w20Range }) : null,
    })
  )
)

/** Liefert eine veränderbare Tiefenkopie der Vierbeiner-Vorlage. */
export function cloneVierbeinerWappenDefs() {
  return DEFAULT_VIERBEINER_DEFS.map((d) => ({
    ...d,
    autoMods: d.autoMods.map((m) => ({ ...m })),
    w20Range: d.w20Range ? { ...d.w20Range } : null,
  }))
}

/** Bekannte Vorlage-Schlüssel (für Quelle-Wahl in der Helden-UI). */
export const WAPPEN_TEMPLATE_KEYS = Object.freeze(['mensch', 'vierbeiner'])

/**
 * Liefert eine veränderbare Tiefenkopie einer Vorlage.
 * Unbekannte Schlüssel fallen auf „Mensch" zurück.
 *
 * @param {string} key
 * @returns {WappenDef[]}
 */
export function cloneTemplateWappenDefs(key) {
  if (key === 'vierbeiner') return cloneVierbeinerWappenDefs()
  return cloneDefaultWappenDefs()
}

function clampSlot(n, fallback) {
  const x = Math.floor(Number(n))
  if (!Number.isFinite(x)) return fallback
  return Math.max(1, Math.min(MAX_WAPPEN, x))
}

function clampInt(n, lo, hi, fallback) {
  const x = Math.floor(Number(n))
  if (!Number.isFinite(x)) return fallback
  return Math.max(lo, Math.min(hi, x))
}

function strOr(v, fallback) {
  if (v === undefined || v === null) return fallback
  const s = String(v)
  return s
}

function clampAbbr(s) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return Array.from(t).slice(0, 2).join('')
}

function safeId(raw, slot) {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
  if (t) return t
  return `wappen-${slot}`
}

function normalizeAutoMod(raw) {
  if (!raw || typeof raw !== 'object') return null
  const field = strOr(raw.field, '').trim().toLowerCase()
  if (!field) return null
  const delta = clampInt(raw.delta, -99, 99, 0)
  if (delta === 0) return null
  const perStufe = VALID_PERSTUFE.has(raw.perStufe) ? raw.perStufe : 'perStage'
  return { field, delta, perStufe }
}

function normalizeW20Range(raw) {
  if (!raw || typeof raw !== 'object') return null
  const from = clampInt(raw.from, 1, 20, NaN)
  const to = clampInt(raw.to, 1, 20, NaN)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const parity = VALID_PARITY.has(raw.parity) ? raw.parity : 'all'
  const split = strOr(raw.frontalSplit, '').trim()
  return {
    from: lo,
    to: hi,
    parity,
    frontalSplit: split || null,
  }
}

/**
 * Bringt eine rohe Wappen-Liste in das normalisierte Schema.
 * - Wenn `raw` keine Liste oder leer: Defaults.
 * - Maximal 9 Einträge; doppelte IDs werden eindeutig gemacht.
 * - Slots werden auf 1..9 geclamped und bei Konflikt umsortiert.
 *
 * @param {unknown} raw
 * @returns {WappenDef[]}
 */
export function normalizeWappenDefs(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return cloneDefaultWappenDefs()
  }
  const arr = raw.slice(0, MAX_WAPPEN)
  /** @type {WappenDef[]} */
  const out = []
  const usedIds = new Set()
  arr.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return
    const slot = clampSlot(entry.slot, idx + 1)
    let id = safeId(entry.id, slot)
    let suffix = 1
    while (usedIds.has(id)) {
      id = `${safeId(entry.id, slot)}-${++suffix}`
    }
    usedIds.add(id)
    const abbr = clampAbbr(entry.abbr)
    const label = strOr(entry.label, '').trim()
    const tooltip = strOr(entry.tooltip, '').trim()
    const woundTooltip = strOr(entry.woundTooltip, '').trim()
    const active = entry.active === undefined ? true : Boolean(entry.active)
    const w20Range = normalizeW20Range(entry.w20Range)
    const autoModsRaw = Array.isArray(entry.autoMods) ? entry.autoMods : []
    const autoMods = autoModsRaw
      .map(normalizeAutoMod)
      .filter((m) => m !== null)
    out.push({
      id,
      active,
      slot,
      abbr,
      label,
      tooltip,
      woundTooltip,
      w20Range,
      autoMods,
    })
  })
  if (out.length === 0) return cloneDefaultWappenDefs()
  out.sort((a, b) => a.slot - b.slot)
  return out
}

/** Inaktiver Platzhalter für Slot 9 im Heldenblock (Kürzel SW). */
export function defaultSlot9Placeholder() {
  return Object.freeze({
    id: 'slot9',
    active: false,
    slot: 9,
    abbr: 'SW',
    label: '9. Trefferzone',
    tooltip:
      'Optionale 9. Trefferzone — in den Helden-Einstellungen konfigurierbar.',
    woundTooltip: '',
    w20Range: null,
    autoMods: [],
  })
}

/**
 * Normalisiert eine einzelne Slot-9-Definition aus Helden-Meta.
 * @param {unknown} raw
 * @returns {WappenDef | null}
 */
export function normalizeSlot9Def(raw) {
  if (!raw || typeof raw !== 'object') return null
  const entry = /** @type {Record<string, unknown>} */ (raw)
  const slot = clampSlot(entry.slot, 9)
  if (slot !== 9) return null
  let id = safeId(entry.id, 9)
  const abbr = clampAbbr(entry.abbr) || 'SW'
  const label = strOr(entry.label, '9. Trefferzone').trim()
  const tooltip = strOr(entry.tooltip, '').trim()
  const woundTooltip = strOr(entry.woundTooltip, '').trim()
  const active = entry.active === undefined ? true : Boolean(entry.active)
  const w20Range = normalizeW20Range(entry.w20Range)
  const autoModsRaw = Array.isArray(entry.autoMods) ? entry.autoMods : []
  const autoMods = autoModsRaw
    .map(normalizeAutoMod)
    .filter((m) => m !== null)
  return {
    id,
    active,
    slot: 9,
    abbr,
    label,
    tooltip: tooltip || label,
    woundTooltip,
    w20Range,
    autoMods,
  }
}

/**
 * Ergänzt Slot 9 in einer Wappen-Liste (Override oder Meta).
 * @param {WappenDef[]} list
 * @param {unknown} [slot9Meta]
 * @returns {WappenDef[]}
 */
export function mergeEffectiveWappenWithSlot9(list, slot9Meta) {
  const without9 = list.filter((d) => d.slot !== 9)
  let slot9 = list.find((d) => d.slot === 9)
  if (!slot9 && slot9Meta) {
    slot9 = normalizeSlot9Def(slot9Meta)
  }
  if (!slot9) {
    slot9 = { ...defaultSlot9Placeholder() }
  }
  return [...without9, slot9].sort((a, b) => a.slot - b.slot)
}

/**
 * Liefert die effektive Wappen-Liste für einen Helden:
 * - meta.heroExWappenOverride (falls vorhanden) → normalisiert.
 * - Sonst meta.heroExWappenTemplate === 'vierbeiner' → Vierbeiner-Vorlage.
 * - Sonst room.wappenDefs (oder Default).
 * - Immer mit Slot 9 (Platzhalter oder konfiguriert).
 *
 * @param {Record<string, unknown> | undefined | null} meta
 * @param {{ wappenDefs?: unknown } | undefined | null} room
 * @returns {WappenDef[]}
 */
export function effectiveWappenForHero(meta, room) {
  const ov = meta?.[HERO_EX_WAPPEN_OVERRIDE]
  let base
  if (Array.isArray(ov) && ov.length > 0) {
    base = normalizeWappenDefs(ov)
  } else {
    const tpl = meta?.[HERO_EX_WAPPEN_TEMPLATE]
    if (typeof tpl === 'string' && tpl === 'vierbeiner') {
      base = cloneVierbeinerWappenDefs()
    } else if (room && Array.isArray(room.wappenDefs) && room.wappenDefs.length > 0) {
      base = normalizeWappenDefs(room.wappenDefs)
    } else {
      base = cloneDefaultWappenDefs()
    }
  }
  const slot9InBase = base.some((d) => d.slot === 9)
  if (slot9InBase) return base
  return mergeEffectiveWappenWithSlot9(base, meta?.[HERO_EX_WAPPEN_SLOT9])
}

/** Tracker-Meta-Key für die Helden-Override-Liste. */
export const HERO_EX_WAPPEN_OVERRIDE = 'heroExWappenOverride'

/** Tracker-Meta-Key für die gewählte Vorlage (z. B. 'vierbeiner'). */
export const HERO_EX_WAPPEN_TEMPLATE = 'heroExWappenTemplate'

/** Optionale 9. Trefferzone (wenn Vorlage global/vierbeiner, ohne vollständige Override-Liste). */
export const HERO_EX_WAPPEN_SLOT9 = 'heroExWappenSlot9'

/**
 * Fußteil für das TZ-Eingabefeld: Kurzliste bekannter Kürzel / Direktwurf.
 */
export const TZ_ZONE_INPUT_TOOLTIP_FOOTER =
  'Kürzel u. a.: KF, BR, RÜ, LA, RA, BA, LB, RB — oder Zahl 1–20.'

/**
 * Formatiert eine W20-Spanne als kurzen Tooltip-Text („19–20", „9, 11, 13").
 * @param {WappenDef['w20Range']} range
 * @returns {string}
 */
export function formatWappenW20RangeText(range) {
  if (!range) return ''
  const { from, to, parity } = range
  if (parity === 'odd' || parity === 'even') {
    const nums = []
    for (let n = from; n <= to; n++) {
      if (parity === 'odd' && n % 2 === 0) continue
      if (parity === 'even' && n % 2 === 1) continue
      nums.push(n)
    }
    return nums.join(', ')
  }
  return from === to ? String(from) : `${from}–${to}`
}

/**
 * @param {Record<string, unknown> | null | undefined} meta
 * @param {{ wappenDefs?: unknown } | null | undefined} room
 * @returns {string}
 */
function hitZoneProfileBadgeLine(meta, room) {
  const ov = meta?.[HERO_EX_WAPPEN_OVERRIDE]
  if (Array.isArray(ov) && ov.length > 0) {
    return 'Trefferprofil: individuelle Zonendefinition (Held).'
  }
  if (
    String(meta?.[HERO_EX_WAPPEN_TEMPLATE] ?? '').trim().toLowerCase() ===
    'vierbeiner'
  ) {
    return 'Trefferprofil: Vierbeiner (Tier).'
  }
  const raw = room?.wappenDefs
  if (!Array.isArray(raw) || raw.length === 0) return ''
  try {
    const a = normalizeWappenDefs(raw)
    const b = normalizeWappenDefs(cloneDefaultWappenDefs())
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      return 'Trefferprofil: angepasste Raum-Vorgabe (SL).'
    }
  } catch {
    return 'Trefferprofil: angepasste Raum-Vorgabe (SL).'
  }
  return ''
}

/**
 * Dynamischer Tooltip fürs TZ-Eingabefeld: effektive W20 aus den aktiven Zonen +
 * optional Profil-Hinweis + Kurzliste Kürzel.
 *
 * @param {Record<string, unknown> | null | undefined} meta
 * @param {{ wappenDefs?: unknown } | null | undefined} room
 * @returns {string}
 */
export function buildTrefferzoneInputTooltip(meta, room) {
  const defs = effectiveWappenForHero(meta, room).filter((d) => d.active)
  defs.sort((a, b) => a.slot - b.slot)
  const brustDef = defs.find((d) => d.id === 'brust')

  /** @type {string[]} */
  const zoneLines = []
  for (const def of defs) {
    if (def.id === 'ruecken' && !def.w20Range && brustDef?.w20Range) {
      zoneLines.push(
        `${def.abbr}${def.label ? ` – ${def.label}` : ''} · gleicher W20-Bereich wie ${brustDef.abbr}${brustDef.label ? ` (${brustDef.label})` : ''}, wenn Ausrichtung „aus“`
      )
      continue
    }
    if (!def.w20Range) continue
    const span = formatWappenW20RangeText(def.w20Range)
    let suffix = ''
    if (def.w20Range.frontalSplit === 'ruecken') {
      suffix =
        ' — bei Ausrichtung „an“ = Brust, „aus“ = Rücken (gleiche W20-Spanne)'
    }
    zoneLines.push(
      `${def.abbr}${def.label ? ` – ${def.label}` : ''} · W20 ${span}${suffix}`
    )
  }

  const profile = hitZoneProfileBadgeLine(meta, room)
  /** @type {string[]} */
  const parts = []
  if (profile) parts.push(profile)
  parts.push('Trefferzone (TZ), Würfelbereiche:')
  if (zoneLines.length > 0) parts.push(zoneLines.join('\n'))
  parts.push(TZ_ZONE_INPUT_TOOLTIP_FOOTER)
  return parts.join('\n')
}

/**
 * @param {WappenDef['w20Range']} range
 * @returns {Set<number>}
 */
function w20NumbersForRange(range) {
  const set = new Set()
  if (!range) return set
  for (let n = range.from; n <= range.to; n++) {
    if (range.parity === 'odd' && n % 2 === 0) continue
    if (range.parity === 'even' && n % 2 === 1) continue
    set.add(n)
  }
  return set
}

/**
 * Prüft, ob die aktiven Wappen den W20-Bereich 1..20 lückenlos und
 * überlappungsfrei abdecken.
 *
 * @param {WappenDef[]} defs
 * @returns {{ ok: boolean, missing: number[], overlaps: Array<{ n: number, ids: string[] }> }}
 */
export function validateW20Coverage(defs) {
  /** @type {Map<number, string[]>} */
  const byNumber = new Map()
  for (const d of defs) {
    if (!d.active) continue
    if (!d.w20Range) continue
    const nums = w20NumbersForRange(d.w20Range)
    for (const n of nums) {
      if (!byNumber.has(n)) byNumber.set(n, [])
      byNumber.get(n).push(d.id)
    }
  }
  const missing = []
  for (let n = 1; n <= 20; n++) {
    if (!byNumber.has(n)) missing.push(n)
  }
  const overlaps = []
  for (const [n, ids] of byNumber) {
    if (ids.length > 1) overlaps.push({ n, ids: ids.slice() })
  }
  overlaps.sort((a, b) => a.n - b.n)
  return { ok: missing.length === 0 && overlaps.length === 0, missing, overlaps }
}

/**
 * W20-Abdeckung nur für Pflicht-Slots 1–8 (Slot 9 ausgenommen).
 * @param {WappenDef[]} defs
 */
export function validateW20CoverageCore(defs) {
  const core = defs.filter((d) => d.slot >= 1 && d.slot <= CORE_WAPPEN_SLOTS)
  return validateW20Coverage(core)
}

/**
 * Prüft, ob aktiver Slot 9 W20-Zahlen mit Slots 1–8 überlappt.
 * @param {WappenDef[]} defs
 */
export function validateSlot9W20Overlap(defs) {
  const slot9 = defs.find((d) => d.slot === 9 && d.active && d.w20Range)
  if (!slot9) return { ok: true, overlaps: [] }
  /** @type {Set<number>} */
  const coreNums = new Set()
  for (const d of defs) {
    if (d.slot === 9 || !d.active || !d.w20Range) continue
    for (const n of w20NumbersForRange(d.w20Range)) coreNums.add(n)
  }
  const overlaps = []
  for (const n of w20NumbersForRange(slot9.w20Range)) {
    if (coreNums.has(n)) overlaps.push(n)
  }
  return { ok: overlaps.length === 0, overlaps }
}

/**
 * @param {WappenDef[]} defs
 * @param {string} id
 */
export function findWappenById(defs, id) {
  for (const d of defs) if (d.id === id) return d
  return null
}

/**
 * Multiplikator für eine AutoMod-Anwendung gegeben Wundzahl `w` (0..4).
 * - perStage: min(w, 3) → wie heutige HIT_ZONE_WOUND_ONCE_PENALTIES.
 * - perWound: min(w, 4) → wie heutiger zusätzlicher FK-Malus −2*w.
 * - once:    w >= 1 → 1, sonst 0.
 *
 * @param {WappenAutoMod['perStufe']} mode
 * @param {number} w
 * @returns {number}
 */
export function autoModMultiplier(mode, w) {
  const x = Math.max(0, Math.floor(Number(w) || 0))
  if (x <= 0) return 0
  if (mode === 'perWound') return Math.min(x, 4)
  if (mode === 'once') return 1
  return Math.min(x, 3)
}

/**
 * Erkennt persistente Wundwert-Keys (`hz<CapId>Rs` / `hz<CapId>W`) im Tracker-Meta
 * und löscht alle, deren ID nicht in der effektiven Wappen-Liste vorkommt.
 * Aktive *und* inaktive Wappen-IDs (slots) bleiben erhalten — inaktive können
 * vom SL später wieder eingeschaltet werden, ohne dass Daten verloren gehen.
 *
 * Sicher gegen andere `hz...`-Keys (z. B. `hzKampfnotiz`), weil das Pattern
 * nur Endungen `Rs` / `W` matcht.
 *
 * @param {Record<string, unknown>} meta
 * @param {{ wappenDefs?: unknown } | undefined | null} room
 * @returns {number} Anzahl gelöschter Keys.
 */
export function cleanupOrphanHitZoneKeys(meta, room) {
  if (!meta || typeof meta !== 'object') return 0
  const list = effectiveWappenForHero(meta, room)
  const known = new Set(list.map((d) => d.id))
  const re = /^hz([A-Z][A-Za-z0-9_-]*?)(Rs|W)$/
  let removed = 0
  for (const k of Object.keys(meta)) {
    const match = re.exec(k)
    if (!match) continue
    const cap = match[1]
    const id = cap.charAt(0).toLowerCase() + cap.slice(1)
    if (!known.has(id)) {
      delete meta[k]
      removed++
    }
  }
  return removed
}

/**
 * Liefert die effektiven Feld-Deltas eines Wappens bei Wundzahl `w`.
 * Felder, die mehrfach in autoMods auftauchen, werden summiert.
 *
 * @param {WappenDef} def
 * @param {number} w
 * @returns {Record<string, number>}
 */
export function autoModDeltasForWappen(def, w) {
  /** @type {Record<string, number>} */
  const out = {}
  if (!def || !Array.isArray(def.autoMods) || w <= 0) return out
  for (const m of def.autoMods) {
    const mult = autoModMultiplier(m.perStufe, w)
    if (mult === 0) continue
    const d = m.delta * mult
    if (!d) continue
    out[m.field] = (out[m.field] ?? 0) + d
  }
  return out
}
