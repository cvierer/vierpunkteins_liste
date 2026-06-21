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
  return suppressDepth > 0 || switchSessionActiveGuard()
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

function flushDeferredRenderNow() {
  if (shouldBlockDeferredRenderFlush()) return
  const items = pendingDeferredItems
  pendingDeferredItems = undefined
  onFlushDeferredRender?.(items)
}

export function scheduleKrSlotPatchRenderFlush() {
  if (shouldBlockDeferredRenderFlush()) return
  if (flushTimer != null) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushDeferredRenderNow()
  }, DEFERRED_RENDER_MS)
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
