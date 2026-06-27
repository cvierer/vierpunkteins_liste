import OBR from '@owlbear-rodeo/sdk'
import { isGmSync } from './editAccess.js'
import {
  clearEphemeralExtraIniRows,
  pullFullIniTieOrderFromRoom,
  pullZaoRootTieOrderFromRoom,
} from './phaseLinks.js'
import { pullRoomSettingsFromRoom } from './roomSettings.js'
import {
  collectSortedParticipants,
  INI_TIE_ORDER_KEY as INI_TIE_ORDER_KEY_PARTICIPANTS,
} from './participants.js'
import {
  compareInitiativeRowsWithTieOrder,
  initiativeCompareOnlyIni,
} from './initiativeSort.js'
import {
  getManualIniTieOverridePairs,
  pullManualIniTieOverridesFromRoom,
} from './manualIniTieOverrides.js'

const ID = 'vierpunkteins_kampf.tracker'
export const COMBAT_KEY = `${ID}/combat`
export const INI_TIE_ORDER_KEY = INI_TIE_ORDER_KEY_PARTICIPANTS
export const ACTION_STAMPS_KEY = `${ID}/actionStamps`
/** Batches von Stempel-Snapshots nach „Rückgängig“ pro INI-Schritt (LIFO). */
const COMBAT_ACTION_REDO_KEY = `${ID}/combatActionRedo`

const listeners = new Set()
const tieListeners = new Set()

function defaultCombat() {
  return {
    started: false,
    round: 1,
    currentItemId: null,
    currentPhaseLinkId: null,
    currentTurnSubStep: null,
    roundIntroPending: false,
    roundIntroPrevRound: null,
    roundIntroPrevItemId: null,
    roundIntroPrevPhaseLinkId: null,
  }
}

/** Felder zurücksetzen, wenn Runden-Zwischenbildschirm nicht aktiv sein soll. */
export const RESET_ROUND_INTRO = Object.freeze({
  roundIntroPending: false,
  roundIntroPrevRound: null,
  roundIntroPrevItemId: null,
  roundIntroPrevPhaseLinkId: null,
  currentTurnSubStep: null,
})

/** @param {unknown} raw */
export function normalizeCombat(raw) {
  const d = defaultCombat()
  if (!raw || typeof raw !== 'object') return d
  const pr =
    typeof raw.roundIntroPrevRound === 'number' &&
    Number.isFinite(raw.roundIntroPrevRound)
      ? Math.max(1, Math.floor(raw.roundIntroPrevRound))
      : null
  const subRaw = raw.currentTurnSubStep
  const currentTurnSubStep =
    subRaw === 'reaction' ? 'reaction' : subRaw === 'action' ? 'action' : null
  return {
    started: Boolean(raw.started),
    round: Math.max(1, Math.floor(Number(raw.round)) || 1),
    currentItemId:
      typeof raw.currentItemId === 'string' ? raw.currentItemId : null,
    currentPhaseLinkId:
      typeof raw.currentPhaseLinkId === 'string'
        ? raw.currentPhaseLinkId
        : null,
    currentTurnSubStep,
    roundIntroPending: Boolean(raw.roundIntroPending),
    roundIntroPrevRound: pr,
    roundIntroPrevItemId:
      typeof raw.roundIntroPrevItemId === 'string'
        ? raw.roundIntroPrevItemId
        : null,
    roundIntroPrevPhaseLinkId:
      typeof raw.roundIntroPrevPhaseLinkId === 'string'
        ? raw.roundIntroPrevPhaseLinkId
        : null,
  }
}

const normalize = normalizeCombat

let cache = defaultCombat()
let tieOrderCache = []
let actionStampsCache = { anchorId: null, entries: [] }
let combatActionRedoCache = { batches: [] }

function defaultCombatActionRedo() {
  return { batches: [] }
}

/**
 * @param {unknown} raw
 * @returns {{ batches: Array<{ round: number, currentItemId: string, currentPhaseLinkId: string | null, stamps: object[] }> }}
 */
function normalizeCombatActionRedo(raw) {
  const out = defaultCombatActionRedo()
  if (!raw || typeof raw !== 'object') return out
  const br = Array.isArray(raw.batches) ? raw.batches : []
  for (const b of br) {
    if (!b || typeof b !== 'object') continue
    const round = Math.max(1, Math.floor(Number(b.round)) || 1)
    const currentItemId =
      typeof b.currentItemId === 'string' ? b.currentItemId : null
    if (!currentItemId) continue
    const currentPhaseLinkId =
      typeof b.currentPhaseLinkId === 'string' ? b.currentPhaseLinkId : null
    const stampsRaw = Array.isArray(b.stamps) ? b.stamps : []
    const stamps = []
    for (const s of stampsRaw) {
      if (!s || typeof s !== 'object') continue
      const id = typeof s.id === 'string' ? s.id : null
      const itemId = typeof s.itemId === 'string' ? s.itemId : null
      const field = typeof s.field === 'string' ? s.field : null
      if (!id || !itemId || !field) continue
      stamps.push(s)
    }
    if (stamps.length === 0) continue
    out.batches.push({
      round,
      currentItemId,
      currentPhaseLinkId,
      stamps,
    })
  }
  return out
}

/** Bei Runden+1 während ephemerer 2.A.-Entfernung vor Raum-Metadaten: reconcile nicht gegen alte KR patchen. */
let combatNavMutationDepth = 0

export function beginCombatNavMutation() {
  combatNavMutationDepth++
}

export function endCombatNavMutation() {
  combatNavMutationDepth = Math.max(0, combatNavMutationDepth - 1)
}

export function isCombatNavMutationActive() {
  return combatNavMutationDepth > 0
}

/**
 * Während Undo/Redo mehrere `patchActionStamps`-Aufrufe hintereinander:
 * Redo-Stack nicht nach dem ersten Aufruf leeren.
 */
let suppressStampRedoClearDepth = 0

export function beginSuppressStampRedoClear() {
  suppressStampRedoClearDepth++
}

export function endSuppressStampRedoClear() {
  suppressStampRedoClearDepth = Math.max(0, suppressStampRedoClearDepth - 1)
}

function notify() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

function notifyTie() {
  for (const fn of tieListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function getCombat() {
  return cache
}

export function onCombatChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getIniTieOrder() {
  return tieOrderCache
}

export function getActionStamps() {
  return actionStampsCache
}

export function onIniTieOrderChange(fn) {
  tieListeners.add(fn)
  return () => tieListeners.delete(fn)
}

async function pullFromRoom() {
  const meta = await OBR.room.getMetadata()
  const next = normalize(meta[COMBAT_KEY])
  const same =
    next.started === cache.started &&
    next.round === cache.round &&
    next.currentItemId === cache.currentItemId &&
    next.currentPhaseLinkId === cache.currentPhaseLinkId &&
    next.currentTurnSubStep === cache.currentTurnSubStep &&
    next.roundIntroPending === cache.roundIntroPending &&
    next.roundIntroPrevRound === cache.roundIntroPrevRound &&
    next.roundIntroPrevItemId === cache.roundIntroPrevItemId &&
    next.roundIntroPrevPhaseLinkId === cache.roundIntroPrevPhaseLinkId
  if (same) return
  cache = next
  notify()
}

async function pullIniTieOrderFromRoom() {
  const meta = await OBR.room.getMetadata()
  const raw = meta[INI_TIE_ORDER_KEY]
  const next = Array.isArray(raw)
    ? raw.filter((id) => typeof id === 'string')
    : []
  const same =
    next.length === tieOrderCache.length &&
    next.every((id, i) => id === tieOrderCache[i])
  if (same) return
  tieOrderCache = next
  notifyTie()
}

function normalizeActionStampEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' ? raw.id : null
  const itemId = typeof raw.itemId === 'string' ? raw.itemId : null
  const ownerName = typeof raw.ownerName === 'string' ? raw.ownerName : ''
  const field = typeof raw.field === 'string' ? raw.field : null
  if (!id || !itemId || !field) return null
  const anchorRowId =
    typeof raw.anchorRowId === 'string' ? raw.anchorRowId : null
  const anchorPhaseLinkId =
    typeof raw.anchorPhaseLinkId === 'string' ? raw.anchorPhaseLinkId : null
  const zaoLinkId =
    typeof raw.zaoLinkId === 'string' ? raw.zaoLinkId : null
  const paradeExtra = raw.paradeExtra === true
  const abwFromSplit = raw.abwFromSplit === true
  const heroExtraStamp = raw.heroExtraStamp === true
  const paradeExtraSlotRaw = raw.paradeExtraSlot
  const paradeExtraSlot =
    paradeExtra &&
    paradeExtraSlotRaw != null &&
    Number.isFinite(Number(paradeExtraSlotRaw))
      ? Math.max(0, Math.floor(Number(paradeExtraSlotRaw)))
      : undefined
  return {
    id,
    itemId,
    ownerName,
    field,
    anchorRowId,
    anchorPhaseLinkId,
    zaoLinkId,
    paradeExtra,
    paradeExtraSlot,
    abwFromSplit,
    heroExtraStamp,
  }
}

export function normalizeActionStamps(raw) {
  const anchorId = typeof raw?.anchorId === 'string' ? raw.anchorId : null
  const entriesRaw = Array.isArray(raw?.entries) ? raw.entries : []
  const entries = []
  for (const r of entriesRaw) {
    const e = normalizeActionStampEntry(r)
    if (e) entries.push(e)
  }
  return { anchorId, entries }
}

async function pullActionStampsFromRoom() {
  const meta = await OBR.room.getMetadata()
  const next = normalizeActionStamps(meta[ACTION_STAMPS_KEY])
  const same =
    actionStampsCache.anchorId === next.anchorId &&
    actionStampsCache.entries.length === next.entries.length &&
    actionStampsCache.entries.every(
      (e, i) =>
        e.id === next.entries[i].id &&
        e.itemId === next.entries[i].itemId &&
        e.ownerName === next.entries[i].ownerName &&
        e.field === next.entries[i].field &&
        e.anchorRowId === next.entries[i].anchorRowId &&
        e.anchorPhaseLinkId === next.entries[i].anchorPhaseLinkId &&
        e.zaoLinkId === next.entries[i].zaoLinkId &&
        e.paradeExtra === next.entries[i].paradeExtra &&
        e.paradeExtraSlot === next.entries[i].paradeExtraSlot &&
        e.abwFromSplit === next.entries[i].abwFromSplit &&
        e.heroExtraStamp === next.entries[i].heroExtraStamp
    )
  if (same) return
  actionStampsCache = next
  notify()
}

export async function patchActionStamps(mutator, opts = {}) {
  const skipGmCheck = Boolean(opts.skipGmCheck)
  if (!skipGmCheck && !isGmSync()) return
  const meta = await OBR.room.getMetadata()
  const cur = normalizeActionStamps(meta[ACTION_STAMPS_KEY])
  const proposed = mutator(cur)
  const next = normalizeActionStamps(proposed)
  const patch = { [ACTION_STAMPS_KEY]: next }
  const shouldClearRedo =
    !opts.fromRedo && suppressStampRedoClearDepth === 0
  if (shouldClearRedo) {
    patch[COMBAT_ACTION_REDO_KEY] = defaultCombatActionRedo()
  }
  await OBR.room.setMetadata(patch)
  await pullActionStampsFromRoom()
  if (shouldClearRedo) {
    await pullCombatActionRedoFromRoom()
  }
}

async function pullCombatActionRedoFromRoom() {
  const meta = await OBR.room.getMetadata()
  const next = normalizeCombatActionRedo(meta[COMBAT_ACTION_REDO_KEY])
  const same =
    combatActionRedoCache.batches.length === next.batches.length &&
    combatActionRedoCache.batches.every((b, i) => {
      const o = next.batches[i]
      if (!o) return false
      if (
        b.round !== o.round ||
        b.currentItemId !== o.currentItemId ||
        b.currentPhaseLinkId !== o.currentPhaseLinkId ||
        b.stamps.length !== o.stamps.length
      ) {
        return false
      }
      return b.stamps.every(
        (s, j) => JSON.stringify(s) === JSON.stringify(o.stamps[j])
      )
    })
  if (same) return
  combatActionRedoCache = next
  notify()
}

/**
 * @param {(cur: { batches: object[] }) => { batches: object[] }} mutator
 */
export async function patchCombatActionRedo(mutator) {
  if (!isGmSync()) return
  const meta = await OBR.room.getMetadata()
  const cur = normalizeCombatActionRedo(meta[COMBAT_ACTION_REDO_KEY])
  const next = normalizeCombatActionRedo(mutator(cur))
  await OBR.room.setMetadata({ [COMBAT_ACTION_REDO_KEY]: next })
  await pullCombatActionRedoFromRoom()
}

function ensureFullTieOrder(existing, sortedIds) {
  const allowed = new Set(sortedIds)
  const out = existing.filter((id) => allowed.has(id))
  const seen = new Set(out)
  for (const id of sortedIds) {
    if (!seen.has(id)) {
      out.push(id)
      seen.add(id)
    }
  }
  return out
}

function orderRespectsIniAndTie(orderIds, rowMap) {
  const overridePairs = getManualIniTieOverridePairs()
  const opts = overridePairs && overridePairs.size > 0 ? { overridePairs } : null
  for (let i = 0; i < orderIds.length - 1; i++) {
    const a = rowMap.get(orderIds[i])
    const b = rowMap.get(orderIds[i + 1])
    if (!a || !b) return false
    if (compareInitiativeRowsWithTieOrder(a, b, orderIds, opts) > 0) return false
  }
  return true
}

/**
 * Für Drag&Drop: erlaubte Einfüge-Indizes (0 = vor erstem Token, length = nach letztem),
 * wenn `dragId` dort eingefügt wird und die INI-Reihenfolge erhalten bleibt.
 */
export function computeValidIniTieInsertSlots(dragId, items) {
  const sortedRows = collectSortedParticipants(
    items,
    tieOrderCache,
    getManualIniTieOverridePairs()
  )
  const sortedIds = sortedRows.map((r) => r.id)
  if (!sortedIds.includes(dragId))
    return { validSlots: [], sortedIds, without: [] }
  const without = sortedIds.filter((id) => id !== dragId)
  const rowMap = new Map(sortedRows.map((r) => [r.id, r]))
  const validSlots = []
  for (let slot = 0; slot <= without.length; slot++) {
    const next = [...without.slice(0, slot), dragId, ...without.slice(slot)]
    if (orderRespectsIniAndTie(next, rowMap)) validSlots.push(slot)
  }
  return { validSlots, sortedIds, without }
}

/**
 * Token in der Listenreihenfolge verschieben (nur wenn INI-Rang gültig bleibt;
 * gleiche INI = manuelle Reihenfolge über Raum-Metadaten).
 */
export async function reorderIniTieToken(dragId, insertBeforeIndex, items) {
  if (!isGmSync()) return
  const sortedRows = collectSortedParticipants(
    items,
    tieOrderCache,
    getManualIniTieOverridePairs()
  )
  const sortedIds = sortedRows.map((r) => r.id)
  if (!sortedIds.includes(dragId)) return
  const without = sortedIds.filter((id) => id !== dragId)
  const slot = Math.max(0, Math.min(insertBeforeIndex, without.length))
  const next = [...without.slice(0, slot), dragId, ...without.slice(slot)]
  const rowMap = new Map(sortedRows.map((r) => [r.id, r]))
  if (!orderRespectsIniAndTie(next, rowMap)) return
  if (next.length === sortedIds.length && next.every((id, i) => id === sortedIds[i]))
    return
  const order = ensureFullTieOrder(next, sortedIds)
  await OBR.room.setMetadata({ [INI_TIE_ORDER_KEY]: order })
  await pullIniTieOrderFromRoom()
}

/**
 * Zwei in der Liste direkt aufeinanderfolgende Token mit gleicher INI tauschen.
 * `upperId` muss der obere (zuerst agierende) Eintrag sein, `lowerId` der nächste.
 */
export async function swapAdjacentIniTiePair(upperId, lowerId, items) {
  if (!isGmSync()) return
  const sortedRows = collectSortedParticipants(
    items,
    tieOrderCache,
    getManualIniTieOverridePairs()
  )
  const sortedIds = sortedRows.map((r) => r.id)
  const i = sortedIds.indexOf(upperId)
  if (i < 0 || sortedIds[i + 1] !== lowerId) return
  const a = sortedRows[i]
  const b = sortedRows[i + 1]
  if (initiativeCompareOnlyIni(a, b) !== 0) return
  const next = [
    ...sortedIds.slice(0, i),
    lowerId,
    upperId,
    ...sortedIds.slice(i + 2),
  ]
  const rowMap = new Map(sortedRows.map((r) => [r.id, r]))
  if (!orderRespectsIniAndTie(next, rowMap)) return
  const order = ensureFullTieOrder(next, sortedIds)
  await OBR.room.setMetadata({ [INI_TIE_ORDER_KEY]: order })
  await pullIniTieOrderFromRoom()
}

export async function initCombatRoom() {
  await pullFromRoom()
  await pullIniTieOrderFromRoom()
  await pullZaoRootTieOrderFromRoom()
  await pullFullIniTieOrderFromRoom()
  await pullActionStampsFromRoom()
  await pullCombatActionRedoFromRoom()
  await pullRoomSettingsFromRoom()
  await pullManualIniTieOverridesFromRoom()
  return OBR.room.onMetadataChange(() => {
    void pullFromRoom()
    void pullIniTieOrderFromRoom()
    void pullZaoRootTieOrderFromRoom()
    void pullFullIniTieOrderFromRoom()
    void pullActionStampsFromRoom()
    void pullCombatActionRedoFromRoom()
    void pullRoomSettingsFromRoom()
    void pullManualIniTieOverridesFromRoom()
  })
}

export async function patchCombat(partial) {
  const prevRound = cache.round
  const merged = { ...cache, ...partial }
  if (
    partial.currentPhaseLinkId === undefined &&
    partial.currentItemId !== undefined &&
    partial.currentItemId !== cache.currentItemId
  ) {
    merged.currentPhaseLinkId = null
  }
  const next = normalize(merged)
  const roundIncreased = next.started && next.round > prevRound

  if (roundIncreased) {
    beginCombatNavMutation()
  }
  try {
    if (roundIncreased) {
      await clearEphemeralExtraIniRows()
    }
    await OBR.room.setMetadata({ [COMBAT_KEY]: next })
    await pullFromRoom()
  } finally {
    if (roundIncreased) {
      endCombatNavMutation()
    }
  }
}
