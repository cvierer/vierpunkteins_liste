// Synchrone ZAO-Slot-Reader/-Helfer (2.A.-Objekt-Slots der Mutterzeile).
// Schicht über krDigit/krMetaKeys/krTransferMarks/krPrimaryField/phaseLinks;
// kein OBR, kein Render-State. Aus krCounters.js ausgelagert und dort über das
// Barrel re-exportiert (verhaltensneutral). Mutierende Funktionen
// (`applyUoDefaultAbwChargeIfNeeded`, `pruneOrphanZaoSlots`,
// `syncReactionShieldForDualAng`) ändern das übergebene Meta-Objekt in-place.

import { chargeValueFromMarks, normalizeKrDigit } from './krDigit.js'
import { KR_ABW, KR_ANG, KR_ZAO_SLOTS } from './krMetaKeys.js'
import {
  addOneAbwTransferChargeValue,
  krTransferMarkPresent,
} from './krTransferMarks.js'
import { readKrFirstSlotKind } from './krPrimaryField.js'
import { normalizePhases } from './phaseLinks.js'

/**
 * @param {unknown} meta
 * @returns {Record<string, { kind: 'ang'|'sra'|'lh'|'uo', marks: 0|1, lodgedAbw?: true }>}
 */
export function readZaoSlots(meta) {
  const raw = meta?.[KR_ZAO_SLOTS]
  if (!raw || typeof raw !== 'object') return {}
  /** @type {Record<string, { kind: 'ang'|'sra'|'lh'|'uo', marks: 0|1, lodgedAbw?: true }>} */
  const out = {}
  for (const key of Object.keys(raw)) {
    const s = raw[key]
    if (!s || typeof s !== 'object') continue
    const kind =
      s.kind === 'uo'
        ? 'uo'
        : s.kind === 'sra' || s.kind === 'lh'
          ? s.kind
          : 'ang'
    const marks = s.marks === 1 ? 1 : 0
    const lodgedAbw =
      /** @type {{ lodgedAbw?: unknown }} */ (s).lodgedAbw === true
    out[key] = lodgedAbw ? { kind, marks, lodgedAbw: true } : { kind, marks }
  }
  return out
}

/**
 * @param {{ kind?: string, marks?: number, lodgedAbw?: boolean } | null | undefined} slot
 * @returns {'ang' | 'sra' | 'lh' | 'uo'}
 */
export function readEffectiveZaoSlotKind(slot) {
  if (!slot) return 'ang'
  if (slot.kind === 'uo' || slot.lodgedAbw === true) return 'uo'
  if (slot.kind === 'sra' || slot.kind === 'lh') return slot.kind
  return 'ang'
}

/**
 * Standard-Slot für eine n.Akt.-Wurzel (Mutter = 1, erste Wurzel = 2).
 *
 * @param {number} phaseNum
 * @returns {{ kind: 'ang' | 'uo', marks: 0 | 1, lodgedAbw?: true }}
 */
export function defaultZaoSlotForPhaseNum(phaseNum) {
  if (phaseNum >= 2) {
    return { kind: 'uo', marks: 0, lodgedAbw: true }
  }
  return { kind: 'ang', marks: 1 }
}

/**
 * @param {Record<string, unknown>} m
 * @param {{ kind?: string, lodgedAbw?: boolean } | null | undefined} slot
 */
export function applyUoDefaultAbwChargeIfNeeded(m, slot) {
  if (!m || slot?.kind !== 'uo' || slot.lodgedAbw !== true) return
  const abw = normalizeKrDigit(m[KR_ABW])
  const next = addOneAbwTransferChargeValue(abw)
  if (next !== abw) m[KR_ABW] = next
}

/**
 * Liefert den expliziten Slot-Zustand zu einem 2.A.-Link – oder `null`,
 * falls kein Eintrag im Meta vorhanden ist (z. B. L.H.-Counter-ZAO).
 *
 * @param {unknown} meta
 * @param {string} linkId
 * @returns {{ kind: 'ang'|'sra'|'lh'|'uo', marks: 0|1, lodgedAbw?: true } | null}
 */
export function readZaoSlot(meta, linkId) {
  const slots = readZaoSlots(meta)
  return slots[linkId] || null
}

/**
 * Entfernt ZAO-Slot-Einträge ohne passenden Phasen-Link.
 * @param {Record<string, unknown>} meta
 * @returns {boolean} true wenn Meta geändert wurde
 */
export function pruneOrphanZaoSlots(meta) {
  if (!meta || typeof meta !== 'object') return false
  const slots = readZaoSlots(meta)
  const keys = Object.keys(slots)
  if (keys.length === 0) return false
  const linkIds = new Set(normalizePhases(meta.phases).links.map((l) => l.id))
  /** @type {Record<string, { kind: 'ang'|'sra'|'lh'|'uo', marks: 0|1, lodgedAbw?: true }>} */
  const next = {}
  let changed = false
  for (const key of keys) {
    if (linkIds.has(key)) next[key] = slots[key]
    else changed = true
  }
  if (!changed) return false
  if (Object.keys(next).length === 0) delete meta[KR_ZAO_SLOTS]
  else meta[KR_ZAO_SLOTS] = next
  return true
}

/**
 * Mutter-Primärfeld: Angriff (ang) mit geladener Ladung.
 *
 * @param {unknown} meta
 * @returns {boolean}
 */
export function motherHasChargedAng(meta) {
  if (!meta || typeof meta !== 'object') return false
  if (readKrFirstSlotKind(meta) !== 'ang') return false
  return krTransferMarkPresent(normalizeKrDigit(meta[KR_ANG]))
}

/**
 * Reguläre 2.A.-Wurzel mit geladenem Schwert (nicht UO/lodgedAbw).
 *
 * @param {unknown} meta
 * @returns {boolean}
 */
export function hasChargedRegularZaoAng(meta) {
  if (!meta || typeof meta !== 'object') return false
  const zaoSlotsMap = readZaoSlots(meta)
  const phaseLinks = normalizePhases(meta.phases).links
  const heroExtraLinkIds = new Set(
    phaseLinks
      .filter((l) => l.parentId === null && l.heroExtra)
      .map((l) => l.id)
  )
  const lhEndLinkIds = new Set(
    phaseLinks.filter((l) => l.lhEnd === true).map((l) => l.id)
  )
  return Object.entries(zaoSlotsMap).some(([linkId, s]) => {
    if (!s || s.marks !== 1) return false
    if (heroExtraLinkIds.has(linkId)) return false
    if (lhEndLinkIds.has(linkId)) return false
    if (s.lodgedAbw === true) return false
    return s.kind === 'ang'
  })
}

/**
 * Anzahl regulaerer (kein heroExtra/lhEnd) 2.A.-Wurzeln, die eine
 * schild-verbrauchende Aktion halten (`marks===1`, nicht `lodgedAbw`): nur
 * Schwert (ang) und S.R.A. Jede solche Aktion hat genau ein Reaktions-Schild
 * aus dem Speicher gezogen; wird fuer den budget-bewussten Schild-Deckel
 * gebraucht.
 *
 * Eine L.H. (`kind:'lh'`) ist fuer die Schilde KOMPLETT NEUTRAL — wie ein
 * heroExtra-Objekt. Sie zaehlt hier NICHT mit, verbraucht also kein
 * Reaktions-Schild und senkt den Deckel nicht. So bleibt "leer einstellen ->
 * +1 Schild" auch bei eingestellter L.H. zuverlaessig moeglich.
 *
 * @param {unknown} meta
 * @returns {number}
 */
export function chargedRegularZaoActionCount(meta) {
  if (!meta || typeof meta !== 'object') return 0
  const zaoSlotsMap = readZaoSlots(meta)
  const phaseLinks = normalizePhases(meta.phases).links
  const heroExtraLinkIds = new Set(
    phaseLinks
      .filter((l) => l.parentId === null && l.heroExtra)
      .map((l) => l.id)
  )
  const lhEndLinkIds = new Set(
    phaseLinks.filter((l) => l.lhEnd === true).map((l) => l.id)
  )
  let count = 0
  for (const [linkId, s] of Object.entries(zaoSlotsMap)) {
    if (!s || s.marks !== 1) continue
    if (heroExtraLinkIds.has(linkId)) continue
    if (lhEndLinkIds.has(linkId)) continue
    if (s.lodgedAbw === true) continue
    if (s.kind === 'ang' || s.kind === 'sra') count++
  }
  return count
}

/**
 * Dual-Schwert (Mutter + 2.AO): Speicher-Schild ausblenden (kein Abw.-Transfer-Mark).
 *
 * @param {Record<string, unknown>} m
 */
export function syncReactionShieldForDualAng(m) {
  if (!m || typeof m !== 'object') return
  if (motherHasChargedAng(m) && hasChargedRegularZaoAng(m)) {
    m[KR_ABW] = chargeValueFromMarks(0)
  }
}

/**
 * Mindestens eine reguläre (nicht `heroExtra`) 2.A.-Wurzel mit voller Ladung
 * (`marks === 1`). Wird genutzt, um Abwehr→leeres Mutterfeld zu sperren, solange
 * noch eine zweite Aktion abgearbeitet werden soll.
 *
 * @param {unknown} meta
 * @returns {boolean}
 */
export function metaHasPendingLoadedNonHeroExtraZao(meta) {
  if (!meta || typeof meta !== 'object') return false
  const zaoSlotsMap = readZaoSlots(meta)
  const phaseLinksForTransfer = normalizePhases(meta.phases).links
  const heroExtraLinkIds = new Set(
    phaseLinksForTransfer
      .filter((l) => l.parentId === null && l.heroExtra)
      .map((l) => l.id)
  )
  return Object.entries(zaoSlotsMap).some(
    ([linkId, s]) => s && s.marks === 1 && !heroExtraLinkIds.has(linkId)
  )
}
