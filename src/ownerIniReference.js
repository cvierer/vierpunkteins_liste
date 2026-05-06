import { computeIniFromIbBeW6 } from './iniCompute.js'

/** Gleiche Tracker-Meta-Schlüssel wie `HERO_EX_*` in iniModMeta (zyklusfrei). */
const META_IB = 'heroExIb'
const META_BE = 'heroExBe'
const META_W6 = 'heroExW6'

/**
 * Referenz-INI für Helden-Mods (Ticks, Restlaufzeit, Delta-Kontext):
 * zuerst IB − BE + W6 wenn alle Felder gültig, sonst gespeicherte Listen-INI.
 *
 * @param {Record<string, unknown> | undefined} meta — Tracker-Item-Meta
 * @returns {number | null}
 */
export function readOwnerIniReferenceForMods(meta) {
  const ib = meta?.[META_IB]
  const be = meta?.[META_BE]
  const w6 = meta?.[META_W6]
  const fromIb = computeIniFromIbBeW6(ib, be, w6)
  if (fromIb != null && Number.isFinite(fromIb)) return fromIb
  const raw = String(meta?.initiative ?? '')
    .trim()
    .replace(',', '.')
  const fallback = Number(raw)
  return Number.isFinite(fallback) ? fallback : null
}
