/**
 * L.H.-Navigations-Anzeige (Bruch/Pie) — entkoppelt von initiativeList-Rendering.
 */
import { getCombat } from './combatRoom.js'
import {
  LH_COMMIT_INI,
  LH_COMMIT_ROUND,
  lhDisplayStepFromNav,
  readLhCommitKrPriorSpendForRound,
  readLhMechanics,
} from './lhMeta.js'
import { navRenderCtx } from './initiativeListNavContext.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

/**
 * @param {unknown} trackerMeta
 * @param {number} max
 * @param {number | null | undefined} combatRound
 * @returns {number}
 */
export function lhNavStepForMeta(trackerMeta, max, combatRound) {
  const heroIniNum = (() => {
    const raw = trackerMeta?.initiative
    const n = Number(String(raw ?? '').trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  })()
  const mechanics = readLhMechanics(trackerMeta)
  const commitRound =
    Math.max(1, Math.floor(Number(trackerMeta?.[LH_COMMIT_ROUND])) || 0) ||
    (combatRound ?? 1)
  const effectiveRound = combatRound ?? commitRound
  const commitIniStored = Number(trackerMeta?.[LH_COMMIT_INI])
  const priorSpend = readLhCommitKrPriorSpendForRound(
    trackerMeta,
    effectiveRound
  )
  return lhDisplayStepFromNav(
    heroIniNum,
    mechanics,
    commitRound,
    effectiveRound,
    navRenderCtx.currentNavIniForRender,
    max,
    Number.isFinite(commitIniStored) ? commitIniStored : undefined,
    priorSpend
  )
}

/**
 * @param {unknown} trackerMeta
 * @param {number} max
 * @param {number | null | undefined} combatRound
 * @returns {string}
 */
export function lhFractionFromNavForMeta(trackerMeta, max, combatRound) {
  if (max <= 0) return ''
  const step = lhNavStepForMeta(trackerMeta, max, combatRound)
  if (max > 1 && step >= max) return 'GO!'
  return `${Math.max(1, step)}/${max}`
}

/**
 * @param {string} fracLabel
 * @param {number} maxForGo
 */
export function lhActionStepLabelFromNavFraction(fracLabel, maxForGo) {
  if (!fracLabel) return ''
  if (fracLabel === 'GO!') return `${maxForGo} / ${maxForGo}`
  return fracLabel.replace('/', ' / ')
}

/**
 * @param {HTMLElement | null | undefined} listRoot
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {(li: HTMLElement, ownerItemId: string, trackerMeta: unknown, item: import('@owlbear-rodeo/sdk').Item | undefined, combatRound: number | null | undefined) => void} remountOrPatchRow
 */
export function syncLhNavFractionsInList(listRoot, items, remountOrPatchRow) {
  if (!listRoot || !Array.isArray(items)) return
  const combat = getCombat()
  const combatRound = combat.started ? combat.round : null
  const itemById = new Map(items.map((it) => [it.id, it]))

  for (const li of listRoot.querySelectorAll('li.init-row[data-item-id]')) {
    const itemId = li.getAttribute('data-item-id')
    if (!itemId) continue
    const item = itemById.get(itemId)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    remountOrPatchRow(li, itemId, meta, item, combatRound)
  }

  for (const li of listRoot.querySelectorAll(
    'li.init-row--phase[data-phase-owner-id]'
  )) {
    const ownerId = li.getAttribute('data-phase-owner-id')
    if (!ownerId) continue
    const item = itemById.get(ownerId)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    remountOrPatchRow(li, ownerId, meta, item, combatRound)
  }
}
