import {
  cycleKrPrimarySlotKind,
  isKrPrimarySlotIniLocked,
} from './krCounters.js'
import {
  registerKrSwitchSessionActiveGuard,
  flushKrSlotPatchRenderNow,
} from './krSlotPatchGate.js'

/** @typedef {'ang' | 'sra' | 'lh' | 'uo'} KrPrimaryKind */

/**
 * @typedef {{
 *   itemId: string,
 *   linkId: string | null,
 *   dirs: ('next' | 'prev')[],
 *   processing: boolean,
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
 * @param {KrPrimaryKind} startKind
 * @param {('next' | 'prev')[]} queuedDirs
 * @param {unknown} baseMeta
 * @param {string | null} linkId
 */
function virtualKindAfterDirs(startKind, queuedDirs, baseMeta, linkId) {
  const iniLocked = isKrPrimarySlotIniLocked(baseMeta, linkId)
  let kind = startKind
  for (const dir of queuedDirs) {
    kind = cycleKrPrimarySlotKind(kind, dir, iniLocked)
  }
  return kind
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
 * @returns {{ targetKind: KrPrimaryKind } | null}
 */
export function enqueueKrPrimarySwitchStep(key, dir, opts) {
  const { itemId, linkId, startKind, baseMeta, canConvertToUo } = opts
  let session = sessions.get(key)
  if (!session) {
    session = {
      itemId,
      linkId,
      dirs: [],
      processing: false,
    }
    sessions.set(key, session)
  }

  const currentKind = virtualKindAfterDirs(
    startKind,
    session.dirs,
    baseMeta,
    linkId
  )
  const iniLocked = isKrPrimarySlotIniLocked(baseMeta, linkId)
  const nextKind = cycleKrPrimarySlotKind(currentKind, dir, iniLocked)
  if (nextKind === 'uo' && !canConvertToUo) return null

  session.dirs.push(dir)
  return { targetKind: nextKind }
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
        flushKrSlotPatchRenderNow()
        return
      }
    }
  } finally {
    session.processing = false
    const still = sessions.get(key)
    if (still && still.dirs.length > 0) {
      void processKrPrimarySwitchQueue(key, handlers)
    } else if (still && still.dirs.length === 0 && !still.processing) {
      clearKrPrimarySwitchSession(key)
      flushKrSlotPatchRenderNow()
    }
  }
}

registerKrSwitchSessionActiveGuard(hasActiveKrPrimarySwitchSessions)
