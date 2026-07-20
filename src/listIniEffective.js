/**
 * Effektive Listen-INI (= Anzeige im INI-Feld): Rohwert + IB-Mods.
 * Zyklussicher von participants getrennt (heroExMods → participants).
 */

import { effectiveAdjustmentForField } from './heroExMods.js'
import { formatHookDisplay, parseIniNumber } from './initiativeListIniDrag.js'
import { readOwnerIniReferenceForMods } from './ownerIniReference.js'

/**
 * @param {Record<string, unknown> | undefined} meta
 * @param {string} storedIni
 * @param {number | null | undefined} round
 * @param {number | null | undefined} navIni
 * @returns {string}
 */
export function effectiveListInitiativeString(meta, storedIni, round, navIni) {
  const stored = String(storedIni ?? '')
  const ownerIniRef = readOwnerIniReferenceForMods(meta)
  if (ownerIniRef == null) return stored
  const p = parseIniNumber(stored)
  if (p === null) return stored
  const d = effectiveAdjustmentForField(
    meta,
    'ib',
    p,
    ownerIniRef,
    round ?? null,
    navIni ?? null
  )
  if (!Number.isFinite(d) || d === 0) return stored
  return formatHookDisplay(p + d)
}
