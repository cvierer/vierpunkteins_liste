// Synchrone KR-Reader und Hero-Extra-/Parade-Helfer (kein OBR, kein Render-State).
// Blatt-Modul: hängt nur an krDigit, krMetaKeys und roomSettings — keine anderen
// krCounters-Funktionen. Aus krCounters.js ausgelagert und dort über das Barrel
// re-exportiert (verhaltensneutral). `migrateHeroExtraCountFields` mutiert das
// übergebene Meta-Objekt in-place, hängt aber von nichts weiterem ab.

import { normalizeKrDigit } from './krDigit.js'
import {
  HERO_EXTRA_MAX,
  HERO_INI_NEG_ACTIONS_LOST,
  HERO_INI_NEG_ANG_MODE,
  KR_ABW,
  KR_ANG,
  KR_FREE_ACTION,
  KR_LH_ACTION,
  KR_LH_SECOND,
  KR_PARADE_EXTRA,
  KR_SRA,
  LEGACY_KR_ACTION,
} from './krMetaKeys.js'
import { faMaxForInitiative } from './roomSettings.js'

/**
 * Wie viele Ladungen bei INI < 0 gesperrt werden (0–10, Standard 1).
 * @param {unknown} meta
 * @returns {number}
 */
export function readHeroIniNegActionsLost(meta) {
  if (!meta || typeof meta !== 'object') return 1
  const n = Math.floor(Number(meta[HERO_INI_NEG_ACTIONS_LOST]))
  return Number.isFinite(n) && n >= 0 ? Math.min(10, n) : 1
}

/**
 * Schwert-Freigabe im negativen INI-Bereich.
 * 'no'      — kein Schwert (Standard/bisheriges Verhalten)
 * 'yes'     — Schwert als Mutter-Aktion erlaubt
 * 'zatOnly' — Mutter bleibt SRA, aber z.AT-Objekte dürfen in den negativen Bereich
 * @param {unknown} meta
 * @returns {'no' | 'yes' | 'zatOnly'}
 */
export function readHeroIniNegAngMode(meta) {
  if (!meta || typeof meta !== 'object') return 'no'
  const v = meta[HERO_INI_NEG_ANG_MODE]
  return v === 'yes' || v === 'zatOnly' ? v : 'no'
}

function clampHeroExtraCount(raw) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(HERO_EXTRA_MAX, n))
}

/**
 * @param {unknown} meta
 * @returns {number}
 */
export function readHeroExtraAngCount(meta) {
  if (meta && typeof meta === 'object') {
    if (Object.prototype.hasOwnProperty.call(meta, 'heroExtraAngCount')) {
      return clampHeroExtraCount(meta.heroExtraAngCount)
    }
    return meta.heroExtraAng ? 1 : 0
  }
  return 0
}

/**
 * @param {unknown} meta
 * @returns {number}
 */
export function readHeroExtraParCount(meta) {
  if (meta && typeof meta === 'object') {
    if (Object.prototype.hasOwnProperty.call(meta, 'heroExtraParCount')) {
      return clampHeroExtraCount(meta.heroExtraParCount)
    }
    return meta.heroExtraPar ? 1 : 0
  }
  return 0
}

export function migrateHeroExtraCountFields(m) {
  if (!m || typeof m !== 'object') return
  if (m.heroExtraAngCount === undefined && m.heroExtraAng !== undefined) {
    m.heroExtraAngCount = m.heroExtraAng ? 1 : 0
  }
  if (m.heroExtraParCount === undefined && m.heroExtraPar !== undefined) {
    m.heroExtraParCount = m.heroExtraPar ? 1 : 0
  }
  delete m.heroExtraAng
  delete m.heroExtraPar
}

/**
 * @param {unknown} meta
 * @param {string | number | undefined} iniStr
 * @param {{ highIniFreeActions?: boolean } | undefined} settings
 * @returns {number}
 */
export function readHeroFaMax(meta, iniStr, settings) {
  if (meta && typeof meta === 'object') {
    if (Object.prototype.hasOwnProperty.call(meta, 'heroFaMax')) {
      const n = Math.floor(Number(meta.heroFaMax))
      if (Number.isFinite(n) && n >= 0) return Math.max(0, Math.min(HERO_EXTRA_MAX, n))
    }
  }
  return faMaxForInitiative(iniStr, Boolean(settings?.highIniFreeActions))
}

export function paradeExtraFieldForIndex(index) {
  return index <= 0 ? KR_PARADE_EXTRA : `${KR_PARADE_EXTRA}_${index + 1}`
}

export function paradeExtraIndexForField(field) {
  if (field === KR_PARADE_EXTRA) return 0
  if (typeof field !== 'string') return null
  if (!field.startsWith(`${KR_PARADE_EXTRA}_`)) return null
  const n = Math.floor(Number(field.slice(KR_PARADE_EXTRA.length + 1)))
  if (!Number.isFinite(n) || n < 2 || n > HERO_EXTRA_MAX) return null
  return n - 1
}

export function readKrFreeAction(meta, faMax) {
  const cap = Math.max(1, Math.min(HERO_EXTRA_MAX, Math.floor(Number(faMax)) || 2))
  return normalizeKrDigit(meta?.[KR_FREE_ACTION], cap)
}

export function readKrAng(meta) {
  if (meta && meta[KR_ANG] != null) return normalizeKrDigit(meta[KR_ANG])
  if (meta && meta[LEGACY_KR_ACTION] != null)
    return normalizeKrDigit(meta[LEGACY_KR_ACTION])
  return 0
}

export function readKrAbw(meta) {
  return normalizeKrDigit(meta?.[KR_ABW])
}

/**
 * @param {unknown} meta
 * @returns {undefined | 0 | 1} `0` = Parade-Schild geladen, `1` = verbraucht, `undefined` = kein Eintrag
 */
export function readKrParadeExtra(meta) {
  if (!meta || typeof meta !== 'object') return undefined
  if (meta[KR_PARADE_EXTRA] === undefined) return undefined
  return normalizeKrDigit(meta[KR_PARADE_EXTRA], 1)
}

/**
 * @param {unknown} meta
 * @returns {(undefined | 0 | 1)[]}
 */
export function readKrParadeExtraSlots(meta) {
  if (!meta || typeof meta !== 'object') return []
  const out = []
  const count = readHeroExtraParCount(meta)
  for (let i = 0; i < count; i++) {
    const key = paradeExtraFieldForIndex(i)
    if (meta[key] === undefined) out.push(undefined)
    else out.push(normalizeKrDigit(meta[key], 1))
  }
  return out
}

export function readKrSra(meta) {
  return normalizeKrDigit(meta?.[KR_SRA])
}

export function readKrLhAction(meta) {
  return normalizeKrDigit(meta?.[KR_LH_ACTION])
}

/**
 * Zweite L.H.-Ladung (nach Schild-Umwandlung). `undefined`/`null` = 1 (wie früher: ein Feld ohne Zweiteilung).
 * @param {unknown} meta
 * @returns {0 | 1}
 */
export function readKrLhSecondCharge(meta) {
  if (meta?.[KR_LH_SECOND] == null) return 1
  return normalizeKrDigit(meta[KR_LH_SECOND], 1) >= 1 ? 1 : 0
}
