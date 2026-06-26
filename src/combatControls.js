import OBR from '@owlbear-rodeo/sdk'
import { scheduleTurnActionMapRefresh } from './heroActionLabel.js'
import { collectSortedParticipants } from './participants.js'
import {
  buildCombatTurnSteps,
  clearAllRootPhaseLinksInScene,
  clearEphemeralExtraIniRows,
  combatPatchForStep,
  findCombatStepIndex,
  findCombatStepIndexLoose,
  isStampableCombatStep,
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
} from './phaseLinks.js'
import {
  beginCombatNavMutation,
  beginSuppressStampRedoClear,
  endCombatNavMutation,
  endSuppressStampRedoClear,
  getActionStamps,
  getCombat,
  getIniTieOrder,
  onCombatChange,
  patchCombat,
  patchCombatActionRedo,
  RESET_ROUND_INTRO,
} from './combatRoom.js'
import { awaitLhLifecycleIdle } from './lhEngine.js'
import { getTrackedParticipantIds } from './listState.js'
import {
  hasPrimaryActionStampAtCombatStep,
  resetAllKrCountersInScene,
  resetAllTrackerStateForCombatStart,
  undoKrActionStamp,
} from './krCounters.js'
import { clearCombatStartHeroSessionVisuals } from './krCombatMarks.js'
import { applyLhKrStartObjects } from './longHandlung.js'
import { getManualIniTieOverridePairs } from './manualIniTieOverrides.js'
import { clearCombatLog } from './combatLog.js'
import { autoStampForCombatStep } from './combatAutoStamp.js'
import {
  isCombatAtRoundEndMarker,
} from './combatRoundNav.js'
import { getRoomSettings } from './roomSettings.js'

async function combatTurnSteps() {
  let items = await OBR.scene.items.getItems()
  if (!items?.length) {
    await new Promise((r) => setTimeout(r, 0))
    items = await OBR.scene.items.getItems()
  }
  const tieOrder = getIniTieOrder()
  const rows = collectSortedParticipants(
    items,
    tieOrder,
    getManualIniTieOverridePairs()
  )
  const c = getCombat()
  const combatRound = c.started ? c.round : null
  return buildCombatTurnSteps(rows, items, tieOrder, combatRound)
}

/**
 * Auto-Stempel der Primaer-Aktion am aktuellen Schritt. KEIN Wechsel auf einen
 * Reaktions-Substep mehr: Navigation springt im selben Klick direkt zum
 * naechsten Objekt (siehe applyCombatNext). Reaktionen werden manuell auf der
 * Mutterzeile gestempelt; ein dedizierter Reaktions-Zwischenschritt entfaellt.
 */
async function maybeAutoStampAtCurrentStep(cur, c) {
  if (!isStampableCombatStep(cur)) return false
  if (hasPrimaryActionStampAtCombatStep(c)) return false
  let stamped = await autoStampForCombatStep(cur)
  if (!stamped && cur?.id) {
    await OBR.scene.items.getItems([cur.id])
    stamped = await autoStampForCombatStep(cur)
  }
  return Boolean(stamped)
}

function isTypingTarget(el) {
  if (!el || !(el instanceof Element)) return false
  return Boolean(
    el.closest('input, textarea, select, [contenteditable="true"]')
  )
}

/** Stempel gehört zum aktuellen Kampf-Schritt (INI-Punkt). */
function stampMatchesCurrentCombatStep(e, c) {
  if (!c.started || c.roundIntroPending) return false
  const rid = c.currentItemId
  if (typeof rid !== 'string') return false
  if (rid === ROUND_START_STEP_ID || rid === ROUND_END_STEP_ID) return false
  const rowAnchor =
    typeof e.anchorRowId === 'string' ? e.anchorRowId : e.itemId
  const phaseCombat =
    typeof c.currentPhaseLinkId === 'string' ? c.currentPhaseLinkId : null
  const phaseStamp =
    typeof e.anchorPhaseLinkId === 'string' ? e.anchorPhaseLinkId : null
  return rowAnchor === rid && phaseStamp === phaseCombat
}

function hasStampsAtCurrentStep(c) {
  return getActionStamps().entries.some((e) => stampMatchesCurrentCombatStep(e, c))
}

/**
 * Undo wie {@link undoStampsAtCurrentCombatStep}, aber bezogen auf einen
 * bestimmten Schritt (z. B. das Ziel eines „Zurueck"-Klicks). Konstruiert ein
 * „as-if"-Combat-Snapshot mit den Feldern dieses Schritts und delegiert dann
 * an die normale Undo-Routine, sodass die Stempel-Matching-Logik unveraendert
 * bleibt.
 */
async function undoStampsAtSpecificStep(c, step) {
  const stepCombat = { ...c, ...combatPatchForStep(step) }
  return undoStampsAtCurrentCombatStep(stepCombat)
}

async function undoStampsAtCurrentCombatStep(c) {
  const matching = getActionStamps().entries.filter((e) =>
    stampMatchesCurrentCombatStep(e, c)
  )
  if (matching.length === 0) return false
  beginSuppressStampRedoClear()
  try {
    const batch = {
      round: c.round,
      currentItemId: c.currentItemId,
      currentPhaseLinkId:
        typeof c.currentPhaseLinkId === 'string' ? c.currentPhaseLinkId : null,
      stamps: matching.map((e) => ({ ...e })),
    }
    await patchCombatActionRedo((cur) => ({
      batches: [...cur.batches, batch],
    }))
    for (let i = matching.length - 1; i >= 0; i--) {
      await undoKrActionStamp(matching[i].id)
    }
    return true
  } finally {
    endSuppressStampRedoClear()
  }
}

/** Navigationsuntergrenze: nicht vor „Beginn der Kampfrunde 1“. */
function isAtFirstRoundStart(c) {
  return (
    c.started &&
    !c.roundIntroPending &&
    c.round === 1 &&
    c.currentItemId === ROUND_START_STEP_ID &&
    (typeof c.currentPhaseLinkId !== 'string' || !c.currentPhaseLinkId)
  )
}

async function beginRoundIntroFromCombat(combat) {
  const reverseIni = getRoomSettings().roundIntroFocusLowestIni === true
  const markerStep = reverseIni
    ? { kind: 'roundEnd', id: ROUND_END_STEP_ID }
    : { kind: 'roundStart', id: ROUND_START_STEP_ID }
  await patchCombat({
    roundIntroPending: true,
    roundIntroPrevRound: combat.round,
    roundIntroPrevItemId: combat.currentItemId,
    roundIntroPrevPhaseLinkId: combat.currentPhaseLinkId,
    ...combatPatchForStep(markerStep),
  })
}

/**
 * @param {Awaited<ReturnType<typeof combatTurnSteps>>} steps
 * @param {ReturnType<typeof getCombat>} combat
 */
async function advanceCombatFromResolvedStep(steps, combat, stepIdx) {
  if (stepIdx < 0 || stepIdx >= steps.length) return false
  const nextIdx = (stepIdx + 1) % steps.length
  const atRoundEnd = steps[stepIdx]?.kind === 'roundEnd'
  if (atRoundEnd && nextIdx === 0) {
    await beginRoundIntroFromCombat(combat)
    return true
  }
  const cur = steps[stepIdx]
  // Stempel + Weiterschalten in EINEM Klick (kein Reaktions-Zwischenschritt).
  await maybeAutoStampAtCurrentStep(cur, combat)
  await patchCombat({
    ...combatPatchForStep(steps[nextIdx]),
    round: combat.round,
  })
  return true
}

export async function setupCombatControls(root) {
  if (!root) {
    return { refreshBar: () => {}, cleanup: () => {} }
  }

  const role = await OBR.player.getRole()
  const isGm = role === 'GM'

  const elRound = root.querySelector('[data-combat-round]')
  const btnToggle = root.querySelector('[data-combat-toggle]')
  const btnPrev = root.querySelector('[data-combat-prev]')
  const btnNext = root.querySelector('[data-combat-next]')
  const toolbar = root.querySelector('.combat-toolbar--grid')

  const setGmDisabled = (btn, disabled) => {
    if (!btn) return
    btn.disabled = disabled
    btn.title = !isGm ? 'Nur Spielleitung' : ''
  }

  const refreshBar = () => {
    const c = getCombat()
    const ids = getTrackedParticipantIds()

    if (btnToggle) {
      const toggleLabel = c.started ? 'Kampf beenden' : 'Kampf beginnen'
      btnToggle.textContent = toggleLabel
      btnToggle.setAttribute('aria-label', toggleLabel)
    }

    if (elRound) {
      elRound.hidden = !c.started
      if (c.started) {
        if (c.roundIntroPending) {
          const base =
            typeof c.roundIntroPrevRound === 'number' &&
            c.roundIntroPrevRound >= 1
              ? c.roundIntroPrevRound
              : c.round
          elRound.textContent = `Kampfrunde ${base + 1}`
        } else {
          elRound.textContent = `Kampfrunde ${c.round}`
        }
      }
    }

    if (btnNext) {
      btnNext.title =
        c.started && c.roundIntroPending
          ? getRoomSettings().roundIntroFocusLowestIni
            ? 'Neue Kampfrunde bestätigen (Zug: Ende der Kampfrunde)'
            : 'Neue Kampfrunde bestätigen (Zug: Beginn der Kampfrunde)'
          : ''
    }

    const canNav = isGm && c.started && ids.length > 0
    const atFirstRoundStart = isAtFirstRoundStart(c)
    const hasStampsHere = hasStampsAtCurrentStep(c)
    setGmDisabled(btnToggle, !isGm || (!c.started && ids.length === 0))
    setGmDisabled(btnPrev, !canNav || (atFirstRoundStart && !hasStampsHere))
    setGmDisabled(btnNext, !canNav)
    if (btnPrev && isGm && canNav) {
      if (hasStampsHere) {
        btnPrev.title =
          'Aktions-Stempel an diesem Punkt rückgängig machen (Zug bleibt)'
      } else if (atFirstRoundStart) {
        btnPrev.title = 'Beginn der Kampfrunde 1'
      } else {
        btnPrev.title = 'Vorheriger Zug'
      }
    }
    if (btnNext && isGm && canNav && !c.roundIntroPending) {
      btnNext.title = hasStampsHere
        ? 'Nächster Zug'
        : 'Nächster Zug oder Aktion stempeln (Zug bleibt)'
    }
  }

  const applyCombatStartStop = async () => {
    const c = getCombat()
    if (c.started) {
      // Kampfende: alle 2.A.-Objekte aller Tokens löschen und die komplette
      // Tracker-Aktivität (L.H., Paare, ZAO-Slots, Zähler, Stempel) auf den
      // Standard zurücksetzen. So startet der nächste Kampf wieder
      // vollständig mit den Standard-Positionen (Angriff + Abwehr).
      try {
        await clearAllRootPhaseLinksInScene()
      } catch {
        /* ignore */
      }
      try {
        await resetAllTrackerStateForCombatStart()
      } catch {
        /* ignore */
      }
      await patchCombat({
        started: false,
        round: 1,
        currentItemId: null,
        currentPhaseLinkId: null,
        ...RESET_ROUND_INTRO,
      })
      return
    }
    const steps = await combatTurnSteps()
    if (steps.length === 0) return
    // Kampfstart: vor dem Festlegen des ersten Schrittes alle 2.A.-Objekte
    // und Tracker-Zustände zurücksetzen. Die `combatTurnSteps`-Liste oben
    // wurde noch auf dem alten (evtl. dreckigen) Stand gebaut — das ist
    // unkritisch, da der erste Schritt anschließend im sauberen Zustand
    // gesetzt wird.
    try {
      await clearAllRootPhaseLinksInScene()
    } catch {
      /* ignore */
    }
    await resetAllTrackerStateForCombatStart({ restoreHeroExtraZat: true })
    clearCombatStartHeroSessionVisuals()
    clearCombatLog()
    const freshSteps = await combatTurnSteps()
    const firstStep = freshSteps[0] ?? steps[0]
    await patchCombat({
      started: true,
      round: 1,
      ...RESET_ROUND_INTRO,
      ...combatPatchForStep(firstStep),
    })
  }

  const applyCombatNext = async () => {
    try {
    await awaitLhLifecycleIdle()
    const c0 = getCombat()
    if (c0.started && c0.roundIntroPending) {
      let stepsCommit = await combatTurnSteps()
      if (stepsCommit.length === 0) {
        await new Promise((r) => setTimeout(r, 0))
        stepsCommit = await combatTurnSteps()
        if (stepsCommit.length === 0) {
          return
        }
      }
      const targetRound =
        typeof c0.roundIntroPrevRound === 'number' && c0.roundIntroPrevRound >= 1
          ? c0.roundIntroPrevRound + 1
          : c0.round + 1
      beginCombatNavMutation()
      try {
        await clearEphemeralExtraIniRows()
      } finally {
        endCombatNavMutation()
      }
      const reverseIni = getRoomSettings().roundIntroFocusLowestIni === true
      const nextStep = reverseIni
        ? stepsCommit.find((s) => s.kind === 'roundEnd') ?? null
        : stepsCommit.find((s) => s.kind === 'roundStart') ?? null
      if (!nextStep) {
        await patchCombat({
          started: false,
          round: 1,
          currentItemId: null,
          currentPhaseLinkId: null,
          ...RESET_ROUND_INTRO,
        })
        return
      }
      await patchCombat({
        ...RESET_ROUND_INTRO,
        ...combatPatchForStep(nextStep),
        round: targetRound,
      })
      await resetAllKrCountersInScene({ targetRound })
      // KR-Beginn-Hook: temporaere n.A.-Objekte fuer Tokens anlegen, deren
      // L.H. in dieser KR endet (siehe applyLhKrStartObjects). Stille
      // Fehler akzeptieren, damit ein Hick im Tracker nicht die Navigation
      // blockiert.
      try {
        await applyLhKrStartObjects(targetRound)
      } catch {
        /* ignore */
      }
      return
    }

    let steps = await combatTurnSteps()
    const c = getCombat()
    if (steps.length === 0) {
      await new Promise((r) => setTimeout(r, 0))
      steps = await combatTurnSteps()
      if (steps.length === 0) {
        // Transient leerer Steps-Snapshot (OBR nach L.H.-Umwandel): nicht
        // started:false — nächster Weiter-Versuch nach Szene-Sync.
        return
      }
    }
    const idx = findCombatStepIndex(steps, c)
    if (idx < 0) {
      if (isCombatAtRoundEndMarker(c)) {
        await beginRoundIntroFromCombat(c)
        return
      }
      let resolvedIdx = findCombatStepIndexLoose(steps, c)
      if (resolvedIdx >= 0) {
        if (await advanceCombatFromResolvedStep(steps, c, resolvedIdx)) {
          return
        }
      }
      await new Promise((r) => setTimeout(r, 0))
      const stepsRetry = await combatTurnSteps()
      const cRetry = getCombat()
      let idxRetry = findCombatStepIndex(stepsRetry, cRetry)
      if (stepsRetry.length === 0) return
      if (idxRetry < 0) {
        if (isCombatAtRoundEndMarker(cRetry)) {
          await beginRoundIntroFromCombat(cRetry)
          return
        }
        idxRetry = findCombatStepIndexLoose(stepsRetry, cRetry)
        if (idxRetry < 0) {
          return
        }
      }
      if (await advanceCombatFromResolvedStep(stepsRetry, cRetry, idxRetry)) {
        return
      }
      return
    }
    const nextIdx = (idx + 1) % steps.length
    const atRoundEnd = steps[idx]?.kind === 'roundEnd'

    if (atRoundEnd && nextIdx === 0) {
      await beginRoundIntroFromCombat(c)
      return
    }

    const cur = steps[idx]
    // Stempel + Weiterschalten in EINEM Klick (kein Reaktions-Zwischenschritt).
    await maybeAutoStampAtCurrentStep(cur, c)
    await patchCombat({
      ...combatPatchForStep(steps[nextIdx]),
      round: c.round,
    })
    } finally {
      scheduleTurnActionMapRefresh()
    }
  }

  const applyCombatPrev = async () => {
    try {
    await awaitLhLifecycleIdle()
    const cIntro = getCombat()
    if (cIntro.started && cIntro.roundIntroPending) {
      await patchCombat({
        ...RESET_ROUND_INTRO,
        currentItemId:
          typeof cIntro.roundIntroPrevItemId === 'string'
            ? cIntro.roundIntroPrevItemId
            : null,
        currentPhaseLinkId:
          typeof cIntro.roundIntroPrevPhaseLinkId === 'string'
            ? cIntro.roundIntroPrevPhaseLinkId
            : null,
      })
      return
    }

    const steps = await combatTurnSteps()
    const c = getCombat()
    if (steps.length === 0) {
      // siehe applyCombatNext: kein automatischer started:false-Fallback.
      return
    }
    // Rueckwaerts: Stempel des Ziel-Schritts ggf. zuruecknehmen UND in einem
    // Klick zum vorherigen Objekt zurueckspringen (kein Reaktions-Substep mehr).
    // Stempel an einem Schritt werden beim Hinein-Navigieren rueckgaengig
    // gemacht, damit der Wechsel wieder dieselbe Stempelmoeglichkeit eroeffnet.
    const goPrev = async (curSteps, curCombat, fromIdx) => {
      // Sonderfall „Beginn der Kampfrunde 1": Cursor bleibt; vorhandene
      // Stempel an dieser Position lassen sich dennoch zuruecknehmen.
      if (isAtFirstRoundStart(curCombat)) {
        await undoStampsAtCurrentCombatStep(curCombat)
        return
      }
      const prevIdx = (fromIdx - 1 + curSteps.length) % curSteps.length
      let round = curCombat.round
      if (fromIdx === 0 && prevIdx === curSteps.length - 1) {
        round = Math.max(1, curCombat.round - 1)
      }
      await undoStampsAtSpecificStep(curCombat, curSteps[prevIdx])
      await patchCombat({
        ...combatPatchForStep(curSteps[prevIdx]),
        round,
      })
    }

    const idx = findCombatStepIndex(steps, c)
    if (idx < 0) {
      let resolvedIdx = findCombatStepIndexLoose(steps, c)
      if (resolvedIdx >= 0) {
        await goPrev(steps, c, resolvedIdx)
        return
      }
      // Wie applyCombatNext: einen Tick warten, neu ziehen.
      await new Promise((r) => setTimeout(r, 0))
      const stepsRetry = await combatTurnSteps()
      const cRetry = getCombat()
      let idxRetry = findCombatStepIndex(stepsRetry, cRetry)
      if (stepsRetry.length === 0) return
      if (idxRetry < 0) {
        idxRetry = findCombatStepIndexLoose(stepsRetry, cRetry)
        if (idxRetry < 0) {
          return
        }
      }
      await goPrev(stepsRetry, cRetry, idxRetry)
      return
    }
    await goPrev(steps, c, idx)
    } finally {
      scheduleTurnActionMapRefresh()
    }
  }

  btnToggle?.addEventListener('click', () => void applyCombatStartStop())

  btnNext?.addEventListener('click', () => void applyCombatNext())

  btnPrev?.addEventListener('click', () => void applyCombatPrev())

  const onCombatKeyDown = (e) => {
    if (!isGm) return
    if (isTypingTarget(e.target)) return
    const c = getCombat()
    const canNav = c.started && getTrackedParticipantIds().length > 0
    if (!canNav) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      if (c.roundIntroPending && e.repeat) return
      e.preventDefault()
      void applyCombatNext()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      void applyCombatPrev()
    }
  }
  document.addEventListener('keydown', onCombatKeyDown)

  // onCombatChange: Kampf, Aktions-Stempel und combatActionRedo → Bar inkl. KR1-Undo-Disable
  const unsub = onCombatChange(refreshBar)
  refreshBar()

  return {
    refreshBar,
    cleanup: () => {
      unsub()
      document.removeEventListener('keydown', onCombatKeyDown)
    },
  }
}
