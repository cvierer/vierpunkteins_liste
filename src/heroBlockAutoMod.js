/**
 * Reine Heldenblock-Logik: LE-Balken-Farbbänder, Wundstufen, automatische Mod-Zusammenfassung
 * (ohne Owlbear/DOM) — getrennt, damit Unit-Tests keinen schweren Modulgraphen laden.
 */

/**
 * LE/LE-max (0..1) → Farbband (strikt „>“ wie in der UI-Vorgabe).
 * @param {number} frac
 * @returns {'std' | 'gly' | 'yel' | 'yor' | 'alert' | 'peril' | 'crit'}
 */
export function leFractionToThresholdBand(frac) {
  const f = Math.max(0, Math.min(1, frac))
  if (f > 7 / 8) return 'std'
  if (f > 6 / 8) return 'gly'
  if (f > 5 / 8) return 'yel'
  if (f > 1 / 2) return 'yor'
  if (f > 3 / 8) return 'alert'
  if (f > 1 / 4) return 'peril'
  return 'crit'
}

/**
 * Balkenfarbe inkl. LE unter 6 (lebend): signalroter Puls statt Anteilsfarbe.
 * @param {number} leV
 * @param {number} maxV
 * @returns {'std' | 'gly' | 'yel' | 'yor' | 'alert' | 'peril' | 'crit' | 'sig'}
 */
export function leBarColorBand(leV, maxV) {
  const frac = Math.max(0, Math.min(1, leV / maxV))
  if (leV > 0 && leV < 6) return 'sig'
  return leFractionToThresholdBand(frac)
}

/** Wundstufen 0..3 für Mini-Wappen (1–3 Marken). */
export function zoneStageFromWounds(w) {
  const x = Math.max(0, Math.floor(Number(w) || 0))
  if (x >= 3) return 3
  if (x >= 2) return 2
  if (x >= 1) return 1
  return 0
}

/**
 * Pro Wundstufe einmal angewandte Feld-Abzüge.
 * @type {Record<string, Record<string, number>>}
 */
export const HIT_ZONE_WOUND_ONCE_PENALTIES = {
  kopf: { mu: 2, kl: 2, inn: 2, ib: 2 },
  brust: { at: 1, pa: 1, ko: 1, kk: 1, a: 1 },
  ruecken: { at: 1, pa: 1, ko: 1, kk: 1, a: 1 },
  schildarm: { at: 2, pa: 2, kk: 2, ff: 2 },
  schwertarm: { at: 2, pa: 2, kk: 2, ff: 2 },
  bauch: { at: 1, pa: 1, ko: 1, kk: 1, gs: 1, ib: 1, a: 1 },
  lbein: { at: 2, pa: 2, a: 2, ge: 2, ib: 2, gs: 1 },
  rbein: { at: 2, pa: 2, a: 2, ge: 2, ib: 2, gs: 1 },
}

const HIT_ZONE_ABBR_DE = {
  kopf: 'KF',
  brust: 'BR',
  ruecken: 'RÜ',
  schildarm: 'LA',
  schwertarm: 'RA',
  bauch: 'BA',
  lbein: 'LB',
  rbein: 'RB',
}

const MOD_SUMMARY_FIELD_ORDER = [
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
]

const MOD_SUMMARY_FIELD_LABEL_DE = {
  at: 'AT',
  pa: 'PA',
  a: 'AW',
  fk: 'FK',
  mu: 'MU',
  kl: 'KL',
  inn: 'IN',
  ib: 'IB',
  ko: 'KO',
  kk: 'KK',
  ff: 'FF',
  gs: 'GS',
  ge: 'GE',
}

/**
 * @param {Array<{ id: string, abbr?: string }> | null | undefined} wappenDefs
 * @param {string} zoneId
 */
function abbrForZone(wappenDefs, zoneId) {
  if (Array.isArray(wappenDefs)) {
    const def = wappenDefs.find((d) => d?.id === zoneId)
    if (def?.abbr) return def.abbr
  }
  return HIT_ZONE_ABBR_DE[zoneId] ?? zoneId
}

/**
 * @param {Array<{ id: string, autoMods?: Array<{ field: string, delta: number, perStufe: 'perStage'|'perWound'|'once' }> }> | null | undefined} wappenDefs
 * @param {string} zoneId
 */
function perStageMalisForZone(wappenDefs, zoneId) {
  if (Array.isArray(wappenDefs)) {
    const def = wappenDefs.find((d) => d?.id === zoneId)
    if (def && Array.isArray(def.autoMods)) {
      /** @type {Record<string, number>} */
      const perStage = {}
      for (const m of def.autoMods) {
        if (m.perStufe !== 'perStage') continue
        const v = -m.delta
        if (!Number.isFinite(v) || v <= 0) continue
        perStage[m.field] = (perStage[m.field] ?? 0) + v
      }
      return perStage
    }
  }
  return HIT_ZONE_WOUND_ONCE_PENALTIES[zoneId] ?? null
}

/**
 * @param {Array<{ zoneId: string, getWunden: () => number }>} zoneUiList
 * @param {{ wappenDefs?: Array<{ id: string, abbr?: string }> }} [opts]
 */
export function buildWundenZonesTitle(zoneUiList, opts = {}) {
  const parts = []
  let sum = 0
  for (const u of zoneUiList) {
    const w = u.getWunden() || 0
    sum += w
    if (w > 0) {
      const ab = abbrForZone(opts?.wappenDefs, u.zoneId)
      parts.push(`${ab} ${w}`)
    }
  }
  if (sum === 0) {
    return 'Keine Wunden gesetzt. Wundmarken je Trefferzone im Heldenblock (KF … RB).'
  }
  return `Wunden je Trefferzone (Marken): ${parts.join(', ')} · Gesamt: ${sum}`
}

/**
 * Felder mit automatischem Mod aus LE-Schwelle (AT/PA/AW/FK) und/oder Wundzonen.
 * @param {Array<{ zoneId: string, getWunden: () => number }>} zoneUiList
 * @param {number} leAtPaMalus
 * @param {{ wappenDefs?: Array<{ id: string, autoMods?: Array<{ field: string, delta: number, perStufe: 'perStage'|'perWound'|'once' }> }> }} [opts]
 * @returns {string[]}
 */
export function computeAutoModAffectedFields(zoneUiList, leAtPaMalus, opts = {}) {
  const m = Math.max(0, Math.floor(Number(leAtPaMalus) || 0))
  let wSum = 0
  for (const u of zoneUiList) {
    wSum += Math.max(0, Math.floor(Number(u.getWunden()) || 0))
  }
  /** @type {Set<string>} */
  const keys = new Set()
  if (m) {
    keys.add('at')
    keys.add('pa')
    keys.add('a')
    keys.add('fk')
  }
  if (wSum > 0) keys.add('fk')
  for (const u of zoneUiList) {
    const st = zoneStageFromWounds(u.getWunden())
    if (!st) continue
    const once = perStageMalisForZone(opts?.wappenDefs, u.zoneId)
    if (!once) continue
    for (const field of Object.keys(once)) keys.add(field)
  }
  return MOD_SUMMARY_FIELD_ORDER.filter((f) => keys.has(f))
}

/**
 * @param {Array<{ zoneId: string, getWunden: () => number }>} zoneUiList
 * @param {number} leAtPaMalus
 * @param {{ wappenDefs?: Array<{ id: string, abbr?: string, autoMods?: Array<{ field: string, delta: number, perStufe: 'perStage'|'perWound'|'once' }> }> }} [opts]
 * @returns {{ total: number, title: string, activeFields: string[] }}
 */
export function buildLePopoverModSummary(zoneUiList, leAtPaMalus, opts = {}) {
  /** @type {Record<string, Array<{ src: string, n: number }>>} */
  const byField = {}
  const add = (field, src, n) => {
    const k = Math.max(0, Math.round(Number(n) || 0))
    if (!k) return
    if (!byField[field]) byField[field] = []
    byField[field].push({ src, n: k })
  }

  const m = Math.max(0, Math.floor(Number(leAtPaMalus) || 0))
  if (m) {
    add('at', 'LE', m)
    add('pa', 'LE', m)
    add('a', 'LE', m)
    add('fk', 'LE', m)
  }

  let wSum = 0
  for (const u of zoneUiList) {
    wSum += Math.max(0, Math.floor(Number(u.getWunden()) || 0))
  }
  if (wSum > 0) add('fk', 'W', 2 * wSum)

  for (const u of zoneUiList) {
    const st = zoneStageFromWounds(u.getWunden())
    if (!st) continue
    const once = perStageMalisForZone(opts?.wappenDefs, u.zoneId)
    if (!once) continue
    const ab = abbrForZone(opts?.wappenDefs, u.zoneId)
    for (const [field, perStage] of Object.entries(once)) {
      add(field, ab, perStage * st)
    }
  }

  let total = 0
  for (const arr of Object.values(byField)) {
    for (const p of arr) total += p.n
  }

  if (total === 0) {
    return {
      total: 0,
      activeFields: computeAutoModAffectedFields(zoneUiList, leAtPaMalus, opts),
      title:
        'Keine automatischen LE-/Wund-Modifikatoren auf AT, PA, AW, FK und Trefferzonen-Felder (laut aktueller Heldenblock-Logik).',
    }
  }

  const lines = []
  for (const field of MOD_SUMMARY_FIELD_ORDER) {
    const parts = byField[field]
    if (!parts?.length) continue
    const tf = parts.reduce((a, p) => a + p.n, 0)
    const detail = parts.map((p) => `${p.src} −${p.n}`).join(', ')
    const lab = MOD_SUMMARY_FIELD_LABEL_DE[field] ?? field.toUpperCase()
    lines.push(`${lab}: −${tf} (${detail})`)
  }
  return {
    total,
    title: lines.join('\n'),
    activeFields: computeAutoModAffectedFields(zoneUiList, leAtPaMalus, opts),
  }
}
