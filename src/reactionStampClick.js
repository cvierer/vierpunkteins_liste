import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem } from './editAccess.js'
import { getActionStamps, getCombat } from './combatRoom.js'
import { isLhLockingActions } from './lhMeta.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'
import {
  KR_ABW,
  KR_FREE_ACTION,
  normalizeKrDigit,
  patchKrCounterByDelta,
  patchKrStampAbwFromCharge,
  patchKrStampParadeExtraFromCharge,
  readKrAbw,
  readKrFreeAction,
  readKrParadeExtraSlots,
  readHeroFaMax,
  undoKrActionStamp,
} from './krCounters.js'
import { getRoomSettings } from './roomSettings.js'
import {
  liveAbwCombatAllowsStamp,
  liveAbwStampAnchor,
  liveFaLadungAllowed,
} from './krAbwStampGates.js'
import { abwShieldCountFromKrValue } from './krMirrorAbwDisplay.js'

/** @param {unknown} trackerMeta */
export function paradeLoadedSlotIndices(trackerMeta) {
  if (trackerMeta?.krExtraChoiceUsed === 'ang') return []
  return readKrParadeExtraSlots(trackerMeta)
    .map((slot, idx) => ({ slot, idx }))
    .filter((e) => e.slot === 0)
    .map((e) => e.idx)
}

/**
 * @param {unknown} meta
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat> | null | undefined} [combat]
 */
export function reactionAbwStampAllowed(meta, combat = null) {
  const c = combat ?? getCombat()
  if (!liveAbwCombatAllowsStamp(c)) return false
  const round =
    c?.started && Number.isFinite(Number(c.round)) ? Number(c.round) : null
  return !isLhLockingActions(meta, round)
}

/**
 * F.A. stempelbar: Kampf-Gates nur — L.H.-Sperre gilt nicht für F.A.
 *
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat> | null | undefined} [combat]
 * @param {unknown} [meta]
 * @param {number} [delta]
 */
export function reactionFaStampAllowed(combat = null, meta = null, delta = 1) {
  if (!liveFaLadungAllowed(combat)) return false
  if (delta <= 0 || !meta) return true
  const iniStr = /** @type {{ initiative?: string }} */ (meta)?.initiative
  const settings = getRoomSettings()
  const faMax = readHeroFaMax(meta, iniStr, settings)
  const used = readKrFreeAction(meta, faMax)
  const avail = Math.max(0, faMax - Math.max(0, Math.floor(Number(used)) || 0))
  return avail > 0
}

/**
 * @param {string} ownerItemId
 * @param {import('./combatRoom.js').ReturnType<typeof getCombat> | null | undefined} combat
 * @param {boolean} inReactionStore
 */
export function reactionStampAnchor(ownerItemId, combat, inReactionStore) {
  if (inReactionStore) {
    return { rowId: ownerItemId, phaseLinkId: null }
  }
  return liveAbwStampAnchor(ownerItemId, combat)
}

/**
 * @param {EventTarget | null} eventTarget
 * @returns {{ kind: 'abw' | 'fa' | 'parade', ownerItemId: string, paradeSlot?: number, inReactionStore: boolean } | null}
 */
export function resolveReactionStampTarget(eventTarget) {
  const el =
    eventTarget &&
    typeof eventTarget === 'object' &&
    typeof /** @type {{ closest?: unknown }} */ (eventTarget).closest ===
      'function'
      ? /** @type {Element} */ (eventTarget)
      : null
  if (!el) return null

  if (el.closest('.init-lh-counter__action-btn')) return null

  if (el.closest('.init-kr-abw-split-shell--mirror-link')) return null

  const faTap = el.closest('.init-fa-cell__tap')
  if (faTap) {
    const wrap = faTap.closest('.init-fa-cell[data-fa-link-group]')
    const ownerItemId = wrap?.getAttribute('data-fa-link-group')
    if (!ownerItemId) return null
    return {
      kind: 'fa',
      ownerItemId,
      inReactionStore: Boolean(wrap?.closest('.init-kr-reaction-store')),
    }
  }

  const paradeEl = el.closest('.init-kr-abw-shield--parade-extra')
  const abwExec = el.closest('.init-kr-abw-split-shell__exec')
  const shell = (paradeEl ?? abwExec)?.closest(
    '.init-kr-abw-split-shell[data-shield-link-group]'
  )
  if (!shell || shell.classList.contains('init-kr-abw-split-shell--mirror-link')) {
    return null
  }
  const ownerItemId = shell.getAttribute('data-shield-link-group')
  if (!ownerItemId) return null
  const inReactionStore = Boolean(shell.closest('.init-kr-reaction-store'))
  if (paradeEl) {
    const slotIdx = Math.max(
      0,
      Math.floor(Number(paradeEl.getAttribute('data-parade-extra-slot')) || 0)
    )
    return {
      kind: 'parade',
      ownerItemId,
      paradeSlot: slotIdx,
      inReactionStore,
    }
  }
  if (abwExec) {
    return { kind: 'abw', ownerItemId, inReactionStore }
  }
  return null
}

/** @param {string} ownerItemId */
export function findLatestParadeExtraStampId(ownerItemId) {
  const entries = getActionStamps()?.entries
  if (!Array.isArray(entries)) return null
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e.itemId === ownerItemId && e.paradeExtra) return e.id
  }
  return null
}

/** @param {string} itemId */
async function findSceneItemById(itemId) {
  let items = await OBR.scene.items.getItems([itemId])
  let item = items?.[0]
  if (!item) {
    const all = await OBR.scene.items.getItems()
    item = all.find((i) => i.id === itemId)
  }
  return item ?? null
}

/**
 * @param {string} ownerItemId
 * @param {{ kind?: 'abw' | 'parade', paradeSlot?: number, inReactionStore?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export async function executeAbwStampClick(ownerItemId, opts = {}) {
  const item = await findSceneItemById(ownerItemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false
  const combat = getCombat()
  if (!reactionAbwStampAllowed(meta, combat)) return false

  const inReactionStore = Boolean(opts.inReactionStore)
  const stampAnchor = reactionStampAnchor(ownerItemId, combat, inReactionStore)

  if (opts.kind === 'parade' || opts.paradeSlot != null) {
    const slotIdx = opts.paradeSlot ?? 0
    if (!paradeLoadedSlotIndices(meta).includes(slotIdx)) return false
    await patchKrStampParadeExtraFromCharge(ownerItemId, {
      paradeExtraSlot: slotIdx,
      stampAnchor,
    })
    return true
  }

  const v = normalizeKrDigit(readKrAbw(meta))
  if (abwShieldCountFromKrValue(v) < 1) return false
  return patchKrStampAbwFromCharge(ownerItemId, { stampAnchor })
}

/**
 * @param {string} ownerItemId
 * @param {number} delta
 * @param {{ inReactionStore?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export async function executeFaStampClick(ownerItemId, delta, opts = {}) {
  const combat = getCombat()
  const item = await findSceneItemById(ownerItemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false
  if (!reactionFaStampAllowed(combat, meta, delta)) return false

  const inReactionStore = Boolean(opts.inReactionStore)
  const patchOpts = inReactionStore
    ? {
        stampAnchor: reactionStampAnchor(ownerItemId, combat, true),
      }
    : {}
  return patchKrCounterByDelta(ownerItemId, KR_FREE_ACTION, delta, patchOpts)
}

/**
 * @param {MouseEvent} event
 * @returns {Promise<boolean>} true wenn behandelt
 */
export async function handleReactionStampClick(event) {
  const resolved = resolveReactionStampTarget(event.target)
  if (!resolved) return false

  const combat = getCombat()

  if (resolved.kind === 'fa') {
    const item = await findSceneItemById(resolved.ownerItemId)
    if (!item || !canEditSceneItem(item)) return false
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta || !reactionFaStampAllowed(combat, meta, 1)) return false
    event.preventDefault()
    event.stopPropagation()
    return executeFaStampClick(resolved.ownerItemId, 1, {
      inReactionStore: resolved.inReactionStore,
    })
  }

  const item = await findSceneItemById(resolved.ownerItemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta || !reactionAbwStampAllowed(meta, combat)) return false

  event.preventDefault()
  event.stopPropagation()

  return executeAbwStampClick(resolved.ownerItemId, {
    kind: resolved.kind === 'parade' ? 'parade' : 'abw',
    paradeSlot: resolved.paradeSlot,
    inReactionStore: resolved.inReactionStore,
  })
}

/**
 * @param {MouseEvent} event
 * @returns {Promise<boolean>} true wenn behandelt
 */
export async function handleReactionStampContextMenu(event) {
  const resolved = resolveReactionStampTarget(event.target)
  if (!resolved) return false

  const combat = getCombat()
  if (resolved.kind === 'fa') {
    const item = await findSceneItemById(resolved.ownerItemId)
    if (!item || !canEditSceneItem(item)) return false
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta || !reactionFaStampAllowed(combat, meta, -1)) return false
    event.preventDefault()
    event.stopPropagation()
    return executeFaStampClick(resolved.ownerItemId, -1, {
      inReactionStore: resolved.inReactionStore,
    })
  }

  const item = await findSceneItemById(resolved.ownerItemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false
  if (!reactionAbwStampAllowed(meta, combat)) return false

  event.preventDefault()
  event.stopPropagation()

  const el =
    event.target &&
    typeof event.target === 'object' &&
    typeof /** @type {{ closest?: unknown }} */ (event.target).closest ===
      'function'
      ? /** @type {Element} */ (event.target)
      : null
  const paradeShield = el?.closest('.init-kr-abw-shield--parade-extra')
  const onExec = el?.closest('.init-kr-abw-split-shell__exec')
  const paradeUndoId = findLatestParadeExtraStampId(resolved.ownerItemId)

  if (paradeUndoId && paradeShield) {
    await undoKrActionStamp(paradeUndoId)
    return true
  }

  const v = normalizeKrDigit(readKrAbw(meta))
  if (v === 1) {
    await patchKrCounterByDelta(resolved.ownerItemId, KR_ABW, -1)
    return true
  }

  if (paradeUndoId && onExec) {
    await undoKrActionStamp(paradeUndoId)
    return true
  }

  return false
}
