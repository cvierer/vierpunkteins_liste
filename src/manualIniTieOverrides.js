import OBR from '@owlbear-rodeo/sdk'
import { isGmSync } from './editAccess.js'
import { TRACKER_ID } from './participants.js'

/**
 * Manuelle Override-Reihenfolge bei INI-Gleichstand. Pro Heldenpaar (kanonisch
 * sortierter Schlüssel `idA|idB`) wird ein Eintrag gespeichert. Für jedes
 * Heldenpaar in dieser Liste wird die Standard-IB-Sortierung übergangen — die
 * zuletzt über die Reihenfolge-Tausch-Pfeile (oder per Drag&Drop) festgelegte
 * Reihenfolge gilt dann ab dann für alle weiteren Kampfrunden.
 */
const MANUAL_INI_TIE_OVERRIDE_KEY = `${TRACKER_ID}/manualIniTieOverridePairs`

/** @type {Set<string>} */
let cache = new Set()
const listeners = new Set()

function notify() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

/** Kanonisch sortierter Pair-Key oder `null`, wenn ungültig. */
export function manualIniTiePairKey(idA, idB) {
  if (typeof idA !== 'string' || typeof idB !== 'string') return null
  if (idA === '' || idB === '' || idA === idB) return null
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`
}

export function getManualIniTieOverridePairs() {
  return cache
}

export function onManualIniTieOverridesChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function normalizePairsRaw(raw) {
  if (!Array.isArray(raw)) return new Set()
  const out = new Set()
  for (const v of raw) {
    if (typeof v !== 'string' || v === '') continue
    const i = v.indexOf('|')
    if (i <= 0 || i === v.length - 1) continue
    const a = v.slice(0, i)
    const b = v.slice(i + 1)
    const k = manualIniTiePairKey(a, b)
    if (k) out.add(k)
  }
  return out
}

export async function pullManualIniTieOverridesFromRoom() {
  const meta = await OBR.room.getMetadata()
  const next = normalizePairsRaw(meta[MANUAL_INI_TIE_OVERRIDE_KEY])
  if (setsEqual(cache, next)) return
  cache = next
  notify()
}

/**
 * Fügt das Heldenpaar (Token-IDs) als manuelle Override-Reihenfolge hinzu.
 * No-op wenn Pair bereits gesetzt oder einer der Werte ungültig ist.
 * Nur SL.
 */
export async function addManualIniTieOverridePair(idA, idB) {
  if (!isGmSync()) return
  const k = manualIniTiePairKey(idA, idB)
  if (!k) return
  const meta = await OBR.room.getMetadata()
  const cur = normalizePairsRaw(meta[MANUAL_INI_TIE_OVERRIDE_KEY])
  if (cur.has(k)) return
  cur.add(k)
  await OBR.room.setMetadata({
    [MANUAL_INI_TIE_OVERRIDE_KEY]: [...cur].sort(),
  })
  await pullManualIniTieOverridesFromRoom()
}
