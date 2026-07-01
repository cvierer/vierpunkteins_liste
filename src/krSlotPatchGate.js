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
 * Bevorzugt den frisch von OBR gelesenen State (`pending`) pro Token-ID.
 * `lastItems` dient nur als Fallback fuer Token-IDs, die in `pending` fehlen
 * (z. B. voruebergehende Loecher beim Re-Sync). Frueher war das umgedreht — was
 * jeden Patch nach einer Suppress-Welle (eingestellte L.H., laufende Switch-
 * Session, L.H.-Commit) wieder auf den Vor-Patch-Stand revertierte und Stempel,
 * Slot-Kinds, L.H.-Feld am 2.AO sowie Nav-Highlight bis zur naechsten Navigation
 * unsichtbar/falsch machte.
 *
 * @param {import('@owlbear-rodeo/sdk').Item[] | null | undefined} pending
 * @param {import('@owlbear-rodeo/sdk').Item[] | null | undefined} lastItems
 * @returns {import('@owlbear-rodeo/sdk').Item[] | undefined}
 */
export function mergeDeferredRenderItems(pending, lastItems) {
  if (pending == null) return lastItems ?? undefined
  if (lastItems == null) return pending
  const freshIds = new Set(pending.map((item) => item.id))
  const fallback = lastItems.filter((item) => !freshIds.has(item.id))
  return fallback.length === 0 ? pending : pending.concat(fallback)
}

function scheduleDeferredRenderRetry() {
  if (flushTimer != null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushDeferredRenderNow()
  }, DEFERRED_RENDER_MS)
}

function flushDeferredRenderNow() {
  if (shouldBlockDeferredRenderFlush()) {
    scheduleDeferredRenderRetry()
    return
  }
  const items = pendingDeferredItems
  pendingDeferredItems = undefined
  onFlushDeferredRender?.(items)
}

export function scheduleKrSlotPatchRenderFlush() {
  scheduleDeferredRenderRetry()
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
