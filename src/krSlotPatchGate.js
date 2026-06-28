/** Während Primär-Slot-Patches: vollen renderList-Lauf unterdrücken/debouncen. */

let suppressDepth = 0
/** @type {() => boolean} */
let switchSessionActiveGuard = () => false
/** @type {import('@owlbear-rodeo/sdk').Item[] | null | undefined} */
let pendingDeferredItems = undefined
/** @type {((items: import('@owlbear-rodeo/sdk').Item[] | undefined) => void) | null} */
let onFlushDeferredRender = null
/** @type {ReturnType<typeof setTimeout> | null} */
let flushTimer = null
const DEFERRED_RENDER_MS = 200

/**
 * @param {() => boolean} fn
 */
export function registerKrSwitchSessionActiveGuard(fn) {
  switchSessionActiveGuard = fn
}

function shouldBlockDeferredRenderFlush() {
  return suppressDepth > 0
}

/**
 * @param {(items: import('@owlbear-rodeo/sdk').Item[] | undefined) => void} fn
 */
export function registerKrSlotPatchRenderFlush(fn) {
  onFlushDeferredRender = fn
}

export function isKrSlotPatchSuppressingRenderList() {
  return suppressDepth > 0
}

/** @param {import('@owlbear-rodeo/sdk').Item[] | null | undefined} items */
export function noteDeferredRenderListItems(items) {
  if (items != null) pendingDeferredItems = items
}

/**
 * Bevorzugt pro Token die lokal gepatchten Items (z. B. nach Slot-Kind-Wechsel).
 *
 * @param {import('@owlbear-rodeo/sdk').Item[] | null | undefined} pending
 * @param {import('@owlbear-rodeo/sdk').Item[] | null | undefined} lastItems
 * @returns {import('@owlbear-rodeo/sdk').Item[] | undefined}
 */
export function mergeDeferredRenderItems(pending, lastItems) {
  if (pending == null) return lastItems ?? undefined
  if (lastItems == null) return pending
  const lastById = new Map(lastItems.map((item) => [item.id, item]))
  return pending.map((item) => lastById.get(item.id) ?? item)
}

function flushDeferredRenderNow() {
  if (shouldBlockDeferredRenderFlush()) return
  const items = pendingDeferredItems
  pendingDeferredItems = undefined
  onFlushDeferredRender?.(items)
}

export function scheduleKrSlotPatchRenderFlush() {
  if (shouldBlockDeferredRenderFlush()) return
  // Laeuft bereits ein Flush-Timer, NICHT zuruecksetzen: bei schnell
  // aufeinanderfolgenden Suppress-Zyklen (z. B. wiederholte Primaer-Slot-
  // Patches waehrend eine L.H. eingestellt ist) wuerde ein Reset den Timer
  // immer wieder verschieben und den verzoegerten Render aushungern — dann
  // bleiben Reaktions-/F.A.-Stempel unsichtbar bis zum naechsten Force-Render.
  if (flushTimer != null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushDeferredRenderNow()
  }, DEFERRED_RENDER_MS)
}

/** Sofortiger Flush ohne Debounce (z. B. nach Primär-Switch-Session). */
export function flushKrSlotPatchRenderNow() {
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  flushDeferredRenderNow()
}

/** Flush erzwingen — ignoriert Session-Guard, wartet nur auf laufenden OBR-Patch. */
export function forceKrSlotPatchRenderNow() {
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (suppressDepth > 0) return
  const items = pendingDeferredItems
  pendingDeferredItems = undefined
  onFlushDeferredRender?.(items)
}

/**
 * @template T
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function runWithKrSlotPatchSuppressed(fn) {
  suppressDepth++
  try {
    return await fn()
  } finally {
    suppressDepth--
    if (suppressDepth === 0) {
      scheduleKrSlotPatchRenderFlush()
    }
  }
}

/** @type {((itemId: string, linkId: string | null, kind: string) => void) | null} */
let onKrSlotKindPatched = null

/**
 * @param {(itemId: string, linkId: string | null, kind: string) => void} fn
 */
export function registerKrSlotKindPatched(fn) {
  onKrSlotKindPatched = fn
}

/** @param {string} itemId @param {string | null} linkId @param {string} kind */
export function notifyKrSlotKindPatched(itemId, linkId, kind) {
  onKrSlotKindPatched?.(itemId, linkId, kind)
}
