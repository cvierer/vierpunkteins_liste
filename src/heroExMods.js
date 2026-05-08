/**
 * heroExMods.js — Temporaere Helden-Modifikatoren (Multi).
 *
 * Daten:
 *   `meta[HERO_EX_MODS] = HeroExMod[]` (Array auf Tracker-Meta)
 *
 * Mechanik:
 *   - Pro Token-Eigenturn (Helden-INI) und pro Phasen-Offset (Helden-INI − 8)
 *     wird ein "Tick" gezaehlt — gleiche Tick-Definition wie L.H.
 *     (`readLhMechanics`).
 *   - `remaining = duration − ticksPassed` (Standard) bzw. `duration − krIntervals`
 *     bei Akkumulation pro KR; bei `permanent` laeuft der Mod nicht ab (nur manuell).
 *   - Akkumulation: `accrual === 'action'` → Effekt `delta * ticksPassed`;
 *     `accrual === 'round'` → Effekt `delta * krIntervalsPassed`.
 *   - Anzeige rechnet stets live aus dem Storage; Pruning ist nur Aufraeumen.
 *
 * Sperr-frei: gespeicherte `heroEx*`-Werte werden nicht ueberschrieben — der
 * Effektivwert ergibt sich rein durch Aufaddieren aktiver Deltas auf Render-
 * Ebene.
 */

import OBR from '@owlbear-rodeo/sdk'
import { getCombat } from './combatRoom.js'
import { getManualIniTieOverridePairs } from './manualIniTieOverrides.js'
import { readOwnerIniReferenceForMods } from './ownerIniReference.js'
import {
  buildCombatTurnSteps,
  buildMergedDisplayRows,
  findCombatStepIndex,
} from './phaseLinks.js'
import { collectSortedParticipants, TRACKER_ITEM_META_KEY } from './participants.js'
import {
  DEFAULT_LH_ACTIONS_PER_KR,
  DEFAULT_LH_TRIGGER_INI_STEP,
  lhCommitIniRef,
  lhDisplayStepFromNav,
  readLhMechanics,
} from './lhMeta.js'

export const HERO_EX_MODS = 'heroExMods'

/** Max. gleichzeitige Mod-Elemente wie im Heldenblock-Streifen (Buendel zaehlt als eins). */
export const MAX_HERO_EX_MOD_UI_SLOTS = 15

/**
 * Token-Meta: Zahlfelder mit Mod-Summe anzeigen vs. nur Basis (Default: getrennt).
 * Sub-Badges unter den Feldern sind in beiden Modi gleich; Fehlender Schlüssel = getrennt.
 */
export const MOD_DISPLAY_MODE = 'modDisplayMode'

/**
 * @param {Record<string, unknown> | undefined} meta
 * @returns {'integrated' | 'separate'}
 */
export function readModDisplayMode(meta) {
  return meta?.[MOD_DISPLAY_MODE] === 'integrated' ? 'integrated' : 'separate'
}

/**
 * LE und IB zeigen Basis+Mods immer als eine Zahl („integriert“), auch wenn die
 * Anzeige der übrigen Felder getrennt ist.
 *
 * @param {string} field
 */
export function heroFieldModsAlwaysIntegratedDisplay(field) {
  return field === 'le' || field === 'ib'
}

/**
 * @param {Record<string, unknown> | undefined} meta
 * @param {string} field
 */
export function integratesHeroModsIntoDisplayedValue(meta, field) {
  if (heroFieldModsAlwaysIntegratedDisplay(field)) return true
  return readModDisplayMode(meta) === 'integrated'
}

/**
 * Whitelist der mod-faehigen Felder. Identifier matchen die Helden-Block-
 * Felder in [src/iniModMeta.js](src/iniModMeta.js) sowie das Listen-INI.
 * `inn` = Intuition (IN), entspricht `heroExIn`.
 */
/** Trefferzonen-RS als Mod-Ziele (IDs wie [src/iniModMeta.js](src/iniModMeta.js) ZONE_MID_SPECS). */
export const HIT_ZONE_MOD_FIELD_IDS = Object.freeze([
  'kopf',
  'brust',
  'ruecken',
  'schildarm',
  'schwertarm',
  'bauch',
  'lbein',
  'rbein',
])

export const MOD_FIELDS = Object.freeze([
  'mu',
  'kl',
  'inn',
  'ch',
  'ff',
  'ge',
  'ko',
  'kk',
  'at',
  'pa',
  'fk',
  'ws',
  'a',
  'gs',
  'ae',
  'ke',
  'le',
  'leMax',
  ...HIT_ZONE_MOD_FIELD_IDS,
  'tp',
  'ib',
  'be',
  'mr',
])

/** Anzeigekuerzel (UI-Text). */
export const MOD_FIELD_LABEL = Object.freeze({
  mu: 'MU',
  kl: 'KL',
  inn: 'IN',
  ch: 'CH',
  ff: 'FF',
  ge: 'GE',
  ko: 'KO',
  kk: 'KK',
  at: 'AT',
  pa: 'PA',
  fk: 'FK',
  ws: 'WS',
  a: 'AW',
  gs: 'GS',
  ae: 'AE',
  ke: 'KE',
  le: 'LE',
  leMax: 'MAX',
  kopf: 'KF',
  brust: 'BR',
  ruecken: 'RÜ',
  schildarm: 'LA',
  schwertarm: 'RA',
  bauch: 'BA',
  lbein: 'LB',
  rbein: 'RB',
  tp: 'TP',
  ib: 'IB',
  be: 'BE',
  mr: 'MR',
})

const MIN_DELTA = -99
const MAX_DELTA = 99
const MIN_DURATION = 1
const MAX_DURATION = 99

/** Maximale Laenge der optionalen Mod-Bezeichnung (Overlay-Eingabe). */
export const MAX_MOD_LABEL_LEN = 20

/**
 * Vorgegebene Mod-Kartenfarben (Meta speichert stable `id`).
 * Hintergruende kraftvoll, Vordergrund fuer Lesbarkeit abgestimmt.
 */
export const MOD_CHIP_PALETTE = [
  { id: 'ruby', label: 'Rot' },
  { id: 'amber', label: 'Gold' },
  { id: 'forest', label: 'Gruen' },
  { id: 'ocean', label: 'Blau' },
  { id: 'violet', label: 'Violett' },
  { id: 'terracotta', label: 'Terracotta' },
  { id: 'neutral', label: 'Grau' },
]

/** @type {ReadonlySet<string>} */
const MOD_CHIP_COLOR_IDS = new Set(MOD_CHIP_PALETTE.map((p) => p.id))

/**
 * @param {unknown} raw
 * @returns {string | null} gueltige chipColor-Id oder null
 */
export function normalizeModChipColor(raw) {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return null
  return MOD_CHIP_COLOR_IDS.has(s) ? s : null
}

/** @typedef {'none' | 'action' | 'round'} ModAccrual */

/** @type {ReadonlySet<ModAccrual>} */
const ACCRUAL_VALID = new Set(['none', 'action', 'round'])

/**
 * @typedef {{
 *   id: string,
 *   field: typeof MOD_FIELDS[number],
 *   delta: number,
 *   duration: number,
 *   addedRound: number,
 *   addedNavIni: number | null,
 *   permanent?: boolean,
 *   accrual?: ModAccrual,
 *   label?: string,
 *   bundleId?: string,
 *   chipColor?: string,
 * }} HeroExMod
 */

/** Gruppen-ID fuer Mod-Buendel (mehrere `HeroExMod` mit gleichem Paket). */
export function generateModBundleId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `bun-${crypto.randomUUID()}`
    }
  } catch {
    /* ignore */
  }
  return `bun-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Sicherer ID-Generator (RFC 4122 wenn vorhanden, sonst Fallback). */
function genModId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `mod-${crypto.randomUUID()}`
    }
  } catch {
    /* ignore */
  }
  return `mod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function clampInt(raw, lo, hi) {
  const n = Math.trunc(Number(raw))
  if (!Number.isFinite(n)) return null
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Strikte Validierung: liefert null wenn ausserhalb [lo, hi] (kein Clamp,
 * sondern Drop). Sonst die ganze Zahl.
 */
function strictInt(raw, lo, hi) {
  const n = Math.trunc(Number(raw))
  if (!Number.isFinite(n)) return null
  if (n < lo || n > hi) return null
  return n
}

/**
 * @param {unknown} raw
 * @returns {ModAccrual}
 */
function parseAccrual(raw) {
  const s = typeof raw === 'string' ? raw : 'none'
  return ACCRUAL_VALID.has(/** @type {ModAccrual} */ (s)) ? /** @type {ModAccrual} */ (s) : 'none'
}

/**
 * Freitext-Bezeichnung fuer einen Mod (Overlay); max. {@link MAX_MOD_LABEL_LEN} Zeichen.
 *
 * @param {unknown} raw
 * @returns {string} getrimmt oder leer
 */
export function normalizeModLabel(raw) {
  const s = String(raw ?? '')
    .replace(/[\r\n\x00-\x1f]/g, '')
    .trim()
  if (!s) return ''
  return s.length > MAX_MOD_LABEL_LEN ? s.slice(0, MAX_MOD_LABEL_LEN) : s
}

/**
 * @param {unknown} raw
 * @returns {string | null} non-empty bundle id or null
 */
function normalizeBundleId(raw) {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s || s.length > 120) return null
  return s
}

/**
 * Vollendete Kampfrunden seit Mod-Start (`currentRound - addedRound`).
 *
 * @param {HeroExMod} mod
 * @param {number | null | undefined} currentRound
 * @returns {number}
 */
export function krIntervalsPassed(mod, currentRound) {
  if (!mod) return 0
  const cr =
    currentRound != null && Number.isFinite(Number(currentRound))
      ? Math.max(1, Math.floor(Number(currentRound)))
      : 0
  if (cr < 1) return 0
  const cmt = Math.max(1, Math.floor(Number(mod.addedRound)) || 1)
  return Math.max(0, cr - cmt)
}

/**
 * Effektiver Zahlenwert eines einzelnen Mods (Vorzeichen, Akkumulation).
 *
 * @param {HeroExMod} mod
 * @param {number} ownerIni
 * @param {number | null | undefined} currentRound
 * @param {number | null | undefined} currentNavIni
 * @param {{ actionsPerKr: number, triggerIniStep: number }} mechanics
 */
export function modEffectiveContribution(
  mod,
  ownerIni,
  currentRound,
  currentNavIni,
  mechanics
) {
  if (!mod) return 0
  const r = modRemaining(mod, ownerIni, currentRound, currentNavIni, mechanics)
  if (r <= 0) return 0
  const acc = mod.accrual ?? 'none'
  if (acc === 'none') return mod.delta
  if (acc === 'action') {
    const t = ticksPassedForMod(mod, ownerIni, currentRound, currentNavIni, mechanics)
    return mod.delta * t
  }
  const kr = krIntervalsPassed(mod, currentRound)
  return mod.delta * kr
}

/** Meta-Lesen: liefert immer ein Array (auch bei `undefined`/Korruption). */
export function readHeroExMods(meta) {
  const raw = /** @type {any} */ (meta)?.[HERO_EX_MODS]
  if (!Array.isArray(raw)) return []
  /** @type {HeroExMod[]} */
  const out = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    let field = String(m.field ?? '')
    /* Legacy: INI-Mods gelten als IB (Heldenblock-Anker umgestellt). */
    if (field === 'ini') field = 'ib'
    if (!MOD_FIELDS.includes(/** @type {any} */ (field))) continue
    const delta = strictInt(m.delta, MIN_DELTA, MAX_DELTA)
    const duration = strictInt(m.duration, MIN_DURATION, MAX_DURATION)
    if (delta === null || duration === null) continue
    const id = typeof m.id === 'string' && m.id ? m.id : genModId()
    const addedRound = Math.max(1, Math.floor(Number(m.addedRound)) || 1)
    const navN = Number(m.addedNavIni)
    const addedNavIni = Number.isFinite(navN)
      ? navN
      : navN === Number.POSITIVE_INFINITY
        ? Number.POSITIVE_INFINITY
        : navN === Number.NEGATIVE_INFINITY
          ? Number.NEGATIVE_INFINITY
          : null
    const permanent = m.permanent === true
    const accrual = parseAccrual(m.accrual)
    const label = normalizeModLabel(m.label)
    const bundleId = normalizeBundleId(m.bundleId)
    const chipColor = normalizeModChipColor(m.chipColor)
    /** @type {HeroExMod} */
    const rec = {
      id,
      field: /** @type {any} */ (field),
      delta,
      duration,
      addedRound,
      addedNavIni,
      permanent,
      accrual,
    }
    if (label) rec.label = label
    if (bundleId) rec.bundleId = bundleId
    if (chipColor) rec.chipColor = chipColor
    out.push(rec)
  }
  return out
}

/**
 * Anzahl L.H.-Trigger-Indizes k mit `T_k > commitIni` (vor dem Mod-Start
 * in der Commit-KR schon passiert) — gleiche Semantik wie in lhMeta.
 *
 * @param {number} heroIni
 * @param {number} ap
 * @param {number} step
 * @param {number} commitIni
 */
function commitOffsetFromIni(heroIni, ap, step, commitIni) {
  if (
    !Number.isFinite(heroIni) ||
    !Number.isFinite(step) ||
    step === 0 ||
    !Number.isFinite(commitIni)
  ) {
    return 0
  }
  const apN = Math.max(1, Math.floor(Number(ap)) || DEFAULT_LH_ACTIONS_PER_KR)
  let off = 0
  for (let k = 0; k < apN; k++) {
    const T = heroIni + k * step
    if (!Number.isFinite(T)) continue
    if (k > 0 && T < 0) continue
    if (T > commitIni) off++
  }
  const effAp = effectiveActionsPerKr(heroIni, apN, step)
  return Math.min(off, effAp)
}

/**
 * Anzahl gueltiger Trigger-Stufen pro KR. k=0 (Helden-Turn) zaehlt immer;
 * k>0 nur wenn deren INI nicht negativ ist.
 *
 * @param {number} heroIni
 * @param {number} ap
 * @param {number} step
 */
function effectiveActionsPerKr(heroIni, ap, step) {
  const apN = Math.max(1, Math.floor(Number(ap)) || DEFAULT_LH_ACTIONS_PER_KR)
  if (!Number.isFinite(heroIni) || !Number.isFinite(step) || step === 0) {
    return apN
  }
  let count = 0
  for (let k = 0; k < apN; k++) {
    const T = heroIni + k * step
    if (k === 0 || T >= 0) count++
  }
  return Math.max(1, count)
}

/**
 * Anzahl bereits passierter Eigenturn-Ticks (Hero-INI und Hero-INI − 8) seit
 * Mod-Commit. `currentNavIni`:
 *   - `Number.POSITIVE_INFINITY` = roundStart (vor allen Triggern dieser KR)
 *   - `Number.NEGATIVE_INFINITY` = roundEnd (alle Trigger dieser KR passiert)
 *   - finite Zahl = aktuelle Navigations-INI
 *   - `null` / nicht-finit / kein Kampf → 0 (kein Tick, Mod bleibt unveraendert)
 *
 * @param {HeroExMod} mod
 * @param {number} ownerIni Eigentum-INI (Helden-INI als Zahl)
 * @param {number | null | undefined} currentRound
 * @param {number | null | undefined} currentNavIni
 * @param {{ actionsPerKr: number, triggerIniStep: number }} mechanics
 * @returns {number} ticksPassed (>= 0)
 */
export function ticksPassedForMod(
  mod,
  ownerIni,
  currentRound,
  currentNavIni,
  mechanics
) {
  if (!mod || !Number.isFinite(ownerIni)) return 0
  const cr = Math.max(1, Math.floor(Number(currentRound)) || 0)
  if (!Number.isFinite(cr) || cr < 1) return 0
  const cmt = Math.max(1, Math.floor(Number(mod.addedRound)) || 1)
  if (cr < cmt) return 0
  const ap = Math.max(
    1,
    Math.floor(Number(mechanics?.actionsPerKr)) || DEFAULT_LH_ACTIONS_PER_KR
  )
  const step = Number(mechanics?.triggerIniStep) || DEFAULT_LH_TRIGGER_INI_STEP
  const effAp = effectiveActionsPerKr(ownerIni, ap, step)
  const commitRef = lhCommitIniRef(mod.addedNavIni, ownerIni)
  const commitOffset = commitOffsetFromIni(ownerIni, ap, step, commitRef)
  const ticksInCommitKr = Math.max(0, effAp - commitOffset)

  let positionInCurrentKr = 0
  if (Number.isFinite(ownerIni) && Number.isFinite(step) && step !== 0) {
    const navN = Number(currentNavIni)
    const roundEndNav = currentNavIni === Number.NEGATIVE_INFINITY
    if (cr === cmt) {
      for (let k = commitOffset; k < ap; k++) {
        const T = ownerIni + k * step
        if (!Number.isFinite(T) || (k > 0 && T < 0)) continue
        if (roundEndNav || (Number.isFinite(navN) && navN <= T)) {
          positionInCurrentKr++
        }
      }
    } else {
      for (let k = 0; k < ap; k++) {
        const T = ownerIni + k * step
        if (!Number.isFinite(T) || (k > 0 && T < 0)) continue
        if (roundEndNav || (Number.isFinite(navN) && navN <= T)) {
          positionInCurrentKr++
        }
      }
    }
  }

  let passedPriorKr = 0
  if (cr > cmt) {
    passedPriorKr = ticksInCommitKr + Math.max(0, cr - cmt - 1) * effAp
  }
  return passedPriorKr + positionInCurrentKr
}

/**
 * Verbleibende Aktionen fuer einen Mod, geclamped auf [0, duration].
 *
 * @param {HeroExMod} mod
 * @param {number} ownerIni
 * @param {number | null | undefined} currentRound
 * @param {number | null | undefined} currentNavIni
 * @param {{ actionsPerKr: number, triggerIniStep: number }} mechanics
 */
export function modRemaining(mod, ownerIni, currentRound, currentNavIni, mechanics) {
  if (!mod) return 0
  const dur = Math.max(0, Math.floor(Number(mod.duration)) || 0)
  if (dur <= 0) return 0
  if (mod.permanent === true) return dur
  const acc = mod.accrual ?? 'none'
  if (acc === 'round') {
    const kr = krIntervalsPassed(mod, currentRound)
    return Math.max(0, dur - kr)
  }
  const ticks = ticksPassedForMod(mod, ownerIni, currentRound, currentNavIni, mechanics)
  return Math.max(0, dur - ticks)
}

/**
 * Nav-basierter Bruch wie L.H.-UI (`lhFractionFromNavForMeta`): `n/max` oder `GO!`.
 *
 * @param {HeroExMod} mod
 * @param {number} ownerIni numerische Helden-INI
 * @param {{ actionsPerKr: number, triggerIniStep: number }} mechanics `readLhMechanics(meta)`
 * @param {number | null | undefined} combatRound aktuelle KR (≥1)
 * @param {number | null | undefined} currentNavIni wie Initiative-Navigation
 * @returns {string} z. B. `2/5`, `GO!`, oder `''` wenn duration ungueltig
 */
export function modNavFractionLabelFromNav(
  mod,
  ownerIni,
  mechanics,
  combatRound,
  currentNavIni
) {
  if (!mod || !Number.isFinite(ownerIni)) return ''
  const max = Math.max(0, Math.floor(Number(mod.duration)) || 0)
  if (max <= 0) return ''
  if (mod.permanent === true) return '\u221e'
  const acc = mod.accrual ?? 'none'
  if (acc === 'round') {
    const kr = krIntervalsPassed(mod, combatRound)
    if (max > 1 && kr >= max) return 'GO!'
    const step = Math.min(max, kr + 1)
    return `${step}/${max}`
  }
  const commitRound = Math.max(1, Math.floor(Number(mod.addedRound)) || 1)
  const effectiveRound =
    combatRound != null && Number.isFinite(Number(combatRound))
      ? Math.max(1, Math.floor(Number(combatRound)))
      : commitRound
  const step = lhDisplayStepFromNav(
    ownerIni,
    mechanics,
    commitRound,
    effectiveRound,
    currentNavIni,
    max,
    mod.addedNavIni
  )
  if (max > 1 && step >= max) return 'GO!'
  return `${Math.max(1, step)}/${max}`
}

/**
 * Nav-Anzeige fuer Mod-Band unter Wertfeldern: verbleibende Schritte als eine Zahl
 * (von duration runter), z. B. statt 1/8 nur 8, statt 2/8 nur 7. Permanent ∞, Ablauf GO!.
 *
 * @param {HeroExMod} mod
 * @param {number} ownerIni
 * @param {{ actionsPerKr: number, triggerIniStep: number }} mechanics
 * @param {number | null | undefined} combatRound
 * @param {number | null | undefined} currentNavIni
 * @returns {string}
 */
export function modNavCountdownLabelFromNav(
  mod,
  ownerIni,
  mechanics,
  combatRound,
  currentNavIni
) {
  if (!mod || !Number.isFinite(ownerIni)) return ''
  const max = Math.max(0, Math.floor(Number(mod.duration)) || 0)
  if (max <= 0) return ''
  if (mod.permanent === true) return '\u221e'
  const acc = mod.accrual ?? 'none'
  if (acc === 'round') {
    const kr = krIntervalsPassed(mod, combatRound)
    if (max > 1 && kr >= max) return 'GO!'
    const step = Math.min(max, kr + 1)
    return String(Math.max(1, max - step + 1))
  }
  const commitRound = Math.max(1, Math.floor(Number(mod.addedRound)) || 1)
  const effectiveRound =
    combatRound != null && Number.isFinite(Number(combatRound))
      ? Math.max(1, Math.floor(Number(combatRound)))
      : commitRound
  const step = lhDisplayStepFromNav(
    ownerIni,
    mechanics,
    commitRound,
    effectiveRound,
    currentNavIni,
    max,
    mod.addedNavIni
  )
  if (max > 1 && step >= max) return 'GO!'
  const s = Math.max(1, step)
  return String(Math.max(1, max - s + 1))
}

/**
 * Aktive Mods (remaining > 0) gefiltert nach Feld.
 *
 * @param {Record<string, unknown> | undefined} meta
 * @param {string} field
 * @param {number} ownerIni
 * @param {number | null | undefined} currentRound
 * @param {number | null | undefined} currentNavIni
 * @returns {HeroExMod[]}
 */
export function activeModsForField(meta, field, ownerIni, currentRound, currentNavIni) {
  const mods = readHeroExMods(meta)
  if (mods.length === 0) return []
  const mech = readLhMechanics(meta)
  const out = []
  for (const m of mods) {
    if (m.field !== field) continue
    const r = modRemaining(m, ownerIni, currentRound, currentNavIni, mech)
    if (r > 0) out.push(m)
  }
  return out
}

/**
 * Effektiver Delta-Summe auf einem Feld (nicht-destruktive Anzeige).
 *
 * @param {Record<string, unknown> | undefined} meta
 * @param {string} field
 * @param {number} ownerIni
 * @param {number | null | undefined} currentRound
 * @param {number | null | undefined} currentNavIni
 */
export function effectiveDeltaForField(
  meta,
  field,
  ownerIni,
  currentRound,
  currentNavIni
) {
  const mods = readHeroExMods(meta)
  if (mods.length === 0) return 0
  const mech = readLhMechanics(meta)
  let sum = 0
  for (const m of mods) {
    if (m.field !== field) continue
    sum += modEffectiveContribution(m, ownerIni, currentRound, currentNavIni, mech)
  }
  return sum
}

/**
 * Integrierte TP-Anzeige: letzte Zahl im Text um `deltaSum` verschieben;
 * positive Ergebnisse mit führendem „+“, negative mit „−“; sonst Delta anhängen.
 *
 * @param {string | undefined} baseStr
 * @param {number} deltaSum
 */
export function formatTpDisplayIntegrated(baseStr, deltaSum) {
  const d = Number(deltaSum)
  if (!Number.isFinite(d) || d === 0) return String(baseStr ?? '')
  const s = String(baseStr ?? '')
  const re = /-?\d+(?:[.,]\d+)?/g
  let m
  /** @type {RegExpExecArray | null} */
  let last = null
  while ((m = re.exec(s)) !== null) last = m
  if (last) {
    let start = last.index
    const end0 = start + last[0].length
    /* "+1" am Ende: letzter Regex-Treffer ist nur "1" — fuehrendes "+" mit ersetzen. */
    if (start > 0 && s[start - 1] === '+' && !last[0].startsWith('-')) {
      start -= 1
    }
    const rawTok = s.slice(start, end0)
    const num = parseFloat(String(rawTok).replace(',', '.'))
    if (Number.isFinite(num)) {
      const next = num + d
      const repl =
        next === 0
          ? '+0'
          : next < 0
            ? String(next)
            : `+${String(next)}`
      const out = s.slice(0, start) + repl + s.slice(end0)
      return out.replace(/\+\-/g, '-').replace(/-\+/g, '-')
    }
  }
  const sign = d > 0 ? '+' : ''
  const gap = s.length > 0 && !/\s$/.test(s) ? ' ' : ''
  const out = s + gap + sign + d
  return out.replace(/\+\-/g, '-').replace(/-\+/g, '-')
}

/**
 * Persistenz: integrierte TP-Anzeige → gespeicherte Basis-Zeichenkette.
 */
export function basisTpStringFromDisplayedIntegrated(
  meta,
  displayedTp,
  ownerIniNum,
  currentRound,
  currentNavIni
) {
  if (readModDisplayMode(meta) !== 'integrated' || ownerIniNum == null) {
    return String(displayedTp ?? '')
  }
  const d = effectiveDeltaForField(
    meta,
    'tp',
    ownerIniNum,
    currentRound,
    currentNavIni
  )
  if (!d) return String(displayedTp ?? '')
  const s = String(displayedTp ?? '')
  const appendOnly = s.match(/^(.+?)\s+([+-])(\d+)$/)
  if (appendOnly) {
    const baseOnly = appendOnly[1]
    const sign = appendOnly[2]
    const tailVal = Number(appendOnly[3]) * (sign === '-' ? -1 : 1)
    if (!/\d/.test(baseOnly) && tailVal === d) {
      return baseOnly.trimEnd()
    }
  }
  const re = /-?\d+(?:[.,]\d+)?/g
  let m
  /** @type {RegExpExecArray | null} */
  let last = null
  while ((m = re.exec(s)) !== null) last = m
  if (last) {
    let start = last.index
    const end0 = start + last[0].length
    if (start > 0 && s[start - 1] === '+' && !last[0].startsWith('-')) {
      start -= 1
    }
    const rawTok = s.slice(start, end0)
    const num = parseFloat(String(rawTok).replace(',', '.'))
    if (Number.isFinite(num)) {
      const next = num - d
      return s.slice(0, start) + String(next) + s.slice(end0)
    }
  }
  return s.replace(/\s[+-]?\d+$/u, '').trimEnd()
}

/**
 * Persistenz: Kästchen zeigen ggf. Basis+Mod; in den Meta-Feldern bleibt die Basis.
 * Nur ganzzahlige Eingaben werden umgerechnet; leer / nicht-ganzzahlig = unverändert.
 *
 * @param {Record<string, unknown> | undefined} meta
 * @param {Record<string, string | undefined>} displayed — z. B. `gather()`-Ergebnis
 * @param {number | null} ownerIniNum
 * @param {number | null} currentRound
 * @param {number} currentNavIni
 * @returns {Record<string, string | undefined>}
 */
export function basisHeroExpandSnapshotFromDisplayed(
  meta,
  displayed,
  ownerIniNum,
  currentRound,
  currentNavIni
) {
  if (ownerIniNum == null) {
    return { ...displayed }
  }
  const out = { ...displayed }
  const zonesIntegrated =
    readModDisplayMode(meta) === 'integrated' &&
    out.hitZones &&
    typeof out.hitZones === 'object' &&
    out.hitZones.zones

  for (const field of MOD_FIELDS) {
    if (field === 'tp') continue
    if (HIT_ZONE_MOD_FIELD_IDS.includes(field)) continue
    if (!integratesHeroModsIntoDisplayedValue(meta, field)) continue
    const key = field
    if (!(key in out)) continue
    const raw = out[key]
    const t = String(raw ?? '').trim()
    if (t === '') continue
    if (!/^-?\d+$/.test(t)) continue
    const n = parseInt(t, 10)
    if (!Number.isFinite(n)) continue
    const d = effectiveDeltaForField(
      meta,
      field,
      ownerIniNum,
      currentRound,
      currentNavIni
    )
    out[key] = String(n - d)
  }
  if (
    readModDisplayMode(meta) === 'integrated' &&
    'tp' in out &&
    out.tp !== undefined
  ) {
    out.tp = basisTpStringFromDisplayedIntegrated(
      meta,
      String(out.tp ?? ''),
      ownerIniNum,
      currentRound,
      currentNavIni
    )
  }
  if (zonesIntegrated) {
    const zones = { ...out.hitZones.zones }
    for (const zid of HIT_ZONE_MOD_FIELD_IDS) {
      const zd = zones[zid]
      if (!zd || zd.rs === undefined) continue
      const t = String(zd.rs ?? '').trim()
      if (t === '' || !/^-?\d+$/.test(t)) continue
      const n = parseInt(t, 10)
      if (!Number.isFinite(n)) continue
      const d = effectiveDeltaForField(
        meta,
        zid,
        ownerIniNum,
        currentRound,
        currentNavIni
      )
      zones[zid] = { ...zd, rs: String(n - d) }
    }
    out.hitZones = { ...out.hitZones, zones }
  }
  return out
}

/**
 * Alle gerade aktiven Mods eines Tokens (in Original-Reihenfolge).
 *
 * @param {Record<string, unknown> | undefined} meta
 * @param {number} ownerIni
 * @param {number | null | undefined} currentRound
 * @param {number | null | undefined} currentNavIni
 * @returns {Array<HeroExMod & { remaining: number }>}
 */
export function listActiveMods(meta, ownerIni, currentRound, currentNavIni) {
  const mods = readHeroExMods(meta)
  if (mods.length === 0) return []
  const mech = readLhMechanics(meta)
  const out = []
  for (const m of mods) {
    const r = modRemaining(m, ownerIni, currentRound, currentNavIni, mech)
    if (r > 0) out.push({ ...m, remaining: r })
  }
  return out
}

/**
 * Anzahl Mod-„Kacheln“ wie im Streifen: Einzelmods je 1, gleiche bundleId nur einmal.
 *
 * @param {readonly { bundleId?: string }[]} mods
 */
export function countHeroModUiSlots(mods) {
  const seenBundles = new Set()
  let n = 0
  for (const mod of mods) {
    const bid = normalizeBundleId(mod.bundleId)
    if (bid) {
      if (seenBundles.has(bid)) continue
      seenBundles.add(bid)
    }
    n++
  }
  return n
}

/**
 * @param {string} itemId
 * @param {{
 *   field: string,
 *   delta: number | string,
 *   duration: number | string,
 *   currentRound: number | null | undefined,
 *   currentNavIni: number | null | undefined,
 *   permanent?: boolean,
 *   accrual?: ModAccrual | string,
 *   label?: string,
 *   bundleId?: string,
 *   chipColor?: string,
 * }} args
 * @returns {Promise<boolean>} true wenn angelegt, false bei Validierungsfehler.
 */
export async function addHeroExMod(itemId, args) {
  const field = String(args.field || '')
  if (!MOD_FIELDS.includes(/** @type {any} */ (field))) return false
  const delta = clampInt(args.delta, MIN_DELTA, MAX_DELTA)
  const permanent = args.permanent === true
  const duration = clampInt(args.duration, MIN_DURATION, MAX_DURATION)
  if (delta === null) return false
  if (duration === null) return false
  const accrual = parseAccrual(args.accrual)
  const round = Math.max(1, Math.floor(Number(args.currentRound)) || 1)
  const navIni = Number(args.currentNavIni)
  const navStored =
    args.currentNavIni === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : args.currentNavIni === Number.NEGATIVE_INFINITY
        ? Number.NEGATIVE_INFINITY
        : Number.isFinite(navIni)
          ? navIni
          : null
  const next = {
    id: genModId(),
    field,
    delta,
    duration,
    addedRound: round,
    addedNavIni: navStored,
  }
  if (accrual !== 'none') {
    next.accrual = accrual
  }
  if (permanent) {
    next.permanent = true
  }
  const label = normalizeModLabel(args.label)
  if (label) {
    next.label = label
  }
  const bundleId = normalizeBundleId(args.bundleId)
  if (bundleId) {
    next.bundleId = bundleId
  }
  const chipColor = normalizeModChipColor(args.chipColor)
  if (chipColor) {
    next.chipColor = chipColor
  }
  let wrote = false
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const cur = Array.isArray(m[HERO_EX_MODS]) ? m[HERO_EX_MODS] : []
      const trialMeta = { ...m, [HERO_EX_MODS]: [...cur, next] }
      const ownerIniRef = readOwnerIniReferenceForMods(trialMeta)
      let slotCount
      if (ownerIniRef != null && Number.isFinite(ownerIniRef)) {
        slotCount = countHeroModUiSlots(
          listActiveMods(trialMeta, ownerIniRef, round, args.currentNavIni)
        )
      } else {
        slotCount = countHeroModUiSlots(readHeroExMods(trialMeta))
      }
      if (slotCount > MAX_HERO_EX_MOD_UI_SLOTS) continue
      m[HERO_EX_MODS] = [...cur, next]
      wrote = true
    }
  })
  return wrote
}

/**
 * Entfernt einen Mod anhand seiner ID.
 *
 * @param {string} itemId
 * @param {string} modId
 */
export async function removeHeroExMod(itemId, modId) {
  if (!modId) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const cur = Array.isArray(m[HERO_EX_MODS]) ? m[HERO_EX_MODS] : []
      const next = cur.filter((x) => x && x.id !== modId)
      if (next.length === 0) delete m[HERO_EX_MODS]
      else m[HERO_EX_MODS] = next
    }
  })
}

/**
 * Entfernt alle Mods mit derselben {@link HeroExMod#bundleId} (Mod-Buendel).
 *
 * @param {string} itemId
 * @param {string} bundleId
 */
export async function removeHeroExModsByBundleId(itemId, bundleId) {
  const bid = normalizeBundleId(bundleId)
  if (!bid) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const cur = Array.isArray(m[HERO_EX_MODS]) ? m[HERO_EX_MODS] : []
      const next = cur.filter((x) => !x || String(x.bundleId || '') !== bid)
      if (next.length === 0) delete m[HERO_EX_MODS]
      else m[HERO_EX_MODS] = next
    }
  })
}

/**
 * Entfernt abgelaufene Mods aus dem Storage. Idempotent.
 *
 * @param {string} itemId
 * @param {number} ownerIni
 * @param {number | null | undefined} currentRound
 * @param {number | null | undefined} currentNavIni
 */
export async function pruneExpiredMods(itemId, ownerIni, currentRound, currentNavIni) {
  const items = await OBR.scene.items.getItems([itemId])
  const item = items?.[0]
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  const mods = readHeroExMods(meta)
  if (mods.length === 0) return
  const mech = readLhMechanics(meta)
  const keep = []
  let changed = false
  for (const m of mods) {
    const r = modRemaining(m, ownerIni, currentRound, currentNavIni, mech)
    if (r > 0) keep.push(m)
    else changed = true
  }
  if (!changed) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      if (keep.length === 0) delete m[HERO_EX_MODS]
      else m[HERO_EX_MODS] = keep
    }
  })
}

/**
 * Aktuelle Nav-INI fuer Mod-Pruning — gleiche Schritte wie `renderList` /
 * `lhDisplayStepFromNav` (nicht `currentNavIniForRender`, das beim
 * `onCombatChange`-Hook noch den vorherigen Render-Stand haben kann).
 *
 * @param {readonly any[]} items
 * @param {readonly string[] | null | undefined} tieOrderIds
 * @returns {number | null} finite INI, +/-Infinity fuer roundStart/roundEnd,
 *   oder `null` wenn nicht ermittelbar
 */
function computeHeroExModsNavIniForPrune(items, tieOrderIds) {
  const combat = getCombat()
  if (!combat.started || combat.roundIntroPending) return null
  const tie = Array.isArray(tieOrderIds) ? tieOrderIds : []
  const tokenRows = collectSortedParticipants(
    items,
    tie,
    getManualIniTieOverridePairs()
  )
  const combatRoundForMerged = combat.started ? combat.round : null
  const merged = buildMergedDisplayRows(
    tokenRows,
    items,
    tie,
    combatRoundForMerged
  )
  const steps = buildCombatTurnSteps(
    tokenRows,
    items,
    tie,
    combatRoundForMerged
  )
  const idx = findCombatStepIndex(steps, combat)
  if (idx < 0 || idx >= merged.length) return null
  const current = merged[idx]
  if (!current) return null
  if (current.kind === 'roundEnd') return Number.NEGATIVE_INFINITY
  if (current.kind === 'roundStart') return Number.POSITIVE_INFINITY
  if (current.kind === 'token') {
    const n = Number(String(current.row.initiative ?? '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  if (Number.isFinite(current.hookIni)) return current.hookIni
  return null
}

/**
 * Nav-Hook: nach jeder Kampf-Navigation pro Tracker-Item alle abgelaufenen
 * Mods entfernen. Nav-INI wird live aus Combat + Items berechnet (wie L.H.),
 * nicht aus dem Listen-Render-Cache.
 *
 * @param {readonly any[]} items Szene-Items
 * @param {readonly string[] | null | undefined} tieOrderIds INI-Tie-Reihenfolge
 * @param {{
 *   currentRound: number | null | undefined,
 * }} ctx
 */
export async function runHeroExModsAfterCombatUpdate(items, tieOrderIds, ctx) {
  if (!Array.isArray(items) || items.length === 0) return
  let round = Number(ctx?.currentRound)
  if (!Number.isFinite(round)) {
    const c = getCombat()
    if (c?.started && Number.isFinite(Number(c.round))) round = Number(c.round)
  }
  if (!Number.isFinite(round) || round < 1) return
  const navIni = computeHeroExModsNavIniForPrune(items, tieOrderIds) ?? undefined
  for (const item of items) {
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    const mods = readHeroExMods(meta)
    if (mods.length === 0) continue
    const ownerIni = readOwnerIniReferenceForMods(meta)
    if (ownerIni == null || !Number.isFinite(ownerIni)) continue
    try {
      await pruneExpiredMods(item.id, ownerIni, round, navIni)
    } catch {
      /* nicht kritisch */
    }
  }
}
