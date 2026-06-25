// Primärfeld-/Paarmodus-Helfer der Mutterzeile (kein OBR, kein Render-State).
// Fundament-Blatt: hängt nur an krDigit + krMetaKeys; wird von krIniLock,
// krActionPool und dem Stempel-Engine in krCounters genutzt. Aus krCounters.js
// ausgelagert und dort über das Barrel re-exportiert (verhaltensneutral).

import { normalizeKrDigit } from './krDigit.js'
import {
  KR_ABW,
  KR_ANG,
  KR_FIRST_SLOT_KIND,
  KR_LH_ACTION,
  KR_PAIR_MODE,
  KR_PRIMARY_LADUNG,
  KR_PRIMARY_VOID_BY_ABW_TRANSFER,
  KR_SRA,
} from './krMetaKeys.js'

/** @typedef {'ang_abw' | 'ang_ang' | 'abw_abw' | 'sra_sra' | 'sra_ang' | 'sra_abw'} KrPairMode */
export const KR_PAIR_MODE_ORDER = /** @type {const} */ ([
  'ang_abw',
  'ang_ang',
  'abw_abw',
  'sra_sra',
  'sra_ang',
  'sra_abw',
])
export const KR_PAIR_MODE_VALID = new Set(KR_PAIR_MODE_ORDER)

/**
 * @param {unknown} meta
 * @returns {KrPairMode}
 */
export function readKrPairMode(meta) {
  const v = meta?.[KR_PAIR_MODE]
  return typeof v === 'string' && KR_PAIR_MODE_VALID.has(v) ? v : 'ang_abw'
}

/** @param {KrPairMode} cur */
export function nextKrPairMode(cur) {
  const i = KR_PAIR_MODE_ORDER.indexOf(cur)
  const idx = i < 0 ? 0 : (i + 1) % KR_PAIR_MODE_ORDER.length
  return KR_PAIR_MODE_ORDER[idx]
}

/**
 * @param {KrPairMode} mode
 * @param {0 | 1} slot
 */
export function krPairModeFieldForSlot(mode, slot) {
  if (slot === 0) {
    if (mode === 'ang_abw' || mode === 'ang_ang') return KR_ANG
    if (mode === 'abw_abw') return KR_ABW
    if (mode === 'sra_ang' || mode === 'sra_abw' || mode === 'sra_sra') return KR_SRA
    return KR_SRA
  }
  if (mode === 'ang_abw') return KR_ABW
  if (mode === 'ang_ang') return KR_ANG
  if (mode === 'abw_abw') return KR_ABW
  if (mode === 'sra_ang') return KR_ANG
  if (mode === 'sra_abw') return KR_ABW
  return KR_SRA
}

/**
 * @param {string} field
 * @returns {'ang' | 'abw' | 'sra' | 'lh'}
 */
export function krFieldToCounterKind(field) {
  if (field === KR_ABW) return 'abw'
  if (field === KR_SRA) return 'sra'
  if (field === KR_LH_ACTION) return 'lh'
  return 'ang'
}

/**
 * @param {unknown} meta
 * @returns {'ang' | 'sra' | 'lh' | 'uo'}
 */
export function readKrFirstSlotKind(meta) {
  const v = meta?.[KR_FIRST_SLOT_KIND]
  if (v === 'uo') return 'uo'
  if (v === 'sra' || v === 'ang' || v === 'lh') return v
  if (meta?.[KR_PRIMARY_VOID_BY_ABW_TRANSFER]) return 'uo'
  const mode = readKrPairMode(meta)
  return krPairModeFieldForSlot(mode, 0) === KR_SRA ? 'sra' : 'ang'
}

export function primaryFieldForKind(meta) {
  const kind = readKrFirstSlotKind(meta)
  if (kind === 'uo') return KR_ANG
  if (kind === 'sra') return KR_SRA
  if (kind === 'lh') return KR_LH_ACTION
  return KR_ANG
}

/**
 * @param {unknown} meta
 */
export function readKrPrimaryLadung(meta) {
  if (!meta || typeof meta !== 'object') return 0
  if (Object.prototype.hasOwnProperty.call(meta, KR_PRIMARY_LADUNG)) {
    return normalizeKrDigit(meta[KR_PRIMARY_LADUNG])
  }
  const pf = primaryFieldForKind(meta)
  return normalizeKrDigit(meta[pf])
}

export function syncKrPrimaryLadungFromPrimaryField(m) {
  if (!m) return
  const pf = primaryFieldForKind(m)
  m[KR_PRIMARY_LADUNG] = normalizeKrDigit(m[pf])
}
