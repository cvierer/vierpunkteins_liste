/** Zentrales Kampf-/Rechenprotokoll (Anzeige im (i)-Dialog) + Undo/Redo für Trefferberechnungen. */

import { mergeKrMarks, revokeKrMarksForBlock } from './krCombatMarks.js'

/** @type {Set<() => void>} */
const listeners = new Set()

/** @type {string[]} */
const miscLines = []

/**
 * @typedef {{
 *   itemId: string,
 *   displayName: string,
 *   ts: string,
 *   lines: string[],
 *   before: unknown,
 *   after: unknown,
 *   marks?: Record<string, number> | null,
 * }} CalcBlock
 */

/** @type {CalcBlock[]} */
const calcBlocks = []

/** @type {Map<string, CalcBlock[]>} */
const redoByItem = new Map()

function notify() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function subscribeCombatLog(fn) {
  if (typeof fn !== 'function') return () => {}
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Leert Notizen und Rechenblöcke (z. B. beim neuen Kampfstart). */
export function clearCombatLog() {
  miscLines.length = 0
  calcBlocks.length = 0
  redoByItem.clear()
  notify()
}

/**
 * @param {string} line
 */
export function logCombat(line) {
  const t = String(line ?? '').trimEnd()
  if (!t) return
  miscLines.push(t)
  while (miscLines.length > 400) miscLines.shift()
  notify()
}

/**
 * @param {string} itemId
 * @param {string} displayName
 * @param {string} ts
 * @param {string[]} lines
 * @param {unknown} before — structuredClone(gather) vor Treffer
 * @param {unknown} after — structuredClone(next) nach Treffer
 * @param {Record<string, number> | null} [marks] — KR-Marken für Undo
 */
export function pushCombatCalcBlock(
  itemId,
  displayName,
  ts,
  lines,
  before,
  after,
  marks = null
) {
  calcBlocks.push({
    itemId,
    displayName,
    ts,
    lines: [...lines],
    before,
    after,
    marks: marks && typeof marks === 'object' ? { ...marks } : null,
  })
  redoByItem.delete(itemId)
  while (calcBlocks.length > 120) calcBlocks.shift()
  notify()
}

/**
 * @param {string} itemId
 * @returns {unknown | null} `before`-Snapshot zum Wiederherstellen
 */
export function undoCombatCalc(itemId) {
  for (let i = calcBlocks.length - 1; i >= 0; i--) {
    if (calcBlocks[i].itemId !== itemId) continue
    const b = calcBlocks.splice(i, 1)[0]
    const st = redoByItem.get(itemId) ?? []
    st.push(b)
    redoByItem.set(itemId, st)
    if (b.marks && typeof b.marks === 'object') {
      revokeKrMarksForBlock(itemId, b.marks)
    }
    notify()
    return b.before
  }
  return null
}

/**
 * @param {string} itemId
 * @returns {unknown | null} `after`-Snapshot zum Wiederherstellen
 */
export function redoCombatCalc(itemId) {
  const st = redoByItem.get(itemId)
  if (!st || st.length === 0) return null
  const b = st.pop()
  if (st.length === 0) redoByItem.delete(itemId)
  else redoByItem.set(itemId, st)
  calcBlocks.push(b)
  if (b.marks && typeof b.marks === 'object') {
    mergeKrMarks(itemId, b.marks)
  }
  notify()
  return b.after
}

/**
 * @param {string} itemId
 */
export function canUndoCombatCalc(itemId) {
  for (let i = calcBlocks.length - 1; i >= 0; i--) {
    if (calcBlocks[i].itemId === itemId) return true
  }
  return false
}

/**
 * @param {string} itemId
 */
export function canRedoCombatCalc(itemId) {
  return (redoByItem.get(itemId)?.length ?? 0) > 0
}

/**
 * Mehrzeiliges Protokoll für Dialog (Abschnitte, Einrückung).
 * @param {string | null} [onlyItemId] — nur Blöcke dieses Tokens; misc immer
 */
export function formatCombatLogForDisplay(onlyItemId = null) {
  const parts = []
  if (miscLines.length > 0) {
    parts.push(`[Sonst]`)
    for (const ln of miscLines) parts.push(`  ${ln}`)
    parts.push('')
  }
  for (const b of calcBlocks) {
    if (onlyItemId && b.itemId !== onlyItemId) continue
    parts.push(`[${b.ts}] ${b.displayName}`)
    for (const ln of b.lines) parts.push(`  ${ln}`)
    parts.push('')
  }
  return parts.join('\n').trimEnd()
}

/**
 * Daten für UI (Kampfprotokoll): getrennte Abschnitte, ohne before/after.
 * @param {string | null} [onlyItemId]
 */
export function getCombatLogUiSnapshot(onlyItemId = null) {
  return {
    misc: [...miscLines],
    blocks: calcBlocks
      .filter((b) => !onlyItemId || b.itemId === onlyItemId)
      .map((b) => ({
        itemId: b.itemId,
        displayName: b.displayName,
        ts: b.ts,
        lines: [...b.lines],
      })),
  }
}
