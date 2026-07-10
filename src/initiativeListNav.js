/**
 * Nav-Highlight und Nav-Kontext-Refresh (aus initiativeList extrahiert).
 */
import { getCombat, getIniTieOrder } from './combatRoom.js'
import { buildConvertListVisibilityCtx } from './convertLockViewer.js'
import { getManualIniTieOverridePairs } from './manualIniTieOverrides.js'
import { collectSortedParticipants } from './participants.js'
import {
  buildCombatTurnSteps,
  findCombatStepIndex,
  findCombatStepIndexLoose,
  resolveCurrentNavIniForCombat,
} from './phaseLinks.js'
import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'
import { resolveNavHighlightSelector } from './navHighlightTarget.js'
import { setNavStepsCache } from './navActivePhaseLink.js'
import { navRenderCtx } from './initiativeListNavContext.js'

/** Nav-Highlight: voller Rahmen (Aktion) oder Unterlinie (Reaktion). */
export function applyNavActiveRowClasses(li, combat) {
  li.classList.add('init-row--active')
  if (combat.currentTurnSubStep === 'reaction') {
    li.classList.add('init-row--active-sub-reaction')
  } else {
    li.classList.add('init-row--active-sub-action')
  }
}

function clearNavActiveRowClasses(li) {
  li.classList.remove(
    'init-row--active',
    'init-row--active-sub-reaction',
    'init-row--active-sub-action'
  )
}

/**
 * @param {HTMLElement | null | undefined} listRoot
 * @param {ReturnType<typeof getCombat>} [combat]
 * @param {{ scroll?: boolean, scrollBehavior?: 'auto' | 'smooth' }} [opts]
 */
export function syncListNavHighlightFromCombat(
  listRoot,
  combat = getCombat(),
  opts = {}
) {
  if (!listRoot) return
  const scroll = opts.scroll !== false
  const sel = resolveNavHighlightSelector(combat)
  if (!sel) {
    for (const li of listRoot.querySelectorAll('li.init-row--active')) {
      clearNavActiveRowClasses(li)
    }
    return
  }

  let target = null
  if (sel.kind === 'roundStart') {
    target = listRoot.querySelector('li.init-row--round-start')
  } else if (sel.kind === 'roundEnd') {
    target = listRoot.querySelector('li.init-row--round-end')
  } else if (sel.kind === 'phase') {
    target =
      listRoot.querySelector(
        `li.init-row--phase[data-phase-owner-id="${CSS.escape(sel.activeId)}"][data-phase-link-id="${CSS.escape(sel.phaseId)}"]`
      ) ||
      listRoot.querySelector(
        `li.init-row--phase[data-phase-owner-id="${CSS.escape(sel.activeId)}"]`
      ) ||
      listRoot.querySelector(
        `li.init-row[data-item-id="${CSS.escape(sel.activeId)}"]`
      )
  } else if (sel.kind === 'token') {
    target = listRoot.querySelector(
      `li.init-row[data-item-id="${CSS.escape(sel.activeId)}"]`
    )
  }

  if (!target) return
  for (const li of listRoot.querySelectorAll('li.init-row--active')) {
    clearNavActiveRowClasses(li)
  }
  applyNavActiveRowClasses(target, combat)
  if (scroll) {
    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: opts.scrollBehavior === 'smooth' ? 'smooth' : 'auto',
    })
  }
}

/** @param {number | null} navIni */
export function mirrorListHostNavIniDataset(navIni) {
  try {
    const host = document.getElementById('initiative-list-host')
    if (!host) return
    if (navIni == null) {
      delete host.dataset.currentNavIni
    } else if (navIni === Number.POSITIVE_INFINITY) {
      host.dataset.currentNavIni = '+inf'
    } else if (navIni === Number.NEGATIVE_INFINITY) {
      host.dataset.currentNavIni = '-inf'
    } else {
      host.dataset.currentNavIni = String(navIni)
    }
  } catch {
    /* nicht kritisch */
  }
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 */
export function refreshNavContextForList(items) {
  const combat = getCombat()
  const listItems = Array.isArray(items) ? items : []
  const tokenRows = collectSortedParticipants(
    listItems,
    getIniTieOrder(),
    getManualIniTieOverridePairs()
  )
  const combatRound = combat.started ? combat.round : null
  const rowActiveId =
    combat.started && combat.currentItemId ? combat.currentItemId : null
  const rowActivePhaseLinkId = combat.started
    ? combat.currentPhaseLinkId
    : null
  navRenderCtx.currentNavIniForRender = resolveCurrentNavIniForCombat(
    tokenRows,
    listItems,
    getIniTieOrder(),
    combatRound,
    combat
  )
  const stepsForNav = buildCombatTurnSteps(
    tokenRows,
    listItems,
    getIniTieOrder(),
    combatRound,
    null
  )
  navRenderCtx.navStepsForRender = stepsForNav
  setNavStepsCache(stepsForNav)
  let combatStepIndex =
    combat.started && !combat.roundIntroPending
      ? findCombatStepIndex(stepsForNav, combat)
      : null
  if (
    combatStepIndex != null &&
    combatStepIndex < 0 &&
    combat.started &&
    !combat.roundIntroPending
  ) {
    combatStepIndex = findCombatStepIndexLoose(stepsForNav, combat)
  }
  navRenderCtx.visibilityCtxForRender = buildConvertListVisibilityCtx({
    combatStarted: combat.started,
    roundIntroPending: combat.roundIntroPending,
    rowActiveId,
    rowActivePhaseLinkId,
    currentNavIni: navRenderCtx.currentNavIniForRender,
    roundStartStepId: ROUND_START_STEP_ID,
    roundEndStepId: ROUND_END_STEP_ID,
    turnSteps: stepsForNav,
    combatStepIndex:
      combatStepIndex != null && combatStepIndex >= 0 ? combatStepIndex : null,
  })
  mirrorListHostNavIniDataset(navRenderCtx.currentNavIniForRender)
}

/** @param {import('@owlbear-rodeo/sdk').Item[]} items */
export function refreshCurrentNavIniForList(items) {
  refreshNavContextForList(items)
}
