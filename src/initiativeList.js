import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem, isGmSync } from './editAccess.js'
import {
  collectSortedParticipants,
  getTokenListDisplayName,
  TRACKER_ITEM_META_KEY,
} from './participants.js'
import {
  computeValidIniTieInsertSlots,
  getCombat,
  getActionStamps,
  getIniTieOrder,
  isCombatNavMutationActive,
  onCombatChange,
  onIniTieOrderChange,
  patchActionStamps,
  patchCombat,
  reorderIniTieToken,
  RESET_ROUND_INTRO,
} from './combatRoom.js'
import {
  getManualIniTieOverridePairs,
  onManualIniTieOverridesChange,
} from './manualIniTieOverrides.js'
import { setTrackedParticipantIds } from './listState.js'
import {
  initiativeCompareOnlyIni,
  initiativeRank,
} from './initiativeSort.js'
import {
  addPhaseChildLink,
  buildCombatTurnSteps,
  buildMergedDisplayRows,
  canCreateSecondActionRoot,
  combatPatchForStep,
  finalizePhasesWithOrderedRoots,
  findCombatStepIndex,
  formatIniForSort,
  hookIniForLink,
  iniNumeric,
  shouldShowHeroExtraLink,
  sortedLinksForLayout,
  mergedEntryDiscriminator,
  nextChainedZaoParentForTransfer,
  normalizePhases,
  onFullIniTieOrderChange,
  onNamePhasePlusClick,
  onZaoRootTieOrderChange,
  orderedAllZaoRootIdsForBadge,
  orderedZaoRootIdsForBadge,
  removeLastZaoRoot,
  removePhaseLink,
  LH_DONE_STEP_ID,
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
  swapAdjacentMergedIniDiscriminators,
  tryCommitPhaseOffset,
  tryCommitPhaseTargetIni,
  zaoRootKey,
} from './phaseLinks.js'
import {
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  MAX_HERO_ACTION_POOL_SUM,
  MIN_HERO_ACTION_POOL_SUM,
  KR_ABW,
  KR_PARADE_EXTRA,
  KR_ANG,
  KR_FREE_ACTION,
  KR_LH_ACTION,
  KR_LH_SECOND,
  KR_LH_VOID_BY_TRANSFER,
  KR_PRIMARY_VOID_BY_ABW_TRANSFER,
  KR_SRA,
  KR_ZAO_SLOTS,
  applyIniNegativePoolShiftForMetaMutation,
  applyIniLockCharges,
  ensureFullFreeActionQuota,
  initKrActionPoolsFromHeroDefaults,
  HERO_INI_NEG_ACTIONS_LOST,
  HERO_INI_NEG_ANG_MODE,
  isHeroIniBelowZero,
  readHeroIniNegActionsLost,
  readHeroIniNegAngMode,
  heroExtraZaoAvailableForRestore,
  krAbwCanAcceptTransferMark,
  krAbwTransferMaxMarks,
  krPrimaryCanAcceptTransferMark,
  krFieldToCounterKind,
  krTransferMarkPresent,
  normalizeKrDigit,
  patchKrCounterByDelta,
  patchKrFirstSlotKind,
  patchKrLhChargeBackToAbw,
  ensureParadeExtraShield,
  patchKrStampAbwFromCharge,
  patchKrStampParadeExtraFromCharge,
  patchKrTransferAbwToLhSecond,
  patchKrTransferAbwToPrimary,
  patchKrTransferAbwToZaoPrimary,
  patchKrTransferPrimaryToAbw,
  patchKrTransferZaoPrimaryToAbw,
  patchKrCloseZaoSlotToAbw,
  patchRestoreHeroExtraZao,
  patchZaoSlot,
  patchZaoSlotStampPrimary,
  readHeroActionPoolMax,
  readHeroActionPoolPair,
  readHeroExtraAngCount,
  readHeroExtraParCount,
  readHeroFaMax,
  readKrAbw,
  readKrParadeExtraSlots,
  readKrAng,
  readKrFirstSlotKind,
  readKrFreeAction,
  readKrLhAction,
  readKrLhSecondCharge,
  readKrPrimaryLadung,
  readKrSra,
  metaHasPendingLoadedNonHeroExtraZao,
  readZaoSlot,
  readZaoSlots,
  stampLhCompletion,
  undoKrActionStamp,
  undoLastZaoSlotStamp,
  motherPrimarySelfStamped,
  lhEndKrConvertArrowGates,
} from './krCounters.js'
import {
  getHideForeignHeroColorsForViewer,
  getShowActionStamps,
  onHideForeignHeroColorsForViewerChange,
  onShowActionStampsChange,
} from './localUiPrefs.js'
import {
  getRoomSettings,
  nextConvertLockState,
  onRoomSettingsChange,
  patchRoomSettings,
} from './roomSettings.js'
import {
  clampLhActionsPerKrForStorage,
  HERO_EXTRA_ANG_PHASE_OFFSET,
  HERO_SECOND_AO_PHASE_OFFSET,
  computeLhProgressDisplayHookIni,
  phaseOffsetFromHeroExtraAngMeta,
  phaseOffsetFromHeroSecondAoMeta,
  isLhActive,
  isLhLockingActions,
  LH_ACTIONS_PER_KR,
  LH_COMMIT_INI,
  LH_COMMIT_ROUND,
  LH_TRIGGER_INI_STEP,
  lhDisplayStepFromNav,
  lhPieFraction,
  lhProgressFractionText,
  phaseOffsetFromLhMeta,
  readLhCommitKrPriorSpendForRound,
  readLhMechanics,
  readLhState,
  storedTriggerIniStepFromPhaseOffsetPositive,
  trackerShowsLhSyntheticRow,
} from './lhMeta.js'
import {
  commitLhValue,
  LH_DONE_INI,
  removeLhDoneRow,
  runLongHandlungAfterCombatUpdate,
  tryCommitLhDoneTargetIni,
} from './longHandlung.js'
import {
  effectiveDeltaForField,
  runHeroExModsAfterCombatUpdate,
} from './heroExMods.js'
import { cancelLh } from './lhEngine.js'
import { createHitZoneOverlay, HIT_ZONE_INFO_ICON_SVG } from './hitZoneOverlay.js'
import {
  bulkApplyIniFromIbBeW6ForTrackedParticipants,
  HERO_EX_ENERGY_MODE,
  HERO_EX_LE_THRESHOLD,
  HERO_EX_SHOW_FK,
  HERO_EX_UNFAEHIG_FIXED_FIELDS,
  HERO_EX_UNFAEHIG_MARK_FIELDS,
  HERO_EX_UNFAEHIG_THRESHOLD,
  defaultUnfaehigThresholdForTemplate,
  mountHeroExpandBlock,
} from './iniModMeta.js'
import { purgeKrMarksBeforeRound } from './krCombatMarks.js'
import { KAMPF_GEAR_ICON_SVG } from './settingsPanel.js'
import {
  ensureRandomHeroBgColor,
  HERO_PALETTE_ROWS,
  patchHeroBgColor,
  readHeroBgColor,
} from './heroColors.js'
import { readOwnerIniReferenceForMods } from './ownerIniReference.js'
import { refreshAutoBundlesForItem } from './heroAutoMods.js'
import { mountWappenEditor } from './wappenEditor.js'
import {
  cleanupOrphanHitZoneKeys,
  cloneDefaultWappenDefs,
  cloneVierbeinerWappenDefs,
  HERO_EX_WAPPEN_OVERRIDE,
  HERO_EX_WAPPEN_TEMPLATE,
  normalizeWappenDefs,
} from './wappenDefs.js'

const HERO_DEATH_AT_MINUS_ONE_POINT_FIVE_KO = 'heroDeathAtMinusOnePointFiveKo'
const HERO_DEATH_MODE = 'heroDeathMode'

/** Letzter L.H.-Stand pro Token (für kurzes „fertig“ nach rem→0). */
const lhRenderPrev = new Map()

/** L.H.-Counter Animation pro Token (füllt zweite Ladung: Stern→weiße Fläche, dann Eingabe). */
const lhCounterPrimaryPrev = new Map()
const lhCounterAnimatedItems = new Set()

const TOKEN_DRAG_MIME = 'application/x-vierpunkteins-token'

const PHASE_DRAG_MARK = 'vierpphase|'

/**
 * INI der aktuellen Kampf-Navigation (aus `merged[idx]` per renderList). Wird
 * pro Render-Pass gesetzt und dient der nav-basierten L.H.-Counter-Anzeige.
 * `null`: keine laufende Navigation (Kampf nicht gestartet oder vor Intro).
 */
let currentNavIniForRender = null

/**
 * Nav-basierter L.H.-Bruch (passive Mechanik): gleiche Logik wie
 * `lhDisplayStepFromNav` / Primärfeld-Counter.
 *
 * @param {unknown} trackerMeta
 * @param {number} max
 * @param {number | null | undefined} combatRound
 * @returns {string}
 */
function lhFractionFromNavForMeta(trackerMeta, max, combatRound) {
  if (max <= 0) return ''
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
  const step = lhDisplayStepFromNav(
    heroIniNum,
    mechanics,
    commitRound,
    effectiveRound,
    currentNavIniForRender,
    max,
    Number.isFinite(commitIniStored) ? commitIniStored : undefined,
    priorSpend
  )
  if (max > 1 && step >= max) return 'GO!'
  return `${Math.max(1, step)}/${max}`
}

/** Bruch für „Aktion N / M“-Badge (Leerzeichen wie früher `actionStepText`). */
function lhActionStepLabelFromNavFraction(fracLabel, maxForGo) {
  if (!fracLabel) return ''
  if (fracLabel === 'GO!') return `${maxForGo} / ${maxForGo}`
  return fracLabel.replace('/', ' / ')
}

function navigationMatchesRow(
  ownerItemId,
  /** @type {string | null | undefined} */ rowNavigationPhaseLinkId,
  /** @type {string | null | undefined} */ activeId,
  /** @type {string | null | undefined} */ activePhaseLinkId
) {
  if (!activeId || ownerItemId !== activeId) return false
  const a =
    activePhaseLinkId != null && activePhaseLinkId !== ''
      ? activePhaseLinkId
      : null
  const r =
    rowNavigationPhaseLinkId != null && rowNavigationPhaseLinkId !== ''
      ? rowNavigationPhaseLinkId
      : null
  return a === r
}

function matchesMergedEntryActive(e, rowActiveId, rowActivePhaseLinkId) {
  if (!rowActiveId) return false
  if (e.kind === 'token') {
    return e.row.id === rowActiveId && !rowActivePhaseLinkId
  }
  if (e.kind === 'roundStart') {
    return rowActiveId === ROUND_START_STEP_ID && !rowActivePhaseLinkId
  }
  if (e.kind === 'roundEnd') {
    return rowActiveId === ROUND_END_STEP_ID && !rowActivePhaseLinkId
  }
  if (e.kind === 'lhDone') {
    return (
      e.ownerId === rowActiveId &&
      rowActivePhaseLinkId === LH_DONE_STEP_ID
    )
  }
  if (e.kind === 'phase') {
    return (
      e.ownerId === rowActiveId &&
      e.link?.id === rowActivePhaseLinkId
    )
  }
  return false
}

/** @param {'down' | 'up'} arrowDir */
function createRoundRowBulkIniButton(arrowDir) {
  const bulkIniBtn = document.createElement('button')
  bulkIniBtn.type = 'button'
  bulkIniBtn.className = 'init-row-round-ini-up-btn'
  const downSvg =
    '<svg class="init-row-round-ini-up-btn__graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 18" width="14" height="14" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M2.5 2.5H8.5M8.5 2.5V12"/><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M8.5 15.3L6.15 12.1H10.85L8.5 15.3"/></svg>'
  const upSvg =
    '<svg class="init-row-round-ini-up-btn__graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 18" width="14" height="14" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M1 15.5H8.5M8.5 15.5V6"/><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M8.5 3.2L6.2 6.2H10.8L8.5 3.2"/></svg>'
  bulkIniBtn.innerHTML = arrowDir === 'down' ? downSvg : upSvg
  bulkIniBtn.title =
    'INI für alle Listenteilnehmer aus IB − BE + W6 berechnen und in die INI-Felder setzen (nur wenn je Token IB, BE und W6 gültig ausgefüllt sind)'
  bulkIniBtn.setAttribute(
    'aria-label',
    'Initiative für alle Listenteilnehmer aus IB minus BE plus W6 setzen'
  )
  bulkIniBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void OBR.scene.items.getItems().then((fresh) =>
      bulkApplyIniFromIbBeW6ForTrackedParticipants(fresh)
    )
  })
  return bulkIniBtn
}

/** SL: Balken wie Spieler, INI-Button überlagert (mittig auf der Linie, Linie hinter Kästchen verborgen). */
function buildGmRoundRowWithIniOverlay(bar, arrowDir) {
  const wrap = document.createElement('div')
  wrap.className = 'init-row-round-gm-wrap'
  wrap.appendChild(bar)
  wrap.appendChild(createRoundRowConvertLockButton())
  wrap.appendChild(createRoundRowBulkIniButton(arrowDir))
  return wrap
}

const CONVERT_LOCK_SVG_OPEN =
  '<svg class="init-row-round-convert-lock-btn__graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path class="init-row-round-convert-lock-btn__shackle" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" d="M7 10V7.5a5 5 0 019.2-2.3"/><rect class="init-row-round-convert-lock-btn__body" x="3.5" y="9" width="17" height="13.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.65"/></svg>'
const CONVERT_LOCK_SVG_AUTO =
  '<svg class="init-row-round-convert-lock-btn__graph init-row-round-convert-lock-btn__graph--auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path class="init-row-round-convert-lock-btn__shackle" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" d="M7 10V8a5 5 0 0110 0v2"/><rect class="init-row-round-convert-lock-btn__body init-row-round-convert-lock-btn__body--auto-fill" x="3.5" y="9" width="17" height="13.5" rx="2.5"/><text class="init-row-round-convert-lock-btn__auto-a" x="12" y="18.8" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9.5" font-weight="800" fill="#ffffff">A</text></svg>'
const CONVERT_LOCK_SVG_CLOSED =
  '<svg class="init-row-round-convert-lock-btn__graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path class="init-row-round-convert-lock-btn__shackle" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" d="M7 10V8a5 5 0 0110 0v2"/><rect class="init-row-round-convert-lock-btn__body" x="3.5" y="9" width="17" height="13.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.65"/></svg>'

function convertLockSvgFor(state) {
  if (state === 'open') return CONVERT_LOCK_SVG_OPEN
  if (state === 'auto') return CONVERT_LOCK_SVG_AUTO
  return CONVERT_LOCK_SVG_CLOSED
}

function convertLockTitleFor(state) {
  if (state === 'open') {
    return 'Umwandlungs-Schloss: OFFEN — alle Spieler dürfen an ihren Helden umwandeln. Klick: → Automatik.'
  }
  if (state === 'auto') {
    return 'Umwandlungs-Schloss: AUTOMATIK — am Beginn/Ende der Kampfrunde dürfen alle Spieler umwandeln; sonst gilt die jeweilige Helden-Einstellung. Klick: → geschlossen.'
  }
  return 'Umwandlungs-Schloss: GESCHLOSSEN — Spieler dürfen die Umwandlungs-Pfeile nicht nutzen. Klick: → offen.'
}

function createRoundRowConvertLockButton() {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'init-row-round-convert-lock-btn'
  const state = getRoomSettings().convertLockState
  btn.dataset.lockState = state
  btn.innerHTML = convertLockSvgFor(state)
  btn.title = convertLockTitleFor(state)
  btn.setAttribute(
    'aria-label',
    `Umwandlungs-Schloss (aktuell ${state}). Klick wechselt zur nächsten Stufe (offen → Automatik → geschlossen).`
  )
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isGmSync()) return
    const cur = getRoomSettings().convertLockState
    const nxt = nextConvertLockState(cur)
    void patchRoomSettings((s) => ({ ...s, convertLockState: nxt }))
  })
  return btn
}

/**
 * Entscheidet, ob der aktuelle Betrachter (kein-SL) bei diesem Token die
 * Umwandlungs-Pfeile nutzen darf. Die Owner-Berechtigung (`canEdit`) wird hier
 * nicht geprüft — sie ist Voraussetzung und wird vom Aufrufer kombiniert.
 *
 * Regelwerk:
 * - SL: immer erlaubt (das Schloss gilt nur für Spieler).
 * - Schloss „offen“: immer erlaubt.
 * - Schloss „geschlossen“: nie erlaubt.
 * - Schloss „Automatik“:
 *   - Heldenmodus „Gesamte Kampfrunde“ (inkl. Legacy `convertAnytimeEnabled`) → erlaubt.
 *   - Navigation steht auf Beginn/Ende der Kampfrunde → erlaubt.
 *   - Sonst greifen die Helden-Ansageoptionen:
 *     · `convertAllowEntireRound` → erlaubt (gesamte KR).
 *     · `convertAllowFirstPhase`  → erlaubt, solange die Navigation noch nicht
 *       hinter die erste INI-Phase des Helden gewandert ist
 *       (`currentNavIni >= heroIni`).
 *     · andernfalls → nicht erlaubt.
 */
/** Eine der beiden Ansageoptionen oder keine (nie beides). */
function convertAnnounceModeFromHeroMeta(m) {
  if (!m) return 'none'
  if (m.convertAllowEntireRound) return 'entireRound'
  if (m.convertAnytimeEnabled) return 'entireRound'
  if (m.convertAllowFirstPhase) return 'firstPhase'
  return 'none'
}

function isHeroConvertAnytimeMode(m) {
  if (!m || typeof m !== 'object') return false
  return m.convertAllowEntireRound === true || m.convertAnytimeEnabled === true
}

function isHeroConvertAllowedForViewer(
  trackerMeta,
  rowActiveId,
  rowActivePhaseLinkId,
  currentNavIni
) {
  if (isGmSync()) return true
  const lock = getRoomSettings().convertLockState
  if (lock === 'closed') return false
  if (isHeroConvertAnytimeMode(trackerMeta)) return true
  if (lock === 'open') return true
  const atRoundBoundary =
    !rowActivePhaseLinkId &&
    (rowActiveId === ROUND_START_STEP_ID || rowActiveId === ROUND_END_STEP_ID)
  if (atRoundBoundary) return true
  if (!trackerMeta) return false
  if (trackerMeta.convertAllowEntireRound) return true
  if (trackerMeta.convertAllowFirstPhase) {
    if (currentNavIni == null) return true
    const heroIni = Number(
      String(trackerMeta.initiative ?? '').trim().replace(',', '.')
    )
    if (!Number.isFinite(heroIni)) return false
    return currentNavIni >= heroIni
  }
  return false
}

function mergeActionStampsIntoMerged(merged, stampEntries) {
  const working = [...merged]
  for (const stamp of stampEntries) {
    const ar =
      typeof stamp.anchorRowId === 'string' ? stamp.anchorRowId : null
    const apl =
      typeof stamp.anchorPhaseLinkId === 'string'
        ? stamp.anchorPhaseLinkId
        : null
    let matchIdx = -1
    if (ar != null) {
      matchIdx = working.findIndex((e) =>
        matchesMergedEntryActive(e, ar, apl)
      )
    }
    if (matchIdx < 0) {
      matchIdx = working.findIndex(
        (e) => e.kind === 'token' && e.row.id === stamp.itemId
      )
    }
    if (matchIdx < 0) {
      matchIdx = working.findIndex((e) => e.kind === 'token')
    }
    if (matchIdx < 0) continue
    let pos = matchIdx + 1
    while (
      pos < working.length &&
      working[pos].kind === 'actionStamp'
    ) {
      pos++
    }
    working.splice(pos, 0, { kind: 'actionStamp', stamp })
  }
  return working
}

/**
 * INI-Tausch: direkt aufeinanderfolgende Listeneinträge (wie angezeigt) mit gleicher INI;
 * Action-Stempel dazwischen = kein Paar. Beliebige Typen (Token, 2.A., L.H., Phasen-Kind).
 */
function collectAdjacentSameIniSwapPairs(mergedWithStamps) {
  const discPairs = []
  for (let i = 0; i < mergedWithStamps.length - 1; i++) {
    const u = mergedWithStamps[i]
    const l = mergedWithStamps[i + 1]
    if (u.kind === 'actionStamp' || l.kind === 'actionStamp') continue
    if (
      u.kind === 'roundEnd' ||
      l.kind === 'roundEnd' ||
      u.kind === 'roundStart' ||
      l.kind === 'roundStart'
    ) {
      continue
    }
    const du = mergedEntryDiscriminator(u)
    const dl = mergedEntryDiscriminator(l)
    if (!du || !dl) continue
    const iniU =
      u.kind === 'token' ? u.row.initiative : formatIniForSort(u.hookIni)
    const iniL =
      l.kind === 'token' ? l.row.initiative : formatIniForSort(l.hookIni)
    if (
      initiativeCompareOnlyIni(
        { initiative: iniU, name: '' },
        { initiative: iniL, name: '' }
      ) !== 0
    ) {
      continue
    }
    discPairs.push([du, dl])
  }
  return discPairs
}

function createInitExpandSpacerCell() {
  const col = document.createElement('div')
  col.className = 'init-col-expand'
  col.setAttribute('aria-hidden', 'true')
  return col
}

function createInitExpandCloseCell({ title, ariaLabel, canEdit, onClick }) {
  const col = document.createElement('div')
  col.className = 'init-col-expand init-col-expand--close'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'init-row-expand-close'
  btn.textContent = '×'
  btn.title = title
  btn.setAttribute('aria-label', ariaLabel || title)
  btn.disabled = !canEdit
  if (canEdit && typeof onClick === 'function') {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onClick()
    })
  }
  col.appendChild(btn)
  return col
}

const ACTION_STAMP_LABEL = Object.freeze({
  [KR_ANG]: 'Angriff',
  [KR_ABW]: 'Abwehr',
  [KR_SRA]: 'S.R.A.',
  [KR_FREE_ACTION]: 'F.A.',
  [KR_LH_ACTION]: 'L.H.',
})

function availableFreeActions(usedRaw, faMaxRaw) {
  const max = Math.max(0, Math.min(10, Math.floor(Number(faMaxRaw)) || 0))
  const used = Math.max(0, Math.floor(Number(usedRaw)) || 0)
  return Math.max(0, max - used)
}

function primaryLadungAria(v, labelDe, stampAllowed) {
  if (v <= 0) {
    if (stampAllowed === false) {
      return `${labelDe}, Ladung geladen: Stempeln nur, wenn die Kampf-Navigation auf dieser Zeile steht`
    }
    return `${labelDe}, Ladung geladen: Klick in die untere Fläche stempelt an der aktuellen Listenposition; die Ladung wird verbraucht`
  }
  return `${labelDe}, Ladung verbraucht: Rechtsklick auf dieses Kästchen holt die Ladung zurück (letzter Stempel dieser Aktion wird entfernt)`
}

/** @param {'primary' | 'abw'} variant */
function applySplitLadungVisual(shell, chargeRow, exec, v, variant) {
  const spent = variant === 'abw' ? v === 1 : v >= 1
  const shellSpent =
    variant === 'abw'
      ? 'init-kr-abw-split-shell--spent'
      : 'init-kr-primary-shell--spent'
  shell.classList.toggle(shellSpent, spent)
  if (variant === 'primary') {
    chargeRow.classList.toggle('init-kr-primary-charge--empty', spent)
  } else {
    chargeRow.classList.remove('init-kr-abw-charge--empty')
  }
  const fill = exec.querySelector('.init-row-kr-counter__fill')
  const digit = exec.querySelector('.init-row-kr-counter__digit')
  const primaryIcon = exec.querySelector('.init-kr-primary-charge-icon')
  if (!fill || !digit) return
  const showDigit = variant === 'abw' && v >= 2
  fill.classList.toggle('init-row-kr-counter__fill--on', !spent)
  digit.textContent = showDigit ? String(v) : ''
  exec.classList.toggle('init-row-kr-counter--has-digit', showDigit)
  if (primaryIcon) {
    primaryIcon.classList.toggle('init-kr-primary-charge-icon--on', !spent)
  }
}

function applyPrimaryLadungVisual(shell, chargeRow, exec, v) {
  applySplitLadungVisual(shell, chargeRow, exec, v, 'primary')
}

function faCounterAria(used, faMax) {
  const avail = availableFreeActions(used, faMax)
  const cap = Math.max(0, Math.min(4, Math.floor(Number(faMax)) || 2))
  return `Freie Aktion, ${avail} verfügbar von ${cap} · Linksklick +1, Rechtsklick −1`
}

function actionPhaseRangeLabel(rootCount) {
  if (rootCount <= 0) return '2. Aktionsphase'
  if (rootCount === 1) return '2. Aktionsphase'
  return `2.–${rootCount + 1}. Aktionsphase`
}

function abwLadungAria(v, allowed) {
  const count = abwShieldCount(v)
  const abwMax = krAbwTransferMaxMarks()
  if (count >= 1) {
    if (count >= 2) {
      return `Abwehr, ${count} Schildladungen geladen (maximal ${abwMax})`
    }
    return allowed
      ? 'Abwehr, Ladung geladen: Klick unten stempelt; am Rundenbeginn/-ende gesperrt'
      : 'Abwehr, Ladung geladen: am Rundenbeginn/-ende gesperrt'
  }
  return 'Abwehr, Ladung verbraucht: Rechtsklick auf das Kästchen holt die Ladung zurück'
}

function abwShieldCount(vRaw) {
  const v = normalizeKrDigit(vRaw)
  if (v === 1) return 0
  if (v === 0) return 1
  return v
}

const SVG_ARROW_TO_AB = `<svg class="init-kr-convert-cell__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 12" width="18" height="11" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M2 6h11M11 2l4 4-4 4"/></svg>`
const SVG_ARROW_TO_ANG = `<svg class="init-kr-convert-cell__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 12" width="18" height="11" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M18 6H7M9 10L5 6l4-4"/></svg>`
const SVG_FA_BOLT = `<svg class="init-fa-cell__bolt-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 28" aria-hidden="true"><ellipse cx="9" cy="14" rx="4.4" ry="11.6" fill="#7e57c2" opacity="0.28"/><path fill="#311b92" d="M9 0.8 Q11.2 8 12.4 14 Q11.2 20 9 27.2 Q6.8 20 5.6 14 Q6.8 8 9 0.8 Z"/><path fill="#7e57c2" d="M9 3.4 Q10.6 8.7 11.6 14 Q10.6 19.3 9 24.6 Q7.4 19.3 6.4 14 Q7.4 8.7 9 3.4 Z"/><path fill="#ffd54f" opacity="0.95" d="M9 6.6 Q9.7 10.3 10.05 14 Q9.7 17.7 9 21.4 Q8.3 17.7 7.95 14 Q8.3 10.3 9 6.6 Z"/><path fill="#fffde7" opacity="0.85" d="M9 9.6 Q9.25 11.6 9.35 14 Q9.25 16.4 9 18.4 Q8.75 16.4 8.65 14 Q8.75 11.6 9 9.6 Z"/><path fill="none" stroke="#b8860b" stroke-width="0.5" stroke-linejoin="round" d="M9 0.8 Q11.2 8 12.4 14 Q11.2 20 9 27.2 Q6.8 20 5.6 14 Q6.8 8 9 0.8 Z"/></svg>`
const SVG_PRIMARY_LH_STAR = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--lh" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#5d4037" d="M12 5l3.35 6.95 7.55.55-5.75 4.95 1.8 7.4L12 21.05 5.05 24.85l1.8-7.4L1.1 12.5l7.55-.55z"/><path fill="#0c2e24" d="M12 6.45 14.85 12.4l6.55.5-4.95 4.25 1.55 6.45L12 20.2 5.95 23.6l1.55-6.45L2.6 12.9l6.55-.5z"/><path fill="#1f6b4a" d="M12 8 14.45 13l5.65.45-4.3 3.7 1.35 5.55L12 19.5l-5.15 3.2 1.35-5.55-4.3-3.7 5.65-.45z"/><path fill="#3a9d6e" d="M12 9.65 13.95 13.7l4.6.35-3.55 3.05 1.1 4.55L12 19l-4.1 2.6 1.1-4.55-3.55-3.05 4.6-.35z"/><circle cx="12" cy="14.95" r="1.55" fill="#b8860b"/><circle cx="12" cy="14.95" r="0.85" fill="#fffde7"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M12 5l3.35 6.95 7.55.55-5.75 4.95 1.8 7.4L12 21.05 5.05 24.85l1.8-7.4L1.1 12.5l7.55-.55z"/></svg>`
const SVG_PRIMARY_ATTACK = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--ang" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><ellipse cx="12" cy="30.6" rx="2.5" ry="2.3" fill="#5d4037"/><circle cx="12" cy="30.6" r="1.85" fill="#b8860b"/><circle cx="12" cy="30.6" r="0.85" fill="#7e1010"/><path fill="#3e2723" d="M10.4 22.4 H13.6 V29.8 H10.4 Z"/><path fill="#5d4037" d="M10.55 22.6 H13.45 V23.5 H10.55 Z M10.55 24.4 H13.45 V25.3 H10.55 Z M10.55 26.2 H13.45 V27.1 H10.55 Z M10.55 28.0 H13.45 V28.9 H10.55 Z"/><path fill="#4f4643" d="M3.4 18.9 H20.6 L18.6 22.4 H5.4 Z"/><path fill="#6d615d" d="M4.2 19.3 H19.8 L18.0 22.0 H6.0 Z"/><ellipse cx="12" cy="20.7" rx="1.7" ry="1.0" fill="#584e4a"/><path fill="#5d4037" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 Z"/><path fill="#7e1010" d="M10.2 18.5 L11.6 2.5 L12.4 2.5 L13.8 18.5 Z"/><path fill="#c62828" d="M10.65 18.3 L11.7 3.4 L12.3 3.4 L13.35 18.3 Z"/><path fill="#ef9a9a" opacity="0.85" d="M11.85 4 L12.15 4 L12.0 17.6 Z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 H20.6 L18.6 22.4 H13.6 V29.8 A1.6 1.6 0 1 1 10.4 29.8 V22.4 H5.4 L3.4 18.9 Z"/></svg>`

/** S.R.A.: gleiche Sternform wie L.H., Farbpalette orange statt grün. */
const SVG_PRIMARY_ACTION = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--sra" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#5d4037" d="M12 5l3.35 6.95 7.55.55-5.75 4.95 1.8 7.4L12 21.05 5.05 24.85l1.8-7.4L1.1 12.5l7.55-.55z"/><path fill="#3d1608" d="M12 6.45 14.85 12.4l6.55.5-4.95 4.25 1.55 6.45L12 20.2 5.95 23.6l1.55-6.45L2.6 12.9l6.55-.5z"/><path fill="#ef6c00" d="M12 8 14.45 13l5.65.45-4.3 3.7 1.35 5.55L12 19.5l-5.15 3.2 1.35-5.55-4.3-3.7 5.65-.45z"/><path fill="#ffca28" d="M12 9.65 13.95 13.7l4.6.35-3.55 3.05 1.1 4.55L12 19l-4.1 2.6 1.1-4.55-3.55-3.05 4.6-.35z"/><circle cx="12" cy="14.95" r="1.55" fill="#ff8f00"/><circle cx="12" cy="14.95" r="0.85" fill="#fffde7"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M12 5l3.35 6.95 7.55.55-5.75 4.95 1.8 7.4L12 21.05 5.05 24.85l1.8-7.4L1.1 12.5l7.55-.55z"/></svg>`
const SVG_ABW_SHIELD = `<svg class="init-kr-abw-shield__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#5d4037" d="M12 2l8 3v8.4c0 6.9-3.2 13-8 15.8-4.8-2.8-8-8.9-8-15.8V5l8-3z"/><path fill="#1a237e" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/><path fill="#3949ab" d="M12 5.55 7.15 7.25v6.45c0 4.2 1.85 8.1 4.85 10.2 3-2.1 4.85-6 4.85-10.2V7.25L12 5.55z"/><path fill="#b8860b" d="M12 2.75 19.05 4.85 18.85 5.45 12 3.75 5.15 5.45 4.95 4.85 12 2.75z"/><path fill="#90caf9" opacity="0.4" d="M8.65 9.1c1.05 2.5 1.55 5.15 1.55 7.95 0 3.45-.75 6.75-2.1 9.75 1.85-1.7 3.05-4.55 3.05-7.75 0-3.25-.85-6.3-2.5-8.95z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/></svg>`
/** Wie blaues Schild, aber dunkel schwarz-grau — Zusatz-Parade (nicht umwandelbar). */
const SVG_ABW_SHIELD_DARK = `<svg class="init-kr-abw-shield__svg init-kr-abw-shield__svg--parade" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#3e2723" d="M12 2l8 3v8.4c0 6.9-3.2 13-8 15.8-4.8-2.8-8-8.9-8-15.8V5l8-3z"/><path fill="#0d1117" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/><path fill="#263238" d="M12 5.55 7.15 7.25v6.45c0 4.2 1.85 8.1 4.85 10.2 3-2.1 4.85-6 4.85-10.2V7.25L12 5.55z"/><path fill="#6d4c41" d="M12 2.75 19.05 4.85 18.85 5.45 12 3.75 5.15 5.45 4.95 4.85 12 2.75z"/><path fill="#78909c" opacity="0.35" d="M8.65 9.1c1.05 2.5 1.55 5.15 1.55 7.95 0 3.45-.75 6.75-2.1 9.75 1.85-1.7 3.05-4.55 3.05-7.75 0-3.25-.85-6.3-2.5-8.95z"/><path fill="none" stroke="#212121" stroke-width="0.45" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/></svg>`

/** @param {'ang' | 'sra' | 'lh'} k */
function nextKrPrimarySlotKind(k) {
  if (k === 'ang') return 'sra'
  if (k === 'sra') return 'lh'
  return 'ang'
}

/** @param {'ang' | 'sra' | 'lh'} k */
function prevKrPrimarySlotKind(k) {
  if (k === 'ang') return 'lh'
  if (k === 'sra') return 'ang'
  return 'sra'
}

/**
 * Zyklus der Mutter-Primäraktion (AN → A → L.H. → AN …).
 *
 * Bei INI < 0 (`iniLocked`) wird das Schwert (`'ang'`) aus der Auswahl
 * ausgeblendet: der Zyklus springt nur zwischen `'sra'` und `'lh'`. Das
 * passt zu `applyIniLockCharges`, das bei INI < 0 die Gesamtzahl der
 * Ladungen auf 1 begrenzt (Priorität A vor B) und bei INI ≥ 0 wieder
 * herstellt. Die vorhandene Ladung bleibt über die Umwandelpfeile voll
 * zwischen Schild und Primärseite austauschbar.
 *
 * @param {'ang' | 'sra' | 'lh'} k
 * @param {'next' | 'prev'} dir
 * @param {boolean} [iniLocked]
 * @returns {'ang' | 'sra' | 'lh'}
 */
function cycleKrPrimarySlotKind(k, dir, iniLocked = false) {
  let next =
    dir === 'next' ? nextKrPrimarySlotKind(k) : prevKrPrimarySlotKind(k)
  if (iniLocked && next === 'ang') {
    next = dir === 'next' ? nextKrPrimarySlotKind(next) : prevKrPrimarySlotKind(next)
  }
  return next
}

/**
 * Erstes Feld: oben Aktionstyp (AN / A / LH), unten einmalige Ladung in Typfarbe.
 * Ladung voll (Zähler 0): Klick unten stempelt wie bisher und verbraucht die Ladung (oben verbraucht, unten leer).
 * Rechtsklick irgendwo auf dem Kästchen: Ladung zurück, letzter Stempel dieser Aktion entfernen (Zähler −1).
 * Oben: Klick schaltet zyklisch AN → A → L.H. (ohne Dropdown).
 * Ladung stempeln nur, wenn die Kampf-Navigation auf dieser Zeile steht (`primaryLadungAllowed`).
 *
 * @param {{ rootCount: number, badgeNumber: number, canCreateSecondAction: boolean, title?: string } | null | undefined} [secondActionBadgeUi]
 *        Kleine Zahl unten rechts: Mutter = 1, erste reguläre 2.A.-Wurzel = 2 usw.
 * @param {boolean} [phaseRowActive] — Navigierte Zeile (Stempeln erlaubt); sonst gedimmte Darstellung.
 */
function appendKrPrimarySplitCell(
  container,
  ownerItemId,
  trackerMeta,
  canEdit,
  primaryLadungAllowed,
  secondActionBadgeUi = null,
  phaseRowActive = true,
  combatRound = null,
  zaoSlotOverride = null,
  boundaryAsActiveVisual = false
) {
  const isZaoSlot = Boolean(zaoSlotOverride)
  const kind = isZaoSlot
    ? zaoSlotOverride.kind
    : readKrFirstSlotKind(trackerMeta)
  // INI < 0 greift nur am Mutter-Primärslot, nicht an 2.A.O.-Slots.
  // Bei angMode 'yes' bleibt das Schwert erlaubt, auch bei INI < 0.
  const iniLocked =
    !isZaoSlot &&
    isHeroIniBelowZero(trackerMeta) &&
    readHeroIniNegAngMode(trackerMeta) !== 'yes'
  const iniLockHint =
    ' — INI < 0: Schwert als Option gesperrt, nur noch eine Ladung.'
  /** @type {string} */
  let field = KR_ANG
  if (kind === 'sra') field = KR_SRA
  else if (kind === 'lh') field = KR_LH_ACTION
  const counterKind = krFieldToCounterKind(field)
  const labelDe = ACTION_STAMP_LABEL[field] || 'Aktion'

  const shell = document.createElement('div')
  shell.className = 'init-kr-primary-shell'
  const v = isZaoSlot
    ? zaoSlotOverride.marks === 1
      ? 0
      : 1
    : normalizeKrDigit(readKrPrimaryLadung(trackerMeta))
  const kindLabelLong =
    kind === 'sra'
      ? 'Sonstige reg. Aktion (A) — z. B. Atem holen, Bewegen, Position, Taktik'
      : kind === 'lh'
        ? 'Längerfristige Handlung (L.H.)'
        : 'Angriff (AN)'
  const primaryTooltipLabel =
    kind === 'sra'
      ? `${labelDe}: Sonstige reguläre Aktion wie Atem holen, Bewegen, Position und Taktik`
      : labelDe
  const switchCol = document.createElement('div')
  switchCol.className = 'init-kr-primary-switch'
  const prevBtn = document.createElement('button')
  prevBtn.type = 'button'
  prevBtn.className = 'init-kr-primary-switch__btn'
  prevBtn.innerHTML =
    '<svg class="init-kr-primary-switch__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 12" width="12" height="8" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m3 9 7-6 7 6"/></svg>'
  prevBtn.title = `Vorige Aktion (${kindLabelLong})${iniLocked ? iniLockHint : ''}`
  prevBtn.setAttribute('aria-label', 'Vorige Aktion wählen')
  // Normale 2.A.O.-Slots dürfen immer zwischen Ang/SRA/L.H. umschalten.
  // Nur Helden-Zusatz-Objekte (`heroExtra` / ZAO) bleiben fix, weil deren
  // Ladung nicht umwandel- oder tauschbar ist.
  const isHeroExtraSlot = isZaoSlot && Boolean(zaoSlotOverride.heroExtra)
  const isLhEndSlot = isZaoSlot && Boolean(zaoSlotOverride.lhEnd)
  // n.A.-Slot (lhEnd) ist konzeptuell der L.H.-Stempel-Anker; der Kind-
  // Switch (Ang/SRA/L.H.) bleibt hier gesperrt, damit nur der LH-Pie-
  // Stempel-Pfad greift.
  const switchLocked = isHeroExtraSlot || isLhEndSlot
  prevBtn.disabled = !canEdit || switchLocked
  if (switchLocked) {
    prevBtn.title = 'ZAO: Aktion ist fest und kann nicht umgeschaltet werden.'
  }
  if (canEdit && !switchLocked) {
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const next = cycleKrPrimarySlotKind(kind, 'prev', iniLocked)
      if (isZaoSlot) {
        void patchZaoSlot(ownerItemId, zaoSlotOverride.linkId, { kind: next })
      } else {
        void patchKrFirstSlotKind(ownerItemId, next)
      }
    })
  }
  const nextBtn = document.createElement('button')
  nextBtn.type = 'button'
  nextBtn.className = 'init-kr-primary-switch__btn'
  nextBtn.innerHTML =
    '<svg class="init-kr-primary-switch__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 12" width="12" height="8" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m3 3 7 6 7-6"/></svg>'
  nextBtn.title = `Nächste Aktion (${kindLabelLong})${iniLocked ? iniLockHint : ''}`
  nextBtn.setAttribute('aria-label', 'Nächste Aktion wählen')
  nextBtn.disabled = !canEdit || switchLocked
  if (switchLocked) {
    nextBtn.title = prevBtn.title
  }
  if (canEdit && !switchLocked) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const next = cycleKrPrimarySlotKind(kind, 'next', iniLocked)
      if (isZaoSlot) {
        void patchZaoSlot(ownerItemId, zaoSlotOverride.linkId, { kind: next })
      } else {
        void patchKrFirstSlotKind(ownerItemId, next)
      }
    })
  }
  switchCol.append(prevBtn, nextBtn)

  // Mit der 1-Ladung-pro-Objekt-Regel gibt es keine zweite Ladung und kein
  // „voided“-Halbstern-Layout mehr; Mutter L.H. zeigt entweder Stern (geladen)
  // oder ausgegraut (leer).
  const lhSecond = 1
  const lhExplicitSecond = false
  const lhNeedsSecond = false
  const lhVoided =
    !isZaoSlot && kind === 'lh' && Boolean(trackerMeta?.[KR_LH_VOID_BY_TRANSFER])
  const lhStatePrimary =
    !isZaoSlot && kind === 'lh' ? readLhState(trackerMeta) : { max: 0, rem: 0 }
  // Mit der neuen Regel: Counter-Eingabe wandert in die Schildspalte und wird
  // dort getriggert, wenn Mutter-L.H. + L.H.-2.A.O. beide geladen sind.
  // Hier nur noch: visuelle „voll geladen“-Markierung an der Mutter.
  const lhFullyLoaded = !isZaoSlot && kind === 'lh' && v < 1

  const main = document.createElement('div')
  main.className =
    'init-kr-primary-main init-kr-primary-main--' +
    (kind === 'sra' ? 'sra' : kind === 'lh' ? 'lh' : 'ang')
  if (lhNeedsSecond) {
    main.classList.add('init-kr-primary-main--lh-wait-second')
  }
  if (lhVoided) {
    main.classList.add('init-kr-primary-main--lh-voided')
  }
  // Ohne laufende L.H.: leeres Primär-L.H. ausgrauen. Mit gesetztem lhMax
  // (Counter im Schild) ist v oft >= 1 ohne KR-Markierung — Stern trotzdem
  // vollfarbig (v. a. INI < 0).
  const lhNoChargeVisual =
    kind === 'lh' &&
    (lhVoided || v >= 1) &&
    !lhFullyLoaded &&
    lhStatePrimary.max <= 0
  if (lhNoChargeVisual) {
    main.classList.add('init-kr-primary-main--lh-empty')
  }

  const exec = document.createElement('button')
  exec.type = 'button'
  exec.className = `init-kr-primary-main__exec init-kr-primary-main__exec--${counterKind}`
  const icon = document.createElement('span')
  icon.className = 'init-kr-primary-main__icon'
  icon.setAttribute('aria-hidden', 'true')
  // L.H.-Pie-Anteil: Bei laufender L.H. wird der Stern als Kuchen-Diagramm
  // dargestellt — am Mutter-Slot (Mutter-LH) und am n.A.-Slot (lhEnd-Phase).
  // 0…1 ueber `--lh-pie-frac`, gerendert per conic-gradient mask in CSS.
  let lhPieFracValue = null
  let lhPieFullyFilled = false
  if (kind === 'lh' && !lhVoided && !lhNeedsSecond) {
    const lhStForPie = isZaoSlot
      ? readLhState(trackerMeta)
      : lhStatePrimary
    if (lhStForPie.max > 0) {
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
      const priorSpendPie = readLhCommitKrPriorSpendForRound(
        trackerMeta,
        effectiveRound
      )
      lhPieFracValue = lhPieFraction(
        effectiveRound,
        currentNavIniForRender,
        commitRound,
        heroIniNum,
        mechanics.actionsPerKr,
        mechanics.triggerIniStep,
        lhStForPie.max,
        Number.isFinite(commitIniStored) ? commitIniStored : undefined,
        priorSpendPie
      )
      lhPieFullyFilled = lhPieFracValue >= 1
    }
  }
  if (kind === 'sra') {
    icon.innerHTML = SVG_PRIMARY_ACTION
  } else if (kind === 'lh') {
    if (lhVoided) {
      icon.classList.add('init-kr-primary-main__icon--lh-split')
      icon.innerHTML =
        '<span class="init-kr-primary-lh-split" aria-hidden="true"><span class="init-kr-primary-lh-split__live init-kr-primary-lh-split__live--void"></span><span class="init-kr-primary-lh-split__blank"></span></span>'
    } else if (lhNeedsSecond) {
      icon.classList.add('init-kr-primary-main__icon--lh-split')
      icon.innerHTML = `<span class="init-kr-primary-lh-split"><span class="init-kr-primary-lh-split__live init-kr-primary-lh-split__live--half-star">${SVG_PRIMARY_LH_STAR}</span><span class="init-kr-primary-lh-split__blank"></span></span>`
    } else if (lhPieFracValue !== null) {
      icon.classList.add('init-kr-primary-main__icon--lh-pie')
      icon.style.setProperty('--lh-pie-frac', String(lhPieFracValue))
      icon.innerHTML =
        `<span class="init-kr-primary-lh-pie" aria-hidden="true">` +
        `<span class="init-kr-primary-lh-pie__disc" aria-hidden="true"></span>` +
        `<span class="init-kr-primary-lh-pie__base">${SVG_PRIMARY_LH_STAR}</span>` +
        `<span class="init-kr-primary-lh-pie__fill">${SVG_PRIMARY_LH_STAR}</span>` +
        `</span>`
      if (lhPieFullyFilled) {
        icon.classList.add('init-kr-primary-main__icon--lh-pie-full')
      }
    } else {
      icon.innerHTML = SVG_PRIMARY_LH_STAR
    }
  } else {
    icon.innerHTML = SVG_PRIMARY_ATTACK
  }
  if (
    !isZaoSlot &&
    (lhVoided ||
      ((kind === 'ang' || kind === 'sra') &&
        Boolean(trackerMeta?.[KR_PRIMARY_VOID_BY_ABW_TRANSFER])))
  ) {
    icon.classList.add('init-kr-primary-main__icon--hidden-by-abw-transfer')
  }
  exec.append(icon)
  const hasPrimaryCharge = krTransferMarkPresent(v)
  const primarySpentVisual = !hasPrimaryCharge && !lhVoided
  exec.classList.toggle(
    'init-kr-primary-main__exec--spent',
    primarySpentVisual && phaseRowActive
  )
  shell.classList.toggle(
    'init-kr-primary-shell--spent',
    primarySpentVisual && phaseRowActive
  )
  shell.classList.toggle(
    'init-kr-primary-shell--inactive-charged',
    !phaseRowActive && hasPrimaryCharge && !lhVoided
  )
  const inactiveEmpty =
    !phaseRowActive && !hasPrimaryCharge && !lhVoided
  shell.classList.toggle('init-kr-primary-shell--inactive-empty', inactiveEmpty)
  shell.classList.toggle(
    'init-kr-primary-shell--inactive-empty-ang',
    inactiveEmpty && kind === 'ang'
  )
  /* A-Spalte: Aktions-Objekte ohne Ladung generell ausblenden (Mutter und
     2.A.O.-Slots). L.H.-Void (Ladung temporär im Schild) bleibt sichtbar;
     Ausnahme für ZAO-Restore-„+“ greift per :has() in der CSS-Regel.
     Laufende L.H. (Ziel gesetzt): Primärfeld oft ohne KR-Markierung, Counter
     im Schild — Stern/Pie trotzdem sichtbar lassen. */
  shell.classList.toggle(
    'init-kr-primary-shell--no-charge',
    !hasPrimaryCharge &&
      !lhVoided &&
      !(kind === 'lh' && lhStatePrimary.max > 0)
  )
  // Optik an KR-Grenzen: Icons (Schwert/Schild/L.H./S.R.A.) werden hier so
  // dargestellt, als wäre die Navigation gerade auf der eigenen Zeile —
  // nav-blocked-Dimmung wird unterdrückt. Mechanik (disabled / Click-Handler /
  // Titel) bleibt unverändert: Stempeln ist an KR-Grenzen weiter gesperrt.
  shell.classList.toggle(
    'init-kr-primary-shell--nav-blocked',
    Boolean(
      canEdit &&
        hasPrimaryCharge &&
        !boundaryAsActiveVisual &&
        (!primaryLadungAllowed || (kind === 'lh' && lhNeedsSecond))
    )
  )
  const stampOk =
    !canEdit ||
    (primaryLadungAllowed && !(kind === 'lh' && lhNeedsSecond))
  const lhSecondHint =
    kind === 'lh' && lhNeedsSecond
      ? `${labelDe}: Zuerst eine Abwehr-Schildladung über den unteren Pfeil im Umwandlungsfeld hierher umwandeln.`
      : ''
  exec.title = canEdit
    ? hasPrimaryCharge
      ? !primaryLadungAllowed
        ? `${primaryTooltipLabel}: Ladung stempeln erst, wenn die Navigation auf dieser Zeile steht (aktuell anderer Zug).`
        : lhSecondHint ||
          `${primaryTooltipLabel}: Untere Ladung anklicken — an aktueller Listenposition stempeln und Ladung verbrauchen`
      : lhVoided
        ? `${labelDe}: Ladungen ins Abwehr-Schild gelegt — unten Schild zurück ins Feld; Rechtsklick hebt die Leerung auf (ohne Stempel).`
        : `${primaryTooltipLabel}: Rechtsklick auf das Kästchen — Ladung zurück, letzten Stempel entfernen`
    : `${primaryTooltipLabel} (nur Anzeige)`
  exec.setAttribute(
    'aria-label',
    canEdit && kind === 'lh' && lhNeedsSecond
      ? `${labelDe}: Zweite Ladung fehlt — eine Abwehr-Schildladung über den unteren Pfeil im Umwandlungsfeld zu L.H. umwandeln.`
      : canEdit && kind === 'lh' && lhVoided
        ? `${labelDe}: Feld geleert ins Abwehr-Schild — unten Schild zurückladen; Rechtsklick macht die Leerung rückgängig.`
        : primaryLadungAria(v, primaryTooltipLabel, stampOk)
  )
  // Längerfristige Handlung läuft (und endet NICHT in dieser KR):
  // Ang/SRA-Primärfeld (Mutter und ZAO) visuell gedimmt + disabled.
  // L.H.-Slots bleiben sichtbar/passiv. In der End-KR sind Ang/SRA wieder
  // frei, damit der Held weiterkämpfen kann.
  const lhLockActive =
    isLhLockingActions(trackerMeta, combatRound) && kind !== 'lh'
  if (lhLockActive) {
    exec.classList.add('init-kr-primary-main__exec--lh-locked')
    shell.classList.add('init-kr-primary-shell--lh-locked')
    exec.title =
      'Längerfristige Handlung läuft – nur freie Aktionen erlaubt.'
  }
  // L.H.-Pie voll & Navigation auf eigener Zeile: Stempeln freischalten,
  // sonst (Pie noch unvollstaendig) Klick deaktivieren.
  const lhPieStampReady =
    kind === 'lh' && lhPieFullyFilled && primaryLadungAllowed
  exec.disabled =
    !canEdit ||
    lhLockActive ||
    (kind === 'lh' && hasPrimaryCharge && lhNeedsSecond) ||
    (hasPrimaryCharge && !primaryLadungAllowed) ||
    (kind === 'lh' && !lhPieStampReady)
  const primaryStampHighlight =
    canEdit &&
    !lhLockActive &&
    primaryLadungAllowed &&
    (kind === 'lh'
      ? lhPieStampReady
      : kind === 'ang' || kind === 'sra'
        ? hasPrimaryCharge
        : false)
  main.classList.toggle(
    'init-kr-primary-main--stamp-hi',
    Boolean(primaryStampHighlight)
  )
  main.classList.toggle(
    'init-kr-primary-main--stampable-now',
    Boolean(primaryStampHighlight)
  )
  if (canEdit) {
    exec.addEventListener('click', (e) => {
      e.preventDefault()
      if (lhLockActive) return
      if (!primaryLadungAllowed) return
      if (kind === 'lh') {
        if (!lhPieStampReady) return
        const anchorPid = isZaoSlot ? zaoSlotOverride.linkId : null
        void stampLhCompletion(ownerItemId, anchorPid)
        return
      }
      if (!hasPrimaryCharge) return
      if (isZaoSlot) {
        void patchZaoSlotStampPrimary(ownerItemId, zaoSlotOverride.linkId)
      } else {
        void patchKrCounterByDelta(ownerItemId, field, 1)
      }
    })
    shell.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (lhLockActive) return
      if (!primaryLadungAllowed) return
      if (hasPrimaryCharge) return
      if (isZaoSlot) {
        if (zaoSlotOverride?.kind === 'lh') return
        void undoLastZaoSlotStamp(ownerItemId, zaoSlotOverride.linkId)
      } else {
        if (kind === 'lh') return
        void patchKrCounterByDelta(ownerItemId, field, -1)
      }
    })
  }

  // Am Mutter-Feld (kein ZAO-Slot-Override) kleines Schwert-Icon oben rechts im
  // Primärkästchen (zuerst im `main` = vorn), wenn … ZAO … wiederherstellbar.
  if (!isZaoSlot && heroExtraZaoAvailableForRestore(trackerMeta)) {
    const restoreBtn = document.createElement('button')
    restoreBtn.type = 'button'
    restoreBtn.className = 'init-kr-primary-zao-restore'
    restoreBtn.innerHTML = `<span class="init-kr-primary-zao-restore__glyph" aria-hidden="true">${SVG_PRIMARY_ATTACK}</span>`
    restoreBtn.title = canEdit
      ? 'Zusätzliches Angriffsaktions-Objekt (ZAO) wiederherstellen — die Ladung aus den Helden-Einstellungen steht dir noch zu.'
      : 'Zusätzliches Angriffsaktions-Objekt (ZAO) noch verfügbar; nur der Held oder die Spielleitung kann es wiederherstellen.'
    restoreBtn.setAttribute(
      'aria-label',
      canEdit
        ? 'Zusätzliches Angriffsaktions-Objekt (z.AT) wiederherstellen'
        : 'Zusätzliches Angriffsaktions-Objekt (z.AT) noch verfügbar (nur Held oder SL)'
    )
    restoreBtn.disabled = !canEdit
    if (canEdit) {
      restoreBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        void patchRestoreHeroExtraZao(ownerItemId)
      })
    }
    main.appendChild(restoreBtn)
  }
  main.appendChild(exec)
  // Pfeil-Tauscher am Mutterobjekt ausblenden, sobald eine L.H. mit Wert
  // aktiv ist. Bei selektierter, aber noch nicht committeter L.H.
  // (lhMax === 0) bleiben die Tauschpfeile sichtbar — der Play-Button
  // erscheint stattdessen in der Spalte der Umwandlungspfeile.
  const hideMotherSwitchForLh =
    !isZaoSlot && kind === 'lh' && lhStatePrimary.max > 0
  if (hideMotherSwitchForLh || isHeroExtraSlot) {
    shell.append(main)
    shell.classList.add('init-kr-primary-shell--no-switch')
  } else {
    shell.append(switchCol, main)
  }
  if (
    secondActionBadgeUi &&
    secondActionBadgeUi.canCreateSecondAction &&
    Number.isFinite(secondActionBadgeUi.badgeNumber)
  ) {
    const badge = document.createElement('span')
    badge.className = 'init-kr-primary-zao-badge'
    badge.textContent = String(secondActionBadgeUi.badgeNumber)
    badge.title =
      secondActionBadgeUi.title ||
      actionPhaseRangeLabel(secondActionBadgeUi.rootCount || 1)
    badge.setAttribute('aria-hidden', 'true')
    /* Unten rechts am Aktions-Icon (.init-kr-primary-main), nicht am gesamten Shell-Raster */
    main.appendChild(badge)
  }
  container.appendChild(shell)
}

/**
 * L.H.-Counter-Eingabefeld: leer bis Eingabe, Bereich 2–99.
 * Blur / Navigation / Enter / Pfeil-Navigation commit den Wert via `commitLhValue`
 * (leer = kein Commit, keine still gesetzte Vorgabe).
 *
 * @param {boolean} [lhStartAllowed] nur wenn die Initiative-Navigation auf dieser Zeile steht (`primaryLadungAllowed`).
 */
function createLhCounterInputWidget(
  ownerItemId,
  canEdit,
  isRunning,
  max,
  step,
  lhStartAllowed = true
) {
  const wrap = document.createElement('div')
  wrap.className = 'init-lh-counter'
  wrap.setAttribute('aria-label', 'L.H.-Counter (2–99 Aktionen)')

  /** @param {string} raw */
  const parseLhTarget = (raw) => {
    const t = String(raw ?? '').trim()
    if (t === '') return null
    const x = Math.floor(Number(t.replace(',', '.')))
    if (!Number.isFinite(x)) return null
    return Math.max(2, Math.min(99, x))
  }

  const input = document.createElement('input')
  input.type = 'text'
  input.inputMode = 'numeric'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.maxLength = isRunning ? 5 : 2
  input.className = 'init-lh-counter__value'

  if (isRunning) {
    const safeMax = Math.max(1, Math.floor(max) || 1)
    const safeStep = Math.max(0, Math.min(safeMax, Math.floor(step) || 0))
    const fract = `${safeStep}/${safeMax}`
    input.value = fract
    input.readOnly = true
    input.title = `Längerfristige Handlung: ${fract}`
    const flen = fract.length
    if (flen >= 5) {
      input.dataset.lhFractLen = '5'
    } else if (flen === 4) {
      input.dataset.lhFractLen = '4'
    }
  } else {
    input.value = ''
    input.setAttribute('aria-label', 'L.H.-Counter Ziel')
    input.title = lhStartAllowed
      ? 'Counter-Zielwert (2–99): Zahl tippen. Verlassen (Tab / Enter / Navigation) startet die Längerfristige Handlung. Leer lassen bricht nichts aus.'
      : 'L.H. starten geht nur, wenn die Navigation auf dieser Heldenzeile steht.'
    input.readOnly = !canEdit || !lhStartAllowed
  }

  input.addEventListener('focus', () => {
    if (!isRunning) input.select()
  })
  input.addEventListener('click', (e) => {
    if (isRunning) return
    e.stopPropagation()
    input.select()
  })

  let committed = false
  let commitPromise = null
  const commit = () => {
    if (!canEdit || committed || isRunning || !lhStartAllowed) return null
    const v = parseLhTarget(input.value)
    if (v == null) return null
    committed = true
    commitPromise = commitLhValue(ownerItemId, String(v), {
      commitIni: currentNavIniForRender,
    }).catch(() => {})
    return commitPromise
  }

  input.addEventListener('blur', () => {
    commit()
  })
  input.addEventListener('keydown', (e) => {
    if (!canEdit || isRunning || !lhStartAllowed) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      input.blur()
      return
    }
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      e.preventDefault()
      const p = commit() ?? commitPromise
      input.blur()
      const isNext = e.key === 'ArrowDown' || e.key === 'ArrowRight'
      const sel = isNext ? '[data-combat-next]' : '[data-combat-prev]'
      const click = () => {
        const btn = document.querySelector(sel)
        if (btn instanceof HTMLButtonElement) btn.click()
      }
      if (p && typeof p.then === 'function') {
        void p.then(click)
      } else {
        click()
      }
    }
  })

  wrap.append(input)
  wrap.appendChild(createLhHourglass(ownerItemId, isRunning ? step : 0))
  return wrap
}

const lhHourglassStepCache = new Map()

function createLhHourglass(ownerItemId, step) {
  const hg = document.createElement('div')
  hg.className = 'init-lh-counter__hourglass'
  hg.style.transform = `rotate(${step * 180}deg)`
  const prev = lhHourglassStepCache.get(ownerItemId)
  lhHourglassStepCache.set(ownerItemId, step)
  if (prev !== undefined && prev !== step) {
    if (typeof hg.animate === 'function') {
      window.requestAnimationFrame(() => {
        hg.animate(
          [
            { transform: `rotate(${prev * 180}deg)` },
            { transform: `rotate(${step * 180}deg)` },
          ],
          { duration: 400, easing: 'ease-in-out' }
        )
      })
    }
  }
  return hg
}


/**
 * Laufender L.H.-Counter im Primärfeld: Bruch (n/max bzw. GO!) mit Ring-Fortschritt.
 */
function createLhCounterRunningDisplay(trackerMeta, max, rem, combatRound) {
  const wrap = document.createElement('div')
  wrap.className = 'init-lh-counter init-lh-counter--running'
  wrap.setAttribute('aria-hidden', 'true')
  const fracLabel = lhProgressFractionText(max, rem, trackerMeta, combatRound)
  wrap.dataset.lhFractLen = fracLabel ? String(fracLabel.length) : '0'
  const [numText, denText] = fracLabel === 'GO!'
    ? ['GO', '!']
    : fracLabel
      ? fracLabel.split('/')
      : ['', '']
  const num = document.createElement('span')
  num.className = 'init-lh-counter__num'
  num.textContent = numText || ''
  const sep = document.createElement('span')
  sep.className = 'init-lh-counter__sep'
  sep.textContent = fracLabel === 'GO!' ? '' : '/'
  const den = document.createElement('span')
  den.className = 'init-lh-counter__den'
  den.textContent = denText || ''
  wrap.append(num, sep, den)
  wrap.title = fracLabel === 'GO!'
    ? 'Längerfristige Handlung: letzter Auslöser (GO!)'
    : `Längerfristige Handlung: ${fracLabel}`
  return wrap
}

/** @param {string} ownerItemId */
function findLatestParadeExtraStampId(ownerItemId) {
  const entries = getActionStamps()?.entries
  if (!Array.isArray(entries)) return null
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e.itemId === ownerItemId && e.paradeExtra) return e.id
  }
  return null
}

function setLinkedShieldHover(ownerItemId, on) {
  if (!ownerItemId) return
  const nodes = document.querySelectorAll(
    `.init-kr-abw-split-shell[data-shield-link-group="${ownerItemId}"]`
  )
  for (const n of nodes) {
    if (!(n instanceof HTMLElement)) continue
    n.classList.toggle('is-linked-hover', on)
  }
}

function setLinkedFaHover(ownerItemId, on) {
  if (!ownerItemId) return
  const nodes = document.querySelectorAll(
    `.init-fa-cell[data-fa-link-group="${ownerItemId}"]`
  )
  for (const n of nodes) {
    if (!(n instanceof HTMLElement)) continue
    n.classList.toggle('is-linked-hover', on)
  }
}

/**
 * Abwehr: nur Schild-Icons ohne AB-Kopfzeile.
 * Gesperrt nur bei Navigation auf „Beginn/Ende der Kampfrunde“.
 */
function appendKrAbwSplitCell(
  container,
  ownerItemId,
  trackerMeta,
  canEdit,
  abwLadungAllowed,
  phaseRowActive = true,
  abwRoundBoundaryShell = false,
  boundaryAsActiveVisual = false,
  combatRound = null,
  combatStarted = false,
  roundIntroPending = false,
  mirrorLinkUi = false
) {
  const value = readKrAbw(trackerMeta)
  const v = normalizeKrDigit(value)
  const shieldCount = abwShieldCount(v)
  const paradeSlots = readKrParadeExtraSlots(trackerMeta)
  // Mutex z.AT vs schwarzes Schild: Wenn der Held in dieser KR den z.AT
  // bereits gestempelt hat, ist das Schild nicht mehr verfuegbar.
  // Defense-in-depth — nach Stempel ist `KR_PARADE_EXTRA` ohnehin geloescht;
  // der Guard schuetzt zusaetzlich gegen transient inkonsistente Zustaende.
  const paradeLoadedSlots =
    trackerMeta?.krExtraChoiceUsed === 'ang'
      ? []
      : paradeSlots
          .map((slot, idx) => ({ slot, idx }))
          .filter((e) => e.slot === 0)
          .map((e) => e.idx)
  const paradeLoaded = paradeLoadedSlots.length > 0
  const totalDisplay = shieldCount + (paradeLoaded ? 1 : 0)
  const firstKindAbwUi = readKrFirstSlotKind(trackerMeta)
  // Reaktions-Optik gilt für alle Aktionstypen (ang, sra, lh), nicht nur Angriff.
  const reactionAbwUi = true
  const stackedBlueReaction = reactionAbwUi && shieldCount >= 3
  const shieldLayoutSlots = stackedBlueReaction
    ? 1 + (paradeLoaded ? 1 : 0)
    : totalDisplay

  const shell = document.createElement('div')
  shell.className = 'init-kr-abw-split-shell'
  shell.dataset.shieldLinkGroup = ownerItemId
  shell.style.setProperty(
    '--init-abw-shield-slots',
    String(Math.max(1, shieldLayoutSlots || 1))
  )
  if (shieldLayoutSlots >= 1) {
    shell.setAttribute('data-shield-count', String(shieldLayoutSlots))
  }
  shell.classList.toggle(
    'init-kr-abw-split-shell--three-shields',
    shieldLayoutSlots === 3
  )
  shell.classList.toggle(
    'init-kr-abw-split-shell--four-shields',
    shieldLayoutSlots === 4
  )
  /* 2.-Akt-Spiegel: volle Farbe solange eine Schildladung (oder Parade) angezeigt wird */
  const dimAbwByNav =
    !phaseRowActive &&
    !(mirrorLinkUi && (shieldCount >= 1 || paradeLoaded))
  shell.classList.toggle(
    'init-kr-abw-split-shell--inactive-charged',
    dimAbwByNav && (shieldCount >= 1 || paradeLoaded)
  )
  shell.classList.toggle(
    'init-kr-abw-split-shell--inactive-empty',
    dimAbwByNav && shieldCount < 1 && !paradeLoaded
  )
  // Optik an KR-Grenzen: Schild-Icons werden hier nicht gedimmt; mechanisch
  // bleibt das Stempeln an KR-Grenzen weiterhin gesperrt (siehe exec.disabled
  // und die Click-Handler unten).
  shell.classList.toggle(
    'init-kr-abw-split-shell--nav-blocked',
    Boolean(canEdit && v < 1 && !abwLadungAllowed && !boundaryAsActiveVisual)
  )
  shell.classList.toggle(
    'init-kr-abw-split-shell--round-boundary',
    abwRoundBoundaryShell
  )
  shell.setAttribute('role', 'group')
  if (mirrorLinkUi) {
    shell.classList.add('init-kr-abw-split-shell--mirror-link')
  }
  if (reactionAbwUi) {
    shell.classList.add('init-kr-abw-split-shell--reaction-theme')
    shell.setAttribute('aria-label', 'Reaktion, Abwehr-Schildladungen')
  } else {
    shell.setAttribute('aria-label', 'Abwehr')
  }

  const chargeRow = document.createElement('div')
  chargeRow.className = 'init-kr-abw-charge'

  const exec = document.createElement('button')
  exec.type = 'button'
  exec.className = 'init-kr-abw-split-shell__exec'
  exec.classList.toggle(
    'init-kr-abw-split-shell__exec--has-shields',
    shieldCount > 0 || paradeLoaded
  )
  const shields = document.createElement('span')
  shields.className = 'init-kr-abw-shields'
  shields.setAttribute('aria-hidden', 'true')
  if (stackedBlueReaction) {
    const icon = document.createElement('span')
    icon.className =
      'init-kr-abw-shield init-kr-abw-shield--reaction-blue-count'
    icon.innerHTML = SVG_ABW_SHIELD
    const countEl = document.createElement('span')
    countEl.className = 'init-kr-abw-shield__count'
    countEl.textContent = String(shieldCount)
    icon.appendChild(countEl)
    shields.appendChild(icon)
  } else {
    for (let i = 0; i < shieldCount; i++) {
      const icon = document.createElement('span')
      icon.className = 'init-kr-abw-shield'
      icon.innerHTML = SVG_ABW_SHIELD
      shields.appendChild(icon)
    }
  }
  if (paradeLoaded) {
    const slotIdx = paradeLoadedSlots[0]
    const iconP = document.createElement('span')
    iconP.className = 'init-kr-abw-shield init-kr-abw-shield--parade-extra'
    iconP.dataset.paradeExtraSlot = String(slotIdx)
    iconP.innerHTML = SVG_ABW_SHIELD_DARK
    if (paradeLoadedSlots.length >= 2) {
      const countEl = document.createElement('span')
      countEl.className = 'init-kr-abw-shield__count'
      countEl.textContent = String(paradeLoadedSlots.length)
      iconP.appendChild(countEl)
    }
    shields.appendChild(iconP)
  }
  exec.append(shields)
  applySplitLadungVisual(shell, chargeRow, exec, v, 'abw')
  const abwMaxMarks = krAbwTransferMaxMarks()
  const abwCombatAllowsStamp = Boolean(combatStarted && !roundIntroPending)
  const abwLhLocked = isLhLockingActions(trackerMeta, combatRound)
  const canStampAbwNow =
    canEdit && !abwLhLocked && abwLadungAllowed && shieldCount >= 1
  const canStampParadeNow =
    canEdit && !abwLhLocked && abwLadungAllowed && paradeLoaded
  const canStampAnyShieldNow = canStampAbwNow || canStampParadeNow
  shell.classList.toggle(
    'init-kr-abw-split-shell--stampable-now',
    canStampAnyShieldNow
  )

  shell.addEventListener('pointerenter', () => {
    if (!canStampAnyShieldNow) return
    setLinkedShieldHover(ownerItemId, true)
  })
  shell.addEventListener('pointerleave', () => {
    setLinkedShieldHover(ownerItemId, false)
  })

  exec.title = mirrorLinkUi
    ? canEdit
      ? 'Reaktion (Spiegel): gleiche Schildladungen wie am Mutterobjekt — Stempeln nutzt denselben gemeinsamen Schild-Pool; Umwandlung über die Pfeile wirkt auf dieselben Ladungen.'
      : 'Reaktion (Spiegel): Anzeige der Mutter-Schildladungen.'
    : canEdit
      ? shieldCount >= 2
        ? `Abwehr: ${shieldCount} Schildladungen geladen (maximal ${abwMaxMarks}).`
        : v <= 0
          ? !abwLadungAllowed
            ? !abwCombatAllowsStamp
              ? !combatStarted
                ? 'Abwehr: Schild erst stempeln, wenn der Kampf läuft (Start).'
                : 'Abwehr: neue Kampfrunde zuerst bestätigen (oben „Weiter“), dann stempeln.'
              : 'Abwehr: am Beginn/Ende der Kampfrunde gesperrt; stempeln erst wieder im nächsten Zug.'
            : 'Abwehr: Untere Ladung stempeln; am Beginn/Ende der Kampfrunde gesperrt. Rechtsklick holt verbrauchte Ladung zurück'
          : 'Abwehr: Rechtsklick aufs Kästchen — Ladung zurück, letzten Stempel entfernen'
      : 'Abwehr (nur Anzeige)'
  if (paradeLoaded) {
    exec.title =
      (exec.title ? `${exec.title} ` : '') +
      `Zusatz-Parade (schwarzes Schild): ${paradeLoadedSlots.length} verfügbar. Klick auf das schwarze Schild stempelt eine Ladung (nicht umwandelbar). Rechtsklick aufs schwarze Schild oder die Schildfläche hebt den letzten Parade-Stempel auf.`
  }
  exec.setAttribute('aria-label', abwLadungAria(v, abwLadungAllowed))
  if (abwLhLocked) {
    shell.classList.add('init-kr-abw-split-shell--lh-locked')
    exec.classList.add('init-kr-abw-split-shell__exec--lh-locked')
    exec.title =
      'Längerfristige Handlung läuft – Schild/Parade gesperrt; nur freie Aktionen erlaubt.'
  }
  exec.disabled =
    !canEdit ||
    abwLhLocked ||
    ((shieldCount >= 1 || paradeLoaded) && !abwLadungAllowed)
  if (canEdit) {
    exec.addEventListener('click', (e) => {
      e.preventDefault()
      if (abwLhLocked) return
      const t = e.target
      const el = t instanceof Element ? t : null
      const paradeEl = el?.closest('.init-kr-abw-shield--parade-extra')
      if (paradeEl) {
        if (!abwLadungAllowed) return
        if (!paradeLoaded) return
        const slotIdx = Math.max(
          0,
          Math.floor(Number(paradeEl.dataset.paradeExtraSlot)) || 0
        )
        void patchKrStampParadeExtraFromCharge(ownerItemId, {
          paradeExtraSlot: slotIdx,
        })
        return
      }
      if (shieldCount < 1) return
      if (!abwLadungAllowed) return
      void patchKrStampAbwFromCharge(ownerItemId)
    })
    shell.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (abwLhLocked) return
      if (!abwLadungAllowed) return
      const t = e.target instanceof Element ? e.target : null
      const paradeShield = t?.closest('.init-kr-abw-shield--parade-extra')
      const onExec = t?.closest('.init-kr-abw-split-shell__exec')
      const paradeUndoId = findLatestParadeExtraStampId(ownerItemId)
      if (paradeUndoId && paradeShield) {
        void undoKrActionStamp(paradeUndoId)
        return
      }
      if (v === 1) {
        void patchKrCounterByDelta(ownerItemId, KR_ABW, -1)
        return
      }
      if (paradeUndoId && onExec) {
        void undoKrActionStamp(paradeUndoId)
      }
    })
  }

  chargeRow.appendChild(exec)
  shell.append(chargeRow)
  container.appendChild(shell)

  if (
    !mirrorLinkUi &&
    readHeroExtraParCount(trackerMeta) > 0 &&
    paradeSlots.some((slot) => slot === undefined) &&
    trackerMeta?.krExtraChoiceUsed !== 'ang'
  ) {
    void ensureParadeExtraShield(ownerItemId)
  }
}

/**
 * Play/Abbrechen für L.H. werden direkt als Overlay an der rechten Kante
 * des Schildplatz-Kästchens gerendert — siehe `appendLhPlayOverlay` /
 * `appendLhAbortOverlay`. Klick auf Play fokussiert das Eingabefeld.
 */
const LH_PLAY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#0c2e24" stroke="#3e2723" stroke-width="0.5"/><circle cx="12" cy="12" r="9.5" fill="#1f6b4a"/><circle cx="12" cy="12" r="7.5" fill="#3a9d6e"/><path fill="#0c2e24" d="M9.2 7.1 17.2 12 9.2 16.9z"/><path fill="#fffde7" d="M9.6 8 15.9 12 9.6 16z"/></svg>'

const LH_ABORT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="11" fill="#4a0e0e" stroke="#2b0808" stroke-width="0.5"/>' +
  '<circle cx="12" cy="12" r="9.5" fill="#b71c1c"/>' +
  '<circle cx="12" cy="12" r="7.5" fill="#e53935"/>' +
  '<path fill="#4a0e0e" d="M8.2 6.8 L12 10.6 L15.8 6.8 L17.2 8.2 L13.4 12 L17.2 15.8 L15.8 17.2 L12 13.4 L8.2 17.2 L6.8 15.8 L10.6 12 L6.8 8.2 z"/>' +
  '<path fill="#fffde7" d="M8.5 7.5 L12 11 L15.5 7.5 L16.5 8.5 L13 12 L16.5 15.5 L15.5 16.5 L12 13 L8.5 16.5 L7.5 15.5 L11 12 L7.5 8.5 z"/>' +
  '</svg>'

function appendLhPlayOverlay(counterEl) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'init-lh-counter__action-btn init-lh-counter__action-btn--play'
  btn.title =
    'L.H. aktivieren: Klick öffnet das Eingabefeld für die Anzahl der Aktionen.'
  btn.setAttribute('aria-label', 'L.H. aktivieren')
  btn.innerHTML = LH_PLAY_SVG
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const target = counterEl.querySelector('.init-lh-counter__value')
    if (target instanceof HTMLInputElement) {
      target.focus()
      target.select()
    }
  })
  counterEl.appendChild(btn)
}

function appendLhAbortOverlay(counterEl, ownerItemId) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'init-lh-counter__action-btn init-lh-counter__action-btn--abort'
  btn.title =
    'Längerfristige Handlung abbrechen (alle L.H.-Daten und Sperren entfernen).'
  btn.setAttribute('aria-label', 'Längerfristige Handlung abbrechen')
  btn.innerHTML = LH_ABORT_SVG
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void cancelLh(ownerItemId)
  })
  counterEl.appendChild(btn)
}

/**
 * Umwandeln: Angriff → Abwehr (oben) / Abwehr → Angriff (unten).
 */
function appendKrConvertArrowsCell(
  container,
  ownerItemId,
  trackerMeta,
  canEdit,
  phaseRowActive = true,
  convertAllowedByLock = true,
  combatRound = null,
  motherPrimaryStamped = false,
  zaoScopedLinkId = null
) {
  const wrap = document.createElement('div')
  wrap.className = 'init-kr-convert-cell'
  wrap.classList.toggle('init-kr-convert-cell--inactive', !phaseRowActive)
  // Gesperrt durch globales Schloss / Helden-Ansageoptionen (nicht-SL).
  const lockedByConvertLock = canEdit && !convertAllowedByLock
  const convertLockTip =
    'Umwandeln gesperrt – das Umwandlungs-Schloss der Spielleitung lässt diese Aktion gerade nicht zu (oder die Helden-Ansageoptionen greifen nicht mehr).'

  const firstKind = readKrFirstSlotKind(trackerMeta)
  const firstIsAng = firstKind === 'ang'
  const firstIsLh = firstKind === 'lh'
  const firstIsSra = firstKind === 'sra'
  const primaryVal = normalizeKrDigit(
    firstIsSra
      ? readKrSra(trackerMeta)
      : firstIsLh
        ? readKrLhAction(trackerMeta)
        : readKrAng(trackerMeta)
  )
  const motherHasCharge = firstIsLh
    ? primaryVal === 0 && !trackerMeta?.[KR_LH_VOID_BY_TRANSFER]
    : krTransferMarkPresent(primaryVal)
  const abwVal = normalizeKrDigit(readKrAbw(trackerMeta))
  const abwMaxMarks = krAbwTransferMaxMarks()
  const scopedLink =
    typeof zaoScopedLinkId === 'string' && zaoScopedLinkId && trackerMeta
      ? zaoScopedLinkId
      : null
  const scopedSlot =
    scopedLink && trackerMeta
      ? readZaoSlot(trackerMeta, scopedLink) || {
          kind: readKrFirstSlotKind(trackerMeta),
          marks: 1,
        }
      : null
  const scopedLhKind = scopedSlot?.kind === 'lh'

  // Quelle für Primär→Schild: Mutter ODER irgendein „normaler" 2.A.-Slot mit
  // Ladung. Helden-Zusatz-Objekte (`heroExtra`) liefern keine umwandelbare
  // Ladung — ihre einzelne Ladung ist ausdrücklich nur stempelbar.
  const anyZaoCharged = Boolean(
    trackerMeta && metaHasPendingLoadedNonHeroExtraZao(trackerMeta)
  )
  const lowerBlockedPendingLoadedZao =
    !motherHasCharge && anyZaoCharged
  const canUpperTransfer =
    scopedSlot && scopedLink && !scopedLhKind
      ? canEdit &&
        scopedSlot.marks === 1 &&
        !scopedSlot.lodgedAbw &&
        krAbwCanAcceptTransferMark(abwVal)
      : canEdit &&
        (motherHasCharge || anyZaoCharged) &&
        krAbwCanAcceptTransferMark(abwVal)
  const phaseLinksNorm = trackerMeta
    ? normalizePhases(trackerMeta.phases)
    : { links: [], rowPanelOpen: false }
  const phaseOffLower = phaseOffsetFromHeroSecondAoMeta(trackerMeta)
  const canAppendChainedZao =
    typeof trackerMeta?.initiative === 'string' &&
    nextChainedZaoParentForTransfer(
      trackerMeta.initiative,
      phaseLinksNorm,
      phaseOffLower
    ) != null
  // Schild→Primär: läuft, solange das Schild eine Ladung hat (Mutter
  // bekommt Ladung, oder es entsteht ein neuer 2.A.-Slot mit freier INI).
  // Kein Schild→leeres Mutterfeld, solange noch eine geladene 2.A.-Zeile wartet.
  const canLowerTransfer =
    scopedSlot && scopedLink && !scopedLhKind
      ? canEdit &&
        krTransferMarkPresent(abwVal) &&
        scopedSlot.lodgedAbw === true &&
        scopedSlot.marks === 0
      : canEdit &&
        krTransferMarkPresent(abwVal) &&
        (!motherHasCharge || canAppendChainedZao) &&
        !lowerBlockedPendingLoadedZao

  const endKrGates = lhEndKrConvertArrowGates(trackerMeta, combatRound)
  let allowUpper =
    scopedLink && scopedSlot && !scopedLhKind
      ? canUpperTransfer
      : canUpperTransfer && !endKrGates.blockUpperLhMotherNoZao
  let allowLower =
    scopedLink && scopedSlot && !scopedLhKind
      ? canLowerTransfer
      : canLowerTransfer && !endKrGates.blockLowerPendingZao
  if (motherPrimaryStamped) {
    allowUpper = false
    allowLower = false
  }
  const stampLockTip =
    'Umwandeln gesperrt — am Mutter-Primärfeld liegt ein Aktions-Stempel von der eigenen Heldenzeile (Angriff, S.R.A. oder L.H.-Abschluss).'

  const upperLabel = firstIsLh
    ? 'L.H.-Ladung ins Abwehr-Schild verschieben'
    : firstIsAng
      ? 'Aktion → Reaktion — eine Ladung ins Abwehr-Schild verschieben'
      : 'S.R.A.-Ladung als Abwehr-Schild verschieben'
  /* INI < 0: unterer Pfeil landet nur bei angMode 'yes' noch auf Angriff */
  const iniLocked =
    isHeroIniBelowZero(trackerMeta) && readHeroIniNegAngMode(trackerMeta) !== 'yes'
  const transferTargetKind =
    iniLocked && firstKind === 'ang' ? 'sra' : firstKind
  const lowerLabel =
    transferTargetKind === 'lh'
      ? 'Schild-Ladung ins L.H.-Feld verschieben (oder neues 2.A.-Objekt)'
      : transferTargetKind === 'ang'
        ? firstIsAng
          ? 'Reaktion → Aktion — Schild-Ladung verschieben; bei voller Mutter neues 2.AO (Phasen-Offset „2.AO / Parade→Angriff“)'
          : 'Schild-Ladung in Angriff verschieben (oder neues 2.A.-Objekt)'
        : 'Schild-Ladung in S.R.A. verschieben (oder neues 2.A.-Objekt)'

  // In der End-KR (`isLhLockingActions === false`) sind Umwandeln-Pfeile
  // wieder frei — der Held darf Schild aufladen / 2.A. anlegen, waehrend der
  // L.H.-Stempel-Slot ueber die Slot-Konflikt-Logik geschuetzt bleibt.
  const lhLocked = isLhLockingActions(trackerMeta, combatRound)
  const lhLockTip =
    'Längerfristige Handlung läuft – Umwandeln gesperrt; nur freie Aktionen erlaubt.'
  const endKrUpperOnlyTip =
    'In der End-KR der L.H.: zuerst die pendelnde 2.-Aktion mit dem oberen Pfeil ins Abwehr-Schild zurücklegen — die laufende L.H. am Mutterfeld bleibt fix.'
  const endKrLowerOnlyTip =
    'In der End-KR der L.H.: zuerst die Reaktions-Ladung mit dem unteren Pfeil zur Aktion schieben — die laufende L.H. am Mutterfeld bleibt fix.'

  const toAb = document.createElement('button')
  toAb.type = 'button'
  toAb.className = 'init-kr-convert-cell__btn init-kr-convert-cell__btn--to-ab'
  toAb.innerHTML = SVG_ARROW_TO_AB
  toAb.title = lhLocked
    ? lhLockTip
    : motherPrimaryStamped
      ? stampLockTip
      : lockedByConvertLock
        ? convertLockTip
        : upperLabel
  toAb.setAttribute(
    'aria-label',
    lhLocked
      ? lhLockTip
      : motherPrimaryStamped
        ? stampLockTip
        : lockedByConvertLock
          ? convertLockTip
          : upperLabel
  )
  toAb.disabled =
    !allowUpper || lhLocked || lockedByConvertLock || motherPrimaryStamped
  if (lhLocked) toAb.classList.add('init-kr-convert-cell__btn--lh-locked')
  if (lockedByConvertLock) {
    toAb.classList.add('init-kr-convert-cell__btn--convert-locked')
  }
  if (motherPrimaryStamped) {
    toAb.classList.add('init-kr-convert-cell__btn--stamp-locked')
  }
  if (
    !allowUpper &&
    canEdit &&
    !lhLocked &&
    !motherPrimaryStamped &&
    !lockedByConvertLock &&
    endKrGates.blockUpperLhMotherNoZao
  ) {
    toAb.title = endKrUpperOnlyTip
    toAb.setAttribute('aria-label', endKrUpperOnlyTip)
  }
  if (
    !allowUpper &&
    canEdit &&
    !lhLocked &&
    !motherPrimaryStamped &&
    !lockedByConvertLock &&
    !endKrGates.blockUpperLhMotherNoZao &&
    (motherHasCharge || anyZaoCharged) &&
    !krAbwCanAcceptTransferMark(abwVal)
  ) {
    toAb.title = `${upperLabel} – maximal ${abwMaxMarks} Abwehr-Schildladungen.`
  }
  if (canEdit) {
    toAb.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (lhLocked || lockedByConvertLock || motherPrimaryStamped) return
      if (scopedLink && scopedSlot && !scopedLhKind) {
        void patchKrTransferZaoPrimaryToAbw(ownerItemId, scopedLink)
      } else {
        void patchKrTransferPrimaryToAbw(ownerItemId)
      }
    })
  }

  const toAng = document.createElement('button')
  toAng.type = 'button'
  toAng.className = 'init-kr-convert-cell__btn init-kr-convert-cell__btn--to-ang'
  toAng.innerHTML = SVG_ARROW_TO_ANG
  toAng.title = lhLocked
    ? lhLockTip
    : motherPrimaryStamped
      ? stampLockTip
      : lockedByConvertLock
        ? convertLockTip
        : lowerLabel
  toAng.setAttribute(
    'aria-label',
    lhLocked
      ? lhLockTip
      : motherPrimaryStamped
        ? stampLockTip
        : lockedByConvertLock
          ? convertLockTip
          : firstIsAng
            ? 'Schild-Ladung verschieben: ins Primärfeld (oder neues 2.AO)'
            : lowerLabel
  )
  toAng.disabled =
    !allowLower || lhLocked || lockedByConvertLock || motherPrimaryStamped
  if (lhLocked) toAng.classList.add('init-kr-convert-cell__btn--lh-locked')
  if (lockedByConvertLock) {
    toAng.classList.add('init-kr-convert-cell__btn--convert-locked')
  }
  if (motherPrimaryStamped) {
    toAng.classList.add('init-kr-convert-cell__btn--stamp-locked')
  }
  if (
    !allowLower &&
    canEdit &&
    !lhLocked &&
    !motherPrimaryStamped &&
    !lockedByConvertLock &&
    endKrGates.blockLowerPendingZao
  ) {
    toAng.title = endKrLowerOnlyTip
    toAng.setAttribute('aria-label', endKrLowerOnlyTip)
  } else if (
    !allowLower &&
    canEdit &&
    !lhLocked &&
    !motherPrimaryStamped &&
    !lockedByConvertLock &&
    lowerBlockedPendingLoadedZao &&
    krTransferMarkPresent(abwVal) &&
    (!motherHasCharge || canAppendChainedZao)
  ) {
    toAng.title =
      'Zuerst die ausstehende 2.-Aktion an der Phasenzeile nutzen (oder den Slot schließen) — Schild nicht erneut ins leere Mutterfeld.'
    toAng.setAttribute('aria-label', toAng.title)
  }
  if (canEdit) {
    toAng.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (lhLocked || lockedByConvertLock || motherPrimaryStamped) return
      if (scopedLink && scopedSlot && !scopedLhKind) {
        void patchKrTransferAbwToZaoPrimary(ownerItemId, scopedLink)
      } else {
        void patchKrTransferAbwToPrimary(ownerItemId)
      }
    })
  }

  wrap.append(toAb, toAng)
  if (lhLocked) wrap.classList.add('init-kr-convert-cell--lh-locked')
  if (lockedByConvertLock) {
    wrap.classList.add('init-kr-convert-cell--convert-locked')
  }
  if (motherPrimaryStamped) {
    wrap.classList.add('init-kr-convert-cell--stamp-locked')
  }
  container.appendChild(wrap)
}

function appendFaCounter(
  container,
  ownerItemId,
  trackerMeta,
  canEdit,
  ownerIniStr,
  phaseRowActive = true,
  faLadungAllowed = true,
  combatStarted = false
) {
  const settings = getRoomSettings()
  const faMax = readHeroFaMax(trackerMeta, ownerIniStr, settings)
  const used = readKrFreeAction(trackerMeta, faMax)
  const avail = availableFreeActions(used, faMax)

  const wrap = document.createElement('div')
  wrap.className = 'init-fa-cell init-fa-cell--active'
  wrap.dataset.faLinkGroup = ownerItemId
  wrap.classList.toggle('init-fa-cell--inactive-charged', !phaseRowActive && avail > 0)
  wrap.classList.toggle('init-fa-cell--inactive-empty', !phaseRowActive && avail <= 0)
  wrap.classList.toggle(
    'init-fa-cell--stampable-now',
    Boolean(canEdit && faLadungAllowed && avail > 0)
  )
  const canStampFaNow = Boolean(canEdit && faLadungAllowed && avail > 0)

  wrap.addEventListener('pointerenter', () => {
    if (!canStampFaNow) return
    setLinkedFaHover(ownerItemId, true)
  })
  wrap.addEventListener('pointerleave', () => {
    setLinkedFaHover(ownerItemId, false)
  })

  const bolts = document.createElement('span')
  bolts.className = 'init-fa-cell__bolts'
  bolts.setAttribute('aria-hidden', 'true')
  const compactCount = avail >= 5
  const boltCount = compactCount ? 1 : avail
  wrap.classList.toggle('init-fa-cell--compact-count', compactCount)
  for (let i = 0; i < boltCount; i++) {
    const bolt = document.createElement('span')
    bolt.className = 'init-fa-cell__bolt'
    bolt.innerHTML = SVG_FA_BOLT
    bolts.appendChild(bolt)
  }
  if (compactCount) {
    const count = document.createElement('span')
    count.className = 'init-fa-cell__count'
    count.textContent = String(avail)
    count.setAttribute('aria-hidden', 'true')
    wrap.appendChild(count)
  }

  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'init-fa-cell__tap'
  b.title = !faLadungAllowed
    ? !combatStarted
      ? `Freie Aktion: erst nach Kampfbeginn stempelbar (Zyklus 0…${faMax})`
      : `Freie Aktion: am Beginn/Ende der Kampfrunde gesperrt (Zyklus 0…${faMax})`
    : `Freie Aktion: ${avail} verfügbar · Linksklick +1, Rechtsklick −1 (Zyklus 0…${faMax})`
  b.setAttribute('aria-label', faCounterAria(used, faMax))
  b.disabled = !canEdit || !faLadungAllowed

  wrap.append(bolts, b)

  if (canEdit) {
    b.addEventListener('click', (e) => {
      e.preventDefault()
      if (!faLadungAllowed) return
      void patchKrCounterByDelta(ownerItemId, KR_FREE_ACTION, 1)
    })
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (!faLadungAllowed) return
      void patchKrCounterByDelta(ownerItemId, KR_FREE_ACTION, -1)
    })
  }

  container.appendChild(wrap)
}

function appendKrCounterPair(
  container,
  ownerItemId,
  trackerMeta,
  canEdit,
  ownerIniStr,
  lhStampPhaseLinkId,
  combatRound = null,
  rowActiveId = null,
  rowActivePhaseLinkId = null,
  navigationPhaseLinkId = null,
  secondActionBadgeUi = null,
  options = {}
) {
  const {
    hideAbw = false,
    hideFa = false,
    hideLh = true,
    hideConvert = false,
    abwReplacement = null,
    convertReplacement = null,
    zaoSlotOverride = null,
    lhContainer = null,
    /** Primär-Stempel am Mutterankel — beide Umwandlungspfeile aus. */
    motherPrimaryStamped = false,
    /** Kampf muss laufen und Runden-Intro bestätigt sein — sonst keine Schild-Stempel. */
    combatStarted = false,
    roundIntroPending = false,
    /** 2.A.-Zeile: Schilde nur Spiegel des Mutter-`KR_ABW`, kein Stempeln hier. */
    abwMirrorLinkUi = false,
  } = options || {}
  const primaryLadungAllowed = navigationMatchesRow(
    ownerItemId,
    navigationPhaseLinkId,
    rowActiveId,
    rowActivePhaseLinkId
  )
  const abwCombatAllowsStamp = Boolean(combatStarted && !roundIntroPending)
  const abwNavAllowsStamp =
    rowActiveId !== ROUND_START_STEP_ID && rowActiveId !== ROUND_END_STEP_ID
  const abwLadungAllowed = abwCombatAllowsStamp && abwNavAllowsStamp
  const faLadungAllowed = Boolean(combatStarted) && abwNavAllowsStamp
  // Optik (kein Mechanik-Effekt): an den KR-Grenzen — sowohl Beginn als auch
  // Ende der Kampfrunde — werden alle Icons in voller Stärke gezeigt; die
  // Sperren (primaryLadungAllowed/abwLadungAllowed/faLadungAllowed) bleiben
  // davon unberührt.
  const atRoundBoundaryNav =
    !rowActivePhaseLinkId &&
    (rowActiveId === ROUND_START_STEP_ID ||
      rowActiveId === ROUND_END_STEP_ID)
  const phaseRowActive =
    primaryLadungAllowed || abwLadungAllowed || atRoundBoundaryNav
  const abwRoundBoundaryShell = !abwLadungAllowed && !atRoundBoundaryNav
  const lhRoundLockedVisual = !faLadungAllowed && !atRoundBoundaryNav
  appendKrPrimarySplitCell(
    container,
    ownerItemId,
    trackerMeta,
    canEdit,
    primaryLadungAllowed,
    secondActionBadgeUi,
    phaseRowActive,
    combatRound,
    zaoSlotOverride,
    atRoundBoundaryNav
  )
  if (hideConvert) {
    if (convertReplacement instanceof HTMLElement) {
      container.appendChild(convertReplacement)
    }
  } else {
    const convertAllowedByLock = isHeroConvertAllowedForViewer(
      trackerMeta,
      rowActiveId,
      rowActivePhaseLinkId,
      currentNavIniForRender
    )
    appendKrConvertArrowsCell(
      container,
      ownerItemId,
      trackerMeta,
      canEdit,
      phaseRowActive,
      convertAllowedByLock,
      combatRound,
      motherPrimaryStamped,
      abwMirrorLinkUi && zaoSlotOverride?.linkId
        ? zaoSlotOverride.linkId
        : null
    )
  }
  // Schildplatz: entweder L.H.-Counter-Eingabe (vor Werte-Setzung),
  // L.H.-Fortschritts-Kuchen (nach Werte-Setzung), Schilde oder Replacement.
  // Die L.H. kann in Mutter ODER in einem 2.A.O. beginnen.
  const lhSt = readLhState(trackerMeta)
  let lhAtAbwActive = false
  if (zaoSlotOverride) {
    lhAtAbwActive =
      zaoSlotOverride.kind === 'lh' && zaoSlotOverride.marks >= 1
  } else if (!hideAbw) {
    const motherKindIsLh = readKrFirstSlotKind(trackerMeta) === 'lh'
    const motherLhCharged =
      normalizeKrDigit(readKrPrimaryLadung(trackerMeta)) === 0
    const someLhZaoLoaded = Object.values(readZaoSlots(trackerMeta)).some(
      (s) => s.kind === 'lh' && s.marks === 1
    )
    lhAtAbwActive =
      motherKindIsLh && (motherLhCharged || lhSt.max > 0 || someLhZaoLoaded)
  }

  if (lhContainer) {
    const motherKindIsLh =
      !zaoSlotOverride && readKrFirstSlotKind(trackerMeta) === 'lh'
    const lhSt = readLhState(trackerMeta)
    let lhAtAbwActive = false
    if (zaoSlotOverride) {
      lhAtAbwActive =
        zaoSlotOverride.kind === 'lh' && zaoSlotOverride.marks >= 1
    } else {
      const motherLhCharged =
        normalizeKrDigit(readKrPrimaryLadung(trackerMeta)) === 0
      const someLhZaoLoaded = Object.values(readZaoSlots(trackerMeta)).some(
        (s) => s.kind === 'lh' && s.marks === 1
      )
      lhAtAbwActive =
        motherKindIsLh && (motherLhCharged || lhSt.max > 0 || someLhZaoLoaded)
    }

    // End-KR (LH endet in dieser KR) vs. laufender Tracker: während
    // `isLhLockingActions` true ist, ist die bisherige „Phase F“-Logik aktiv
    // (Schildspalte/UX wie mittendrin). Wird die End-KR erreicht, bleibt der
    // grosse Bruch in der Schildspalte trotzdem sichtbar, solange
    // `isLhActive` — erst nach L.H.-Stempel räumt `clearLhTrackerActivity` die
    // Anzeige; parallel zeigt `appendKrPrimarySplitCell` weiter das n/x am
    // Pie-Stern.
    const lhEndsThisKrUi =
      isLhActive(trackerMeta) && !isLhLockingActions(trackerMeta, combatRound)

    if (lhAtAbwActive && (!lhEndsThisKrUi || isLhActive(trackerMeta))) {
      let counter
      if (lhSt.max > 0) {
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
        const priorSpendStep = readLhCommitKrPriorSpendForRound(
          trackerMeta,
          effectiveRound
        )
        const step = lhDisplayStepFromNav(
          heroIniNum,
          mechanics,
          commitRound,
          effectiveRound,
          currentNavIniForRender,
          lhSt.max,
          Number.isFinite(commitIniStored) ? commitIniStored : undefined,
          priorSpendStep
        )
        counter = createLhCounterInputWidget(
          ownerItemId,
          canEdit,
          true,
          lhSt.max,
          step,
          primaryLadungAllowed
        )
      } else {
        counter = createLhCounterInputWidget(
          ownerItemId,
          canEdit,
          false,
          0,
          0,
          primaryLadungAllowed
        )
      }
      counter.classList.add('init-lh-counter--at-abw')
      if (motherKindIsLh && lhSt.max === 0 && canEdit && primaryLadungAllowed) {
        appendLhPlayOverlay(counter)
      } else if (motherKindIsLh && lhSt.max > 0 && canEdit) {
        appendLhAbortOverlay(counter, ownerItemId)
      }
      lhContainer.appendChild(counter)
    }
  }

  if (hideAbw) {
    if (abwReplacement instanceof HTMLElement) {
      container.appendChild(abwReplacement)
    }
  } else {
    appendKrAbwSplitCell(
      container,
      ownerItemId,
      trackerMeta,
      canEdit,
      abwLadungAllowed,
      phaseRowActive,
      abwRoundBoundaryShell,
      atRoundBoundaryNav,
      combatRound,
      combatStarted,
      roundIntroPending,
      abwMirrorLinkUi
    )
  }

  if (!hideFa) {
    appendFaCounter(
      container,
      ownerItemId,
      trackerMeta,
      canEdit,
      ownerIniStr,
      phaseRowActive,
      faLadungAllowed,
      combatStarted
    )
  }
  if (!hideLh) {
    appendLhCell(
      container,
      ownerItemId,
      trackerMeta,
      canEdit,
      lhStampPhaseLinkId,
      combatRound,
      primaryLadungAllowed,
      lhRoundLockedVisual
    )
  }
}

/**
 * Wie Token-Zeile (null): L.H.-Stempel / commitLhValue nur mit Phasen-Anker, wenn L.H. aktiv (max > 0).
 */
function lhStampPhaseLinkIdWhenLhActive(trackerMeta, phaseLinkId) {
  return readLhState(trackerMeta).max > 0 ? phaseLinkId : null
}

function applyLhVisual(wrap, max, _rem, trackerMeta, combatRound) {
  const pie = wrap.querySelector('.init-lh-cell__pie')
  if (!pie) return
  if (max <= 0) {
    pie.style.setProperty('--lh-consumed', '0deg')
    return
  }
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
  const priorSpendVisual = readLhCommitKrPriorSpendForRound(
    trackerMeta,
    effectiveRound
  )
  const frac = lhPieFraction(
    effectiveRound,
    currentNavIniForRender,
    commitRound,
    heroIniNum,
    mechanics.actionsPerKr,
    mechanics.triggerIniStep,
    max,
    Number.isFinite(commitIniStored) ? commitIniStored : undefined,
    priorSpendVisual
  )
  pie.style.setProperty('--lh-consumed', `${frac * 360}deg`)
}

function appendLhCell(
  container,
  ownerItemId,
  trackerMeta,
  canEdit,
  lhStampPhaseLinkId,
  combatRound = null,
  roundStampingAllowed = true,
  lhVisualRoundLocked
) {
  const lhDimAtRoundBoundary =
    lhVisualRoundLocked !== undefined
      ? lhVisualRoundLocked
      : !roundStampingAllowed
  const lhCommitOpts =
    lhStampPhaseLinkId !== undefined
      ? { stampPhaseLinkId: lhStampPhaseLinkId }
      : undefined
  const st = readLhState(trackerMeta)
  const prev = lhRenderPrev.get(ownerItemId)
  lhRenderPrev.set(ownerItemId, { max: st.max, rem: st.rem })

  const wrap = document.createElement('div')
  wrap.className =
    'init-lh-cell' + (st.max > 0 ? ' init-lh-cell--active' : ' init-lh-cell--empty')
  if (canEdit && lhDimAtRoundBoundary) {
    wrap.classList.add('init-lh-cell--round-locked')
  }

  const pieWrap = document.createElement('div')
  pieWrap.className = 'init-lh-cell__pie-wrap'
  const pie = document.createElement('div')
  pie.className = 'init-lh-cell__pie'
  pie.setAttribute('aria-hidden', 'true')
  pieWrap.appendChild(pie)

  const fraction = document.createElement('span')
  fraction.className = 'init-lh-cell__fraction'
  fraction.setAttribute('aria-hidden', 'true')
  const fracLabel = lhFractionFromNavForMeta(trackerMeta, st.max, combatRound)
  if (fracLabel) fraction.textContent = fracLabel

  const lhRunning = isLhActive(trackerMeta)
  const stepLabel = lhRunning
    ? lhActionStepLabelFromNavFraction(fracLabel, st.max)
    : ''
  const stepBadge = document.createElement('span')
  stepBadge.className = 'init-lh-cell__step'
  stepBadge.setAttribute('aria-hidden', 'true')
  if (stepLabel) stepBadge.textContent = `Aktion ${stepLabel}`

  const inp = document.createElement('input')
  inp.type = 'text'
  inp.className = 'init-lh-cell__input'
  inp.inputMode = 'numeric'
  inp.autocomplete = 'off'
  inp.spellcheck = false
  inp.maxLength = 3
  inp.value = st.max > 0 ? String(st.rem) : ''

  const lhTitleActive = lhRunning
    ? `Längerfristige Handlung läuft: Aktion ${stepLabel}. Pro KR bis zu zwei Abzüge an den INI-Stufen des Tokens und 8 darunter (≥ 0); bei INI < 0 nur ein Abzug pro KR. Während die L.H. läuft sind Angriff, S.R.A., Schild und Parade gesperrt — freie Aktionen bleiben erlaubt. Über das × oben rechts abbrechen.`
    : 'Längerfristige Handlung: Anzahl Aktionen eintragen und Verlassen (Tab/Enter). Während die L.H. läuft sind Angriff, S.R.A., Schild und Parade gesperrt; freie Aktionen bleiben erlaubt.'
  inp.title = lhTitleActive
  inp.setAttribute(
    'aria-label',
    fracLabel
      ? fracLabel === 'GO!'
        ? `Längerfristige Handlung, letzter Auslöser (GO!), ${st.rem} verbleibend von ${st.max}`
        : `Längerfristige Handlung, Aktion ${stepLabel || fracLabel}`
      : 'Längerfristige Handlung, inaktiv'
  )
  inp.readOnly = !canEdit || !roundStampingAllowed || lhRunning
  if (!canEdit) {
    inp.title =
      'Nur Spielleitung oder Besitzer dieses Tokens (Längerfristige Handlung)'
  } else if (!roundStampingAllowed) {
    inp.title =
      'Längerfristige Handlung: am Beginn/Ende der Kampfrunde keine Änderungen (Navigation).'
  }

  wrap.append(pieWrap, fraction, stepBadge, inp)

  applyLhVisual(wrap, st.max, st.rem, trackerMeta, combatRound)

  if (
    prev &&
    prev.max > 0 &&
    prev.rem > 0 &&
    st.max === 0 &&
    st.rem === 0
  ) {
    wrap.classList.add('init-lh-cell--completed-flash')
    window.setTimeout(() => {
      wrap.classList.remove('init-lh-cell--completed-flash')
    }, 2200)
  }

  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      inp.blur()
      const btn = document.querySelector('[data-combat-next]')
      if (btn instanceof HTMLButtonElement) btn.click()
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      inp.blur()
      const btn = document.querySelector('[data-combat-prev]')
      if (btn instanceof HTMLButtonElement) btn.click()
      return
    }
    if (canEdit && e.key === 'Enter') {
      e.preventDefault()
      inp.blur()
    }
  })

  if (canEdit) {
    let dirty = false
    inp.addEventListener('focus', () => {
      dirty = false
      wrap.classList.add('init-lh-cell--input-focus')
    })
    inp.addEventListener('input', () => {
      dirty = true
    })
    inp.addEventListener('blur', () => {
      wrap.classList.remove('init-lh-cell--input-focus')
      if (!dirty || !roundStampingAllowed) return
      dirty = false
      void commitLhValue(ownerItemId, inp.value, {
        ...lhCommitOpts,
        commitIni: currentNavIniForRender,
      })
    })
    wrap.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!roundStampingAllowed) return
      void commitLhValue(ownerItemId, '', lhCommitOpts)
    })
  }

  container.appendChild(wrap)
}

function encodePhaseDrag(ownerId, linkId) {
  return `${PHASE_DRAG_MARK}${ownerId}|${linkId}`
}

function parsePhaseDrag(dragId) {
  if (typeof dragId !== 'string' || !dragId.startsWith(PHASE_DRAG_MARK)) {
    return null
  }
  const rest = dragId.slice(PHASE_DRAG_MARK.length)
  const i = rest.indexOf('|')
  if (i < 0) return null
  return { ownerId: rest.slice(0, i), linkId: rest.slice(i + 1) }
}

function isTokenDragTransfer(dataTransfer) {
  return (
    dataTransfer?.types &&
    Array.from(dataTransfer.types).includes(TOKEN_DRAG_MIME)
  )
}

function formatHookDisplay(hook) {
  if (hook === null) return ''
  return Number.isInteger(hook) ? String(hook) : String(hook)
}

function parseIniNumber(s) {
  const n = Number(String(s ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** INI-Stützpunkte für vertikales Lerp: Token + Phasen-Zeilen (Ziel-INI). */
function buildDragKnots(listElement, items, tieOrderIds, dragId) {
  const rows = collectSortedParticipants(
    items,
    tieOrderIds,
    getManualIniTieOverridePairs()
  )
  const rowMap = new Map(rows.map((r) => [r.id, r]))
  const phaseRef = parsePhaseDrag(dragId)
  const knots = []
  for (const el of listElement.querySelectorAll(
    'li.init-row--token-draggable, li.init-row--phase, li.init-row--round-start, li.init-row--round-end'
  )) {
    const itemId = el.dataset.itemId
    const linkId = el.dataset.phaseLinkId
    const ownerId = el.dataset.phaseOwnerId
    if (itemId) {
      if (!phaseRef && itemId === dragId) continue
      const row = rowMap.get(itemId)
      const v = parseIniNumber(row?.initiative)
      if (v === null) continue
      const r = el.getBoundingClientRect()
      knots.push({ y: r.top + r.height / 2, v })
    } else if (
      el.classList.contains('init-row--round-end') ||
      el.classList.contains('init-row--round-start')
    ) {
      const v = parseIniNumber(el.dataset.dragKnotIni)
      if (v === null) continue
      const r = el.getBoundingClientRect()
      knots.push({ y: r.top + r.height / 2, v })
    } else if (linkId && ownerId) {
      if (
        phaseRef &&
        ownerId === phaseRef.ownerId &&
        linkId === phaseRef.linkId
      ) {
        continue
      }
      const v = parseIniNumber(el.dataset.dragKnotIni)
      if (v === null) continue
      const r = el.getBoundingClientRect()
      knots.push({ y: r.top + r.height / 2, v })
    }
  }
  knots.sort((a, b) => a.y - b.y)
  return knots
}

/** Ganzzahliger Kampfwert-Anteil beim Drag: -99 … 99. */
const DRAG_INI_INT_MIN = -99
const DRAG_INI_INT_MAX = 99

/** Fallback nur für seltene Drag-Fälle ohne referenzierbare Listeinträge. */
const DRAG_INI_FALLBACK_TOP = 20
const DRAG_INI_FALLBACK_BOTTOM = 8

const INI_DRAG_FLOAT_HINT = 'LOSLASSEN: NEUEN WERT ÜBERNEHMEN'

/** Dwell-Zeit in ms pro ±1 INI, wenn die Maus in der INI-Spalte über/unter der Liste bleibt. */
const INI_LIST_EDGE_DWELL_MS = 240

function getIniColumnBoundsFromList(listUl) {
  const inputs = listUl.querySelectorAll('.init-row-init')
  if (inputs.length === 0) return null
  let left = Infinity
  let right = -Infinity
  for (const el of inputs) {
    const r = el.getBoundingClientRect()
    left = Math.min(left, r.left)
    right = Math.max(right, r.right)
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null
  return { left, right }
}

/**
 * Zusätzliche INI-Schritte, wenn die Maus oberhalb/unterhalb des Float-Fensters bleibt.
 */
function extraIniStepsOutsideFloat(clientY, floatRect, pxPerStep = 26) {
  if (!floatRect || floatRect.width <= 0 || floatRect.height <= 0) return 0
  let s = 0
  if (clientY < floatRect.top) {
    s += Math.ceil((floatRect.top - clientY) / pxPerStep)
  }
  if (clientY > floatRect.bottom) {
    s -= Math.ceil((clientY - floatRect.bottom) / pxPerStep)
  }
  return s
}

function positionAndClampIniFloat(el, leftPx, topPx) {
  el.style.left = `${leftPx}px`
  el.style.top = `${topPx}px`
  el.classList.add('init-drag-ini-float--visible')
  const pad = 8
  for (let i = 0; i < 4; i++) {
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = parseFloat(el.style.left) || 0
    const top = parseFloat(el.style.top) || 0
    let dx = 0
    let dy = 0
    if (r.left < pad) dx = pad - r.left
    if (r.right > vw - pad) dx = vw - pad - r.right
    if (r.top < pad) dy = pad - r.top
    if (r.bottom > vh - pad) dy = vh - pad - r.bottom
    if (dx === 0 && dy === 0) break
    el.style.left = `${left + dx}px`
    el.style.top = `${top + dy}px`
  }
}

/**
 * INI aus Y relativ zum Greifpunkt:
 * - am Greifpunkt bleibt der aktuelle INI-Wert erhalten
 * - nach oben skaliert bis (max(Knots)+8)
 * - nach unten skaliert bis (min(Knots)-8)
 */
function lerpIniFromClientY(clientY, knots, listUl, anchor) {
  const vals = knots
    .map((k) => Number(k?.v))
    .filter((n) => Number.isFinite(n))
  const topIni =
    vals.length > 0 ? Math.max(...vals) + 8 : DRAG_INI_FALLBACK_TOP
  const bottomIni =
    vals.length > 0 ? Math.min(...vals) - 8 : DRAG_INI_FALLBACK_BOTTOM
  const scrollEl = listUl.closest('.initiative-list-scroll')
  const ur =
    scrollEl?.getBoundingClientRect() ?? listUl.getBoundingClientRect()
  const anchorY = Number.isFinite(anchor?.clientY)
    ? anchor.clientY
    : ur.top + ur.height / 2
  const anchorInt = Number.isFinite(anchor?.intPart) ? anchor.intPart : 0
  if (clientY <= anchorY) {
    const denUp = Math.max(1e-6, anchorY - ur.top)
    const tUp = (anchorY - clientY) / denUp
    return anchorInt + tUp * (topIni - anchorInt)
  }
  const denDown = Math.max(1e-6, ur.bottom - anchorY)
  const tDown = (clientY - anchorY) / denDown
  return anchorInt + tDown * (bottomIni - anchorInt)
}

function clampIniContinuous(continuous) {
  if (continuous == null || !Number.isFinite(continuous)) return null
  return continuous
}

/** Konsistentes Runden (ohne JS „half-to-even“ bei .5). */
function roundHalfUp(n) {
  if (!Number.isFinite(n)) return null
  return Math.floor(n + 0.5)
}

function iniBaseIntFromLerp(continuous) {
  return roundHalfUp(continuous)
}

function formatIniStorage(n) {
  if (!Number.isFinite(n)) return '0'
  const x = n
  let s = x.toFixed(4).replace(/\.?0+$/, '')
  if (s === '' || s === '-') s = '0'
  return s
}

function intPartFromIniStr(iniStr) {
  const r = initiativeRank(iniStr)
  if (r && Number.isFinite(r.intPart)) return r.intPart
  const n = parseIniNumber(iniStr)
  return Number.isFinite(n) ? roundHalfUp(n) : 0
}

/**
 * Ganzzahliger „Kampfwert“-Anteil aus vertikalem Lerp; Nachkomma wie bisher am Token.
 * newNum = Ersatz-Ganzzahlanteil + (aktueller Wert − trunc-Anteil aus initiativeRank).
 */
function composeProposedIniFromDragIntPart(replacementIntPart, currentIniStr) {
  const cur = parseIniNumber(currentIniStr)
  const r = initiativeRank(currentIniStr)
  if (cur === null || r === null) {
    return formatIniStorage(replacementIntPart)
  }
  const newNum = replacementIntPart + (cur - r.intPart)
  return formatIniStorage(newNum)
}

function dragProposesIniChange(proposedStr, curStr, dragRow, dragId, phaseRef) {
  if (phaseRef) {
    if (!dragRow) return false
    const id = phaseRef.linkId
    return (
      initiativeCompareOnlyIni(
        { id, initiative: proposedStr, name: dragRow.name },
        { id, initiative: curStr, name: dragRow.name }
      ) !== 0
    )
  }
  if (!dragRow) return false
  return (
    initiativeCompareOnlyIni(
      { id: dragId, initiative: proposedStr, name: dragRow.name },
      { id: dragId, initiative: curStr, name: dragRow.name }
    ) !== 0
  )
}

function computeDropProposal(
  clientY,
  dragId,
  items,
  tieOrderIds,
  listElement,
  wheelNudge,
  listUl,
  dragAnchor
) {
  const rows = collectSortedParticipants(
    items,
    tieOrderIds,
    getManualIniTieOverridePairs()
  )
  const rowMap = new Map(rows.map((r) => [r.id, r]))
  const phaseRef = parsePhaseDrag(dragId)
  let dragRow
  let curStr
  if (phaseRef) {
    dragRow = rowMap.get(phaseRef.ownerId)
    const it = items.find((i) => i.id === phaseRef.ownerId)
    const meta = it?.metadata?.[TRACKER_ITEM_META_KEY]
    if (phaseRef.linkId === LH_DONE_STEP_ID) {
      const doneIni = Number(meta?.[LH_DONE_INI])
      if (Number.isFinite(doneIni)) {
        curStr = formatHookDisplay(doneIni)
      } else {
        const { max: lhm, rem: lhr } = readLhState(meta)
        const H = parseIniNumber(dragRow?.initiative ?? '')
        const cr = getCombat().started ? getCombat().round : null
        if (lhm > 0 && lhr > 0 && H != null) {
          const hk = computeLhProgressDisplayHookIni(
            lhm,
            lhr,
            H,
            meta,
            cr
          )
          curStr = formatHookDisplay(hk)
        } else {
          curStr = ''
        }
      }
    } else {
      const links = normalizePhases(meta?.phases).links
      const h = hookIniForLink(
        phaseRef.linkId,
        dragRow?.initiative ?? '',
        links
      )
      curStr = formatHookDisplay(h)
    }
  } else {
    dragRow = rowMap.get(dragId)
    curStr = dragRow?.initiative ?? ''
  }
  const knots = buildDragKnots(listElement, items, tieOrderIds, dragId)
  const anchor =
    dragAnchor &&
    Number.isFinite(dragAnchor.clientY) &&
    Number.isFinite(dragAnchor.intPart)
      ? dragAnchor
      : { clientY, intPart: intPartFromIniStr(curStr) }
  const previewCont = clampIniContinuous(
    lerpIniFromClientY(clientY, knots, listUl, anchor)
  )
  let baseInt = iniBaseIntFromLerp(previewCont)
  if (baseInt == null) {
    const r = initiativeRank(curStr)
    baseInt = r ? r.intPart : 0
  }
  let intPart = baseInt + wheelNudge
  intPart = Math.max(DRAG_INI_INT_MIN, Math.min(DRAG_INI_INT_MAX, intPart))
  const proposedStr = composeProposedIniFromDragIntPart(intPart, curStr)
  const willIni = dragProposesIniChange(
    proposedStr,
    curStr,
    dragRow,
    dragId,
    phaseRef
  )
  return { proposedStr, willIni, knots, dragRow, curStr }
}

function clientYToInsertSlot(clientY, tokenEls) {
  const n = tokenEls.length
  if (n === 0) return 0
  let slot = 0
  for (let i = 0; i < n; i++) {
    const r = tokenEls[i].getBoundingClientRect()
    const mid = r.top + r.height / 2
    if (clientY >= mid) slot = i + 1
  }
  return slot
}

function pickNearestValidSlot(rawSlot, validSlots) {
  if (validSlots.length === 0) return null
  let best = validSlots[0]
  let bestD = Math.abs(rawSlot - best)
  for (const s of validSlots) {
    const d = Math.abs(rawSlot - s)
    if (d < bestD || (d === bestD && s < best)) {
      best = s
      bestD = d
    }
  }
  return best
}

function findListLiForSwapDisc(ul, disc) {
  const parts = disc.split('|')
  const kind = parts[0]
  if (kind === 'token' && parts[1]) {
    return ul.querySelector(
      `li.init-row--token-draggable[data-item-id="${CSS.escape(parts[1])}"]`
    )
  }
  if (kind === 'lhdone' && parts[1]) {
    const key = zaoRootKey(parts[1], LH_DONE_STEP_ID)
    return ul.querySelector(
      `li.init-row--phase-zao[data-zao-swap-key="${CSS.escape(key)}"]`
    )
  }
  if (kind === 'zroot' && parts.length >= 3) {
    const owner = parts[1]
    const linkId = parts.slice(2).join('|')
    const key = zaoRootKey(owner, linkId)
    return ul.querySelector(
      `li.init-row--phase-zao[data-zao-swap-key="${CSS.escape(key)}"]`
    )
  }
  if (kind === 'pchild' && parts.length >= 3) {
    const owner = parts[1]
    const linkId = parts.slice(2).join('|')
    return ul.querySelector(
      `li.init-row--phase[data-phase-owner-id="${CSS.escape(owner)}"][data-phase-link-id="${CSS.escape(linkId)}"]`
    )
  }
  return null
}

/** INI-Tauschpfeil mit klaren Spitzen und leicht gebogener Mittellinie. */
const INI_SWAP_SVG_CURVED =
  '<svg class="init-row-ini-swap__svg" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.55" stroke-linecap="square" stroke-linejoin="miter" d="M5.6 6V1H10.6"/><path fill="none" stroke="currentColor" stroke-width="2.55" stroke-linecap="square" stroke-linejoin="miter" d="M7 1Q13.8 10 7 19"/><path fill="none" stroke="currentColor" stroke-width="2.55" stroke-linecap="square" stroke-linejoin="miter" d="M10.6 19H5.6V14"/></svg>'

/** Tausch-Button exakt im Flex-Gap zwischen zwei `li` (gleiche INI, beliebiger Zeilentyp). */
function layoutIniSwapBetween(ul, host, overlay) {
  if (!host || !overlay) return
  const hostR = host.getBoundingClientRect()
  for (const btn of overlay.querySelectorAll('.init-row-ini-swap')) {
    const dU = btn.dataset.iniSwapDiscUpper
    const dL = btn.dataset.iniSwapDiscLower
    if (!dU || !dL) continue
    const upperLi = findListLiForSwapDisc(ul, dU)
    const lowerLi = findListLiForSwapDisc(ul, dL)
    const refCol = upperLi?.querySelector('.init-col-swap')
    const prev = lowerLi?.previousElementSibling
    if (!upperLi || !lowerLi || !refCol || !prev) {
      btn.style.display = 'none'
      continue
    }
    btn.style.display = ''
    const gapTop = prev.getBoundingClientRect().bottom
    const gapBot = lowerLi.getBoundingClientRect().top
    const gapH = Math.max(0, gapBot - gapTop)
    if (gapH < 1) {
      btn.style.display = 'none'
      continue
    }
    const col = refCol.getBoundingClientRect()
    const hitH = 22
    const hitW = Math.max(col.width + 10, 24)
    const midY = (gapTop + gapBot) / 2
    btn.style.position = 'absolute'
    btn.style.left = `${col.left - hostR.left - (hitW - col.width) / 2}px`
    btn.style.width = `${hitW}px`
    btn.style.top = `${midY - hostR.top - hitH / 2}px`
    btn.style.height = `${hitH}px`
  }
}

export function setupInitiativeList(element, { onListChange } = {}) {
  let restoreFocusItemId = null
  /** @type {{ itemId: string, inputId: string, selectionStart: number | null, selectionEnd: number | null } | null} */
  let restoreHeroInputFocus = null
  let lastItems = []

  const roundIntroBoard = document.querySelector('[data-kampf-round-intro]')
  const roundIntroLabel = document.querySelector('[data-kampf-round-intro-label]')

  /** Enthält `ul` + Swap-Overlay, scrollt gemeinsam mit `.initiative-list-scroll`. */
  const listContentRoot = element.parentElement
  const listScrollEl = listContentRoot?.parentElement ?? null

  const swapOverlay = document.createElement('div')
  swapOverlay.className = 'init-ini-swap-overlay'
  swapOverlay.setAttribute('aria-hidden', 'true')
  if (listContentRoot) listContentRoot.appendChild(swapOverlay)

  const runSwapLayout = () =>
    layoutIniSwapBetween(element, listContentRoot, swapOverlay)

  if (listScrollEl) {
    listScrollEl.addEventListener('scroll', runSwapLayout, { passive: true })
  }

  /** INI-Felder: bei Fokus (Klick/Tab) den vorhandenen Wert vollständig auswählen. */
  element.addEventListener('focusin', (e) => {
    const t = e.target
    if (!(t instanceof HTMLInputElement)) return
    if (!t.classList.contains('init-row-init')) return
    if (t.disabled) return
    requestAnimationFrame(() => {
      t.select()
    })
  })

  const iniFloat = document.createElement('div')
  iniFloat.className = 'init-drag-ini-float'
  iniFloat.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iniFloat)

  let rowDragActive = false
  let dragWheelNudge = 0
  /** Letzter effektiver Rad-+Außerhalb-Schritte-Wert (für Drop ohne verpasstes dragover). */
  let lastCombinedWheelNudge = 0
  /** Langsame ±1-Schritte bei Maus in INI-Spalte über/unter der Liste. */
  let dragEdgeSlowSteps = 0
  let dragEdgeAccumMs = 0
  let dragEdgeZone = null
  let dragSessionLastTs = 0
  let activeDragRowId = null
  let lastDragClientX = 0
  let lastDragClientY = 0
  let lastPreviewProposedStr = ''
  let lastPreviewWillIni = false
  let lastPreviewDragId = null
  let dragAnchorClientY = null
  let dragAnchorIntPart = null
  /** Feste X-Position der INI-Vorschau (nur Y folgt dem Zeiger). */
  let dragFloatAnchorX = 0

  /** Token-Zeilen: ausgeklappte „Helden-Extras“ (nur SL / Besitzer). */
  const expandedPlayerExtrasIds = new Set()

  let swapLayoutRo = null
  /** Nur bei geändertem Kampf-Zug (Combat-State), nicht bei jedem List-Update oder DOM-Signatur. */
  let lastTurnScrollKey = ''

  const hideIniFloat = () => {
    iniFloat.classList.remove('init-drag-ini-float--visible')
    iniFloat.replaceChildren()
  }

  const setDragAnchor = (dragId, clientY) => {
    const phaseRef = parsePhaseDrag(dragId)
    const rows = collectSortedParticipants(
      lastItems,
      getIniTieOrder(),
      getManualIniTieOverridePairs()
    )
    const rowMap = new Map(rows.map((r) => [r.id, r]))
    let curStr = ''
    if (phaseRef) {
      const dragRow = rowMap.get(phaseRef.ownerId)
      const it = lastItems.find((i) => i.id === phaseRef.ownerId)
      const meta = it?.metadata?.[TRACKER_ITEM_META_KEY]
      if (phaseRef.linkId === LH_DONE_STEP_ID) {
        const doneIni = Number(meta?.[LH_DONE_INI])
        if (Number.isFinite(doneIni)) {
          curStr = formatHookDisplay(doneIni)
        } else {
          const { max: lhm, rem: lhr } = readLhState(meta)
          const H = parseIniNumber(dragRow?.initiative ?? '')
          const cr = getCombat().started ? getCombat().round : null
          if (lhm > 0 && lhr > 0 && H != null) {
            const hk = computeLhProgressDisplayHookIni(lhm, lhr, H, meta, cr)
            curStr = formatHookDisplay(hk)
          }
        }
      } else {
        const links = normalizePhases(meta?.phases).links
        const h = hookIniForLink(
          phaseRef.linkId,
          dragRow?.initiative ?? '',
          links
        )
        curStr = formatHookDisplay(h)
      }
    } else {
      curStr = rowMap.get(dragId)?.initiative ?? ''
    }
    dragAnchorClientY = Number.isFinite(clientY) ? clientY : null
    dragAnchorIntPart = intPartFromIniStr(curStr)
  }

  const updateDragSession = (clientX, clientY, dragId) => {
    lastDragClientX = clientX
    lastDragClientY = clientY
    if (!dragId || !rowDragActive) {
      hideIniFloat()
      return
    }

    const now = performance.now()
    if (dragSessionLastTs <= 0) dragSessionLastTs = now
    const dt = Math.min(80, Math.max(0, now - dragSessionLastTs))
    dragSessionLastTs = now

    const iniCol = getIniColumnBoundsFromList(element)
    const listRect =
      listScrollEl?.getBoundingClientRect() ?? element.getBoundingClientRect()
    let iniEdgeZone = null
    if (
      iniCol &&
      clientX >= iniCol.left - 4 &&
      clientX <= iniCol.right + 4
    ) {
      if (clientY > listRect.bottom) iniEdgeZone = 'below'
      else if (clientY < listRect.top) iniEdgeZone = 'above'
    }
    if (iniEdgeZone !== dragEdgeZone) {
      dragEdgeZone = iniEdgeZone
      dragEdgeAccumMs = 0
    }
    if (iniEdgeZone === 'below') {
      dragEdgeAccumMs += dt
      while (dragEdgeAccumMs >= INI_LIST_EDGE_DWELL_MS) {
        dragEdgeSlowSteps--
        dragEdgeAccumMs -= INI_LIST_EDGE_DWELL_MS
      }
    } else if (iniEdgeZone === 'above') {
      dragEdgeAccumMs += dt
      while (dragEdgeAccumMs >= INI_LIST_EDGE_DWELL_MS) {
        dragEdgeSlowSteps++
        dragEdgeAccumMs -= INI_LIST_EDGE_DWELL_MS
      }
    } else {
      dragEdgeAccumMs = 0
    }

    let combinedNudge = dragWheelNudge + dragEdgeSlowSteps
    let proposedStr = ''
    let willIni = false
    let dragRow = null
    const draggingPhase = Boolean(parsePhaseDrag(dragId))

    for (let iter = 0; iter < 5; iter++) {
      ;({ proposedStr, willIni, dragRow } = computeDropProposal(
        clientY,
        dragId,
        lastItems,
        getIniTieOrder(),
        element,
        combinedNudge,
        element,
        { clientY: dragAnchorClientY, intPart: dragAnchorIntPart }
      ))
      if (!dragRow) {
        hideIniFloat()
        lastCombinedWheelNudge = dragWheelNudge + dragEdgeSlowSteps
        lastPreviewProposedStr = ''
        lastPreviewWillIni = false
        lastPreviewDragId = null
        return
      }

      iniFloat.replaceChildren()
      const nameEl = document.createElement('div')
      nameEl.className = 'init-drag-ini-float-name'
      nameEl.textContent = dragRow.name || '—'
      nameEl.title = dragRow.name || ''
      const main = document.createElement('div')
      main.className = 'init-drag-ini-float-main'
      main.textContent = draggingPhase
        ? `2.A. INI ${proposedStr}`
        : `INI ${proposedStr}`
      const mode = document.createElement('div')
      mode.className = 'init-drag-ini-float-mode'
      mode.textContent = INI_DRAG_FLOAT_HINT
      iniFloat.append(nameEl, main, mode)

      positionAndClampIniFloat(iniFloat, dragFloatAnchorX, clientY + 12)
      const outside = extraIniStepsOutsideFloat(
        clientY,
        iniFloat.getBoundingClientRect()
      )
      const next = dragWheelNudge + dragEdgeSlowSteps + outside
      if (next === combinedNudge) break
      combinedNudge = next
    }
    lastCombinedWheelNudge = combinedNudge
    lastPreviewProposedStr = proposedStr
    lastPreviewWillIni = willIni
    lastPreviewDragId = dragId
  }

  const applyTokenDragRelease = (dragId, clientY, wheelAtDrop) => {
    hideIniFloat()
    if (!dragId || !listContentRoot) return
    const capturedStr =
      lastPreviewDragId === dragId && lastPreviewProposedStr !== ''
        ? lastPreviewProposedStr
        : null
    const capturedWillIni = capturedStr != null ? lastPreviewWillIni : false
    void OBR.scene.items.getItems().then((fresh) => {
      const phaseRef = parsePhaseDrag(dragId)
      if (phaseRef) {
        const ownerIt = fresh.find((i) => i.id === phaseRef.ownerId)
        if (!canEditSceneItem(ownerIt)) return
      } else {
        const tokenIt = fresh.find((i) => i.id === dragId)
        if (!canEditSceneItem(tokenIt)) return
      }
      const tokenElsFresh = [
        ...element.querySelectorAll('li.init-row:not(.init-row--phase)'),
      ]
      let proposedStr = ''
      let willIni = false
      if (capturedStr != null) {
        proposedStr = capturedStr
        willIni = capturedWillIni
      } else {
        ;({ proposedStr, willIni } = computeDropProposal(
          clientY,
          dragId,
          fresh,
          getIniTieOrder(),
          element,
          wheelAtDrop,
          element,
          { clientY: dragAnchorClientY, intPart: dragAnchorIntPart }
        ))
      }
      if (phaseRef) {
        if (willIni) {
          if (phaseRef.linkId === LH_DONE_STEP_ID) {
            const om =
              fresh.find((i) => i.id === phaseRef.ownerId)?.metadata?.[
                TRACKER_ITEM_META_KEY
              ]
            if (!Number.isFinite(Number(om?.[LH_DONE_INI]))) return
            void tryCommitLhDoneTargetIni(
              phaseRef.ownerId,
              proposedStr
            ).then(async (res) => {
              if (!res.ok && res.reason === 'NEG_INI') {
                void removeLhDoneRow(phaseRef.ownerId)
              }
            })
          } else {
            const ownerRow = collectSortedParticipants(
              fresh,
              getIniTieOrder(),
              getManualIniTieOverridePairs()
            ).find((r) => r.id === phaseRef.ownerId)
            const ownerIni = ownerRow?.initiative ?? ''
            const it = fresh.find((i) => i.id === phaseRef.ownerId)
            const links = normalizePhases(
              it?.metadata?.[TRACKER_ITEM_META_KEY]?.phases
            ).links
            void tryCommitPhaseTargetIni(
              phaseRef.ownerId,
              phaseRef.linkId,
              proposedStr,
              ownerIni,
              links
            ).then(async (res) => {
              if (!res.ok && res.reason === 'NEG_INI') {
                void removePhaseLink(phaseRef.ownerId, phaseRef.linkId)
              }
            })
          }
        }
        return
      }
      if (willIni) {
        restoreFocusItemId = dragId
        void OBR.scene.items
          .updateItems([dragId], (drafts) => {
            for (const d of drafts) {
              const m = d.metadata[TRACKER_ITEM_META_KEY]
              if (!m) continue
              const wasBelow = isHeroIniBelowZero(m)
              m.initiative = proposedStr
              applyIniLockCharges(m)
              if (getCombat().started) {
                applyIniNegativePoolShiftForMetaMutation(
                  m,
                  wasBelow,
                  isHeroIniBelowZero(m)
                )
              }
              if (!getCombat().started) ensureFullFreeActionQuota(m)
            }
          })
          .then(() => OBR.scene.items.getItems())
          .then((afterIni) => {
            renderList(afterIni)
            const els = [
              ...element.querySelectorAll('li.init-row:not(.init-row--phase)'),
            ]
            const { validSlots } = computeValidIniTieInsertSlots(
              dragId,
              afterIni
            )
            if (validSlots.length === 0) return
            const raw = clientYToInsertSlot(clientY, els)
            const slot = pickNearestValidSlot(raw, validSlots)
            if (slot == null) return
            void reorderIniTieToken(dragId, slot, afterIni)
          })
        return
      }
      const { validSlots } = computeValidIniTieInsertSlots(dragId, fresh)
      if (validSlots.length === 0) return
      const raw = clientYToInsertSlot(clientY, tokenElsFresh)
      const slot = pickNearestValidSlot(raw, validSlots)
      if (slot == null) return
      void reorderIniTieToken(dragId, slot, fresh)
    })
  }

  const wheelListenerOpts = { passive: false }

  const onDocumentDragOverWhileRow = (e) => {
    if (!rowDragActive || activeDragRowId == null) return
    if (!isTokenDragTransfer(e.dataTransfer)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    updateDragSession(e.clientX, e.clientY, activeDragRowId)
  }

  const onDocumentDropWhileRow = (e) => {
    if (!rowDragActive || activeDragRowId == null) return
    if (!isTokenDragTransfer(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    const dragId =
      e.dataTransfer.getData(TOKEN_DRAG_MIME) ||
      e.dataTransfer.getData('text/plain')
    if (dragId !== activeDragRowId) return
    updateDragSession(e.clientX, e.clientY, activeDragRowId)
    applyTokenDragRelease(dragId, e.clientY, lastCombinedWheelNudge)
  }

  const onDocumentWheelWhileRow = (e) => {
    if (!rowDragActive || activeDragRowId == null) return
    e.preventDefault()
    e.stopPropagation()
    dragWheelNudge += e.deltaY < 0 ? 1 : -1
    updateDragSession(lastDragClientX, lastDragClientY, activeDragRowId)
  }

  const attachGlobalDragListeners = () => {
    document.addEventListener('dragover', onDocumentDragOverWhileRow, true)
    document.addEventListener('drop', onDocumentDropWhileRow, true)
    document.addEventListener('wheel', onDocumentWheelWhileRow, wheelListenerOpts)
  }

  const detachGlobalDragListeners = () => {
    document.removeEventListener('dragover', onDocumentDragOverWhileRow, true)
    document.removeEventListener('drop', onDocumentDropWhileRow, true)
    document.removeEventListener('wheel', onDocumentWheelWhileRow, wheelListenerOpts)
  }

  const phaseLinkExistsOnItem = (items, ownerId, linkId) => {
    const it = items.find((i) => i.id === ownerId)
    if (!it) return false
    const p = normalizePhases(
      it.metadata?.[TRACKER_ITEM_META_KEY]?.phases
    )
    return p.links.some((l) => l.id === linkId)
  }

  const reconcileCombat = async (rows, items) => {
    if (!isGmSync()) return
    if (isCombatNavMutationActive()) return
    const c = getCombat()
    if (!c.started) return
    if (c.roundIntroPending) return
    // Defensiver Schutz gegen transient leere Items-Snapshots aus
    // OBR.scene.items (kann während kaskadierender setMetadata/updateItems
    // kurzzeitig 0 zurückgeben). Wenn rows ODER items leer reinkommen, nicht
    // auf `started:false` zurückspringen — sonst geht beim Spieler die Liste
    // verloren und die Navigation klemmt. Der nächste echte Change holt den
    // korrekten Stand garantiert nach.
    if (rows.length === 0 || items.length === 0) return
    const combatRound = c.started ? c.round : null
    const steps = buildCombatTurnSteps(
      rows,
      items,
      getIniTieOrder(),
      combatRound
    )
    if (steps.length === 0) return
    if (findCombatStepIndex(steps, c) >= 0) return

    const phaseId = c.currentPhaseLinkId
    const ownerStillThere = rows.some((r) => r.id === c.currentItemId)

    if (phaseId && ownerStillThere) {
      const linkStillInMeta = phaseLinkExistsOnItem(
        items,
        c.currentItemId,
        phaseId
      )
      if (!linkStillInMeta) {
        await patchCombat({
          ...combatPatchForStep(steps[0]),
          round: c.round,
        })
        return
      }
      // Phasen-Link existiert noch, aber kein Eintrag in steps: nicht auf Mutter zurückspringen
      // (typisch nach Listen-/L.H.-Kantenfall; sonst INI-21 statt gewählter 2.A.-INI).
      return
    }

    await patchCombat({
      ...combatPatchForStep(steps[0]),
      round: c.round,
    })
  }

  let heroSettingsItemId = null
  let heroSettingsGearEl = null
  /** `true` = volles SL-Panel; `false` = Spieler sieht nur Zeilenfarbe. */
  let heroSettingsGmMode = true

  const heroSettingsBackdrop = document.createElement('div')
  heroSettingsBackdrop.className =
    'kampf-settings-backdrop kampf-hero-settings-backdrop'
  heroSettingsBackdrop.hidden = true
  heroSettingsBackdrop.setAttribute('aria-hidden', 'true')
  heroSettingsBackdrop.style.display = 'none'

  const heroSettingsPanel = document.createElement('div')
  heroSettingsPanel.className = 'kampf-settings-panel'
  heroSettingsPanel.setAttribute('role', 'dialog')
  heroSettingsPanel.setAttribute('aria-modal', 'true')
  heroSettingsPanel.setAttribute('aria-labelledby', 'kampf-hero-settings-title')
  heroSettingsPanel.innerHTML = `
    <h2 class="kampf-settings-panel__title" id="kampf-hero-settings-title">Helden-Einstellungen</h2>
    <p class="kampf-settings-panel__hint" id="kampf-hero-settings-hint"></p>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <label class="init-row-extra-label" for="kampf-hero-settings-offset">Phasen-Offset L.H.</label>
      <input type="text" id="kampf-hero-settings-offset" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Abstand der L.H.-Auslöser-INI unter der Helden-INI (Standard 8)" />
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <label class="init-row-extra-label" for="kampf-hero-settings-zat-offset">Phasen-Offset z.AT</label>
      <input type="text" id="kampf-hero-settings-zat-offset" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Abstand zusätzlicher Angriffe unter der Helden-INI (Standard 4)" />
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <label class="init-row-extra-label" for="kampf-hero-settings-ao-offset">Phasen-Offset 2.AO / Parade→Angriff</label>
      <input type="text" id="kampf-hero-settings-ao-offset" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Abstand der 2.A.-Wurzel bei Plus/Umwandlung unter der Helden-INI (Standard 8)" />
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <label class="init-row-extra-label" for="kampf-hero-settings-apkr">Max. Aktionen / KR für längerfristige Handlungen</label>
      <input type="text" id="kampf-hero-settings-apkr" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Längerfristige Handlung: Auslöser pro Kampfrunde (1–10)" />
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <p class="kampf-settings-panel__microhint">Ladungs-Erhaltung: Aktions-Ladungen + Reaktions-Schilde + gestempelte Ladungen = <strong>Ladungen gesamt</strong> (konstant). Beim Rundenstart werden Aktionsobjekte und Schilde automatisch aus diesen Werten befüllt. <strong>Ladungen gesamt</strong> = Summe beider Seiten (1–20).</p>
      <label class="init-row-extra-label" for="kampf-hero-settings-pool-max">Ladungen gesamt / KR</label>
      <input type="text" id="kampf-hero-settings-pool-max" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Gesamtbudget Angriff+Abwehr pro KR (1–20)" />
      <label class="init-row-extra-label" for="kampf-hero-settings-pool-ang">Aktionsladungen (Rundenstart)</label>
      <input type="text" id="kampf-hero-settings-pool-ang" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Ladungen als Aktionsobjekte beim Rundenstart (0…Max); Reaktion = Rest" />
      <label class="init-row-extra-label" for="kampf-hero-settings-pool-abw">Reaktionsladungen (Rundenstart)</label>
      <input type="text" id="kampf-hero-settings-pool-abw" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Ladungen als blaue Schilde beim Rundenstart (0…Max); Aktion = Rest" />
      <p class="kampf-settings-panel__microhint"><strong>INI im positiven Bereich (≥ 0):</strong> Beim Kampfstart und Kampfrundenstart gelten die eingetragenen Aktions- und Reaktionsladungen wie oben. <strong>INI unter 0:</strong> Es wird intern eine Aktionsladung zugunsten der Reaktionsladungen verschoben (<strong>Ladungen gesamt</strong> bleibt gleich). Wechselt die INI in der laufenden Kampfrunde über die Null-Grenze, wird diese Verschiebung angepasst oder zurückgenommen — ohne dass sich die Gesamtkapazität dauerhaft ändern würde.</p>
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <label class="init-row-extra-label" for="kampf-hero-settings-fa-max">Freie Aktionen (Obergrenze)</label>
      <input type="text" id="kampf-hero-settings-fa-max" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="0–10; leer = globale Regel (highIniFreeActions + INI)" />
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <label class="init-row-extra-label" for="kampf-hero-settings-ang-count">Zusätzliche Angriffe (AT)</label>
      <input type="text" id="kampf-hero-settings-ang-count" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="0–10 zusätzliche Angriffs-ZAOs" />
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <label class="init-row-extra-label" for="kampf-hero-settings-par-count">Zusätzliche Paraden</label>
      <input type="text" id="kampf-hero-settings-par-count" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="0–10 zusätzliche schwarze Schilde" />
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <p class="kampf-settings-panel__microhint"><strong>Verhalten bei negativen INI-Werten:</strong> Legt fest, wie viele Ladungen bei INI &lt; 0 gesperrt werden und ob das Schwert weiterhin verfügbar bleibt.</p>
      <label class="init-row-extra-label" for="kampf-hero-settings-ini-neg-lost">Weniger verfügbare Aktionen (Standard 1)</label>
      <input type="text" id="kampf-hero-settings-ini-neg-lost" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Wie viele Ladungen im negativen INI-Bereich gesperrt werden (0–10). Standard: 1." />
      <label class="init-row-extra-label" for="kampf-hero-settings-ini-neg-ang">Angriffe im negativen INI-Bereich</label>
      <select id="kampf-hero-settings-ini-neg-ang" class="init-row-extra-input init-row-extra-select">
        <option value="no">Nein (kein Schwert)</option>
        <option value="yes">Ja (Schwert erlaubt)</option>
        <option value="zatOnly">Nur z.AT zulassen</option>
      </select>
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <p class="kampf-settings-panel__microhint"><strong>Ansageoptionen — Umwandlungs-Schloss „Automatik“:</strong> greifen nur, wenn das Schloss in der Liste auf <em>Automatik</em> steht und die Navigation nicht am Beginn/Ende der Kampfrunde ist. Es ist nur <strong>eine</strong> der beiden Regeln wählbar oder <strong>keine</strong>.</p>
      <fieldset class="kampf-settings-convert-announce">
        <legend class="kampf-settings-convert-announce__legend">Umwandlung (Automatik, außerhalb KR-Beginn/-Ende)</legend>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-convert-announce" value="none" />
          <span><strong>Keine Zusatzregel:</strong> Es gelten nur die allgemeinen Schloss-Regeln.</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-convert-announce" value="firstPhase" />
          <span><strong>Bis einschließlich erster INI-Phase:</strong> Solange die Listen-Navigation noch nicht hinter die erste INI-Phase dieses Helden gewandert ist, darf der Spieler die Umwandlungs-Pfeile nutzen.</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-convert-announce" value="entireRound" />
          <span><strong>Gesamte Kampfrunde:</strong> Der Spieler darf die Umwandlungs-Pfeile in jeder Navigations-Position der Kampfrunde nutzen; dabei gilt automatisch auch der frühere „Umwandeln jederzeit“-Effekt (inkl. Spiegelanzeige an regulären 2.-Aktionszeilen, ohne Zusatzladungen).</span>
        </label>
      </fieldset>
    </div>
    <div class="kampf-settings-panel__section">
      <label class="init-row-extra-label">Hintergrundfarbe (Hauptzeile)</label>
      <p class="kampf-settings-panel__microhint">Für alle in der Szene sichtbar (SL und Spieler). Klick setzt die Farbe sofort; „×“ entfernt sie.</p>
      <div class="kampf-hero-color-grid" data-kampf-hero-color-grid></div>
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-hero-hide-foreign-colors />
        <span><strong>Fremde Heldenfarben ausblenden (Raum-Standard):</strong> Voreinstellung für alle, die in den <strong>Kampf-Einstellungen</strong> (Zahnrad unten) keine eigene Wahl getroffen haben. Wenn aktiv, sehen sie nur die Farbe des eigenen Helden; sonst alle Farben.</span>
      </label>
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only data-kampf-hero-wappen-section>
      <h3 class="kampf-settings-panel__sub">Wunden und Trefferzonen</h3>
      <p class="kampf-settings-panel__microhint">Standard-Vorlage Mensch oder Vierbeiner pro Kämpfer wählen, oder eine eigene Liste anlegen. In den Rüstungskästchen (früher Wappenkästchen) kannst du den Rüstungsschutz eintragen. Eigene startet wahlweise aus Mensch oder Vierbeiner und ist danach komplett bearbeitbar (W20-Zonen, Auto-Mods).</p>
      <fieldset class="kampf-settings-convert-announce">
        <legend class="kampf-settings-convert-announce__legend">Vorlage: Kästchen für Wunden und Trefferzonen</legend>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-wappen-source" value="global" />
          <span><strong>Mensch</strong> (Standard).</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-wappen-source" value="vierbeiner" />
          <span><strong>Vierbeiner (Tiere)</strong> — Standard-Vorlage für vierbeinige Wesen.</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-wappen-source" value="own" />
          <span><strong>Eigene Kästchen für Wunden und Trefferzonen für diesen Kämpfer.</strong> Im Editor wählst du Mensch oder Vierbeiner als Startpunkt; danach individuell anpassbar. In den Rüstungskästchen (früher Wappenkästchen) kannst du den Rüstungsschutz eintragen.</span>
        </label>
      </fieldset>
      <div data-kampf-hero-wappen-host hidden></div>
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <h3 class="kampf-settings-panel__sub">Feldsichtbarkeit und Energie</h3>
      <fieldset class="kampf-settings-convert-announce">
        <legend class="kampf-settings-convert-announce__legend">Energie-Feld im Heldenblock</legend>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-energy-mode" value="ae" />
          <span><strong>AE</strong> anzeigen.</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-energy-mode" value="ke" />
          <span><strong>KE</strong> anzeigen.</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-energy-mode" value="none" />
          <span><strong>Weder noch</strong> (Platzhalter bleibt unsichtbar).</span>
        </label>
      </fieldset>
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-hero-show-fk />
        <span><strong>FK anzeigen:</strong> bei Vierbeiner standardmäßig ausblendbar.</span>
      </label>
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-hero-le-threshold-enabled />
        <span><strong>LE-Schwelle aktivieren:</strong> zusätzliche Schwelle unterhalb der Prozentbänder.</span>
      </label>
      <label class="init-row-extra-label" for="kampf-hero-le-threshold-value">LE-Schwelle (Zahl)</label>
      <input type="text" id="kampf-hero-le-threshold-value" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Positive Zahl, z. B. 5. Leer oder deaktiviert = keine zusätzliche Schwelle." />
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-hero-unfaehig-enabled />
        <span><strong>Auto-Mod „unfähig“ aktivieren:</strong> rein optische Überlagerung bei LE-Schwelle.</span>
      </label>
      <fieldset class="kampf-settings-convert-announce">
        <legend class="kampf-settings-convert-announce__legend">Todesregel</legend>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-death-mode" value="lt0" />
          <span><strong>Tod schon bei LE ≤ 0</strong></span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-death-mode" value="minusKo" />
          <span><strong>Tod ab LE ≤ -KO</strong></span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-death-mode" value="minusOnePointFiveKo" />
          <span><strong>Tod erst bei LE ≤ -1,5KO</strong></span>
        </label>
      </fieldset>
      <label class="init-row-extra-label" for="kampf-hero-unfaehig-threshold-value">Schwelle „unfähig“ (LE ≤)</label>
      <input type="text" id="kampf-hero-unfaehig-threshold-value" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="0 oder größer. Standard Mensch: 5, Vierbeiner: 0." />
      <label class="init-row-extra-label" for="kampf-hero-unfaehig-mark-fields">Markierung (rote Diagonale)</label>
      <input type="text" id="kampf-hero-unfaehig-mark-fields" class="init-row-extra-input" autocomplete="off" spellcheck="false" title="Kommagetrennt, z. B. at,pa,a,tp,fk" />
      <label class="init-row-extra-label" for="kampf-hero-unfaehig-fixed-fields">Optische Fixwerte</label>
      <input type="text" id="kampf-hero-unfaehig-fixed-fields" class="init-row-extra-input" autocomplete="off" spellcheck="false" title="Kommagetrennt, z. B. at=0,pa=0,a=0,tp=0,fk=0,gs=1" />
    </div>
    <div class="kampf-settings-panel__actions">
      <button type="button" class="btn kampf-settings-panel__cancel" data-kampf-hero-settings-cancel>Abbrechen</button>
      <button type="button" class="btn btn--primary kampf-settings-panel__save" data-kampf-hero-settings-save>Speichern und schließen</button>
    </div>
  `
  heroSettingsBackdrop.appendChild(heroSettingsPanel)
  document.body.appendChild(heroSettingsBackdrop)

  const hitZoneOverlay = createHitZoneOverlay({
    trackerMetaKey: TRACKER_ITEM_META_KEY,
  })

  const inpHeroOff = heroSettingsPanel.querySelector('#kampf-hero-settings-offset')
  const inpHeroZatOff = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-zat-offset'
  )
  const inpHeroAoOff = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-ao-offset'
  )
  const inpHeroAp = heroSettingsPanel.querySelector('#kampf-hero-settings-apkr')
  const inpHeroFaMax = heroSettingsPanel.querySelector('#kampf-hero-settings-fa-max')
  const inpHeroAngCount = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-ang-count'
  )
  const inpHeroParCount = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-par-count'
  )
  const inpHeroIniNegLost = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-ini-neg-lost'
  )
  const selHeroIniNegAng = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-ini-neg-ang'
  )
  const inpHeroPoolMax = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-pool-max'
  )
  const inpHeroPoolAng = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-pool-ang'
  )
  const inpHeroPoolAbw = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-pool-abw'
  )
  const heroConvertAnnounceFieldset = heroSettingsPanel.querySelector(
    'fieldset.kampf-settings-convert-announce'
  )
  const heroHideForeignCb = heroSettingsPanel.querySelector(
    '[data-kampf-hero-hide-foreign-colors]'
  )
  const heroColorGrid = heroSettingsPanel.querySelector(
    '[data-kampf-hero-color-grid]'
  )
  const titleHeroEl = heroSettingsPanel.querySelector('#kampf-hero-settings-title')
  const saveHeroBtn = heroSettingsPanel.querySelector(
    '[data-kampf-hero-settings-save]'
  )
  const cancelHeroBtn = heroSettingsPanel.querySelector(
    '[data-kampf-hero-settings-cancel]'
  )
  const heroSettingsHintEl = heroSettingsPanel.querySelector(
    '#kampf-hero-settings-hint'
  )
  const heroGmOnlySections = heroSettingsPanel.querySelectorAll(
    '[data-kampf-hero-gm-only]'
  )
  const heroWappenSection = heroSettingsPanel.querySelector(
    '[data-kampf-hero-wappen-section]'
  )
  const heroWappenHost = heroSettingsPanel.querySelector(
    '[data-kampf-hero-wappen-host]'
  )
  const heroShowFkCb = heroSettingsPanel.querySelector('[data-kampf-hero-show-fk]')
  const heroLeThresholdEnabledCb = heroSettingsPanel.querySelector(
    '[data-kampf-hero-le-threshold-enabled]'
  )
  const heroLeThresholdInp = heroSettingsPanel.querySelector(
    '#kampf-hero-le-threshold-value'
  )
  const heroUnfaehigEnabledCb = heroSettingsPanel.querySelector(
    '[data-kampf-hero-unfaehig-enabled]'
  )
  const heroDeathModeRadios = heroSettingsPanel.querySelectorAll(
    'input[name="kampf-hero-death-mode"]'
  )
  const readHeroDeathMode = (m, fallbackIsVierbeiner) => {
    const v = String(m?.[HERO_DEATH_MODE] ?? '')
      .trim()
      .toLowerCase()
    if (v === 'lt0' || v === 'minusko' || v === 'minusonepointfiveko') {
      return v === 'minusko'
        ? 'minusKo'
        : v === 'minusonepointfiveko'
          ? 'minusOnePointFiveKo'
          : 'lt0'
    }
    const legacy = String(m?.[HERO_DEATH_AT_MINUS_ONE_POINT_FIVE_KO] ?? '')
      .trim()
      .toLowerCase()
    if (['1', 'true', 'on', 'yes', 'ja'].includes(legacy)) return 'minusOnePointFiveKo'
    return fallbackIsVierbeiner ? 'lt0' : 'minusKo'
  }

  const heroUnfaehigThresholdInp = heroSettingsPanel.querySelector(
    '#kampf-hero-unfaehig-threshold-value'
  )
  const heroUnfaehigMarkFieldsInp = heroSettingsPanel.querySelector(
    '#kampf-hero-unfaehig-mark-fields'
  )
  const heroUnfaehigFixedFieldsInp = heroSettingsPanel.querySelector(
    '#kampf-hero-unfaehig-fixed-fields'
  )

  /** @type {ReturnType<typeof mountWappenEditor> | null} */
  let heroWappenEditor = null
  let heroWappenValid = true

  const applyHeroSettingsUiMode = () => {
    const gm = heroSettingsGmMode
    for (const el of heroGmOnlySections) {
      if (el instanceof HTMLElement) {
        el.hidden = !gm
        el.style.display = gm ? '' : 'none'
      }
    }
    if (heroSettingsHintEl instanceof HTMLElement) {
      heroSettingsHintEl.textContent = gm
        ? 'Spielleitung: Werte gelten für dieses Token in der Szene. Die Zeilen-Hintergrundfarbe ist für alle sichtbar.'
        : 'Nur für deinen Helden: Zeilenfarbe wird im Token gespeichert. Ob andere deine Farbe sehen, steuern sie unter Kampf-Einstellungen (Zahnrad unten).'
    }
    if (saveHeroBtn instanceof HTMLElement) {
      saveHeroBtn.textContent = gm ? 'Speichern und schließen' : 'Schließen'
    }
    if (cancelHeroBtn instanceof HTMLElement) {
      cancelHeroBtn.hidden = !gm
      cancelHeroBtn.style.display = gm ? '' : 'none'
    }
  }

  /**
   * Zwischenspeicher beim Öffnen des Helden-Settings-Panels. „Abbrechen“
   * verwirft die Werte (Panel schließt ohne Meta-Änderung), „Speichern und
   * schließen“ überträgt sie in die Token- bzw. Raum-Metadaten und legt bei
   * Bedarf das 2.A.-Objekt / P-Schild für die Zusatzaktion an.
   */
  let heroPending = null

  const readHeroEnergyMode = (m, fallbackIsVierbeiner = false) => {
    const v = String(m?.[HERO_EX_ENERGY_MODE] ?? '').trim().toLowerCase()
    if (v === 'ke' || v === 'none') return v
    if (v === 'both') return 'ae'
    return fallbackIsVierbeiner ? 'none' : 'ae'
  }

  const readHeroShowFk = (m, fallbackIsVierbeiner) => {
    const raw = String(m?.[HERO_EX_SHOW_FK] ?? '').trim().toLowerCase()
    if (!raw) return !fallbackIsVierbeiner
    return !['0', 'false', 'off', 'no', 'nein'].includes(raw)
  }

  const readHeroLeThreshold = (m) => {
    const raw = String(m?.[HERO_EX_LE_THRESHOLD] ?? '').trim().toLowerCase()
    if (!raw || ['off', 'none', 'false', '0'].includes(raw)) return null
    const n = Math.floor(Number(raw.replace(',', '.')))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const normalizeUnfaehigThreshold = (raw, fallbackIsVierbeiner) => {
    const t = String(raw ?? '').trim().toLowerCase()
    const n = Math.floor(Number(t.replace(',', '.')))
    if (t && Number.isFinite(n) && n >= 0) return n
    return defaultUnfaehigThresholdForTemplate(Boolean(fallbackIsVierbeiner))
  }

  const normalizeUnfaehigMarkFieldsText = (raw) => {
    const fields = String(raw ?? '')
      .split(',')
      .map((x) => {
        const t = x.trim().toLowerCase()
        return t === 'aw' ? 'a' : t
      })
      .filter((x) => ['at', 'pa', 'a', 'tp', 'fk', 'gs'].includes(x))
    const canonical = fields.length > 0 ? [...new Set(fields)] : ['at', 'pa', 'a', 'tp', 'fk', 'gs']
    if (!canonical.includes('gs')) canonical.push('gs')
    const toLabel = (x) => (x === 'a' ? 'AW' : x.toUpperCase())
    return canonical.map(toLabel).join(',')
  }

  const normalizeUnfaehigFixedFieldsText = (raw, fallback = '') => {
    const txt = String(raw ?? '')
      .replace(/[;\n\r\t ]+/g, ',')
      .replace(/,+/g, ',')
      .replace(/^,|,$/g, '')
    const out = []
    const seen = new Set()
    for (const part of txt.split(',')) {
      const [kRaw, vRaw] = part.split('=')
      const k = String(kRaw ?? '').trim().toLowerCase()
      const n = Math.floor(Number(String(vRaw ?? '').trim().replace(',', '.')))
      if (!['at', 'pa', 'a', 'tp', 'fk', 'gs'].includes(k)) continue
      if (!Number.isFinite(n)) continue
      if (seen.has(k)) continue
      seen.add(k)
      out.push(`${k}=${n}`)
    }
    const normalized = out.join(',')
    if (normalized) {
      const hasGs = normalized
        .split(',')
        .some((part) => String(part).trim().toLowerCase().startsWith('gs='))
      return hasGs ? normalized : `${normalized},gs=1`
    }
    const fallbackTxt = String(fallback ?? '').trim()
    if (fallbackTxt) {
      const hasGs = fallbackTxt
        .split(',')
        .some((part) => String(part).trim().toLowerCase().startsWith('gs='))
      return hasGs ? fallbackTxt : `${fallbackTxt},gs=1`
    }
    return 'gs=1'
  }

  if (heroColorGrid instanceof HTMLElement) {
    const swatchHost = document.createElement('div')
    swatchHost.className = 'kampf-hero-color-grid__swatches'
    heroColorGrid.appendChild(swatchHost)
    for (const row of HERO_PALETTE_ROWS) {
      for (const color of row) {
        const sw = document.createElement('button')
        sw.type = 'button'
        sw.className = 'kampf-hero-color-swatch'
        sw.style.backgroundColor = color
        sw.dataset.color = color
        sw.title = `Farbe ${color} setzen`
        sw.setAttribute('aria-label', `Hintergrundfarbe ${color}`)
        sw.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!heroSettingsItemId) return
          void patchHeroBgColor(heroSettingsItemId, color)
        })
        swatchHost.appendChild(sw)
      }
    }
    const clearWrap = document.createElement('div')
    clearWrap.className = 'kampf-hero-color-grid__clear-wrap'
    const clearBtn = document.createElement('button')
    clearBtn.type = 'button'
    clearBtn.className = 'kampf-hero-color-swatch kampf-hero-color-swatch--clear'
    clearBtn.title = 'Hintergrundfarbe entfernen'
    clearBtn.setAttribute('aria-label', 'Hintergrundfarbe entfernen')
    clearBtn.textContent = '×'
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!heroSettingsItemId) return
      void patchHeroBgColor(heroSettingsItemId, null)
    })
    clearWrap.appendChild(clearBtn)
    heroColorGrid.appendChild(clearWrap)
  }

  const syncHeroSettingsFields = (items) => {
    if (!heroSettingsItemId || !Array.isArray(items)) return
    const it = items.find((i) => i.id === heroSettingsItemId)
    const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
    if (
      !m ||
      !(inpHeroOff instanceof HTMLInputElement) ||
      !(inpHeroZatOff instanceof HTMLInputElement) ||
      !(inpHeroAoOff instanceof HTMLInputElement) ||
      !(inpHeroAp instanceof HTMLInputElement)
    ) {
      return
    }
    inpHeroOff.value = String(phaseOffsetFromLhMeta(m))
    inpHeroZatOff.value = String(phaseOffsetFromHeroExtraAngMeta(m))
    inpHeroAoOff.value = String(phaseOffsetFromHeroSecondAoMeta(m))
    inpHeroAp.value = String(readLhMechanics(m).actionsPerKr)
    if (inpHeroFaMax instanceof HTMLInputElement) {
      const raw = m.heroFaMax
      inpHeroFaMax.value =
        raw == null ? '' : String(Math.max(0, Math.min(10, Math.floor(Number(raw)) || 0)))
    }
    if (inpHeroAngCount instanceof HTMLInputElement) {
      inpHeroAngCount.value = String(
        Number.isFinite(Number(m.heroExtraAngCount))
          ? Math.max(0, Math.min(10, Math.floor(Number(m.heroExtraAngCount))))
          : m.heroExtraAng
            ? 1
            : 0
      )
    }
    if (inpHeroParCount instanceof HTMLInputElement) {
      inpHeroParCount.value = String(readHeroExtraParCount(m))
    }
    if (inpHeroIniNegLost instanceof HTMLInputElement) {
      inpHeroIniNegLost.value = String(readHeroIniNegActionsLost(m))
    }
    if (selHeroIniNegAng instanceof HTMLSelectElement) {
      selHeroIniNegAng.value = readHeroIniNegAngMode(m)
    }
    if (inpHeroPoolMax instanceof HTMLInputElement) {
      const maxV = heroPending
        ? heroPending.heroActionPoolMax
        : readHeroActionPoolMax(m)
      inpHeroPoolMax.value = String(maxV)
    }
    if (inpHeroPoolAng instanceof HTMLInputElement && inpHeroPoolAbw instanceof HTMLInputElement) {
      const pair = heroPending
        ? {
            ang: heroPending.heroActionPoolAng,
            abw: heroPending.heroActionPoolAbw,
          }
        : readHeroActionPoolPair(m)
      inpHeroPoolAng.value = String(pair.ang)
      inpHeroPoolAbw.value = String(pair.abw)
    }
  }

  const closeHeroSettings = () => {
    heroSettingsBackdrop.hidden = true
    heroSettingsBackdrop.style.display = 'none'
    heroSettingsBackdrop.setAttribute('aria-hidden', 'true')
    heroSettingsItemId = null
    heroPending = null
    heroSettingsGmMode = true
    if (heroWappenEditor) {
      heroWappenEditor.destroy()
      heroWappenEditor = null
    }
    heroWappenValid = true
    if (saveHeroBtn instanceof HTMLButtonElement) {
      saveHeroBtn.disabled = false
      saveHeroBtn.title = ''
    }
    heroSettingsGearEl?.focus()
    heroSettingsGearEl = null
  }

  const syncHeroSettingsCheckboxes = () => {
    const room = getRoomSettings()
    if (heroHideForeignCb instanceof HTMLInputElement) {
      heroHideForeignCb.checked = heroPending
        ? Boolean(heroPending.hideForeignHeroColors)
        : Boolean(room.hideForeignHeroColors)
    }
    const energyMode = heroPending?.energyMode ?? 'ae'
    const energyRadios = heroSettingsPanel.querySelectorAll(
      'input[name="kampf-hero-energy-mode"]'
    )
    for (const r of energyRadios) {
      if (r instanceof HTMLInputElement) {
        r.checked = r.value === energyMode
        r.disabled = !heroSettingsGmMode
      }
    }
    if (heroShowFkCb instanceof HTMLInputElement) {
      heroShowFkCb.checked = heroPending ? heroPending.showFk !== false : true
      heroShowFkCb.disabled = !heroSettingsGmMode
    }
    if (
      heroLeThresholdEnabledCb instanceof HTMLInputElement &&
      heroLeThresholdInp instanceof HTMLInputElement
    ) {
      const threshold = heroPending?.leThreshold ?? null
      heroLeThresholdEnabledCb.checked = threshold != null
      heroLeThresholdEnabledCb.disabled = !heroSettingsGmMode
      heroLeThresholdInp.disabled = !heroSettingsGmMode || threshold == null
      heroLeThresholdInp.value = threshold == null ? '' : String(threshold)
    }
    if (
      heroUnfaehigEnabledCb instanceof HTMLInputElement &&
      heroUnfaehigThresholdInp instanceof HTMLInputElement &&
      heroUnfaehigMarkFieldsInp instanceof HTMLInputElement &&
      heroUnfaehigFixedFieldsInp instanceof HTMLInputElement &&
      heroPending
    ) {
      const enabled = heroPending.unfaehigEnabled !== false
      heroUnfaehigEnabledCb.checked = enabled
      heroUnfaehigEnabledCb.disabled = !heroSettingsGmMode
      for (const r of heroDeathModeRadios) {
        if (!(r instanceof HTMLInputElement)) continue
        r.checked = r.value === heroPending.deathMode
        r.disabled = !heroSettingsGmMode
      }
      heroUnfaehigThresholdInp.disabled = !heroSettingsGmMode || !enabled
      heroUnfaehigMarkFieldsInp.disabled = !heroSettingsGmMode
      heroUnfaehigFixedFieldsInp.disabled = !heroSettingsGmMode
      heroUnfaehigThresholdInp.value = String(
        Number.isFinite(Number(heroPending.unfaehigThreshold))
          ? Math.max(0, Math.floor(Number(heroPending.unfaehigThreshold)))
          : Number(heroPending.unfaehigThresholdDefault) || 5
      )
      heroUnfaehigMarkFieldsInp.value = normalizeUnfaehigMarkFieldsText(
        heroPending.unfaehigMarkFields
      )
      heroUnfaehigFixedFieldsInp.value = normalizeUnfaehigFixedFieldsText(
        heroPending.unfaehigFixedFields
      )
    }
    if (heroSettingsItemId) {
      const it = lastItems.find((i) => i.id === heroSettingsItemId)
      const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
      if (inpHeroFaMax instanceof HTMLInputElement) {
        const raw = heroPending ? heroPending.heroFaMax : m?.heroFaMax
        inpHeroFaMax.value =
          raw == null ? '' : String(Math.max(0, Math.min(10, Math.floor(Number(raw)) || 0)))
      }
      if (inpHeroAngCount instanceof HTMLInputElement) {
        const n = heroPending
          ? heroPending.heroExtraAngCount
          : Number.isFinite(Number(m?.heroExtraAngCount))
            ? Math.max(0, Math.min(10, Math.floor(Number(m.heroExtraAngCount))))
            : m?.heroExtraAng
              ? 1
              : 0
        inpHeroAngCount.value = String(n)
      }
      if (inpHeroParCount instanceof HTMLInputElement) {
        const n = heroPending
          ? heroPending.heroExtraParCount
          : readHeroExtraParCount(m)
        inpHeroParCount.value = String(n)
      }
      if (inpHeroPoolMax instanceof HTMLInputElement) {
        const maxV = heroPending
          ? heroPending.heroActionPoolMax
          : m
            ? readHeroActionPoolMax(m)
            : 2
        inpHeroPoolMax.value = String(maxV)
      }
      if (
        inpHeroPoolAng instanceof HTMLInputElement &&
        inpHeroPoolAbw instanceof HTMLInputElement
      ) {
        const pair = heroPending
          ? {
              ang: heroPending.heroActionPoolAng,
              abw: heroPending.heroActionPoolAbw,
            }
          : m
            ? readHeroActionPoolPair(m)
            : { ang: 1, abw: 1 }
        inpHeroPoolAng.value = String(pair.ang)
        inpHeroPoolAbw.value = String(pair.abw)
      }
      if (heroConvertAnnounceFieldset instanceof HTMLElement) {
        const mode = heroPending
          ? heroPending.convertAnnounceMode
          : convertAnnounceModeFromHeroMeta(m)
        const sel = heroConvertAnnounceFieldset.querySelector(
          `input[name="kampf-hero-convert-announce"][value="${mode}"]`
        )
        const toCheck =
          sel instanceof HTMLInputElement
            ? sel
            : heroConvertAnnounceFieldset.querySelector(
                'input[name="kampf-hero-convert-announce"][value="none"]'
              )
        if (toCheck instanceof HTMLInputElement) toCheck.checked = true
      }
    }
    if (heroColorGrid instanceof HTMLElement && heroSettingsItemId) {
      const it = lastItems.find((i) => i.id === heroSettingsItemId)
      const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
      const cur = readHeroBgColor(m)
      for (const sw of heroColorGrid.querySelectorAll(
        '.kampf-hero-color-swatch'
      )) {
        const sel =
          sw instanceof HTMLElement &&
          sw.dataset &&
          sw.dataset.color === cur
        sw.classList.toggle('kampf-hero-color-swatch--selected', Boolean(sel))
      }
    }
  }

  /**
   * @param {string} itemId
   * @param {string} displayName
   * @param {{ id?: string } | null | undefined} sceneItem
   */
  const openHeroSettings = (itemId, displayName, sceneItem) => {
    const gm = isGmSync()
    const owner = sceneItem && canEditSceneItem(sceneItem)
    if (!gm && !owner) return
    heroSettingsGmMode = gm
    heroSettingsItemId = itemId
    const it = lastItems.find((i) => i.id === itemId)
    const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
    const room = getRoomSettings()
    const poolPair = readHeroActionPoolPair(m)
    const poolMax = readHeroActionPoolMax(m)
    const wappenOverrideRaw = m?.[HERO_EX_WAPPEN_OVERRIDE]
    const hasWappenOverride =
      Array.isArray(wappenOverrideRaw) && wappenOverrideRaw.length > 0
    const wappenTemplateRaw = m?.[HERO_EX_WAPPEN_TEMPLATE]
    const initialWappenSource = hasWappenOverride
      ? 'own'
      : wappenTemplateRaw === 'vierbeiner'
        ? 'vierbeiner'
        : 'global'
    const isVierbeinerDefault = initialWappenSource === 'vierbeiner'
    const unfaehigThresholdDefault = defaultUnfaehigThresholdForTemplate(
      isVierbeinerDefault
    )
    heroPending = {
      heroFaMax:
        m?.heroFaMax == null
          ? null
          : Math.max(0, Math.min(10, Math.floor(Number(m.heroFaMax)) || 0)),
      heroExtraAngCount: Number.isFinite(Number(m?.heroExtraAngCount))
        ? Math.max(0, Math.min(10, Math.floor(Number(m.heroExtraAngCount))))
        : m?.heroExtraAng
          ? 1
          : 0,
      heroExtraParCount: readHeroExtraParCount(m),
      convertAnnounceMode: convertAnnounceModeFromHeroMeta(m),
      hideForeignHeroColors: Boolean(room.hideForeignHeroColors),
      heroActionPoolAng: poolPair.ang,
      heroActionPoolAbw: poolPair.abw,
      heroActionPoolMax: poolMax,
      heroIniNegActionsLost: readHeroIniNegActionsLost(m),
      heroIniNegAngMode: readHeroIniNegAngMode(m),
      energyMode: readHeroEnergyMode(m, isVierbeinerDefault),
      showFk: readHeroShowFk(m, isVierbeinerDefault),
      leThreshold: readHeroLeThreshold(m),
      unfaehigThreshold: normalizeUnfaehigThreshold(
        m?.[HERO_EX_UNFAEHIG_THRESHOLD],
        isVierbeinerDefault
      ),
      deathMode: readHeroDeathMode(m, isVierbeinerDefault),
      unfaehigEnabled: String(m?.[HERO_EX_UNFAEHIG_THRESHOLD] ?? '').trim() !== '',
      unfaehigMarkFields: normalizeUnfaehigMarkFieldsText(
        m?.[HERO_EX_UNFAEHIG_MARK_FIELDS]
      ),
      unfaehigFixedFields: normalizeUnfaehigFixedFieldsText(
        m?.[HERO_EX_UNFAEHIG_FIXED_FIELDS]
      ),
      unfaehigThresholdDefault,
      wappenSource: initialWappenSource,
      wappenOverride: hasWappenOverride
        ? normalizeWappenDefs(wappenOverrideRaw)
        : null,
    }
    if (titleHeroEl) {
      titleHeroEl.textContent = gm
        ? `Helden-Einstellungen: ${displayName}`
        : `Mein Held — Zeilenfarbe: ${displayName}`
    }
    applyHeroSettingsUiMode()
    syncHeroSettingsFields(lastItems)
    syncHeroSettingsCheckboxes()
    syncHeroWappenUi(room)
    heroSettingsBackdrop.hidden = false
    heroSettingsBackdrop.style.display = 'flex'
    heroSettingsBackdrop.setAttribute('aria-hidden', 'false')
    ;(saveHeroBtn instanceof HTMLElement ? saveHeroBtn : null)?.focus()
  }

  /**
   * Synchronisiert die Wappen-Section: Radio-Status, sichtbarer Editor,
   * Validitäts-Disable für Save-Button.
   * @param {{ wappenDefs?: unknown }} room
   */
  function syncHeroWappenUi(room) {
    if (!heroPending) return
    const radios = heroSettingsPanel.querySelectorAll(
      'input[name="kampf-hero-wappen-source"]'
    )
    for (const r of radios) {
      if (r instanceof HTMLInputElement) {
        r.checked = r.value === heroPending.wappenSource
        r.disabled = !heroSettingsGmMode
      }
    }
    const showEditor =
      heroSettingsGmMode && heroPending.wappenSource === 'own'
    if (heroWappenHost instanceof HTMLElement) {
      heroWappenHost.hidden = !showEditor
    }
    if (heroWappenEditor) {
      heroWappenEditor.destroy()
      heroWappenEditor = null
    }
    if (showEditor && heroWappenHost instanceof HTMLElement) {
      const initial =
        heroPending.wappenOverride ??
        (Array.isArray(room?.wappenDefs) && room.wappenDefs.length > 0
          ? room.wappenDefs
          : cloneDefaultWappenDefs())
      heroPending.wappenOverride = initial
      heroWappenEditor = mountWappenEditor(heroWappenHost, {
        initial,
        readOnly: false,
        templates: [
          {
            key: 'mensch',
            label: 'Mensch',
            build: cloneDefaultWappenDefs,
          },
          {
            key: 'vierbeiner',
            label: 'Vierbeiner (Tiere)',
            build: cloneVierbeinerWappenDefs,
          },
        ],
        onChange: (next) => {
          if (heroPending) heroPending.wappenOverride = next
        },
        onValidityChange: (ok) => {
          heroWappenValid = ok
          refreshHeroSaveDisabled()
        },
      })
      heroWappenValid = heroWappenEditor.isValid()
    } else {
      heroWappenValid = true
    }
    refreshHeroSaveDisabled()
  }

  function refreshHeroSaveDisabled() {
    if (!(saveHeroBtn instanceof HTMLButtonElement)) return
    const blocking =
      heroSettingsGmMode &&
      heroPending?.wappenSource === 'own' &&
      !heroWappenValid
    saveHeroBtn.disabled = blocking
    saveHeroBtn.title = blocking
      ? 'Kästchen für Wunden/Trefferzonen unvollständig (W20 1–20 müssen abgedeckt sein)'
      : ''
  }

  /**
   * „Zusätzliche Angriffsaktion“ / „Zusätzliche Parade“: setzt die Flags im
   * Token-Meta und entfernt jegliche bestehenden heroExtra-Wurzeln und Slots.
   *
   * Zusätzliche Parade: schwarzes Schild (`krParadeExtra`) und Stempel-Einträge
   * mit `paradeExtra`; bei deaktiviertem Haken werden sie entfernt.
   *
   * Ein neues ZAO wird beim Speichern **nicht** automatisch erzeugt — pro
   * Kampfrunde holt der Spieler das ZAO über das rote „+" am Mutter-Primärfeld
   * manuell herein (`patchRestoreHeroExtraZao`). Der Haken steuert nur noch
   * die Sichtbarkeit des „+"-Buttons.
   */
  async function applyHeroExtraCounts(itemId, angCountRaw, parCountRaw) {
    const angCount = Math.max(0, Math.min(10, Math.floor(Number(angCountRaw)) || 0))
    const parCount = Math.max(0, Math.min(10, Math.floor(Number(parCountRaw)) || 0))
    // IDs der tatsächlich entfernten heroExtra-Wurzeln sammeln, damit nach der
    // Scene-Aktualisierung auch die dazugehörigen ZAO-Stempel im Room-Meta
    // aufgeräumt werden können (Ladungs-Erhaltung).
    const droppedLinkIds = new Set()
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        m.heroExtraAngCount = angCount
        delete m.heroExtraAng
        delete m.heroParadeSplit
        delete m.krParadeSplitRem
        m.heroExtraParCount = parCount
        delete m.heroExtraPar
        for (let i = parCount; i < 10; i++) {
          const key = i <= 0 ? KR_PARADE_EXTRA : `${KR_PARADE_EXTRA}_${i + 1}`
          delete m[key]
        }
        // Mutex z.AT vs schwarzes Schild: Settings-Wechsel mid-KR resettet
        // die Wahl, damit die Mutex-Logik mit konsistentem Zustand neu
        // anlaeuft (und kein verwaister 'ang'/'par'-Lock zurueckbleibt,
        // wenn der zugehoerige Haken gerade abgewaehlt wurde).
        delete m.krExtraChoiceUsed
        const prev = normalizePhases(m.phases)
        const dropIds = new Set(
          prev.links
            .filter(
              (l) =>
                l.parentId === null &&
                (l.heroExtra === 'ang' || l.heroExtra === 'par')
            )
            .map((l) => l.id)
        )
        for (const id of dropIds) droppedLinkIds.add(id)
        const keptLinks = prev.links.filter((l) => !dropIds.has(l.id))
        m.phases = finalizePhasesWithOrderedRoots(m, { ...prev, links: keptLinks })
        const slotsRaw = m[KR_ZAO_SLOTS]
        const slots =
          slotsRaw && typeof slotsRaw === 'object' ? { ...slotsRaw } : {}
        for (const id of dropIds) delete slots[id]
        m[KR_ZAO_SLOTS] = slots
      }
    })
    if (droppedLinkIds.size > 0) {
      await patchActionStamps(
        (stamps) => {
          const entries = stamps.entries.filter(
            (e) =>
              !(
                e.itemId === itemId &&
                typeof e.zaoLinkId === 'string' &&
                droppedLinkIds.has(e.zaoLinkId)
              )
          )
          const anchorId = entries.length > 0 ? stamps.anchorId : null
          return { anchorId, entries }
        },
        { skipGmCheck: true }
      )
    }
    await patchActionStamps(
      (stamps) => {
        const entries = stamps.entries.filter((e) => {
          if (e.itemId !== itemId) return true
          if (e.paradeExtra) {
            const slot = Math.max(0, Math.floor(Number(e.paradeExtraSlot)) || 0)
            if (slot >= parCount) return false
          }
          if (e.field === KR_ABW && e.abwFromSplit) return false
          return true
        })
        const anchorId = entries.length > 0 ? stamps.anchorId : null
        return { anchorId, entries }
      },
      { skipGmCheck: true }
    )
  }

  const saveHeroAndClose = async () => {
    if (!heroSettingsItemId || !heroPending) {
      closeHeroSettings()
      return
    }
    const id = heroSettingsItemId
    const pend = heroPending
    const patchModDisplayMode = (m) => {
      // Modifikator-Anzeige ist dauerhaft "getrennt".
      delete m.modDisplayMode
    }

    if (!heroSettingsGmMode) {
      await OBR.scene.items.updateItems([id], (drafts) => {
        for (const d of drafts) {
          const m = d.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          patchModDisplayMode(m)
        }
      })
      closeHeroSettings()
      return
    }
    if (!isGmSync()) {
      closeHeroSettings()
      return
    }
    const room = getRoomSettings()
    const needsRoomUpdate =
      room.hideForeignHeroColors !== pend.hideForeignHeroColors
    if (needsRoomUpdate) {
      await patchRoomSettings((cur) => ({
        ...cur,
        hideForeignHeroColors: pend.hideForeignHeroColors,
      }))
    }
    await applyHeroExtraCounts(id, pend.heroExtraAngCount, pend.heroExtraParCount)
    if (pend.heroExtraParCount > 0) {
      await ensureParadeExtraShield(id)
    }
    await OBR.scene.items.updateItems([id], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        patchModDisplayMode(m)
        if (pend.heroFaMax == null) delete m.heroFaMax
        else m.heroFaMax = Math.max(0, Math.min(10, Math.floor(Number(pend.heroFaMax)) || 0))
        delete m.convertAllowFirstPhase
        delete m.convertAllowEntireRound
        const mode = pend.convertAnnounceMode ?? 'none'
        if (mode === 'firstPhase') m.convertAllowFirstPhase = true
        else if (mode === 'entireRound') m.convertAllowEntireRound = true
        if (mode === 'entireRound') m.convertAnytimeEnabled = true
        else delete m.convertAnytimeEnabled
        m[HERO_ACTION_POOL_MAX] = pend.heroActionPoolMax
        m[HERO_ACTION_POOL_ANG] = pend.heroActionPoolAng
        m[HERO_ACTION_POOL_ABW] = pend.heroActionPoolAbw
        m[HERO_INI_NEG_ACTIONS_LOST] = pend.heroIniNegActionsLost
        m[HERO_INI_NEG_ANG_MODE] = pend.heroIniNegAngMode
        if (pend.energyMode === 'ke' || pend.energyMode === 'none')
          m[HERO_EX_ENERGY_MODE] = pend.energyMode
        else delete m[HERO_EX_ENERGY_MODE]
        m[HERO_EX_SHOW_FK] = pend.showFk === false ? '0' : '1'
        if (pend.leThreshold != null && Number.isFinite(Number(pend.leThreshold))) {
          m[HERO_EX_LE_THRESHOLD] = String(
            Math.max(1, Math.floor(Number(pend.leThreshold)))
          )
        } else {
          delete m[HERO_EX_LE_THRESHOLD]
        }
        if (
          pend.unfaehigEnabled &&
          Number.isFinite(Number(pend.unfaehigThreshold))
        ) {
          m[HERO_EX_UNFAEHIG_THRESHOLD] = String(
            Math.max(0, Math.floor(Number(pend.unfaehigThreshold)))
          )
        } else {
          delete m[HERO_EX_UNFAEHIG_THRESHOLD]
        }
        m[HERO_EX_UNFAEHIG_MARK_FIELDS] = normalizeUnfaehigMarkFieldsText(
          pend.unfaehigMarkFields
        )
        m[HERO_DEATH_MODE] = pend.deathMode
        delete m[HERO_DEATH_AT_MINUS_ONE_POINT_FIVE_KO]
        const pendingFixedRaw =
          heroUnfaehigFixedFieldsInp instanceof HTMLInputElement
            ? heroUnfaehigFixedFieldsInp.value
            : pend.unfaehigFixedFields
        m[HERO_EX_UNFAEHIG_FIXED_FIELDS] = normalizeUnfaehigFixedFieldsText(
          pendingFixedRaw,
          pend.unfaehigFixedFields
        )
        if (pend.wappenSource === 'own' && Array.isArray(pend.wappenOverride)) {
          m[HERO_EX_WAPPEN_OVERRIDE] = normalizeWappenDefs(pend.wappenOverride)
          delete m[HERO_EX_WAPPEN_TEMPLATE]
        } else if (pend.wappenSource === 'vierbeiner') {
          m[HERO_EX_WAPPEN_TEMPLATE] = 'vierbeiner'
          delete m[HERO_EX_WAPPEN_OVERRIDE]
        } else {
          delete m[HERO_EX_WAPPEN_OVERRIDE]
          delete m[HERO_EX_WAPPEN_TEMPLATE]
        }
        cleanupOrphanHitZoneKeys(m, room)
        initKrActionPoolsFromHeroDefaults(m)
        applyIniLockCharges(m)
      }
    })
    await refreshAutoBundlesForItem(id)
    closeHeroSettings()
  }

  saveHeroBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void saveHeroAndClose()
  })

  cancelHeroBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    closeHeroSettings()
  })

  let heroSettingsBackdropPointerFromBackdrop = false
  heroSettingsBackdrop.addEventListener('pointerdown', (e) => {
    heroSettingsBackdropPointerFromBackdrop = e.target === heroSettingsBackdrop
  })
  heroSettingsBackdrop.addEventListener('click', (e) => {
    if (
      e.target === heroSettingsBackdrop &&
      heroSettingsBackdropPointerFromBackdrop
    ) {
      closeHeroSettings()
    }
  })

  if (inpHeroFaMax instanceof HTMLInputElement) {
    inpHeroFaMax.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const t = inpHeroFaMax.value.trim()
      if (t === '') {
        heroPending.heroFaMax = null
        return
      }
      const n = Math.floor(Number(t.replace(',', '.')))
      heroPending.heroFaMax = Number.isFinite(n)
        ? Math.max(0, Math.min(10, n))
        : heroPending.heroFaMax
    })
  }
  if (inpHeroAngCount instanceof HTMLInputElement) {
    inpHeroAngCount.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const n = Math.floor(Number(inpHeroAngCount.value.trim().replace(',', '.')))
      if (!Number.isFinite(n)) return
      heroPending.heroExtraAngCount = Math.max(0, Math.min(10, n))
      inpHeroAngCount.value = String(heroPending.heroExtraAngCount)
    })
  }
  if (inpHeroParCount instanceof HTMLInputElement) {
    inpHeroParCount.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const n = Math.floor(Number(inpHeroParCount.value.trim().replace(',', '.')))
      if (!Number.isFinite(n)) return
      heroPending.heroExtraParCount = Math.max(0, Math.min(10, n))
      inpHeroParCount.value = String(heroPending.heroExtraParCount)
    })
  }
  if (inpHeroIniNegLost instanceof HTMLInputElement) {
    inpHeroIniNegLost.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const n = Math.floor(Number(inpHeroIniNegLost.value.trim().replace(',', '.')))
      if (!Number.isFinite(n)) return
      heroPending.heroIniNegActionsLost = Math.max(0, Math.min(10, n))
      inpHeroIniNegLost.value = String(heroPending.heroIniNegActionsLost)
    })
  }
  if (selHeroIniNegAng instanceof HTMLSelectElement) {
    selHeroIniNegAng.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const v = selHeroIniNegAng.value
      heroPending.heroIniNegAngMode =
        v === 'yes' || v === 'zatOnly' ? v : 'no'
    })
  }

  const syncHeroPoolInputsFromPending = () => {
    if (
      !(inpHeroPoolAng instanceof HTMLInputElement) ||
      !(inpHeroPoolAbw instanceof HTMLInputElement) ||
      !heroPending
    ) {
      return
    }
    if (inpHeroPoolMax instanceof HTMLInputElement) {
      inpHeroPoolMax.value = String(heroPending.heroActionPoolMax)
    }
    inpHeroPoolAng.value = String(heroPending.heroActionPoolAng)
    inpHeroPoolAbw.value = String(heroPending.heroActionPoolAbw)
  }

  if (inpHeroPoolMax instanceof HTMLInputElement) {
    inpHeroPoolMax.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const n = Math.floor(
        Number(inpHeroPoolMax.value.trim().replace(',', '.'))
      )
      if (!Number.isFinite(n)) {
        syncHeroPoolInputsFromPending()
        return
      }
      const S = Math.max(
        MIN_HERO_ACTION_POOL_SUM,
        Math.min(MAX_HERO_ACTION_POOL_SUM, n)
      )
      heroPending.heroActionPoolMax = S
      heroPending.heroActionPoolAng = Math.min(heroPending.heroActionPoolAng, S)
      heroPending.heroActionPoolAbw = S - heroPending.heroActionPoolAng
      syncHeroPoolInputsFromPending()
    })
  }

  if (inpHeroPoolAng instanceof HTMLInputElement) {
    inpHeroPoolAng.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const S = heroPending.heroActionPoolMax
      const n = Math.floor(
        Number(inpHeroPoolAng.value.trim().replace(',', '.'))
      )
      if (!Number.isFinite(n)) {
        syncHeroPoolInputsFromPending()
        return
      }
      heroPending.heroActionPoolAng = Math.max(0, Math.min(S, n))
      heroPending.heroActionPoolAbw = S - heroPending.heroActionPoolAng
      syncHeroPoolInputsFromPending()
    })
  }
  if (inpHeroPoolAbw instanceof HTMLInputElement) {
    inpHeroPoolAbw.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const S = heroPending.heroActionPoolMax
      const n = Math.floor(
        Number(inpHeroPoolAbw.value.trim().replace(',', '.'))
      )
      if (!Number.isFinite(n)) {
        syncHeroPoolInputsFromPending()
        return
      }
      heroPending.heroActionPoolAbw = Math.max(0, Math.min(S, n))
      heroPending.heroActionPoolAng = S - heroPending.heroActionPoolAbw
      syncHeroPoolInputsFromPending()
    })
  }

  heroConvertAnnounceFieldset?.addEventListener('change', (e) => {
    if (!isGmSync() || !heroPending) return
    const t = e.target
    if (
      !(t instanceof HTMLInputElement) ||
      t.name !== 'kampf-hero-convert-announce'
    ) {
      return
    }
    const v = t.value
    heroPending.convertAnnounceMode =
      v === 'firstPhase' || v === 'entireRound' ? v : 'none'
  })

  heroSettingsPanel.addEventListener('change', (e) => {
    if (!isGmSync() || !heroPending) return
    const t = e.target
    if (
      !(t instanceof HTMLInputElement) ||
      t.name !== 'kampf-hero-wappen-source'
    ) {
      return
    }
    heroPending.wappenSource =
      t.value === 'own'
        ? 'own'
        : t.value === 'vierbeiner'
          ? 'vierbeiner'
          : 'global'
    if (heroPending.wappenSource === 'vierbeiner') {
      heroPending.showFk = false
      if (heroPending.energyMode === 'ae') {
        heroPending.energyMode = 'none'
      }
    }
    const nextIsVierbeiner = heroPending.wappenSource === 'vierbeiner'
    const nextUnfaehigDefault = defaultUnfaehigThresholdForTemplate(nextIsVierbeiner)
    const prevDefault = Number(heroPending.unfaehigThresholdDefault)
    const curThreshold = Number(heroPending.unfaehigThreshold)
    if (Number.isFinite(curThreshold) && Number.isFinite(prevDefault) && curThreshold === prevDefault) {
      heroPending.unfaehigThreshold = nextUnfaehigDefault
    }
    heroPending.unfaehigThresholdDefault = nextUnfaehigDefault
    syncHeroWappenUi(getRoomSettings())
    syncHeroSettingsCheckboxes()
  })

  heroSettingsPanel.addEventListener('click', (e) => {
    const t = e.target
    if (!(t instanceof HTMLInputElement) || !heroPending) return
    if (t.name !== 'kampf-hero-energy-mode') return
    heroPending.energyMode =
      t.value === 'ke' || t.value === 'none' ? t.value : 'ae'
  })

  heroSettingsPanel.addEventListener('change', (e) => {
    const t = e.target
    if (!(t instanceof HTMLInputElement) || !heroPending) return
    if (t.name === 'kampf-hero-energy-mode') {
      heroPending.energyMode =
        t.value === 'ke' || t.value === 'none' ? t.value : 'ae'
      return
    }
    if (t === heroShowFkCb) {
      heroPending.showFk = t.checked
      return
    }
    if (t === heroLeThresholdEnabledCb) {
      if (!t.checked) {
        heroPending.leThreshold = null
      } else if (heroPending.leThreshold == null) {
        heroPending.leThreshold = 5
      }
      syncHeroSettingsCheckboxes()
      return
    }
    if (t === heroUnfaehigEnabledCb) {
      heroPending.unfaehigEnabled = t.checked
      if (
        t.checked &&
        (!Number.isFinite(Number(heroPending.unfaehigThreshold)) ||
          Number(heroPending.unfaehigThreshold) < 0)
      ) {
        heroPending.unfaehigThreshold = heroPending.unfaehigThresholdDefault ?? 5
      }
      syncHeroSettingsCheckboxes()
    }
  })

  if (heroLeThresholdInp instanceof HTMLInputElement) {
    heroLeThresholdInp.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const n = Math.floor(
        Number(heroLeThresholdInp.value.trim().replace(',', '.'))
      )
      if (!Number.isFinite(n) || n <= 0) {
        syncHeroSettingsCheckboxes()
        return
      }
      heroPending.leThreshold = Math.max(1, Math.min(999, n))
      heroLeThresholdInp.value = String(heroPending.leThreshold)
    })
  }

  if (heroUnfaehigThresholdInp instanceof HTMLInputElement) {
    heroUnfaehigThresholdInp.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      const n = Math.floor(
        Number(heroUnfaehigThresholdInp.value.trim().replace(',', '.'))
      )
      if (!Number.isFinite(n) || n < 0) {
        syncHeroSettingsCheckboxes()
        return
      }
      heroPending.unfaehigThreshold = Math.max(0, Math.min(999, n))
      heroUnfaehigThresholdInp.value = String(heroPending.unfaehigThreshold)
    })
  }
  for (const r of heroDeathModeRadios) {
    if (!(r instanceof HTMLInputElement)) continue
    r.addEventListener('change', () => {
      if (!isGmSync() || !heroPending || !r.checked) return
      const v = r.value
      heroPending.deathMode =
        v === 'lt0' || v === 'minusKo' || v === 'minusOnePointFiveKo'
          ? v
          : 'minusKo'
    })
  }
  if (heroUnfaehigMarkFieldsInp instanceof HTMLInputElement) {
    heroUnfaehigMarkFieldsInp.addEventListener('change', () => {
      if (!isGmSync() || !heroPending) return
      heroPending.unfaehigMarkFields = normalizeUnfaehigMarkFieldsText(
        heroUnfaehigMarkFieldsInp.value
      )
      heroUnfaehigMarkFieldsInp.value = heroPending.unfaehigMarkFields
    })
  }
  if (heroUnfaehigFixedFieldsInp instanceof HTMLInputElement) {
    const syncUnfaehigFixedFields = (commitValue = false) => {
      if (!isGmSync() || !heroPending) return
      heroPending.unfaehigFixedFields = normalizeUnfaehigFixedFieldsText(
        heroUnfaehigFixedFieldsInp.value,
        heroPending.unfaehigFixedFields
      )
      if (commitValue) {
        heroUnfaehigFixedFieldsInp.value = heroPending.unfaehigFixedFields
      }
    }
    heroUnfaehigFixedFieldsInp.addEventListener('input', () => {
      syncUnfaehigFixedFields(false)
    })
    heroUnfaehigFixedFieldsInp.addEventListener('blur', () => {
      syncUnfaehigFixedFields(true)
    })
    heroUnfaehigFixedFieldsInp.addEventListener('change', () => {
      syncUnfaehigFixedFields(true)
    })
  }

  heroHideForeignCb?.addEventListener('change', () => {
    if (!isGmSync() || !(heroHideForeignCb instanceof HTMLInputElement)) return
    if (heroPending) heroPending.hideForeignHeroColors = heroHideForeignCb.checked
  })

  if (inpHeroOff instanceof HTMLInputElement) {
    inpHeroOff.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        inpHeroOff.blur()
      }
    })
    inpHeroOff.addEventListener('blur', () => {
      if (!isGmSync() || !heroSettingsItemId) return
      const id = heroSettingsItemId
      void (async () => {
        const fresh = await OBR.scene.items.getItems()
        const it = fresh.find((i) => i.id === id)
        const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
        if (!m) return
        const curOff = phaseOffsetFromLhMeta(m)
        const trimmed = inpHeroOff.value.trim()
        if (trimmed === '') {
          inpHeroOff.value = String(curOff)
          return
        }
        const n = Math.floor(Number(trimmed.replace(',', '.')))
        if (!Number.isFinite(n) || n < 0 || n > 99) {
          inpHeroOff.value = String(curOff)
          return
        }
        const newStep = storedTriggerIniStepFromPhaseOffsetPositive(n)
        if (readLhMechanics(m).triggerIniStep === newStep) return
        await OBR.scene.items.updateItems([id], (drafts) => {
          for (const d of drafts) {
            const mm = d.metadata[TRACKER_ITEM_META_KEY]
            if (!mm) continue
            mm[LH_TRIGGER_INI_STEP] = newStep
          }
        })
        // Neue Mechanik: Wechsel des Trigger-INI-Schritts erzeugt KEINE
        // 2.A.-Wurzel mehr (passive L.H.); ausreichend, dass der neue Step
        // jetzt im Meta steht, runLong rechnet die End-INI dynamisch neu.
      })()
    })
  }

  function bindHeroPhaseOffsetField(inputEl, readCurrentOffset, metaKey) {
    if (!(inputEl instanceof HTMLInputElement)) return
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        inputEl.blur()
      }
    })
    inputEl.addEventListener('blur', () => {
      if (!isGmSync() || !heroSettingsItemId) return
      const id = heroSettingsItemId
      void (async () => {
        const fresh = await OBR.scene.items.getItems()
        const it = fresh.find((i) => i.id === id)
        const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
        if (!m) return
        const curOff = readCurrentOffset(m)
        const trimmed = inputEl.value.trim()
        if (trimmed === '') {
          inputEl.value = String(curOff)
          return
        }
        const n = Math.floor(Number(trimmed.replace(',', '.')))
        if (!Number.isFinite(n) || n < 0 || n > 99) {
          inputEl.value = String(curOff)
          return
        }
        if (curOff === n) {
          inputEl.value = String(curOff)
          return
        }
        await OBR.scene.items.updateItems([id], (drafts) => {
          for (const d of drafts) {
            const mm = d.metadata[TRACKER_ITEM_META_KEY]
            if (!mm) continue
            mm[metaKey] = n
          }
        })
      })()
    })
  }

  bindHeroPhaseOffsetField(
    inpHeroZatOff,
    phaseOffsetFromHeroExtraAngMeta,
    HERO_EXTRA_ANG_PHASE_OFFSET
  )
  bindHeroPhaseOffsetField(
    inpHeroAoOff,
    phaseOffsetFromHeroSecondAoMeta,
    HERO_SECOND_AO_PHASE_OFFSET
  )

  if (inpHeroAp instanceof HTMLInputElement) {
    inpHeroAp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        inpHeroAp.blur()
      }
    })
    inpHeroAp.addEventListener('blur', () => {
      if (!isGmSync() || !heroSettingsItemId) return
      const id = heroSettingsItemId
      void (async () => {
        const fresh = await OBR.scene.items.getItems()
        const it = fresh.find((i) => i.id === id)
        const m = it?.metadata?.[TRACKER_ITEM_META_KEY]
        if (!m) return
        const curAp = readLhMechanics(m).actionsPerKr
        const trimmed = inpHeroAp.value.trim()
        if (trimmed === '') {
          inpHeroAp.value = String(curAp)
          return
        }
        const n = Math.floor(Number(trimmed.replace(',', '.')))
        if (!Number.isFinite(n)) {
          inpHeroAp.value = String(curAp)
          return
        }
        const next = clampLhActionsPerKrForStorage(n)
        if (next === curAp) {
          inpHeroAp.value = String(curAp)
          return
        }
        await OBR.scene.items.updateItems([id], (drafts) => {
          for (const d of drafts) {
            const mm = d.metadata[TRACKER_ITEM_META_KEY]
            if (!mm) continue
            mm[LH_ACTIONS_PER_KR] = next
          }
        })
      })()
    })
  }

  const onHeroSettingsDocKey = (e) => {
    if (e.key === 'Escape' && !heroSettingsBackdrop.hidden) {
      e.preventDefault()
      closeHeroSettings()
    }
  }
  document.addEventListener('keydown', onHeroSettingsDocKey)

/**
 * Konvertiert stamp.field in den CSS-Modifier-Suffix.
 * @param {string} field
 * @param {boolean} [paradeExtra]
 * @returns {string}
 */
function fieldToStampKind(field) {
  if (field === KR_ANG) return 'ang'
  if (field === KR_ABW) return 'abw'
  if (field === KR_SRA) return 'sra'
  if (field === KR_LH_ACTION) return 'lh'
  if (field === KR_FREE_ACTION) return 'fa'
  return 'fa'
}

const STAMP_REMOVE_HINT = ' — Rechtsklick: Stempel entfernen'

function stampTooltipBase(stamp, items) {
  const stampItem = items.find((i) => i.id === stamp?.itemId)
  const ownerName =
    getTokenListDisplayName(stampItem) ||
    String(stamp?.ownerName || 'Unbekannt')
  const action = stamp?.paradeExtra
    ? 'Abwehr (Zusatz-Parade)'
    : ACTION_STAMP_LABEL[stamp?.field] || 'Aktion'
  return `${ownerName} · ${action}`
}

function stampTooltipFull(stamp, items) {
  const base = stampTooltipBase(stamp, items)
  const stampItem = items.find((i) => i.id === stamp?.itemId)
  return canEditSceneItem(stampItem) ? `${base}${STAMP_REMOVE_HINT}` : base
}

function bindStampContextRemove(el, stamp, items) {
  const stampItem = items.find((i) => i.id === stamp?.itemId)
  if (!canEditSceneItem(stampItem)) return
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void undoKrActionStamp(stamp.id)
  })
}

  const renderList = (items) => {
    // Defensiver Schutz: ein transient leerer Items-Snapshot (kann während
    // kaskadierender setMetadata/updateItems-Aufrufe nach einem LH-Ende mit
    // synthetischer Done-Zeile auftreten) darf NICHT die ganze Liste leeren
    // und die Tracker-IDs auf [] zurücksetzen — sonst geht die Combat-Nav
    // beim GM tot und der Spieler sieht eine leere Liste. Wenn vorher Items
    // da waren und jetzt keine, einfach den letzten konsistenten Stand
    // beibehalten; das nächste echte Change-Event holt den korrekten Stand
    // garantiert nach.
    if ((!items || items.length === 0) && lastItems && lastItems.length > 0) {
      return
    }
    lastItems = items
    const tokenRows = collectSortedParticipants(
      items,
      getIniTieOrder(),
      getManualIniTieOverridePairs()
    )
    setTrackedParticipantIds(tokenRows.map((r) => r.id))
    void reconcileCombat(tokenRows, items)

    const combat = getCombat()
    const introActive = Boolean(combat.started && combat.roundIntroPending)
    if (roundIntroBoard && roundIntroLabel) {
      roundIntroBoard.hidden = !introActive
      if (introActive) {
        const nr =
          typeof combat.roundIntroPrevRound === 'number' &&
          combat.roundIntroPrevRound >= 1
            ? combat.roundIntroPrevRound + 1
            : combat.round + 1
        roundIntroLabel.textContent = `Kampfrunde ${nr}`
      } else {
        roundIntroLabel.textContent = ''
      }
    }
    const baseActiveId =
      combat.started && combat.currentItemId ? combat.currentItemId : null
    const baseActivePhaseLinkId = combat.started
      ? combat.currentPhaseLinkId
      : null

    const rowActiveId = baseActiveId
    const rowActivePhaseLinkId = baseActivePhaseLinkId

    const roundLabelInList =
      combat.started &&
      combat.roundIntroPending &&
      typeof combat.roundIntroPrevRound === 'number' &&
      combat.roundIntroPrevRound >= 1
        ? combat.roundIntroPrevRound + 1
        : combat.round

    const combatRoundForMerged = combat.started ? combat.round : null
    const merged = buildMergedDisplayRows(
      tokenRows,
      items,
      getIniTieOrder(),
      combatRoundForMerged
    )
    const actionStamps = getActionStamps()
    const stampEntries = Array.isArray(actionStamps?.entries)
      ? actionStamps.entries
      : []
    const mergedWithStamps =
      stampEntries.length > 0 && getShowActionStamps()
        ? mergeActionStampsIntoMerged(merged, stampEntries)
        : merged

    const iniSwapDiscPairs =
      collectAdjacentSameIniSwapPairs(mergedWithStamps)
    const combatRoundForLhUi = combat.started ? combat.round : null

    currentNavIniForRender = (() => {
      if (!combat.started || combat.roundIntroPending) return null
      const steps = buildCombatTurnSteps(
        tokenRows,
        items,
        getIniTieOrder(),
        combatRoundForMerged
      )
      const idx = findCombatStepIndex(steps, combat)
      if (idx < 0 || idx >= merged.length) return null
      const current = merged[idx]
      if (!current) return null
      // currentNavIniForRender wird nach diesem IIFE auf den Listen-Host
      // (data-current-nav-ini) gespiegelt — siehe weiter unten in renderList.
      // Runden-Marker: `roundStart` = vor allen INI-Schritten dieser KR.
      // `roundEnd` = alle Auslöser dieser KR als passiert (unter jeder
      // endlichen Trigger-INI; 0 wäre bei neg. Helden-INI falsch und würde
      // Stern/Counter/Sanduhr kurz zurückspringen).
      if (current.kind === 'roundEnd') return Number.NEGATIVE_INFINITY
      if (current.kind === 'roundStart') return Number.POSITIVE_INFINITY
      if (current.kind === 'token') {
        const n = Number(String(current.row.initiative ?? '').replace(',', '.'))
        return Number.isFinite(n) ? n : null
      }
      if (Number.isFinite(current.hookIni)) return current.hookIni
      return null
    })()

    /* Spiegel der Navigations-INI auf das Listen-Host, damit Hero-Block
       (iniModMeta.js) den Wert beim Anlegen eines Mods lesen kann. */
    try {
      const host = document.getElementById('initiative-list-host')
      if (host) {
        if (currentNavIniForRender == null) {
          delete host.dataset.currentNavIni
        } else if (currentNavIniForRender === Number.POSITIVE_INFINITY) {
          host.dataset.currentNavIni = '+inf'
        } else if (currentNavIniForRender === Number.NEGATIVE_INFINITY) {
          host.dataset.currentNavIni = '-inf'
        } else {
          host.dataset.currentNavIni = String(currentNavIniForRender)
        }
      }
    } catch {
      /* nicht kritisch */
    }

    const frag = document.createDocumentFragment()

    for (let __idx = 0; __idx < mergedWithStamps.length; __idx++) {
      const entry = mergedWithStamps[__idx]
      if (entry.kind === 'actionStamp') continue

      // Stempel einsammeln die direkt nach diesem Anker folgen
      const __anchorStamps = []
      let __j = __idx + 1
      while (__j < mergedWithStamps.length && mergedWithStamps[__j].kind === 'actionStamp') {
        __anchorStamps.push(mergedWithStamps[__j].stamp)
        __j++
      }

      if (entry.kind === 'token') {
        const row = entry.row
        const tokenSceneItem = items.find((i) => i.id === row.id)
        const canEdit = canEditSceneItem(tokenSceneItem)
        const meta = tokenSceneItem?.metadata?.[TRACKER_ITEM_META_KEY]
        const ownerIniRef = readOwnerIniReferenceForMods(meta)
        const phases = normalizePhases(meta?.phases)
        const lhStToken = readLhState(meta)
        const phaseOffToken =
          lhStToken.max > 0
            ? phaseOffsetFromLhMeta(meta)
            : phaseOffsetFromHeroSecondAoMeta(meta)
        const canCreateSecondActionToken = canCreateSecondActionRoot(
          row.initiative,
          phaseOffToken
        )
        // Alle sichtbaren Wurzeln (regulär + z.AT) zählen — Badge "1" zeigt
        // nur wenn mindestens ein Zusatz-Objekt (egal welcher Art) existiert.
        const allVisibleRootCount = phases.links.filter(
          (l) =>
            l.parentId === null &&
            l.lhEnd !== true &&
            shouldShowHeroExtraLink(meta, l)
        ).length
        const secondActionBadgeUi =
          allVisibleRootCount > 0
            ? {
                rootCount: 1,
                badgeNumber: 1,
                canCreateSecondAction: canCreateSecondActionToken,
                title: '1. Aktionsphase',
              }
            : null

        const li = document.createElement('li')
        li.className = 'init-row init-row--token-draggable'
        if (!canEdit) li.classList.add('init-row--locked')
        if (row.id === rowActiveId && !rowActivePhaseLinkId) {
          li.classList.add('init-row--active')
        }
        li.dataset.itemId = row.id
        li.draggable = false

        const main = document.createElement('div')
        main.className = 'init-row-main'
        if (canEdit) ensureRandomHeroBgColor(row.id, meta)
        const heroBg = readHeroBgColor(meta)
        const showHeroBg =
          heroBg &&
          (canEdit || !getHideForeignHeroColorsForViewer())
        if (showHeroBg) {
          main.style.backgroundColor = heroBg
          main.classList.add('init-row-main--hero-bg')
        }

        if (!canEdit) expandedPlayerExtrasIds.delete(row.id)

        const expandCol = document.createElement('div')
        expandCol.className = 'init-col-expand'
        if (canEdit) {
          const extrasOpen = expandedPlayerExtrasIds.has(row.id)
          const expandBtn = document.createElement('button')
          expandBtn.type = 'button'
          expandBtn.className =
            'init-row-expand-toggle' +
            (extrasOpen ? ' init-row-expand-toggle--open' : '')
          expandBtn.setAttribute('aria-expanded', extrasOpen ? 'true' : 'false')
          expandBtn.setAttribute(
            'aria-label',
            'Weitere Helden-Optionen ein- oder ausblenden'
          )
          expandBtn.title = isGmSync()
            ? 'Zeile aufklappen: Zeile 1 (AT … AE … MR IB BE, INI+Pfeil/W6 … MOD), Zeile 2 (KF … RB WS LE/max), Zeile 3 (MU … KK, KO+TP/TZ); links (i) und SL-Zahnrad'
            : 'Zeile aufklappen: Zeile 1 (AT … AE … MR IB BE, INI+Pfeil/W6 … MOD), Zeile 2 (KF … RB WS LE/max), Zeile 3 (MU … KK, KO+TP/TZ); links (i) und Zahnrad (Zeilenfarbe)'
          const chev = document.createElement('span')
          chev.className = 'init-row-expand-chev'
          chev.setAttribute('aria-hidden', 'true')
          expandBtn.appendChild(chev)
          expandBtn.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (expandedPlayerExtrasIds.has(row.id)) {
              expandedPlayerExtrasIds.delete(row.id)
            } else {
              expandedPlayerExtrasIds.add(row.id)
            }
            renderList(lastItems)
          })
          expandCol.appendChild(expandBtn)
        }

        const btnCol = document.createElement('div')
        btnCol.className = 'init-col-btn init-col-btn--phase-slot'

        const lhCol = document.createElement('div')
        lhCol.className = 'init-col-lh'

        const slotRow = document.createElement('div')
        slotRow.className = 'init-phase-slot-row'
        const motherPrimaryStampedToken = motherPrimarySelfStamped(
          stampEntries,
          row.id
        )
        appendKrCounterPair(
          slotRow,
          row.id,
          meta,
          canEdit,
          row.initiative,
          null,
          combatRoundForLhUi,
          rowActiveId,
          rowActivePhaseLinkId,
          null,
          secondActionBadgeUi,
          {
            lhContainer: lhCol,
            combatStarted: combat.started,
            roundIntroPending: combat.roundIntroPending,
            motherPrimaryStamped: motherPrimaryStampedToken,
          }
        )

        btnCol.appendChild(slotRow)

        const nameCol = document.createElement('div')
        nameCol.className = 'init-row-name-col'

        const nameEl = document.createElement('span')
        nameEl.className = 'init-row-name'
        if (canEdit) {
          nameEl.classList.add('init-row-name--drag-ini')
          nameEl.draggable = true
          nameEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData(TOKEN_DRAG_MIME, row.id)
            e.dataTransfer.setData('text/plain', row.id)
            e.dataTransfer.effectAllowed = 'move'
            rowDragActive = true
            dragWheelNudge = 0
            dragEdgeSlowSteps = 0
            dragEdgeAccumMs = 0
            dragEdgeZone = null
            dragSessionLastTs = 0
            activeDragRowId = row.id
            lastPreviewProposedStr = ''
            lastPreviewWillIni = false
            lastPreviewDragId = null
            lastDragClientX = e.clientX
            lastDragClientY = e.clientY
            setDragAnchor(row.id, e.clientY)
            const hr =
              listScrollEl?.getBoundingClientRect() ??
              listContentRoot?.getBoundingClientRect()
            dragFloatAnchorX = hr
              ? Math.round(hr.left + 8)
              : Math.round(li.getBoundingClientRect().left)
            const dragImg = document.createElement('canvas')
            dragImg.width = 1
            dragImg.height = 1
            e.dataTransfer.setDragImage(dragImg, 0, 0)
            li.classList.add('init-row--dragging')
            attachGlobalDragListeners()
            requestAnimationFrame(() => {
              updateDragSession(e.clientX, e.clientY, row.id)
            })
          })
          nameEl.addEventListener('drag', (e) => {
            if (!li.classList.contains('init-row--dragging')) return
            updateDragSession(e.clientX, e.clientY, row.id)
          })
          nameEl.addEventListener('dragend', () => {
            detachGlobalDragListeners()
            rowDragActive = false
            dragWheelNudge = 0
            dragEdgeSlowSteps = 0
            dragEdgeAccumMs = 0
            dragEdgeZone = null
            dragSessionLastTs = 0
            activeDragRowId = null
            lastPreviewProposedStr = ''
            lastPreviewWillIni = false
            lastPreviewDragId = null
            dragAnchorClientY = null
            dragAnchorIntPart = null
            li.classList.remove('init-row--dragging')
            hideIniFloat()
          })
        }
        nameEl.textContent = row.name
        nameEl.title = 'Doppelklick: Token fokussieren'
        nameEl.addEventListener('dblclick', () => {
          void OBR.player.select([row.id], true)
        })

        nameCol.appendChild(nameEl)

        const input = document.createElement('input')
        input.className = 'init-row-init'
        input.type = 'text'
        input.inputMode = 'decimal'
        input.autocomplete = 'off'
        input.spellcheck = false
        input.value = (() => {
          if (ownerIniRef == null) return row.initiative
          const cr = combat.started ? combat.round : null
          const d = effectiveDeltaForField(
            meta,
            'ib',
            ownerIniRef,
            cr,
            currentNavIniForRender
          )
          const p = parseIniNumber(row.initiative)
          if (p === null) return row.initiative
          return formatHookDisplay(p + d)
        })()
        input.setAttribute('aria-label', 'INI')
        input.readOnly = !canEdit
        if (!canEdit) {
          input.title = 'Nur Besitzer dieses Tokens oder Spielleitung'
        }

        const syncIniRowModTone = () => {
          input.classList.remove(
            'init-row-init--mod-val-separate',
            'init-row-init--mod-val-pos',
            'init-row-init--mod-val-neg',
            'init-row-init--mod-val-zero'
          )
          const v = parseIniNumber(input.value)
          if (v === null) {
            input.classList.add('init-row-init--mod-val-separate')
            return
          }
          if (v > 0) input.classList.add('init-row-init--mod-val-pos')
          else if (v < 0) input.classList.add('init-row-init--mod-val-neg')
          else input.classList.add('init-row-init--mod-val-zero')
        }
        syncIniRowModTone()
        input.addEventListener('input', syncIniRowModTone)

        const commit = () => {
          if (!canEdit) return
          const raw = input.value.trim()
          let persistStr = raw
          const cr = combat.started ? combat.round : null
          const dispNum = parseIniNumber(raw)
          if (ownerIniRef != null && dispNum != null) {
            const d = effectiveDeltaForField(
              meta,
              'ib',
              ownerIniRef,
              cr,
              currentNavIniForRender
            )
            persistStr = formatHookDisplay(dispNum - d)
          }
          if (persistStr === row.initiative) return
          restoreFocusItemId = row.id
          OBR.scene.items.updateItems([row.id], (drafts) => {
            for (const d of drafts) {
              const m = d.metadata[TRACKER_ITEM_META_KEY]
              if (!m) continue
              const wasBelow = isHeroIniBelowZero(m)
              m.initiative = persistStr
              applyIniLockCharges(m)
              if (getCombat().started) {
                applyIniNegativePoolShiftForMetaMutation(
                  m,
                  wasBelow,
                  isHeroIniBelowZero(m)
                )
              }
              if (!getCombat().started) ensureFullFreeActionQuota(m)
            }
          })
        }

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            input.blur()
          }
        })
        input.addEventListener('blur', () => {
          commit()
          syncIniRowModTone()
        })

        const swapCol = document.createElement('div')
        swapCol.className = 'init-col-swap'
        main.append(expandCol, btnCol, nameCol, lhCol, input, swapCol)

        // Stempel-Panel (absolut rechts, kein INI-Shift)
        if (__anchorStamps.length > 0) {
          li.classList.add('init-row--has-stamps')
          const __panel = document.createElement('div')
          __panel.className = 'init-stamp-panel'
          __panel.setAttribute(
            'aria-label',
            'Gestempelte Aktionen: Rechtsklick auf eine Farbe zum Entfernen des Stempels'
          )
          for (const __st of __anchorStamps) {
            const __seg = document.createElement('div')
            const __kind = fieldToStampKind(__st.field)
            __seg.className = `init-stamp-panel__seg init-stamp-panel__seg--${__kind}`
            __seg.title = stampTooltipFull(__st, items)
            bindStampContextRemove(__seg, __st, items)
            __panel.appendChild(__seg)
          }
          main.appendChild(__panel)
        }
        const extraPanel = document.createElement('div')
        extraPanel.className = 'init-row-extra-panel'
        const extrasOpen = canEdit && expandedPlayerExtrasIds.has(row.id)
        const mountHeroExPanel = canEdit || extrasOpen
        if (!mountHeroExPanel) {
          extraPanel.hidden = true
        } else {
          extraPanel.classList.add('init-row-extra-panel--has-hero-ex')
          extraPanel.hidden = canEdit ? !extrasOpen : false
          const body = document.createElement('div')
          body.className = 'init-row-extra-panel__body'
          const infoHit = document.createElement('button')
          infoHit.type = 'button'
          infoHit.className = 'init-row-extra-info'
          infoHit.innerHTML = HIT_ZONE_INFO_ICON_SVG
          infoHit.title =
            'Kampfprotokoll: Rechenwege und Trefferauswertung für diese Figur'
          infoHit.setAttribute(
            'aria-label',
            `Kampfprotokoll für ${row.name}`
          )
          infoHit.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            hitZoneOverlay.setFocusReturn(infoHit)
            hitZoneOverlay.open(
              row.id,
              row.name,
              tokenSceneItem?.metadata?.[TRACKER_ITEM_META_KEY],
              canEdit
            )
          })
          /** @type {HTMLElement[]} */
          const leadButtons = [infoHit]
          if (isGmSync() || canEdit) {
            const gearHero = document.createElement('button')
            gearHero.type = 'button'
            gearHero.className = 'init-row-extra-gear'
            gearHero.innerHTML = KAMPF_GEAR_ICON_SVG
            gearHero.title = isGmSync()
              ? 'Helden-Einstellungen (Spielleitung)'
              : 'Mein Held: Hintergrundfarbe der Zeile'
            gearHero.setAttribute(
              'aria-label',
              isGmSync()
                ? `Helden-Einstellungen für ${row.name}`
                : `Zeilenfarbe für ${row.name}`
            )
            gearHero.addEventListener('click', (e) => {
              e.preventDefault()
              e.stopPropagation()
              heroSettingsGearEl = gearHero
              openHeroSettings(row.id, row.name, tokenSceneItem)
            })
            leadButtons.push(gearHero)
          }
          try {
            mountHeroExpandBlock(body, {
              itemId: row.id,
              meta: tokenSceneItem?.metadata?.[TRACKER_ITEM_META_KEY],
              canEdit,
              leadButtons,
              displayName: row.name,
            })
          } catch (err) {
            console.error(
              '[vierpunkteins] mountHeroExpandBlock failed',
              row.id,
              row.name,
              err
            )
            body.replaceChildren()
            const errNote = document.createElement('div')
            errNote.className = 'init-row-extra-panel__mount-error'
            errNote.textContent =
              'Heldenblock konnte nicht geladen werden (Details in der Konsole).'
            body.appendChild(errNote)
          }
          extraPanel.appendChild(body)
        }

        if (extrasOpen) li.classList.add('init-row--extras-open')
        li.append(main, extraPanel)
        frag.appendChild(li)
      } else if (entry.kind === 'roundStart') {
        const li = document.createElement('li')
        li.className = 'init-row init-row--round-start'
        if (rowActiveId === ROUND_START_STEP_ID && !rowActivePhaseLinkId) {
          li.classList.add('init-row--active')
        }
        const topIni = tokenRows.length
          ? parseIniNumber(tokenRows[0].initiative)
          : null
        li.dataset.dragKnotIni = Number.isFinite(topIni)
          ? String(Math.min(99, topIni + 1))
          : '21'
        const bar = document.createElement('div')
        bar.className = 'init-row-round-end-bar init-row-round-start-bar'
        const ruleL = document.createElement('span')
        ruleL.className = 'init-row-round-end-rule'
        ruleL.setAttribute('aria-hidden', 'true')
        const label = document.createElement('span')
        label.className = 'init-row-round-end-label'
        label.textContent = `Beginn der Kampfrunde ${roundLabelInList}`
        const ruleR = document.createElement('span')
        ruleR.className = 'init-row-round-end-rule'
        ruleR.setAttribute('aria-hidden', 'true')
        bar.append(ruleL, label, ruleR)
        if (isGmSync()) {
          li.appendChild(buildGmRoundRowWithIniOverlay(bar, 'down'))
        } else {
          li.appendChild(bar)
        }
        frag.appendChild(li)
      } else if (entry.kind === 'roundEnd') {
        const li = document.createElement('li')
        li.className = 'init-row init-row--round-end'
        li.dataset.dragKnotIni = '0'
        if (rowActiveId === ROUND_END_STEP_ID && !rowActivePhaseLinkId) {
          li.classList.add('init-row--active')
        }
        const bar = document.createElement('div')
        bar.className = 'init-row-round-end-bar'
        const ruleL = document.createElement('span')
        ruleL.className = 'init-row-round-end-rule'
        ruleL.setAttribute('aria-hidden', 'true')
        const label = document.createElement('span')
        label.className = 'init-row-round-end-label'
        label.textContent = `Ende der Kampfrunde ${roundLabelInList}`
        const ruleR = document.createElement('span')
        ruleR.className = 'init-row-round-end-rule'
        ruleR.setAttribute('aria-hidden', 'true')
        bar.append(ruleL, label, ruleR)
        if (isGmSync()) {
          li.appendChild(buildGmRoundRowWithIniOverlay(bar, 'up'))
        } else {
          li.appendChild(bar)
        }
        frag.appendChild(li)
      } else if (entry.kind === 'lhDone') {
        const {
          ownerId,
          ownerName,
          hookIni,
          ownerIniStr,
          lhPending = false,
          lhProgressLabel,
        } = entry
        const ownerSceneItem = items.find((i) => i.id === ownerId)
        const canEdit = canEditSceneItem(ownerSceneItem)
        const ownerTrackerMeta =
          ownerSceneItem?.metadata?.[TRACKER_ITEM_META_KEY]
        const heroNum = parseIniNumber(ownerIniStr)
        const offsetDisplay =
          Number.isFinite(heroNum) && Number.isFinite(hookIni)
            ? String(Math.max(0, Math.round(heroNum - hookIni)))
            : '—'

        const li = document.createElement('li')
        li.className =
          'init-row init-row--phase init-row--phase-zao' +
          (!lhPending && canEdit ? ' init-row--phase-draggable' : '')
        if (!canEdit) li.classList.add('init-row--locked')
        li.dataset.phaseOwnerId = ownerId
        li.dataset.phaseLinkId = LH_DONE_STEP_ID
        li.dataset.zaoSwapKey = zaoRootKey(ownerId, LH_DONE_STEP_ID)
        li.dataset.dragKnotIni = formatHookDisplay(hookIni)

        const main = document.createElement('div')
        main.className = 'init-row-main init-row-main--phase init-row-main--phase-zao'

        const btnCol = document.createElement('div')
        btnCol.className = 'init-col-btn init-col-btn--phase init-col-btn--zao'
        const zaoOffsetSlot = document.createElement('div')
        zaoOffsetSlot.className = 'init-kr-abw-offset-slot'
        appendKrCounterPair(
          btnCol,
          ownerId,
          ownerTrackerMeta,
          canEdit,
          ownerIniStr,
          lhStampPhaseLinkIdWhenLhActive(ownerTrackerMeta, LH_DONE_STEP_ID),
          combatRoundForLhUi,
          rowActiveId,
          rowActivePhaseLinkId,
          LH_DONE_STEP_ID,
          null,
          {
            hideAbw: true,
            hideFa: true,
            hideLh: true,
            hideConvert: true,
            abwReplacement: zaoOffsetSlot,
            combatStarted: combat.started,
            roundIntroPending: combat.roundIntroPending,
          }
        )

        const lhRemove = document.createElement('button')
        lhRemove.type = 'button'
        lhRemove.className = 'init-row-zao-remove'
        lhRemove.textContent = '×'
        lhRemove.title = lhPending
          ? 'Längerfristige Handlung abbrechen'
          : 'L.H.-Zusatz-Aktion entfernen'
        lhRemove.setAttribute(
          'aria-label',
          lhPending
            ? 'Längerfristige Handlung abbrechen'
            : 'L.H.-Zusatz-Aktion entfernen'
        )
        lhRemove.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!canEdit) return
          if (lhPending) void commitLhValue(ownerId, '')
          else void removeLhDoneRow(ownerId)
        })
        lhRemove.disabled = !canEdit

        btnCol.append(lhRemove)

        const offsetInput = document.createElement('input')
        offsetInput.type = 'text'
        offsetInput.inputMode = 'numeric'
        offsetInput.className = 'phase-offset-input phase-offset-input--zao-inline'
        offsetInput.value = offsetDisplay
        offsetInput.setAttribute('aria-label', 'Phasen später')
        offsetInput.title =
          'Abstand Helden-INI zur Ziel-INI (Anzeige; L.H.-Zeile)'
        offsetInput.readOnly = true
        offsetInput.tabIndex = -1
        zaoOffsetSlot.appendChild(offsetInput)

        const phaseZaoMeta = document.createElement('div')
        phaseZaoMeta.className = 'init-phase-zao-meta'
        const iniActLabel = document.createElement('span')
        iniActLabel.className = 'init-phase-zao-ini-label'
        iniActLabel.textContent = ''
        iniActLabel.title = lhPending
          ? `L.H. (${lhProgressLabel ?? '?/?'}) — Fortschritt`
          : 'Längerfristige Handlung abgeschlossen: Zusatz-Aktion'
        const nameEl = document.createElement('span')
        nameEl.className = 'init-row-name'
        if (!lhPending && canEdit) {
          nameEl.classList.add('init-row-name--drag-ini')
          nameEl.draggable = true
        }
        nameEl.textContent = ownerName
        nameEl.title = lhPending
          ? 'Längerfristige Handlung — Fortschritt in der INI-Spalte'
          : '2. Aktionsphase · Ziel-INI am Lineal ziehen'
        phaseZaoMeta.append(nameEl)

        const iniInput = document.createElement('input')
        iniInput.className = 'init-row-init'
        iniInput.type = 'text'
        iniInput.inputMode = 'decimal'
        iniInput.autocomplete = 'off'
        iniInput.spellcheck = false
        iniInput.value = formatHookDisplay(hookIni)
        iniInput.setAttribute(
          'aria-label',
          lhPending ? 'L.H.-Fortschritt' : 'Ziel-INI'
        )
        iniInput.readOnly = true
        iniInput.title = lhPending
          ? 'Verbrauchte L.H.-Anteile dieser KR (Kuchendiagramm links)'
          : canEdit
            ? 'Ziel-INI (ziehen oder eingeben)'
            : 'Nur Besitzer dieses Tokens oder Spielleitung'

        if (!lhPending && canEdit) {
          iniInput.readOnly = false
        }
        if (!canEdit && !lhPending) {
          iniInput.title = 'Nur Besitzer dieses Tokens oder Spielleitung'
        }

        const runRemoveAfterIniError = async () => {
          iniInput.value = 'INI < 0'
          iniInput.classList.add('init-row-init--error')
          await new Promise((r) => setTimeout(r, 420))
          void removeLhDoneRow(ownerId)
        }

        iniInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            iniInput.blur()
          }
        })
        iniInput.addEventListener('blur', () => {
          if (lhPending || !canEdit) return
          void OBR.scene.items.getItems().then((freshItems) => {
            const it = freshItems.find((i) => i.id === ownerId)
            const metaFresh = it?.metadata?.[TRACKER_ITEM_META_KEY]
            const curDone = Number(metaFresh?.[LH_DONE_INI])
            const prev = formatHookDisplay(
              Number.isFinite(curDone) ? curDone : null
            )
            const trimmed = iniInput.value.trim()
            if (trimmed === prev) return
            return tryCommitLhDoneTargetIni(ownerId, trimmed).then(
              async (res) => {
                if (!res.ok && res.reason === 'NEG_INI')
                  await runRemoveAfterIniError()
              }
            )
          })
        })

        const zaoSwapCol = document.createElement('div')
        zaoSwapCol.className = 'init-col-swap'

        if (
          rowActiveId &&
          rowActivePhaseLinkId &&
          ownerId === rowActiveId &&
          rowActivePhaseLinkId === LH_DONE_STEP_ID
        ) {
          li.classList.add('init-row--active')
        }

        const phasePayload = encodePhaseDrag(ownerId, LH_DONE_STEP_ID)
        li.draggable = false
        if (!lhPending && canEdit) {
          nameEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData(TOKEN_DRAG_MIME, phasePayload)
            e.dataTransfer.setData('text/plain', phasePayload)
            e.dataTransfer.effectAllowed = 'move'
            rowDragActive = true
            dragWheelNudge = 0
            dragEdgeSlowSteps = 0
            dragEdgeAccumMs = 0
            dragEdgeZone = null
            dragSessionLastTs = 0
            activeDragRowId = phasePayload
            lastPreviewProposedStr = ''
            lastPreviewWillIni = false
            lastPreviewDragId = null
            lastDragClientX = e.clientX
            lastDragClientY = e.clientY
            setDragAnchor(phasePayload, e.clientY)
            const hr =
              listScrollEl?.getBoundingClientRect() ??
              listContentRoot?.getBoundingClientRect()
            dragFloatAnchorX = hr
              ? Math.round(hr.left + 8)
              : Math.round(li.getBoundingClientRect().left)
            const dragImg = document.createElement('canvas')
            dragImg.width = 1
            dragImg.height = 1
            e.dataTransfer.setDragImage(dragImg, 0, 0)
            li.classList.add('init-row--dragging')
            attachGlobalDragListeners()
            requestAnimationFrame(() => {
              updateDragSession(e.clientX, e.clientY, phasePayload)
            })
          })
          nameEl.addEventListener('drag', (e) => {
            if (!li.classList.contains('init-row--dragging')) return
            updateDragSession(e.clientX, e.clientY, phasePayload)
          })
          nameEl.addEventListener('dragend', () => {
            detachGlobalDragListeners()
            rowDragActive = false
            dragWheelNudge = 0
            dragEdgeSlowSteps = 0
            dragEdgeAccumMs = 0
            dragEdgeZone = null
            dragSessionLastTs = 0
            activeDragRowId = null
            lastPreviewProposedStr = ''
            lastPreviewWillIni = false
            lastPreviewDragId = null
            dragAnchorClientY = null
            dragAnchorIntPart = null
            li.classList.remove('init-row--dragging')
            hideIniFloat()
          })
        }

        main.append(
          createInitExpandSpacerCell(),
          btnCol,
          phaseZaoMeta,
          lhCol,
          iniInput,
          zaoSwapCol
        )
        // Stempel-Panel (absolut rechts, kein INI-Shift)
        if (__anchorStamps.length > 0) {
          li.classList.add('init-row--has-stamps')
          const __panel = document.createElement('div')
          __panel.className = 'init-stamp-panel'
          __panel.setAttribute(
            'aria-label',
            'Gestempelte Aktionen: Rechtsklick auf eine Farbe zum Entfernen des Stempels'
          )
          for (const __st of __anchorStamps) {
            const __seg = document.createElement('div')
            const __kind = fieldToStampKind(__st.field)
            __seg.className = `init-stamp-panel__seg init-stamp-panel__seg--${__kind}`
            __seg.title = stampTooltipFull(__st, items)
            bindStampContextRemove(__seg, __st, items)
            __panel.appendChild(__seg)
          }
          main.appendChild(__panel)
        }
        li.appendChild(main)
        frag.appendChild(li)
      } else {
        const { ownerId, ownerName, ownerIniStr, link, hookIni } = entry
        const ownerSceneItem = items.find((i) => i.id === ownerId)
        const canEdit = canEditSceneItem(ownerSceneItem)
        const isZaoRoot = link.parentId === null

        const li = document.createElement('li')
        li.className =
          'init-row init-row--phase' +
          (isZaoRoot ? ' init-row--phase-zao init-row--phase-draggable' : '')
        if (!canEdit) li.classList.add('init-row--locked')
        li.dataset.phaseOwnerId = ownerId
        li.dataset.phaseLinkId = link.id
        li.dataset.dragKnotIni = formatHookDisplay(hookIni)
        if (isZaoRoot) {
          li.dataset.zaoSwapKey = zaoRootKey(ownerId, link.id)
        }

        const main = document.createElement('div')
        main.className =
          'init-row-main init-row-main--phase' +
          (isZaoRoot ? ' init-row-main--phase-zao' : '')

        const btnCol = document.createElement('div')
        btnCol.className = isZaoRoot
          ? 'init-col-btn init-col-btn--phase init-col-btn--zao'
          : 'init-col-btn init-col-btn--phase'
        const ownerTrackerMeta =
          ownerSceneItem?.metadata?.[TRACKER_ITEM_META_KEY]
        if (isZaoRoot) {
          const ownerHeroBg = readHeroBgColor(ownerTrackerMeta)
          const ownerCanEdit = canEdit
          const showOwnerHeroBg =
            ownerHeroBg &&
            (ownerCanEdit || !getHideForeignHeroColorsForViewer())
          if (showOwnerHeroBg) {
            main.style.backgroundColor = ownerHeroBg
            main.classList.add('init-row-main--hero-bg')
          }
        }
        const isLhEndLink = isZaoRoot && link.lhEnd === true
        const zaoSlot = isZaoRoot
          ? readZaoSlot(ownerTrackerMeta || {}, link.id) ||
            (isLhEndLink ? { kind: 'lh', marks: 1 } : null)
          : null
        const isHeroExtraZao = isZaoRoot && Boolean(link.heroExtra)
        // Regulär 2.A.: Schließen nur, wenn die Schildspalte die Ladung
        // aufnehmen kann oder der Slot bereits leer ist.
        // ZAO (heroExtra): Schließen **immer** erlaubt — es wird weder ein
        // Schild erzeugt noch eine Ladung verschoben.
        const zaoCanCloseToShield = isZaoRoot
          ? isHeroExtraZao
            ? true
            : zaoSlot
              ? krAbwCanAcceptTransferMark(readKrAbw(ownerTrackerMeta)) ||
                zaoSlot.marks === 0
              : true
          : false
        const zaoOffsetSlot = document.createElement('div')
        zaoOffsetSlot.className = 'init-kr-abw-offset-slot'

        const ownerPhasesNorm = normalizePhases(ownerTrackerMeta?.phases)
        // Einheitliche Nummerierung über alle Wurzel-Typen (regulär + z.AT):
        // Mutter = 1, erste Zusatz-Zeile (höchste Ziel-INI) = 2, usw.
        const zaoOrderedRootIds = isZaoRoot
          ? orderedAllZaoRootIdsForBadge(
              ownerTrackerMeta,
              ownerPhasesNorm,
              ownerIniStr
            )
          : null
        const zaoPhaseNum =
          isZaoRoot && zaoOrderedRootIds
            ? (() => {
                const ix = zaoOrderedRootIds.indexOf(link.id)
                return ix >= 0 ? ix + 2 : 2
              })()
            : 2

        let zaoBadgeUi = null
        if (isZaoRoot) {
          zaoBadgeUi = {
            rootCount: zaoPhaseNum - 1,
            badgeNumber: zaoPhaseNum,
            canCreateSecondAction: true,
            title: `${zaoPhaseNum}. Aktion`,
          }
        }

        const zaoTextReplacement = document.createElement('div')
        zaoTextReplacement.className = 'init-zao-text-replacement'
        
        let zaoOverrideKind = 'ang'
        if (isZaoRoot) {
          if (zaoSlot) {
            zaoOverrideKind = zaoSlot.kind || 'ang'
          }
        }
        
        if (isHeroExtraZao) {
          zaoTextReplacement.textContent = 'z. AT'
          zaoTextReplacement.title = 'zusätzliche Angriffsaktion'
        } else if (!isZaoRoot) {
          if (zaoOverrideKind === 'lh') {
            const lhStZao = readLhState(ownerTrackerMeta)
            const lhFracZao = lhFractionFromNavForMeta(
              ownerTrackerMeta,
              lhStZao.max,
              combatRoundForLhUi
            )
            const lhStepRaw = lhActionStepLabelFromNavFraction(
              lhFracZao,
              lhStZao.max
            )
            zaoTextReplacement.textContent = 'LH'
            zaoTextReplacement.title = `Längerfristige Handlung: Aktion ${lhStepRaw}`
          } else {
            zaoTextReplacement.textContent = `${zaoPhaseNum}. Akt.`
            zaoTextReplacement.title = `${zaoPhaseNum}. Aktionsphase`
          }
        } else if (zaoOverrideKind === 'lh') {
          const lhStZao = readLhState(ownerTrackerMeta)
          const lhFracZao = lhFractionFromNavForMeta(
            ownerTrackerMeta,
            lhStZao.max,
            combatRoundForLhUi
          )
          const lhStepRaw = lhActionStepLabelFromNavFraction(
            lhFracZao,
            lhStZao.max
          )
          zaoTextReplacement.textContent = ''
          zaoTextReplacement.title = `Längerfristige Handlung: Aktion ${lhStepRaw}`
        } else {
          zaoTextReplacement.textContent = ''
          zaoTextReplacement.title = `${zaoPhaseNum}. Aktionsphase`
        }

        const lhCol = document.createElement('div')
        lhCol.className = 'init-col-lh'

        const zaoMotherMirrorUi =
          isZaoRoot &&
          isHeroConvertAnytimeMode(ownerTrackerMeta) &&
          !isHeroExtraZao &&
          !isLhEndLink &&
          zaoOverrideKind !== 'lh'

        const showFaOnNRoot = isZaoRoot && !isHeroExtraZao && !isLhEndLink
        const zaoConvertSlotPlaceholder =
          isZaoRoot && !zaoMotherMirrorUi
            ? (() => {
                const el = document.createElement('div')
                el.className = 'init-kr-convert-cell'
                el.setAttribute('aria-hidden', 'true')
                return el
              })()
            : null

        const zaoMotherStamped = motherPrimarySelfStamped(
          stampEntries,
          ownerId
        )

        appendKrCounterPair(
          btnCol,
          ownerId,
          ownerTrackerMeta,
          canEdit,
          ownerIniStr,
          lhStampPhaseLinkIdWhenLhActive(ownerTrackerMeta, link.id),
          combatRoundForLhUi,
          rowActiveId,
          rowActivePhaseLinkId,
          link.id,
          zaoBadgeUi,
          isZaoRoot
            ? zaoMotherMirrorUi
              ? {
                  hideAbw: false,
                  hideFa: !showFaOnNRoot,
                  hideLh: true,
                  hideConvert: false,
                  abwMirrorLinkUi: true,
                  motherPrimaryStamped: isHeroConvertAnytimeMode(ownerTrackerMeta)
                    ? false
                    : zaoMotherStamped,
                  zaoSlotOverride: zaoSlot
                    ? {
                        linkId: link.id,
                        ...zaoSlot,
                        heroExtra: link.heroExtra || null,
                        lhEnd: Boolean(link.lhEnd),
                      }
                    : null,
                  lhContainer: lhCol,
                  combatStarted: combat.started,
                  roundIntroPending: combat.roundIntroPending,
                }
              : {
                  hideAbw: true,
                  hideFa: !showFaOnNRoot,
                  hideLh: true,
                  hideConvert: true,
                  convertReplacement: zaoConvertSlotPlaceholder,
                  abwReplacement: zaoTextReplacement,
                  zaoSlotOverride: zaoSlot
                    ? {
                        linkId: link.id,
                        ...zaoSlot,
                        heroExtra: link.heroExtra || null,
                        lhEnd: Boolean(link.lhEnd),
                      }
                    : null,
                  lhContainer: lhCol,
                  combatStarted: combat.started,
                  roundIntroPending: combat.roundIntroPending,
                }
            : {
                lhContainer: lhCol,
                combatStarted: combat.started,
                roundIntroPending: combat.roundIntroPending,
              }
        )

        if (!isZaoRoot) {
          const phaseMinus = document.createElement('button')
          phaseMinus.type = 'button'
          phaseMinus.className = 'init-row-phase-minus'
          phaseMinus.textContent = '−'
          phaseMinus.title = 'Diese INI-Phase entfernen'
          phaseMinus.setAttribute('aria-label', 'INI-Phase entfernen')
          phaseMinus.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!canEdit) return
            void removePhaseLink(ownerId, link.id)
          })
          phaseMinus.disabled = !canEdit
          btnCol.append(phaseMinus)
        }

        const offsetInput = document.createElement('input')
        offsetInput.type = 'text'
        offsetInput.inputMode = 'numeric'
        offsetInput.className = isZaoRoot
          ? 'phase-offset-input phase-offset-input--zao-inline'
          : 'phase-offset-input'
        offsetInput.value = String(link.offset)
        offsetInput.setAttribute('aria-label', 'Phasen später')
        offsetInput.title = canEdit
          ? 'INI-Phasen später'
          : 'Nur Besitzer dieses Tokens oder Spielleitung'
        offsetInput.readOnly = !canEdit
        if (isZaoRoot) {
          zaoOffsetSlot.appendChild(offsetInput)
        }

        let phaseZaoMeta = null
        let phaseGutter = null
        let phaseNameCol = null
        /** @type {HTMLSpanElement | null} */
        let zaoIniDragNameEl = null
        if (isZaoRoot) {
          phaseZaoMeta = document.createElement('div')
          phaseZaoMeta.className = 'init-phase-zao-meta'
          const nameEl = document.createElement('span')
          nameEl.className = 'init-row-name'
          if (canEdit) {
            nameEl.classList.add('init-row-name--drag-ini')
            nameEl.draggable = true
          }
          nameEl.textContent = ownerName
          nameEl.title = `${zaoPhaseNum}. Aktionsphase · ${ownerName}`
          zaoIniDragNameEl = nameEl
          phaseZaoMeta.append(nameEl)
        } else {
          phaseGutter = document.createElement('div')
          phaseGutter.className = 'init-phase-gutter'
          const spine = document.createElement('div')
          spine.className = 'phase-spine'
          phaseGutter.append(spine, offsetInput)
          phaseNameCol = document.createElement('div')
          phaseNameCol.className = 'init-row-name-col'
          const nameEl = document.createElement('span')
          nameEl.className = 'init-row-name'
          nameEl.textContent = ownerName
          nameEl.title = 'Weitere INI-Phase dieses Charakters'
          phaseNameCol.appendChild(nameEl)
        }

        if (
          rowActiveId &&
          rowActivePhaseLinkId &&
          ownerId === rowActiveId &&
          link.id === rowActivePhaseLinkId
        ) {
          li.classList.add('init-row--active')
        }

        const iniInput = document.createElement('input')
        iniInput.className = 'init-row-init'
        iniInput.type = 'text'
        iniInput.inputMode = 'decimal'
        iniInput.autocomplete = 'off'
        iniInput.spellcheck = false
        iniInput.value = formatHookDisplay(hookIni)
        iniInput.setAttribute('aria-label', 'Ziel-INI')
        iniInput.readOnly = !canEdit
        if (!canEdit) {
          iniInput.title = 'Nur Besitzer dieses Tokens oder Spielleitung'
        }

        const runRemoveAfterIniError = async () => {
          iniInput.value = 'INI < 0'
          iniInput.classList.add('init-row-init--error')
          await new Promise((r) => setTimeout(r, 420))
          void removePhaseLink(ownerId, link.id)
        }

        iniInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            iniInput.blur()
          }
        })
        iniInput.addEventListener('blur', () => {
          if (!canEdit) return
          void OBR.scene.items.getItems().then((freshItems) => {
            const ownerRow = collectSortedParticipants(
              freshItems,
              getIniTieOrder(),
              getManualIniTieOverridePairs()
            ).find((r) => r.id === ownerId)
            const ownerIni = ownerRow?.initiative ?? ownerIniStr
            const it = freshItems.find((i) => i.id === ownerId)
            const links = normalizePhases(
              it?.metadata?.[TRACKER_ITEM_META_KEY]?.phases
            ).links
            const prev = formatHookDisplay(
              hookIniForLink(link.id, ownerIni, links)
            )
            const trimmed = iniInput.value.trim()
            if (trimmed === prev) return
            return tryCommitPhaseTargetIni(
              ownerId,
              link.id,
              trimmed,
              ownerIni,
              links
            ).then(async (res) => {
              if (!res.ok && res.reason === 'NEG_INI') await runRemoveAfterIniError()
            })
          })
        })

        const runRemoveAfterOffsetError = async () => {
          offsetInput.value = 'Offset < 0'
          offsetInput.classList.add('phase-offset-input--error')
          await new Promise((r) => setTimeout(r, 420))
          void removePhaseLink(ownerId, link.id)
        }

        offsetInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            offsetInput.blur()
          }
        })
        offsetInput.addEventListener('blur', () => {
          if (!canEdit) return
          void OBR.scene.items.getItems().then((freshItems) => {
            const ownerRow = collectSortedParticipants(
              freshItems,
              getIniTieOrder(),
              getManualIniTieOverridePairs()
            ).find((r) => r.id === ownerId)
            const ownerIni = ownerRow?.initiative ?? ownerIniStr
            const it = freshItems.find((i) => i.id === ownerId)
            const links = normalizePhases(
              it?.metadata?.[TRACKER_ITEM_META_KEY]?.phases
            ).links
            const trimmed = offsetInput.value.trim()
            return tryCommitPhaseOffset(
              ownerId,
              link.id,
              trimmed,
              ownerIni,
              links
            ).then(async (res) => {
              if (!res.ok && res.reason === 'NEG_INI')
                await runRemoveAfterOffsetError()
            })
          })
        })

        const swapSpacer = document.createElement('div')
        swapSpacer.className = 'init-col-swap init-col-swap--phase'
        swapSpacer.setAttribute('aria-hidden', 'true')

        const zaoSwapCol = document.createElement('div')
        zaoSwapCol.className = 'init-col-swap'

        const phaseExpandCell = isZaoRoot
          ? createInitExpandCloseCell({
              canEdit: canEdit && zaoCanCloseToShield,
              title: isHeroExtraZao
                ? 'Zusätzliches Angriffsaktions-Objekt (ZAO) entfernen — die Ladung verfällt, es entsteht kein Schild'
                : zaoCanCloseToShield
                  ? '2. Aktionsphase schließen — eine vorhandene Ladung wandert ins Schild zurück'
                  : 'Schließen nicht möglich: Schildspalte voll',
              ariaLabel: isHeroExtraZao
                ? 'ZAO entfernen'
                : '2. Aktionsphase schließen',
              onClick: () => {
                void patchKrCloseZaoSlotToAbw(ownerId, link.id)
              },
            })
          : createInitExpandSpacerCell()
        if (isZaoRoot) {
          main.append(
            phaseExpandCell,
            btnCol,
            zaoOffsetSlot,
            phaseZaoMeta,
            lhCol,
            iniInput,
            zaoSwapCol
          )
        } else {
          main.append(
            phaseExpandCell,
            btnCol,
            phaseGutter,
            phaseNameCol,
            lhCol,
            iniInput,
            swapSpacer
          )
        }
        li.appendChild(main)

        if (isZaoRoot) {
          const phasePayload = encodePhaseDrag(ownerId, link.id)
          li.draggable = false
          if (canEdit && zaoIniDragNameEl) {
            zaoIniDragNameEl.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData(TOKEN_DRAG_MIME, phasePayload)
              e.dataTransfer.setData('text/plain', phasePayload)
              e.dataTransfer.effectAllowed = 'move'
              rowDragActive = true
              dragWheelNudge = 0
              dragEdgeSlowSteps = 0
              dragEdgeAccumMs = 0
              dragEdgeZone = null
              dragSessionLastTs = 0
              activeDragRowId = phasePayload
              lastPreviewProposedStr = ''
              lastPreviewWillIni = false
              lastPreviewDragId = null
              lastDragClientX = e.clientX
              lastDragClientY = e.clientY
              setDragAnchor(phasePayload, e.clientY)
              const hr =
                listScrollEl?.getBoundingClientRect() ??
                listContentRoot?.getBoundingClientRect()
              dragFloatAnchorX = hr
                ? Math.round(hr.left + 8)
                : Math.round(li.getBoundingClientRect().left)
              const dragImg = document.createElement('canvas')
              dragImg.width = 1
              dragImg.height = 1
              e.dataTransfer.setDragImage(dragImg, 0, 0)
              li.classList.add('init-row--dragging')
              attachGlobalDragListeners()
              requestAnimationFrame(() => {
                updateDragSession(e.clientX, e.clientY, phasePayload)
              })
            })
            zaoIniDragNameEl.addEventListener('drag', (e) => {
              if (!li.classList.contains('init-row--dragging')) return
              updateDragSession(e.clientX, e.clientY, phasePayload)
            })
            zaoIniDragNameEl.addEventListener('dragend', () => {
              detachGlobalDragListeners()
              rowDragActive = false
              dragWheelNudge = 0
              dragEdgeSlowSteps = 0
              dragEdgeAccumMs = 0
              dragEdgeZone = null
              dragSessionLastTs = 0
              activeDragRowId = null
              lastPreviewProposedStr = ''
              lastPreviewWillIni = false
              lastPreviewDragId = null
              dragAnchorClientY = null
              dragAnchorIntPart = null
              li.classList.remove('init-row--dragging')
              hideIniFloat()
            })
          }
        }

        // Stempel-Panel (absolut rechts, kein INI-Shift)
        if (__anchorStamps.length > 0) {
          li.classList.add('init-row--has-stamps')
          const __panel = document.createElement('div')
          __panel.className = 'init-stamp-panel'
          __panel.setAttribute(
            'aria-label',
            'Gestempelte Aktionen: Rechtsklick auf eine Farbe zum Entfernen des Stempels'
          )
          for (const __st of __anchorStamps) {
            const __seg = document.createElement('div')
            const __kind = fieldToStampKind(__st.field)
            __seg.className = `init-stamp-panel__seg init-stamp-panel__seg--${__kind}`
            __seg.title = stampTooltipFull(__st, items)
            bindStampContextRemove(__seg, __st, items)
            __panel.appendChild(__seg)
          }
          main.appendChild(__panel)
        }
        frag.appendChild(li)
      }
    }

    const savedListScrollTop =
      listScrollEl && Number.isFinite(listScrollEl.scrollTop)
        ? listScrollEl.scrollTop
        : null

    const activeEl = document.activeElement
    restoreHeroInputFocus = null
    if (activeEl instanceof HTMLInputElement && activeEl.id) {
      const li = activeEl.closest('li[data-item-id]')
      const itemId = li?.getAttribute('data-item-id') ?? ''
      if (itemId && activeEl.id.startsWith('hero-ex-')) {
        restoreHeroInputFocus = {
          itemId,
          inputId: activeEl.id,
          selectionStart: activeEl.selectionStart,
          selectionEnd: activeEl.selectionEnd,
        }
      }
    }

    element.replaceChildren(frag)

    if (heroSettingsItemId) {
      const stillThere = items.some((i) => i.id === heroSettingsItemId)
      if (!stillThere) {
        closeHeroSettings()
      } else if (!heroSettingsBackdrop.hidden) {
        syncHeroSettingsFields(items)
        syncHeroSettingsCheckboxes()
      }
    }

    const hzId = hitZoneOverlay.getOpenItemId()
    if (hzId) {
      const hzItem = items.find((i) => i.id === hzId)
      if (!hzItem || !canEditSceneItem(hzItem)) {
        hitZoneOverlay.close()
      }
    }

    swapOverlay.replaceChildren()
    if (isGmSync()) {
      for (const [upperDisc, lowerDisc] of iniSwapDiscPairs) {
        const swapBtn = document.createElement('button')
        swapBtn.type = 'button'
        swapBtn.className = 'init-row-ini-swap'
        swapBtn.dataset.iniSwapDiscUpper = upperDisc
        swapBtn.dataset.iniSwapDiscLower = lowerDisc
        const arr = document.createElement('span')
        arr.className = 'init-row-ini-swap__arr'
        arr.setAttribute('aria-hidden', 'true')
        arr.innerHTML = INI_SWAP_SVG_CURVED
        swapBtn.append(arr)
        swapBtn.title =
          'Reihenfolge mit dem nächsten Eintrag tauschen (gleiche INI)'
        swapBtn.setAttribute(
          'aria-label',
          'Gleiche INI: mit darunterliegendem Eintrag die Reihenfolge tauschen'
        )
        swapBtn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          void OBR.scene.items.getItems().then((fresh) => {
            void swapAdjacentMergedIniDiscriminators(
              upperDisc,
              lowerDisc,
              fresh,
              getIniTieOrder(),
              combat.started ? combat.round : null
            )
          })
        })
        swapOverlay.appendChild(swapBtn)
      }
    }

    const scrollActiveRowIfTurnChanged = () => {
      const cNow = getCombat()
      if (!cNow.started) {
        lastTurnScrollKey = ''
        return false
      }
      const turnKey = `${cNow.roundIntroPending ? 'i' : 'z'}\0${cNow.currentItemId ?? ''}\0${cNow.currentPhaseLinkId ?? ''}\0${cNow.round}`
      if (turnKey === lastTurnScrollKey) return false
      lastTurnScrollKey = turnKey
      const active = element.querySelector('li.init-row--active')
      if (!active) return false
      active.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      })
      return true
    }

    requestAnimationFrame(() => {
      runSwapLayout()
      requestAnimationFrame(() => {
        runSwapLayout()
        const didScroll = scrollActiveRowIfTurnChanged()
        if (!didScroll && listScrollEl && savedListScrollTop != null) {
          listScrollEl.scrollTop = savedListScrollTop
        }
      })
    })
    if (typeof ResizeObserver !== 'undefined') {
      if (!swapLayoutRo) {
        swapLayoutRo = new ResizeObserver(runSwapLayout)
        swapLayoutRo.observe(element)
        if (listContentRoot) swapLayoutRo.observe(listContentRoot)
        if (listScrollEl) swapLayoutRo.observe(listScrollEl)
      }
    }

    if (restoreFocusItemId) {
      const inp = element.querySelector(
        `li[data-item-id="${CSS.escape(restoreFocusItemId)}"] .init-row-init`
      )
      if (inp) {
        inp.focus({ preventScroll: true })
        const len = inp.value.length
        inp.setSelectionRange(len, len)
      }
      restoreFocusItemId = null
    }
    if (restoreHeroInputFocus) {
      const focusSel = `li[data-item-id="${CSS.escape(restoreHeroInputFocus.itemId)}"] #${CSS.escape(restoreHeroInputFocus.inputId)}`
      const inp = element.querySelector(focusSel)
      if (inp instanceof HTMLInputElement) {
        inp.focus({ preventScroll: true })
        const start =
          typeof restoreHeroInputFocus.selectionStart === 'number'
            ? restoreHeroInputFocus.selectionStart
            : inp.value.length
        const end =
          typeof restoreHeroInputFocus.selectionEnd === 'number'
            ? restoreHeroInputFocus.selectionEnd
            : start
        inp.setSelectionRange(start, end)
      }
      restoreHeroInputFocus = null
    }

    onListChange?.(items)

    const hzOpen = hitZoneOverlay.getOpenItemId()
    if (hzOpen) hitZoneOverlay.syncFromItems(items)
  }

  OBR.scene.items.getItems().then(renderList)
  OBR.scene.items.onChange(renderList)
  onCombatChange(() => {
    void (async () => {
      const c = getCombat()
      const r =
        c?.started && Number.isFinite(Number(c.round)) ? Number(c.round) : null
      if (r != null) purgeKrMarksBeforeRound(r)
      const items = await OBR.scene.items.getItems()
      await runLongHandlungAfterCombatUpdate(items, getIniTieOrder())
      try {
        const c = getCombat()
        const cr =
          c?.started && Number.isFinite(Number(c.round)) ? Number(c.round) : null
        await runHeroExModsAfterCombatUpdate(items, getIniTieOrder(), {
          currentRound: cr,
        })
      } catch {
        /* nicht kritisch */
      }
      const fresh = await OBR.scene.items.getItems()
      renderList(fresh)
    })()
  })
  onIniTieOrderChange(() => renderList(lastItems))
  const offZaoTie = onZaoRootTieOrderChange(() => renderList(lastItems))
  const offFullIniTie = onFullIniTieOrderChange(() => renderList(lastItems))
  const offManualOverrides = onManualIniTieOverridesChange(() =>
    renderList(lastItems)
  )
  const offRoomSettings = onRoomSettingsChange(() => {
    if (!heroSettingsBackdrop.hidden) syncHeroSettingsCheckboxes()
    void OBR.scene.items.getItems().then(renderList)
  })
  const offStampPref = onShowActionStampsChange(() => {
    void OBR.scene.items.getItems().then(renderList)
  })
  const offForeignHeroPref = onHideForeignHeroColorsForViewerChange(() => {
    void OBR.scene.items.getItems().then(renderList)
  })
  const offPlayer = OBR.player.onChange(() => {
    if (!isGmSync()) closeHeroSettings()
    void OBR.scene.items.getItems().then(renderList)
  })

  return () => {
    document.removeEventListener('keydown', onHeroSettingsDocKey)
    hitZoneOverlay.destroy()
    heroSettingsBackdrop.remove()
    offRoomSettings()
    offStampPref()
    offForeignHeroPref()
    offPlayer()
    offZaoTie()
    offFullIniTie()
    offManualOverrides()
    if (listScrollEl) {
      listScrollEl.removeEventListener('scroll', runSwapLayout, { passive: true })
    }
    swapLayoutRo?.disconnect()
    swapLayoutRo = null
    detachGlobalDragListeners()
    swapOverlay.remove()
    iniFloat.remove()
  }
}
