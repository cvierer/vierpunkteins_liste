import OBR from '@owlbear-rodeo/sdk'
import { collectSortedParticipants } from './participants.js'
import {
  buildCombatTurnSteps,
  clearAllRootPhaseLinksInScene,
  clearEphemeralExtraIniRows,
  combatPatchForStep,
  findCombatStepIndex,
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
  getCombatActionRedo,
  getIniTieOrder,
  onCombatChange,
  patchCombat,
  patchCombatActionRedo,
  RESET_ROUND_INTRO,
} from './combatRoom.js'
import { getRoomSettings } from './roomSettings.js'
import { getTrackedParticipantIds } from './listState.js'
import {
  reapplyActionStampForCombatRedo,
  resetAllKrCountersInScene,
  resetAllTrackerStateForCombatStart,
  undoKrActionStamp,
} from './krCounters.js'
import { clearCombatStartHeroSessionVisuals } from './krCombatMarks.js'
import { applyLhKrStartObjects } from './longHandlung.js'
import { getManualIniTieOverridePairs } from './manualIniTieOverrides.js'
import { clearCombatLog } from './combatLog.js'

async function combatTurnSteps() {
  const items = await OBR.scene.items.getItems()
  const rows = collectSortedParticipants(
    items,
    getIniTieOrder(),
    getManualIniTieOverridePairs()
  )
  const c = getCombat()
  const combatRound = c.started ? c.round : null
  return buildCombatTurnSteps(rows, items, getIniTieOrder(), combatRound)
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
  const btnUndo = root.querySelector('[data-combat-undo]')
  const btnRedo = root.querySelector('[data-combat-redo]')

  const setGmDisabled = (btn, disabled) => {
    if (!btn) return
    btn.disabled = disabled
    btn.title = !isGm ? 'Nur Spielleitung' : ''
  }

  const refreshBar = () => {
    const c = getCombat()
    const ids = getTrackedParticipantIds()

    if (btnToggle) {
      btnToggle.textContent = c.started ? 'Beenden' : 'Start'
    }

    if (elRound) {
      if (!c.started) {
        elRound.textContent = 'Kampfrunde —'
      } else if (c.roundIntroPending) {
        const base =
          typeof c.roundIntroPrevRound === 'number' && c.roundIntroPrevRound >= 1
            ? c.roundIntroPrevRound
            : c.round
        elRound.textContent = `Kampfrunde ${base + 1}`
      } else {
        elRound.textContent = `Kampfrunde ${c.round}`
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
    const hasRedo = getCombatActionRedo().batches.length > 0
    const atFirstRoundStart = isAtFirstRoundStart(c)
    const hasStampsHere = getActionStamps().entries.some((e) =>
      stampMatchesCurrentCombatStep(e, c)
    )
    setGmDisabled(btnToggle, !isGm || (!c.started && ids.length === 0))
    setGmDisabled(btnPrev, !canNav || atFirstRoundStart)
    setGmDisabled(btnNext, !canNav)
    setGmDisabled(btnUndo, !canNav || (atFirstRoundStart && !hasStampsHere))
    setGmDisabled(btnRedo, !canNav || !hasRedo)
    if (btnPrev && isGm && canNav && atFirstRoundStart) {
      btnPrev.title = 'Beginn der Kampfrunde 1'
    }
    if (btnUndo && isGm) {
      if (canNav && atFirstRoundStart && !hasStampsHere) {
        btnUndo.title = 'Am Beginn der Kampfrunde 1 (keine Stempel an diesem Punkt)'
      } else {
        btnUndo.title = canNav ? 'Rückgängig' : ''
      }
    }
    if (btnRedo && isGm) {
      if (!canNav) btnRedo.title = ''
      else
        btnRedo.title = hasRedo
          ? 'Wiederherstellen'
          : 'Keine rückgängig gemachten Schritte'
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
    const c0 = getCombat()
    if (c0.started && c0.roundIntroPending) {
      const stepsCommit = await combatTurnSteps()
      if (stepsCommit.length === 0) {
        await patchCombat({
          started: false,
          round: 1,
          currentItemId: null,
          currentPhaseLinkId: null,
          ...RESET_ROUND_INTRO,
        })
        return
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
      await resetAllKrCountersInScene()
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

    const steps = await combatTurnSteps()
    const c = getCombat()
    if (steps.length === 0) {
      // Transient leerer Steps-Snapshot (OBR-Sync-Race nach LH-Ende /
      // Stempel-Kaskade): NICHT mehr auf `started:false` zurücksetzen, sonst
      // verschwindet die ganze Liste beim Spieler und die Navigation klemmt.
      // Combat manuell beenden bleibt über den Toggle-Button erreichbar.
      return
    }
    const idx = findCombatStepIndex(steps, c)
    if (idx < 0) {
      // Aktueller Schritt ist transient nicht in steps (z. B. 2.A.-Wurzel kurz
      // ausgeblendet während die LH abschliesst): NICHT mehr stumpf auf
      // steps[0] (round_start) zurückspringen — das war die Ursache des
      // Hängers an „Beginn der KR x" nach einem LH-Ende mit synthetischer
      // Done-Zeile (gerade Werte). Stattdessen einen Tick warten und neu
      // ziehen; bis dahin sind die Items konsistent.
      await new Promise((r) => setTimeout(r, 0))
      const stepsRetry = await combatTurnSteps()
      const cRetry = getCombat()
      const idxRetry = findCombatStepIndex(stepsRetry, cRetry)
      if (stepsRetry.length === 0) return
      if (idxRetry < 0) {
        await patchCombat({
          ...RESET_ROUND_INTRO,
          ...combatPatchForStep(stepsRetry[0]),
        })
        return
      }
      const nextIdxRetry = (idxRetry + 1) % stepsRetry.length
      const atRoundEndRetry = stepsRetry[idxRetry]?.kind === 'roundEnd'
      if (atRoundEndRetry && nextIdxRetry === 0) {
        const reverseIni = getRoomSettings().roundIntroFocusLowestIni === true
        const markerStep = reverseIni
          ? { kind: 'roundEnd', id: ROUND_END_STEP_ID }
          : { kind: 'roundStart', id: ROUND_START_STEP_ID }
        await patchCombat({
          roundIntroPending: true,
          roundIntroPrevRound: cRetry.round,
          roundIntroPrevItemId: cRetry.currentItemId,
          roundIntroPrevPhaseLinkId: cRetry.currentPhaseLinkId,
          ...combatPatchForStep(markerStep),
        })
        return
      }
      await patchCombat({
        ...combatPatchForStep(stepsRetry[nextIdxRetry]),
        round: cRetry.round,
      })
      return
    }
    const nextIdx = (idx + 1) % steps.length
    const atRoundEnd = steps[idx]?.kind === 'roundEnd'

    if (atRoundEnd && nextIdx === 0) {
      const reverseIni = getRoomSettings().roundIntroFocusLowestIni === true
      const markerStep = reverseIni
        ? { kind: 'roundEnd', id: ROUND_END_STEP_ID }
        : { kind: 'roundStart', id: ROUND_START_STEP_ID }
      await patchCombat({
        roundIntroPending: true,
        roundIntroPrevRound: c.round,
        roundIntroPrevItemId: c.currentItemId,
        roundIntroPrevPhaseLinkId: c.currentPhaseLinkId,
        ...combatPatchForStep(markerStep),
      })
      return
    }

    await patchCombat({
      ...combatPatchForStep(steps[nextIdx]),
      round: c.round,
    })
  }

  const applyCombatPrev = async () => {
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
    const idx = findCombatStepIndex(steps, c)
    if (idx < 0) {
      // Wie applyCombatNext: einen Tick warten, neu ziehen.
      await new Promise((r) => setTimeout(r, 0))
      const stepsRetry = await combatTurnSteps()
      const cRetry = getCombat()
      const idxRetry = findCombatStepIndex(stepsRetry, cRetry)
      if (stepsRetry.length === 0) return
      if (idxRetry < 0) {
        await patchCombat({
          ...RESET_ROUND_INTRO,
          ...combatPatchForStep(stepsRetry[0]),
        })
        return
      }
      if (isAtFirstRoundStart(cRetry)) return
      const prevIdxRetry =
        (idxRetry - 1 + stepsRetry.length) % stepsRetry.length
      let roundRetry = cRetry.round
      if (idxRetry === 0 && prevIdxRetry === stepsRetry.length - 1) {
        roundRetry = Math.max(1, cRetry.round - 1)
      }
      await patchCombat({
        ...combatPatchForStep(stepsRetry[prevIdxRetry]),
        round: roundRetry,
      })
      return
    }
    if (isAtFirstRoundStart(c)) return
    const prevIdx = (idx - 1 + steps.length) % steps.length
    let round = c.round
    if (idx === 0 && prevIdx === steps.length - 1) {
      round = Math.max(1, c.round - 1)
    }
    await patchCombat({ ...combatPatchForStep(steps[prevIdx]), round })
  }

  const applyCombatUndo = async () => {
    const c = getCombat()
    const matching = getActionStamps().entries.filter((e) =>
      stampMatchesCurrentCombatStep(e, c)
    )
    beginSuppressStampRedoClear()
    try {
      if (matching.length > 0) {
        const batch = {
          round: c.round,
          currentItemId: c.currentItemId,
          currentPhaseLinkId:
            typeof c.currentPhaseLinkId === 'string'
              ? c.currentPhaseLinkId
              : null,
          stamps: matching.map((e) => ({ ...e })),
        }
        await patchCombatActionRedo((cur) => ({
          batches: [...cur.batches, batch],
        }))
        for (let i = matching.length - 1; i >= 0; i--) {
          await undoKrActionStamp(matching[i].id)
        }
      }
      await applyCombatPrev()
    } finally {
      endSuppressStampRedoClear()
    }
  }

  const applyCombatRedo = async () => {
    beginSuppressStampRedoClear()
    try {
      await applyCombatNext()
      let c = getCombat()
      const redo = getCombatActionRedo()
      const last = redo.batches[redo.batches.length - 1]
      if (!last) return

      const stepMatches = (state) => {
        const pA =
          typeof last.currentPhaseLinkId === 'string'
            ? last.currentPhaseLinkId
            : null
        const pB =
          typeof state.currentPhaseLinkId === 'string'
            ? state.currentPhaseLinkId
            : null
        return (
          last.round === state.round &&
          last.currentItemId === state.currentItemId &&
          pA === pB
        )
      }

      if (
        !stepMatches(c) &&
        c.started &&
        c.roundIntroPending &&
        last.round > c.round
      ) {
        await applyCombatNext()
        c = getCombat()
      }
      if (!stepMatches(c)) return

      for (const stamp of last.stamps) {
        await reapplyActionStampForCombatRedo(stamp)
      }
      await patchCombatActionRedo((cur) => ({
        batches: cur.batches.slice(0, -1),
      }))
    } finally {
      endSuppressStampRedoClear()
    }
  }

  btnToggle?.addEventListener('click', () => void applyCombatStartStop())

  btnNext?.addEventListener('click', () => void applyCombatNext())

  btnPrev?.addEventListener('click', () => void applyCombatPrev())

  btnUndo?.addEventListener('click', () => void applyCombatUndo())

  btnRedo?.addEventListener('click', () => void applyCombatRedo())

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
