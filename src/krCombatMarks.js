/**
 * Markiert Felder, die in einer Kampfrunde rechnerisch gesunken sind (rot bis KR+1).
 * Pro Token, SessionStorage (kein Szene-Meta).
 */
const STORAGE_KEY = 'vierpunkteins_kr_field_marks_v1'

/** Kurzzeitiger Negativ-Flash im ausklappbaren Heldenblock (`iniModMeta.js`). */
const FLASH_NEG_HERO_KEY = 'vierpunkteins_kampf_flash_neg'

/**
 * Leert KR-Feldmarkierungen und Treffer-Flash im SessionStorage.
 * Beim **Kampfstart** aufrufen, damit kein „dunkelrot“ von der vorigen
 * Kampfrunde (z. B. gleiche KR 1) im Heldenblock hängen bleibt.
 */
export function clearCombatStartHeroSessionVisuals() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(FLASH_NEG_HERO_KEY)
  } catch {
    /* ignore */
  }
}

/** @returns {Record<string, Record<string, number>>} */
function readAll() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function writeAll(all) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

/**
 * @param {number} currentRound — aktuelle KR (≥1)
 */
export function purgeKrMarksBeforeRound(currentRound) {
  const all = readAll()
  let changed = false
  for (const itemId of Object.keys(all)) {
    const o = all[itemId]
    if (!o || typeof o !== 'object') {
      delete all[itemId]
      changed = true
      continue
    }
    for (const f of Object.keys(o)) {
      const mr = o[f]
      if (typeof mr !== 'number' || !Number.isFinite(mr) || currentRound > mr) {
        delete o[f]
        changed = true
      }
    }
    if (Object.keys(o).length === 0) {
      delete all[itemId]
      changed = true
    }
  }
  if (changed) writeAll(all)
}

/**
 * @param {string} itemId
 * @param {Record<string, number>} marks — Feld → KR, in der die Senkung erfolgte
 */
export function mergeKrMarks(itemId, marks) {
  if (!itemId || !marks || typeof marks !== 'object') return
  const all = readAll()
  const prev = all[itemId] && typeof all[itemId] === 'object' ? { ...all[itemId] } : {}
  all[itemId] = { ...prev, ...marks }
  writeAll(all)
}

/**
 * @param {string} itemId
 * @returns {Record<string, number>}
 */
export function getKrMarks(itemId) {
  const all = readAll()
  const o = all[itemId]
  return o && typeof o === 'object' ? { ...o } : {}
}

/**
 * @param {string} itemId
 * @param {string} field
 * @param {number | null | undefined} currentRound
 */
export function krMarkActive(itemId, field, currentRound) {
  if (!itemId || !field || currentRound == null || !Number.isFinite(currentRound)) {
    return false
  }
  const m = getKrMarks(itemId)[field]
  return typeof m === 'number' && Number.isFinite(m) && m === currentRound
}

/** Alle Markierungen für ein Token löschen (z. B. nach Undo einer Trefferberechnung). */
export function clearKrMarksItem(itemId) {
  if (!itemId) return
  const all = readAll()
  if (!all[itemId]) return
  delete all[itemId]
  writeAll(all)
}

/**
 * Markierungen entfernen, die exakt zu einem Treffer-Block gehören (Undo).
 * @param {string} itemId
 * @param {Record<string, number>} marks — wie bei `mergeKrMarks`
 */
export function revokeKrMarksForBlock(itemId, marks) {
  if (!itemId || !marks || typeof marks !== 'object') return
  const all = readAll()
  const prev = all[itemId]
  if (!prev || typeof prev !== 'object') return
  let changed = false
  for (const [k, v] of Object.entries(marks)) {
    if (prev[k] === v) {
      delete prev[k]
      changed = true
    }
  }
  if (!changed) return
  if (Object.keys(prev).length === 0) delete all[itemId]
  else all[itemId] = prev
  writeAll(all)
}
