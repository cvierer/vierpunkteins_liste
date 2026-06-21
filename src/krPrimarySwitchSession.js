import {
  KR_FIRST_SLOT_KIND,
  KR_ZAO_SLOTS,
  cycleKrPrimarySlotKind,
  isKrPrimarySlotIniLocked,
  readKrFirstSlotKind,
  readZaoSlots,
} from './krCounters.js'
import {
  registerKrSwitchSessionActiveGuard,
  scheduleKrSlotPatchRenderFlush,
} from './krSlotPatchGate.js'

/** @typedef {'ang' | 'sra' | 'lh' | 'uo'} KrPrimaryKind */

/**
 * @typedef {{
 *   itemId: string,
 *   linkId: string | null,
 *   dirs: ('next' | 'prev')[],
 *   targetKind: KrPrimaryKind,
 *   rollingMeta: Record<string, unknown>,
 *   processing: boolean,
 *   syncFn: ((targetKind: KrPrimaryKind, rollingMeta: unknown) => void) | null,
 * }} KrPrimarySwitchSession
 */

/** @type {Map<string, KrPrimarySwitchSession>} */
const sessions = new Map()

/**
 * @param {string} itemId
 * @param {string | null | undefined} linkId
 */
export function getKrPrimarySwitchSessionKey(itemId, linkId) {
  return `${itemId}:${linkId ?? 'main'}`
}

/** @param {string} key */
export function getKrPrimarySwitchSession(key) {
  return sessions.get(key) ?? null
}

export function hasActiveKrPrimarySwitchSessions() {
  for (const session of sessions.values()) {
    if (session.processing || session.dirs.length > 0) return true
  }
  return false
}

/** @param {string} key */
export function clearKrPrimarySwitchSession(key) {
  sessions.delete(key)
}

/**
 * @param {unknown} baseMeta
 * @param {KrPrimaryKind} kind
 * @param {string | null} linkId
 */
function patchMetaForKind(baseMeta, kind, linkId) {
  const m = { ...(/** @type {Record<string, unknown>} */ (baseMeta || {})) }
  if (typeof linkId === 'string' && linkId.length > 0) {
    const slots = { ...readZaoSlots(m) }
    const prev = slots[linkId] || {
      kind: readKrFirstSlotKind(m),
      marks: 1,
    }
    slots[linkId] = { ...prev, kind }
    m[KR_ZAO_SLOTS] = slots
  } else {
    m[KR_FIRST_SLOT_KIND] = kind
  }
  return m
}

/** @param {KrPrimarySwitchSession} session */
function notifySessionSync(session) {
  session.syncFn?.(session.targetKind, session.rollingMeta)
}

/**
 * @param {string} key
 * @param {'next' | 'prev'} dir
 * @param {{
 *   itemId: string,
 *   linkId: string | null,
 *   startKind: KrPrimaryKind,
 *   baseMeta: unknown,
 *   canConvertToUo: boolean,
 * }} opts
 * @returns {{ targetKind: KrPrimaryKind, rollingMeta: Record<string, unknown> } | null}
 */
export function enqueueKrPrimarySwitchStep(key, dir, opts) {
  const { itemId, linkId, startKind, baseMeta, canConvertToUo } = opts
  let session = sessions.get(key)
  if (!session) {
    session = {
      itemId,
      linkId,
      dirs: [],
      targetKind: startKind,
      rollingMeta: { ...(/** @type {Record<string, unknown>} */ (baseMeta || {})) },
      processing: false,
      syncFn: null,
    }
    sessions.set(key, session)
  }

  const currentKind = session.targetKind
  const iniLocked = isKrPrimarySlotIniLocked(session.rollingMeta, linkId)
  const nextKind = cycleKrPrimarySlotKind(currentKind, dir, iniLocked)
  if (nextKind === 'uo' && !canConvertToUo) return null

  session.targetKind = nextKind
  session.rollingMeta = patchMetaForKind(session.rollingMeta, nextKind, linkId)
  session.dirs.push(dir)
  notifySessionSync(session)
  return { targetKind: nextKind, rollingMeta: session.rollingMeta }
}

/**
 * @param {string} key
 * @param {(targetKind: KrPrimaryKind, rollingMeta: unknown) => void} syncFn
 */
export function registerKrPrimarySwitchSync(key, syncFn) {
  const session = sessions.get(key)
  if (!session) return
  session.syncFn = syncFn
  notifySessionSync(session)
}

/**
 * @param {string} key
 * @param {{
 *   patchFn: (
 *     itemId: string,
 *     dir: 'next' | 'prev',
 *     opts: { linkId: string | null }
 *   ) => Promise<{
 *     applied: boolean
 *     nextKind: KrPrimaryKind
 *   } | null>,
 *   onFailure?: () => void | Promise<void>,
 * }} handlers
 */
export async function processKrPrimarySwitchQueue(key, handlers) {
  const session = sessions.get(key)
  if (!session || session.processing) return
  session.processing = true
  try {
    while (session.dirs.length > 0) {
      const dir = session.dirs.shift()
      if (!dir) continue
      const result = await handlers.patchFn(session.itemId, dir, {
        linkId: session.linkId,
      })
      if (!result?.applied) {
        session.dirs.length = 0
        await handlers.onFailure?.()
        clearKrPrimarySwitchSession(key)
        scheduleKrSlotPatchRenderFlush()
        return
      }
      session.targetKind = result.nextKind
      session.rollingMeta = patchMetaForKind(
        session.rollingMeta,
        result.nextKind,
        session.linkId
      )
      notifySessionSync(session)
    }
  } finally {
    session.processing = false
    const still = sessions.get(key)
    if (still && still.dirs.length > 0) {
      void processKrPrimarySwitchQueue(key, handlers)
    } else if (still && still.dirs.length === 0 && !still.processing) {
      clearKrPrimarySwitchSession(key)
      scheduleKrSlotPatchRenderFlush()
    }
  }
}

registerKrSwitchSessionActiveGuard(hasActiveKrPrimarySwitchSessions)
