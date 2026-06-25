// INI-Sperre (V362) und INI-Vorzeichen-Reader (kein OBR, kein Render-State).
// Schicht über krPrimaryField/krCounterRead; aus krCounters.js ausgelagert und
// dort über das Barrel re-exportiert (verhaltensneutral). `applyIniLockCharges`
// mutiert `m` direkt.

import {
  chargeValueFromMarks,
  marksFromChargeValue,
  normalizeKrDigit,
} from './krDigit.js'
import { readHeroIniNegActionsLost, readHeroIniNegAngMode } from './krCounterRead.js'
import {
  primaryFieldForKind,
  readKrFirstSlotKind,
  syncKrPrimaryLadungFromPrimaryField,
} from './krPrimaryField.js'
import {
  KR_ABW,
  KR_ANG,
  KR_COUNTER_MAX,
  KR_FIRST_SLOT_KIND,
  KR_FREE_ACTION,
  KR_INI_LOCK_MINUS_A,
  KR_INI_LOCK_MINUS_B,
  KR_LH_ACTION,
  KR_LH_VOID_BY_TRANSFER,
  KR_PAIR_MODE,
  KR_PRIMARY_VOID_BY_ABW_TRANSFER,
  KR_SRA,
} from './krMetaKeys.js'

export function ensureFullFreeActionQuota(m) {
  if (!m || typeof m !== 'object') return
  m[KR_FREE_ACTION] = 0
}

/**
 * @param {unknown} meta
 * @returns {boolean} true, wenn die gespeicherte INI eine endliche Zahl < 0 ist.
 */
export function isHeroIniBelowZero(meta) {
  if (!meta || typeof meta !== 'object') return false
  const raw = String(meta.initiative ?? '').trim().replace(',', '.')
  if (raw === '') return false
  const n = Number(raw)
  return Number.isFinite(n) && n < 0
}

/**
 * INI-Sperre (V362): Solange die INI < 0 ist, darf die Summe der Ladungen auf
 * Primärseite A (`KR_PRIMARY_LADUNG` bzw. das aktive Primärfeld) und Schild B
 * (`KR_ABW`) höchstens 1 betragen. Marks werden bevorzugt auf Seite A
 * abgebaut; nur wenn A leer ist und B mehr als eine Ladung hat, wird eine
 * Mark aus B entfernt. Abgebaute Marks werden in `KR_INI_LOCK_MINUS_A` /
 * `KR_INI_LOCK_MINUS_B` bilanziert.
 *
 * Wird die INI wieder ≥ 0, stellt die Funktion die gemerkten Marks wieder
 * her und räumt die Bilanzfelder auf. Die Funktion ist idempotent und wird
 * bei jeder INI-Änderung sowie zu Rundenwechsel aufgerufen.
 *
 * Mutiert `m` direkt. Tut nichts, wenn INI leer oder ungültig ist, damit
 * Tokens ohne Initiative (z. B. NSCs ohne INI) nicht angefasst werden.
 */
export function applyIniLockCharges(m) {
  if (!m || typeof m !== 'object') return
  const iniRaw = String(m.initiative ?? '').trim().replace(',', '.')
  if (iniRaw === '') return
  const iniNum = Number(iniRaw)
  if (!Number.isFinite(iniNum)) return

  const minusA = Math.max(0, Math.floor(Number(m[KR_INI_LOCK_MINUS_A]) || 0))
  const minusB = Math.max(0, Math.floor(Number(m[KR_INI_LOCK_MINUS_B]) || 0))

  if (iniNum >= 0) {
    // INI erholt sich: abgezogene Ladungen zurückgeben.
    if (minusA > 0) {
      const pf = primaryFieldForKind(m)
      const curMarks = marksFromChargeValue(normalizeKrDigit(m[pf]))
      const nextMarks = Math.min(KR_COUNTER_MAX, curMarks + minusA)
      m[pf] = chargeValueFromMarks(nextMarks)
      // L.H.-Rückgabe hebt eine vom Transfer stammende Leerung auf.
      if (pf === KR_LH_ACTION && nextMarks > 0) {
        delete m[KR_LH_VOID_BY_TRANSFER]
      }
      if ((pf === KR_ANG || pf === KR_SRA) && nextMarks > 0) {
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
      }
      syncKrPrimaryLadungFromPrimaryField(m)
    }
    if (minusB > 0) {
      const curB = marksFromChargeValue(normalizeKrDigit(m[KR_ABW]))
      m[KR_ABW] = chargeValueFromMarks(Math.min(KR_COUNTER_MAX, curB + minusB))
    }
    if (Object.prototype.hasOwnProperty.call(m, KR_INI_LOCK_MINUS_A)) {
      delete m[KR_INI_LOCK_MINUS_A]
    }
    if (Object.prototype.hasOwnProperty.call(m, KR_INI_LOCK_MINUS_B)) {
      delete m[KR_INI_LOCK_MINUS_B]
    }
    return
  }

  // INI < 0: Schwert als Mutter-Aktion abhaengig von heroIniNegAngMode.
  // 'no' und 'zatOnly': Mutter auf SRA migrieren (Schwert weg).
  // 'yes': Schwert bleibt im Zyklus - keine Migration.
  const angMode = readHeroIniNegAngMode(m)
  if (angMode !== 'yes' && readKrFirstSlotKind(m) === 'ang') {
    const angMarks = marksFromChargeValue(normalizeKrDigit(m[KR_ANG]))
    const sraMarks = marksFromChargeValue(normalizeKrDigit(m[KR_SRA]))
    const mergedMarks = Math.min(KR_COUNTER_MAX, angMarks + sraMarks)
    m[KR_FIRST_SLOT_KIND] = 'sra'
    const curPair = m[KR_PAIR_MODE]
    if (
      curPair !== 'sra_sra' &&
      curPair !== 'sra_ang' &&
      curPair !== 'sra_abw'
    ) {
      m[KR_PAIR_MODE] = 'sra_ang'
    }
    m[KR_ANG] = 1
    m[KR_SRA] = chargeValueFromMarks(mergedMarks)
    delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
    syncKrPrimaryLadungFromPrimaryField(m)
  }

  // Gesamtladung auf <= actionsLost reduzieren (A bevorzugt).
  const actionsLost = readHeroIniNegActionsLost(m)
  const pf = primaryFieldForKind(m)
  const aMarks = marksFromChargeValue(normalizeKrDigit(m[pf]))
  const bMarks = marksFromChargeValue(normalizeKrDigit(m[KR_ABW]))
  const total = aMarks + bMarks
  let excess = total - actionsLost
  if (excess <= 0) return

  const removeA = Math.min(excess, aMarks)
  excess -= removeA
  const removeB = Math.min(excess, bMarks)

  if (removeA > 0) {
    m[pf] = chargeValueFromMarks(aMarks - removeA)
    syncKrPrimaryLadungFromPrimaryField(m)
    m[KR_INI_LOCK_MINUS_A] = minusA + removeA
  }
  if (removeB > 0) {
    m[KR_ABW] = chargeValueFromMarks(bMarks - removeB)
    m[KR_INI_LOCK_MINUS_B] = minusB + removeB
  }
}
