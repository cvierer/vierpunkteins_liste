import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem, isGmSync } from './editAccess.js'
import {
  buildConvertListVisibilityCtx,
  isHeroConvertAllowedForViewer,
  isHeroConvertAnytimeMode,
  shouldShowKrPrimaryConvertSwitch,
} from './convertLockViewer.js'
import {
  collectSortedParticipants,
  filterItemsForListViewer,
  getTokenListDisplayName,
  isSceneItemVisibleOnMap,
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
  tokenCenter,
} from './tokenDistance.js'
import {
  formatGridDistWithClass,
  getGridContext,
  initGridDistance,
  onGridDistanceChange,
  resolveDistanceCenter,
} from './gridDistance.js'
import {
  hideDistanceRings,
  shiftDistanceRingsCenter,
  showDistanceRingsFor,
} from './distanceRingsOverlay.js'
import {
  createProbePlacementState,
  detectTrackerCenterMoves,
  trackProbePlacementCenter,
} from './distanceProbeDrag.js'
import {
  ensureProbeAnchorToken,
  getProbeAnchorOwnerId,
  getProbeAnchorPseudoItem,
  hasProbeAnchorToken,
  removeProbeAnchorToken,
} from './probeAnchorToken.js'
import { isProbePointerFromListRows } from './probeListBackgroundClick.js'
import {
  hideDistanceSpokes,
  hideProbeAnchorSpoke,
  showDistanceSpokesFor,
  syncProbeAnchorSpoke,
} from './distanceSpokesOverlay.js'
import {
  buildCustomDistRingSpecs,
  CUSTOM_DIST_MAX_BANDS,
  CUSTOM_DIST_MAX_PROFILES,
  DEFAULT_BAND_LABELS,
  HERO_CUSTOM_DIST,
  readCustomDistProfiles,
  writeCustomDistProfiles,
} from './heroCustomDist.js'
import {
  readHeroDistClassXSchritt,
  writeHeroDistClassXSchritt,
} from './heroDistClassX.js'
import { resolveMirrorAbwKrValue } from './krMirrorAbwDisplay.js'
import {
  SVG_ABW_SHIELD,
  SVG_ABW_SHIELD_DARK,
  SVG_PRIMARY_ACTION,
  SVG_PRIMARY_ATTACK,
  SVG_PRIMARY_LH_STAR,
  SVG_UO_CONVERT_SHIELD,
} from './krPrimaryKindIcons.js'
import {
  CLASS_CODES,
  defaultDistRingVisible,
  isDistMapRingsInactive,
  MOVEMENT_CODES,
  readDistRingVisible,
  writeDistRingVisible,
} from './heroDistRingPrefs.js'
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
  shouldShowPhaseLinkInList,
  sortedLinksForLayout,
  mergedEntryDiscriminator,
  nextChainedZaoParentForTransfer,
  normalizePhases,
  onFullIniTieOrderChange,
  onZaoRootTieOrderChange,
  orderedAllZaoRootIdsForBadge,
  orderedZaoRootIdsForBadge,
  removeLastZaoRoot,
  removePhaseLink,
  resolveCurrentNavIniForCombat,
  LH_DONE_STEP_ID,
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
  swapAdjacentMergedIniDiscriminators,
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
  patchKrCyclePrimarySlotKind,
  patchEnsureZaoSlotForLink,
  patchKrLhChargeBackToAbw,
  ensureParadeExtraShield,
  patchKrStampAbwFromCharge,
  patchKrStampParadeExtraFromCharge,
  patchRestoreHeroExtraZao,
  defaultZaoSlotForPhaseNum,
  readEffectiveZaoSlotKind,
  patchZaoSlotStampPrimary,
  readHeroActionPoolMax,
  readHeroActionPoolPair,
  readHeroExtraAngCount,
  readHeroExtraParCount,
  pruneOrphanZaoSlots,
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
} from './krCounters.js'
import {
  areOrientationRingsAtTokenCenter,
} from './heroOrientationRingsOverlay.js'
import {
  getHideForeignHeroColorsForViewer,
  getShowActionStamps,
  getShowHeroOrientationRings,
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
  readHeroGsSchritt,
  runHeroExModsAfterCombatUpdate,
} from './heroExMods.js'
import { cancelLh } from './lhEngine.js'
import { createHitZoneOverlay, HIT_ZONE_INFO_ICON_SVG } from './hitZoneOverlay.js'
import {
  bulkApplyIniFromIbBeW6ForTrackedParticipants,
  HERO_EX_EXTRA_FIELD,
  HERO_EX_LE_THRESHOLD,
  HERO_EX_SHOW_AU,
  HERO_EX_SHOW_FK,
  HERO_EX_UNFAEHIG_FIXED_FIELDS,
  HERO_EX_UNFAEHIG_MARK_FIELDS,
  HERO_EX_UNFAEHIG_THRESHOLD,
  defaultUnfaehigThresholdForTemplate,
  HERO_EXPAND_BODY_FLUSH,
  mountHeroExpandBlock,
  readHeroExtraField,
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
  defaultSlot9Placeholder,
  HERO_EX_WAPPEN_OVERRIDE,
  HERO_EX_WAPPEN_SLOT9,
  HERO_EX_WAPPEN_TEMPLATE,
  normalizeSlot9Def,
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
/** Sichtbarkeits-/Schloss-Kontext des aktuellen Render-Passes (FirstPhase-Zugindex). */
let visibilityCtxForRender = null

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

/** Eine der beiden Ansageoptionen oder keine (nie beides). */
function convertAnnounceModeFromHeroMeta(m) {
  if (!m) return 'none'
  if (m.convertAllowEntireRound) return 'entireRound'
  if (m.convertAnytimeEnabled) return 'entireRound'
  if (m.convertAllowFirstPhase) return 'firstPhase'
  return 'none'
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

/** Aktionszähler links in der Expand-Spalte (Format „N.“). */
function createActionColumnCountLabel(n, title = '', { variant = '' } = {}) {
  const el = document.createElement('span')
  el.className = 'init-col-action-count'
  if (variant === 'child') el.classList.add('init-col-action-count--child')
  el.textContent = `${n}.`
  if (title) el.title = title
  el.setAttribute('aria-hidden', 'true')
  return el
}

function mountExpandColActionCount(
  expandCol,
  count,
  { minCount = 2, title = '', variant = '' } = {}
) {
  const n = Math.floor(Number(count))
  if (!Number.isFinite(n) || n < minCount) return
  expandCol.classList.add('init-col-expand--has-action-count')
  if (variant === 'child') expandCol.classList.add('init-col-expand--child-count')
  expandCol.insertBefore(
    createActionColumnCountLabel(n, title, { variant }),
    expandCol.firstChild
  )
}

function formatIniOffsetDisplay(offsetValue) {
  return offsetValue != null && String(offsetValue) !== ''
    ? String(offsetValue)
    : '—'
}

/** -n + Ziel-INI in einer Zelle (fester kurzer Abstand). */
function mountPhaseIniTail(iniInput, offsetValue) {
  const offStr = formatIniOffsetDisplay(offsetValue)
  const tailCol = document.createElement('div')
  tailCol.className = 'init-col-ini-tail'
  const prefix = document.createElement('span')
  prefix.className = 'init-phase-offset-prefix'
  prefix.textContent = `-${offStr}`
  prefix.setAttribute('aria-hidden', 'true')
  const baseLabel = iniInput.getAttribute('aria-label') || 'Ziel-INI'
  iniInput.setAttribute(
    'aria-label',
    `${baseLabel} (INI Phasen später −${offStr})`
  )
  tailCol.append(prefix, iniInput)
  return { iniTailCol: tailCol }
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
  const showDigit = false
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

const SVG_FA_BOLT = `<svg class="init-fa-cell__bolt-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 28" aria-hidden="true"><ellipse cx="9" cy="14" rx="4.4" ry="11.6" fill="#7e57c2" opacity="0.28"/><path fill="#311b92" d="M9 0.8 Q11.2 8 12.4 14 Q11.2 20 9 27.2 Q6.8 20 5.6 14 Q6.8 8 9 0.8 Z"/><path fill="#7e57c2" d="M9 3.4 Q10.6 8.7 11.6 14 Q10.6 19.3 9 24.6 Q7.4 19.3 6.4 14 Q7.4 8.7 9 3.4 Z"/><path fill="#ffd54f" opacity="0.95" d="M9 6.6 Q9.7 10.3 10.05 14 Q9.7 17.7 9 21.4 Q8.3 17.7 7.95 14 Q8.3 10.3 9 6.6 Z"/><path fill="#fffde7" opacity="0.85" d="M9 9.6 Q9.25 11.6 9.35 14 Q9.25 16.4 9 18.4 Q8.75 16.4 8.65 14 Q8.75 11.6 9 9.6 Z"/><path fill="none" stroke="#b8860b" stroke-width="0.5" stroke-linejoin="round" d="M9 0.8 Q11.2 8 12.4 14 Q11.2 20 9 27.2 Q6.8 20 5.6 14 Q6.8 8 9 0.8 Z"/></svg>`

/** Leuchtendes Lila — Hover (Stand V991 / ein Prompt zuvor). */
const SVG_FA_BOLT_HOVER = `<svg class="init-fa-cell__bolt-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 28" aria-hidden="true"><ellipse cx="9" cy="14" rx="5.2" ry="12.4" fill="#b388ff" opacity="0.55"/><ellipse cx="9" cy="14" rx="4.4" ry="11.6" fill="#7c4dff" opacity="0.38"/><path fill="#4527a0" d="M9 0.8 Q11.2 8 12.4 14 Q11.2 20 9 27.2 Q6.8 20 5.6 14 Q6.8 8 9 0.8 Z"/><path fill="#651fff" d="M9 3.4 Q10.6 8.7 11.6 14 Q10.6 19.3 9 24.6 Q7.4 19.3 6.4 14 Q7.4 8.7 9 3.4 Z"/><path fill="#8e24aa" d="M9 6.6 Q9.7 10.3 10.05 14 Q9.7 17.7 9 21.4 Q8.3 17.7 7.95 14 Q8.3 10.3 9 6.6 Z"/><path fill="#ce93d8" opacity="0.72" d="M9 8.2 Q9.55 11.2 9.75 14 Q9.55 16.8 9 19.8 Q8.45 16.8 8.25 14 Q8.45 11.2 9 8.2 Z"/><path fill="#f3e5f5" opacity="0.88" d="M8.35 10.2 Q8.55 12.4 8.62 14 Q8.55 15.6 8.35 17.8 Q8.15 15.6 8.08 14 Q8.15 12.4 8.35 10.2 Z"/><path fill="none" stroke="#4a148c" stroke-width="0.45" stroke-linejoin="round" d="M9 0.8 Q11.2 8 12.4 14 Q11.2 20 9 27.2 Q6.8 20 5.6 14 Q6.8 8 9 0.8 Z"/></svg>`
/** @param {'ang' | 'sra' | 'lh' | 'uo'} k */
function nextKrPrimarySlotKind(k) {
  if (k === 'ang') return 'sra'
  if (k === 'sra') return 'lh'
  if (k === 'lh') return 'uo'
  return 'ang'
}

/** @param {'ang' | 'sra' | 'lh' | 'uo'} k */
function prevKrPrimarySlotKind(k) {
  if (k === 'ang') return 'uo'
  if (k === 'sra') return 'ang'
  if (k === 'lh') return 'sra'
  return 'lh'
}

/**
 * Zyklus der Mutter-Primäraktion (AN → A → L.H. → UO → AN …).
 *
 * Bei INI < 0 (`iniLocked`) wird das Schwert (`'ang'`) ausgeblendet.
 *
 * @param {'ang' | 'sra' | 'lh' | 'uo'} k
 * @param {'next' | 'prev'} dir
 * @param {boolean} [iniLocked]
 * @returns {'ang' | 'sra' | 'lh' | 'uo'}
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
 * @param {boolean} [convertAllowedByLock] — Spieler-Umwandlung erlaubt (Schloss + Helden-Einstellung);
 *        steuert Sichtbarkeit der Umtauschpfeile und Klick-Guard bei UO.
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
  boundaryAsActiveVisual = false,
  convertAllowedByLock = true
) {
  const isZaoSlot = Boolean(zaoSlotOverride)
  const kind = isZaoSlot
    ? readEffectiveZaoSlotKind(zaoSlotOverride)
    : readKrFirstSlotKind(trackerMeta)
  const isUoKind = kind === 'uo'
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
    kind === 'uo'
      ? 'Umwandel-Objekt (UO) — Ladung im Abwehr-Schild'
      : kind === 'sra'
        ? 'Sonstige reg. Aktion (A) — z. B. Atem holen, Bewegen, Position, Taktik'
        : kind === 'lh'
          ? 'Längerfristige Handlung (L.H.)'
          : 'Angriff (AN)'
  const primaryTooltipLabel =
    kind === 'uo'
      ? 'Umwandel-Objekt (UO)'
      : kind === 'sra'
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
  // Helden-Zusatz-Objekte (`heroExtra`) und n.A.-Anker (`lhEnd`) bleiben fix.
  // Sonst gilt für Spieler das Umwandelschloss, ob Umtauschpfeile sichtbar sind.
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
      if (next === 'uo' && !convertAllowedByLock) return
      if (isZaoSlot) {
        void patchKrCyclePrimarySlotKind(ownerItemId, next, {
          linkId: zaoSlotOverride.linkId,
        })
      } else {
        void patchKrCyclePrimarySlotKind(ownerItemId, next)
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
      if (next === 'uo' && !convertAllowedByLock) return
      if (isZaoSlot) {
        void patchKrCyclePrimarySlotKind(ownerItemId, next, {
          linkId: zaoSlotOverride.linkId,
        })
      } else {
        void patchKrCyclePrimarySlotKind(ownerItemId, next)
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
    (kind === 'uo'
      ? 'uo'
      : kind === 'sra'
        ? 'sra'
        : kind === 'lh'
          ? 'lh'
          : 'ang')
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
  if (kind === 'uo') {
    icon.classList.add('init-kr-primary-main__icon--uo-slot')
    icon.innerHTML = ''
  } else if (kind === 'sra') {
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
    !isUoKind &&
    !isZaoSlot &&
    (lhVoided ||
      ((kind === 'ang' || kind === 'sra') &&
        Boolean(trackerMeta?.[KR_PRIMARY_VOID_BY_ABW_TRANSFER])))
  ) {
    icon.classList.add('init-kr-primary-main__icon--hidden-by-abw-transfer')
  }
  exec.append(icon)
  const hasPrimaryCharge = isUoKind ? false : krTransferMarkPresent(v)
  const primarySpentVisual = !isUoKind && !hasPrimaryCharge && !lhVoided
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
    !phaseRowActive && (hasPrimaryCharge || isUoKind) && !lhVoided
  )
  const inactiveEmpty =
    !phaseRowActive && !hasPrimaryCharge && !lhVoided
  shell.classList.toggle('init-kr-primary-shell--inactive-empty', inactiveEmpty)
  shell.classList.toggle(
    'init-kr-primary-shell--inactive-empty-ang',
    inactiveEmpty && kind === 'ang'
  )
  /* A-Spalte: Aktions-Objekte ohne Ladung generell ausblenden (Mutter und
     z.AT). Regulaere 2.AO-Zeilen bleiben sichtbar. L.H.-Void bleibt sichtbar;
     Ausnahme für ZAO-Restore-„+“ greift per :has() in der CSS-Regel.
     Laufende L.H. (Ziel gesetzt): Primärfeld oft ohne KR-Markierung, Counter
     im Schild — Stern/Pie trotzdem sichtbar lassen. */
  const isRegularZaoSlot = isZaoSlot && !isHeroExtraSlot && !isLhEndSlot
  shell.classList.toggle(
    'init-kr-primary-shell--no-charge',
    !isRegularZaoSlot &&
      !isUoKind &&
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
      ? `${labelDe}: Zuerst eine Abwehr-Schildladung per UO (Umwandel-Objekt) ins Schild legen.`
      : ''
  exec.title = canEdit
    ? isUoKind
      ? 'Umwandel-Objekt (UO): Ladung liegt im Abwehr-Schild — nicht stempelbar; Pfeile wählen andere Aktion.'
      : hasPrimaryCharge
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
      ? `${labelDe}: Zweite Ladung fehlt — eine Abwehr-Schildladung per UO ins Schild legen.`
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
    isUoKind ||
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
  const hideConvertSwitchForLock = !shouldShowKrPrimaryConvertSwitch(
    convertAllowedByLock,
    switchLocked
  )
  if (
    hideMotherSwitchForLh ||
    isHeroExtraSlot ||
    hideConvertSwitchForLock
  ) {
    shell.append(main)
    shell.classList.add('init-kr-primary-shell--no-switch')
  } else {
    shell.append(switchCol, main)
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

/** Speicher: Hover nur auf dem einzelnen Schild/Blitz, nicht auf der ganzen Gruppe. */
function setFaBoltItemHover(bolt, on) {
  if (!(bolt instanceof HTMLElement)) return
  bolt.classList.toggle('is-item-hover', on)
  const phase = on ? 'hover' : 'rest'
  if (bolt.dataset.faBoltPhase === phase) return
  bolt.innerHTML = on ? SVG_FA_BOLT_HOVER : SVG_FA_BOLT
  bolt.dataset.faBoltPhase = phase
}

function wireReactionStoreItemHover(el, enabled) {
  if (!(el instanceof HTMLElement) || !enabled) return
  el.addEventListener('pointerenter', () => {
    el.classList.add('is-item-hover')
  })
  el.addEventListener('pointerleave', () => {
    el.classList.remove('is-item-hover')
  })
}

function wireFaStampableHover(wrap, tapEl, enabled) {
  if (!enabled || !(wrap instanceof HTMLElement) || !(tapEl instanceof HTMLElement)) {
    return
  }
  const clearAll = () => {
    wrap.classList.remove('is-fa-stamp-hover')
    wrap.querySelectorAll('.init-fa-cell__bolt').forEach((b) => {
      setFaBoltItemHover(b, false)
    })
  }
  /** @param {number} clientX @param {number} clientY */
  const boltAtPoint = (clientX, clientY) => {
    for (const bolt of wrap.querySelectorAll('.init-fa-cell__bolt')) {
      if (!(bolt instanceof HTMLElement)) continue
      const r = bolt.getBoundingClientRect()
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        return bolt
      }
    }
    return null
  }
  /** @param {number} clientX @param {number} clientY */
  const updateHover = (clientX, clientY) => {
    const hit = boltAtPoint(clientX, clientY)
    wrap.querySelectorAll('.init-fa-cell__bolt').forEach((b) => {
      setFaBoltItemHover(b, b === hit)
    })
    wrap.classList.toggle('is-fa-stamp-hover', Boolean(hit))
  }
  tapEl.addEventListener('pointerenter', (e) => {
    updateHover(e.clientX, e.clientY)
  })
  tapEl.addEventListener('pointermove', (e) => {
    updateHover(e.clientX, e.clientY)
  })
  tapEl.addEventListener('pointerleave', clearAll)
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
  mirrorLinkUi = false,
  inReactionStore = false,
  mirrorZaoSlot = null
) {
  const value = resolveMirrorAbwKrValue(
    mirrorLinkUi,
    mirrorZaoSlot,
    readKrAbw(trackerMeta)
  )
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

  if (mirrorLinkUi && shieldCount < 1 && !paradeLoaded) {
    return
  }

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
    if (!canStampAnyShieldNow || inReactionStore) return
    setLinkedShieldHover(ownerItemId, true)
  })
  shell.addEventListener('pointerleave', () => {
    if (inReactionStore) return
    setLinkedShieldHover(ownerItemId, false)
  })

  if (inReactionStore) {
    for (const icon of shields.querySelectorAll(
      '.init-kr-abw-shield:not(.init-kr-abw-shield--parade-extra)'
    )) {
      if (canStampAbwNow) wireReactionStoreItemHover(icon, true)
    }
    for (const icon of shields.querySelectorAll(
      '.init-kr-abw-shield--parade-extra'
    )) {
      if (canStampParadeNow) wireReactionStoreItemHover(icon, true)
    }
  }

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


function appendFaCounter(
  container,
  ownerItemId,
  trackerMeta,
  canEdit,
  ownerIniStr,
  phaseRowActive = true,
  faLadungAllowed = true,
  combatStarted = false,
  inReactionStore = false
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
    if (!canStampFaNow || inReactionStore) return
    setLinkedFaHover(ownerItemId, true)
  })
  wrap.addEventListener('pointerleave', () => {
    if (inReactionStore) return
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
    bolt.dataset.faBoltPhase = 'rest'
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

  if (canStampFaNow) {
    wireFaStampableHover(wrap, b, true)
  }

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
    abwReplacement = null,
    zaoSlotOverride = null,
    lhContainer = null,
    /** Kampf muss laufen und Runden-Intro bestätigt sein — sonst keine Schild-Stempel. */
    combatStarted = false,
    roundIntroPending = false,
    /** 2.A.-Zeile: Schilde nur Spiegel des Mutter-`KR_ABW`, kein Stempeln hier. */
    abwMirrorLinkUi = false,
    /** Mutter-Zeile: Distanz-Kästchen zwischen Aktion und Frei. */
    showDistanceCell = false,
    wireDistanceProbeCell = null,
    refreshDistCellIdle = null,
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
    atRoundBoundaryNav,
    isHeroConvertAllowedForViewer(
      trackerMeta,
      rowActiveId,
      rowActivePhaseLinkId,
      currentNavIniForRender,
      {
        ownerItemId: ownerItemId,
        visibilityCtx: visibilityCtxForRender,
      }
    )
  )
  if (showDistanceCell && typeof wireDistanceProbeCell === 'function') {
    const distCell = document.createElement('div')
    distCell.className = 'init-dist-cell'
    distCell.dataset.distCellItemId = ownerItemId
    distCell.setAttribute('role', 'button')
    distCell.setAttribute('aria-label', 'Distanzen anzeigen (halten)')
    const valEl = document.createElement('span')
    valEl.className = 'init-dist-cell__value'
    distCell.appendChild(valEl)
    wireDistanceProbeCell(distCell, ownerItemId)
    if (typeof refreshDistCellIdle === 'function') {
      refreshDistCellIdle(distCell)
    }
    container.appendChild(distCell)
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
      const lhOverlayEligible =
        motherKindIsLh ||
        (zaoSlotOverride?.kind === 'lh' && lhAtAbwActive)
      if (lhOverlayEligible && lhSt.max === 0 && canEdit && primaryLadungAllowed) {
        appendLhPlayOverlay(counter)
      } else if (lhOverlayEligible && lhSt.max > 0 && canEdit) {
        appendLhAbortOverlay(counter, ownerItemId)
      }
      lhContainer.appendChild(counter)
    }
  }

  if (hideAbw) {
    if (abwReplacement instanceof HTMLElement) {
      container.appendChild(abwReplacement)
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
  } else if (hideFa) {
    const reactionStore = document.createElement('div')
    reactionStore.className = 'init-kr-reaction-store'
    reactionStore.dataset.reactionStoreGroup = ownerItemId
    reactionStore.setAttribute('role', 'group')
    reactionStore.setAttribute('aria-label', 'Reaktionsspeicher: Abwehr-Schildladungen')
    const freiSpacer = document.createElement('div')
    freiSpacer.className = 'init-kr-reaction-store__frei-spacer'
    freiSpacer.setAttribute('aria-hidden', 'true')
    reactionStore.appendChild(freiSpacer)
    appendKrAbwSplitCell(
      reactionStore,
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
      abwMirrorLinkUi,
      true,
      abwMirrorLinkUi ? zaoSlotOverride : null
    )
    container.appendChild(reactionStore)
  } else {
    const reactionStore = document.createElement('div')
    reactionStore.className = 'init-kr-reaction-store'
    reactionStore.dataset.reactionStoreGroup = ownerItemId
    reactionStore.setAttribute('role', 'group')
    reactionStore.setAttribute(
      'aria-label',
      'Reaktionsspeicher: Freie Aktionen und Abwehr-Schildladungen'
    )
    appendFaCounter(
      reactionStore,
      ownerItemId,
      trackerMeta,
      canEdit,
      ownerIniStr,
      phaseRowActive,
      faLadungAllowed,
      combatStarted,
      true
    )
    appendKrAbwSplitCell(
      reactionStore,
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
      abwMirrorLinkUi,
      true,
      abwMirrorLinkUi ? zaoSlotOverride : null
    )
    container.appendChild(reactionStore)
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

/**
 * @param {HTMLElement | null} nameEl
 * @param {string} heroBg
 */
function applyHeroAccent(nameEl, heroBg) {
  if (!nameEl) return
  nameEl.style.color = heroBg
  nameEl.classList.add('init-row-name--hero-color')
}

export function setupInitiativeList(element, { onListChange } = {}) {
  let restoreFocusItemId = null
  /** @type {{ itemId: string, inputId: string, selectionStart: number | null, selectionEnd: number | null } | null} */
  let restoreHeroInputFocus = null
  let lastItems = []

  void hideDistanceRings()

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

  /** Max-Höhe der Liste = Popover/Viewport minus Toolbar und Spaltenkopf. */
  let listScrollMaxHeightPx = 0

  function measureListScrollMaxHeight() {
    if (!listScrollEl) return 0
    const appEl = document.querySelector('#app')
    const header = document.querySelector('.app-header')
    const listHead = document.querySelector('.kampf-list-head')
    const viewportH = window.innerHeight
    let chromeH = 0
    if (appEl instanceof HTMLElement) {
      const appStyle = getComputedStyle(appEl)
      chromeH +=
        (parseFloat(appStyle.paddingTop) || 0) +
        (parseFloat(appStyle.paddingBottom) || 0)
    }
    if (header instanceof HTMLElement) {
      chromeH += header.getBoundingClientRect().height
    }
    if (listHead instanceof HTMLElement) {
      chromeH += listHead.getBoundingClientRect().height
    }
    const section = listScrollEl.closest('.kampf-list-section')
    if (section instanceof HTMLElement) {
      const sectionStyle = getComputedStyle(section)
      chromeH += parseFloat(sectionStyle.marginTop) || 0
    }
    const maxH = Math.max(0, Math.floor(viewportH - chromeH))
    if (maxH > 0) {
      listScrollMaxHeightPx = maxH
      return maxH
    }
    if (listScrollMaxHeightPx > 0) return listScrollMaxHeightPx
    return Math.max(0, Math.floor(viewportH * 0.7))
  }

  /** Listen-Scrollbereich an belegte Zeilen anpassen, bis zur bisherigen Maximalhöhe. */
  function syncListScrollHeight() {
    if (!listScrollEl || !listContentRoot) return
    const host = listScrollEl.closest('.initiative-list-host')
    const maxH = measureListScrollMaxHeight()
    const cap = maxH > 0 ? maxH : listScrollMaxHeightPx
    if (!cap || cap <= 0) return
    host?.style.setProperty('--init-list-scroll-max-h', `${cap}px`)
    listScrollEl.style.maxHeight = `${cap}px`
    const contentH = listContentRoot.scrollHeight
    listScrollEl.style.height = `${Math.min(contentH, cap)}px`
  }

  const onListLayoutResize = () => {
    syncListScrollHeight()
    runSwapLayout()
  }

  if (listScrollEl) {
    listScrollEl.addEventListener('scroll', runSwapLayout, { passive: true })
  }

  const onWindowResize = () => {
    syncListScrollHeight()
    runSwapLayout()
  }
  window.addEventListener('resize', onWindowResize, { passive: true })
  requestAnimationFrame(() => {
    syncListScrollHeight()
    runSwapLayout()
  })

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

  let distanceProbeItemId = null
  /** Ursprung Bewegungslinie: letzte Absetz-Position des Helden (Dist aktiv). */
  /** @type {{ x: number, y: number } | null} */
  let probeMovementAnchor = null
  /** Karten-Drag aktiv (Ringe + Spokes folgen dem Helden). */
  let probeMapDragging = false
  let probePlacementState = createProbePlacementState()
  let externalPlacementState = createProbePlacementState()
  /** @type {Map<string, { x: number, y: number }>} */
  let lastTrackerCentersById = new Map()
  let distanceProbeRefreshPending = false
  let probeMovementRafId = 0
  let probePointerListenersAttached = false
  let probePlayerChangeUnsub = null
  let probePointerHeld = false
  let probePointerDownPending = false
  let probeRestEnding = false
  /** Nach tick.placed: simulierter Listen-Klick erst wenn Orientierungsring am Helden. */
  let probePlacementEndPending = false
  let probePlacementEndPendingAt = 0
  const PROBE_PLACEMENT_END_FALLBACK_MS = 2000

  initGridDistance()

  function clearProbePlacementEndPending() {
    probePlacementEndPending = false
    probePlacementEndPendingAt = 0
  }

  /** @param {Event} [event] */
  function isProbePointerFromExtensionUI(event) {
    return isProbePointerFromListRows(element, event?.target)
  }

  function isProbeMapDragActive() {
    return probeMapDragging || hasProbeAnchorToken()
  }

  /**
   * Greif-Erkennung: Probe-Held in Selektion → Anker an Greifposition.
   */
  async function tryBeginProbeGrabFromSelection() {
    if (!distanceProbeItemId || probePointerHeld) return
    let selection
    try {
      selection = await OBR.player.getSelection()
    } catch {
      return
    }
    if (!selection?.includes(distanceProbeItemId)) return
    let probeItem = lastItems.find((i) => i.id === distanceProbeItemId)
    if (!probeItem) {
      try {
        const sceneItems = await OBR.scene.items.getItems()
        probeItem = findDistanceProbeItem(sceneItems)
      } catch {
        return
      }
    }
    if (!probeItem) return
    const gridContext = await getGridContext()
    if (!gridContext) return
    const center = await resolveDistanceCenter(probeItem, gridContext)
    await ensureProbeAnchorToken(center, distanceProbeItemId, probeItem)
    if (!hasProbeAnchorToken()) return
    probePointerHeld = true
    probeMapDragging = true
  }

  /**
   * Ruheposition oder pointerup: Linie aus, Ringe per shift.
   * @param {{ x: number, y: number }} [restCenter]
   */
  async function endProbeMapDragAtRest(restCenter) {
    if (!distanceProbeItemId || probeRestEnding) return
    if (!probeMapDragging && !hasProbeAnchorToken()) return
    clearProbePlacementEndPending()
    probeRestEnding = true
    probeMapDragging = false
    probePointerHeld = false
    probePointerDownPending = false
    probePlacementState = createProbePlacementState()
    await hideProbeAnchorSpoke()
    await removeProbeAnchorToken()
    try {
      let sceneItems = []
      try {
        sceneItems = await OBR.scene.items.getItems()
      } catch {
        /* ignore */
      }
      const probeItem = findDistanceProbeItem(sceneItems)
      const gridContext = await getGridContext()
      if (restCenter) {
        probeMovementAnchor = restCenter
      } else if (probeItem && gridContext) {
        probeMovementAnchor = await resolveDistanceCenter(probeItem, gridContext)
      }
      if (probeItem && probeMovementAnchor) {
        const shifted = await shiftDistanceRingsCenter(probeMovementAnchor)
        if (!shifted) {
          await refreshProbeRingsForItem(probeItem)
        }
        if (sceneItems.length > 0) {
          await refreshProbeSpokesOnly(probeItem, sceneItems)
        }
      }
    } catch {
      /* ignore */
    } finally {
      probeRestEnding = false
    }
    applyDistanceOverlay()
  }

  /**
   * Karten-Drag beenden (Linie/Anker), DIST-Probe bleibt aktiv.
   * @param {{ x: number, y: number }} [restCenter]
   */
  function finishProbeMapPlacement(restCenter) {
    if (!distanceProbeItemId || probeRestEnding) return
    if (!probeMapDragging && !hasProbeAnchorToken()) return
    void endProbeMapDragAtRest(restCenter)
  }

  /** Simuliert pointerup auf Listen-Scroll-Hintergrund (Owlbear-Map-release-Fallback). */
  function simulateEmptyListPointerUp() {
    const target = listScrollEl ?? listContentRoot
    if (!target) return
    const rect = target.getBoundingClientRect()
    const clientX = rect.left + 12
    const clientY = rect.top + 12
    const init = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    }
    target.dispatchEvent(new PointerEvent('pointerup', init))
  }

  /**
   * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} probeItem
   * @param {import('./gridDistance.js').GridContext} gridContext
   */
  async function tryFinishProbePlacementWhenOrientationSynced(
    probeItem,
    gridContext
  ) {
    if (!probePlacementEndPending || !distanceProbeItemId || !probeItem) return
    const now = Date.now()
    const center = await resolveDistanceCenter(probeItem, gridContext)

    if (!getShowHeroOrientationRings()) {
      clearProbePlacementEndPending()
      simulateEmptyListPointerUp()
      return
    }

    if (areOrientationRingsAtTokenCenter(distanceProbeItemId, center)) {
      clearProbePlacementEndPending()
      simulateEmptyListPointerUp()
      return
    }

    if (
      probePlacementEndPendingAt > 0 &&
      now - probePlacementEndPendingAt >= PROBE_PLACEMENT_END_FALLBACK_MS
    ) {
      clearProbePlacementEndPending()
      finishProbeMapPlacement(center)
    }
  }

  /** @param {PointerEvent} event */
  const onProbePointerDown = (event) => {
    if (!distanceProbeItemId) return
    if (event.button !== 0) return
    if (isProbePointerFromExtensionUI(event)) return
    probePointerDownPending = true
    void tryBeginProbeGrabFromSelection()
  }

  /** @param {PointerEvent} event */
  const onProbePointerEnd = (event) => {
    if (!distanceProbeItemId) return
    probePointerDownPending = false
    if (!probePointerHeld && !probeMapDragging && !hasProbeAnchorToken()) return
    if (isProbePointerFromExtensionUI(event)) return
    finishProbeMapPlacement()
  }

  function attachProbePlayerListener() {
    if (probePlayerChangeUnsub) return
    probePlayerChangeUnsub = OBR.player.onChange(() => {
      if (!distanceProbeItemId) return
      if (probePointerDownPending && !probePointerHeld) {
        void tryBeginProbeGrabFromSelection()
      }
    })
  }

  function detachProbePlayerListener() {
    if (!probePlayerChangeUnsub) return
    probePlayerChangeUnsub()
    probePlayerChangeUnsub = null
  }

  function attachProbePointerListeners() {
    if (probePointerListenersAttached) return
    probePointerListenersAttached = true
    document.addEventListener('pointerdown', onProbePointerDown, true)
    document.addEventListener('pointerup', onProbePointerEnd, true)
    document.addEventListener('pointercancel', onProbePointerEnd, true)
    attachProbePlayerListener()
  }

  function detachProbePointerListeners() {
    if (!probePointerListenersAttached) return
    probePointerListenersAttached = false
    document.removeEventListener('pointerdown', onProbePointerDown, true)
    document.removeEventListener('pointerup', onProbePointerEnd, true)
    document.removeEventListener('pointercancel', onProbePointerEnd, true)
    detachProbePlayerListener()
  }

  async function resetProbeMapDragState() {
    probeMovementAnchor = null
    probeMapDragging = false
    probePointerHeld = false
    probePointerDownPending = false
    clearProbePlacementEndPending()
    probePlacementState = createProbePlacementState()
    externalPlacementState = createProbePlacementState()
    lastTrackerCentersById = new Map()
    await hideProbeAnchorSpoke()
    await removeProbeAnchorToken()
  }

  /**
   * @param {import('@owlbear-rodeo/sdk').Item[]} sceneItems
   * @param {import('./gridDistance.js').GridContext} gridContext
   */
  async function collectTrackerCenterMap(sceneItems, gridContext) {
    /** @type {Map<string, { x: number, y: number }>} */
    const centers = new Map()
    for (const item of sceneItems) {
      if (!item?.id || item.metadata?.[TRACKER_ITEM_META_KEY] == null) continue
      const center = await resolveDistanceCenter(item, gridContext)
      centers.set(item.id, center)
    }
    return centers
  }

  /**
   * @param {import('@owlbear-rodeo/sdk').Item[]} sceneItems
   * @param {import('./gridDistance.js').GridContext} gridContext
   * @param {{ id?: string, metadata?: Record<string, unknown> } | null | undefined} probeItem
   */
  async function updateExternalTrackerDragFromScene(
    sceneItems,
    gridContext,
    probeItem
  ) {
    if (!distanceProbeItemId || probeMapDragging || !probeItem) return

    let selection = []
    try {
      selection = await OBR.player.getSelection()
    } catch {
      selection = []
    }

    const isGm = isGmSync()
    const visibleSceneItems = filterItemsForListViewer(sceneItems ?? [], isGm)
    const visibleLastItems = isGm ? lastItems : lastItems.filter(isSceneItemVisibleOnMap)

    let externalItem = null
    for (const id of selection) {
      if (!id || id === distanceProbeItemId) continue
      const item =
        visibleSceneItems.find((i) => i.id === id) ??
        visibleLastItems.find((i) => i.id === id)
      if (item?.metadata?.[TRACKER_ITEM_META_KEY] != null) {
        externalItem = item
        break
      }
    }

    const anchorOwner = getProbeAnchorOwnerId()

    if (!externalItem?.id) {
      if (anchorOwner && anchorOwner !== distanceProbeItemId) {
        await hideProbeAnchorSpoke()
        await removeProbeAnchorToken()
      }
      externalPlacementState = createProbePlacementState()
      return
    }

    const center = await resolveDistanceCenter(externalItem, gridContext)
    const prevState = externalPlacementState
    const tick = trackProbePlacementCenter(center, prevState)

    if (
      tick.mapDragging &&
      !prevState.mapDragging &&
      prevState.lastCenter &&
      (!hasProbeAnchorToken() || anchorOwner !== externalItem.id)
    ) {
      await ensureProbeAnchorToken(
        prevState.lastCenter,
        externalItem.id,
        externalItem
      )
    }

    externalPlacementState = tick.nextState

    if (tick.placed) {
      if (anchorOwner === externalItem.id) {
        await hideProbeAnchorSpoke()
        await removeProbeAnchorToken()
      }
      externalPlacementState = createProbePlacementState()
      return
    }

    if (tick.mapDragging && hasProbeAnchorToken() && anchorOwner === externalItem.id) {
      const anchorPseudo = getProbeAnchorPseudoItem()
      const meta = externalItem.metadata?.[TRACKER_ITEM_META_KEY]
      const xSchritt = meta ? readHeroDistClassXSchritt(meta) : null
      if (anchorPseudo) {
        await syncProbeAnchorSpoke(anchorPseudo, externalItem, xSchritt, { isGm })
      }
    } else if (anchorOwner && anchorOwner !== distanceProbeItemId) {
      await hideProbeAnchorSpoke()
      await removeProbeAnchorToken()
    }
  }

  function stopProbeMovementLoop() {
    if (probeMovementRafId) {
      cancelAnimationFrame(probeMovementRafId)
      probeMovementRafId = 0
    }
  }

  function startProbeMovementLoop() {
    stopProbeMovementLoop()
    const tick = () => {
      probeMovementRafId = 0
      if (!distanceProbeItemId) return
      void runDistanceProbeMovementTick()
        .catch((err) => {
          console.error('[vierpunkteins] distance probe movement tick failed', err)
        })
        .finally(() => {
          if (distanceProbeItemId) {
            probeMovementRafId = requestAnimationFrame(tick)
          }
        })
    }
    probeMovementRafId = requestAnimationFrame(tick)
  }

  /**
   * Szene: Bewegung erkennen (Ring-Shift); Ende nur per pointerup.
   * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} probeItem
   * @param {import('./gridDistance.js').GridContext} gridContext
   */
  async function updateProbePlacementFromScene(probeItem, gridContext) {
    if (!distanceProbeItemId || !probeItem) return
    const center = await resolveDistanceCenter(probeItem, gridContext)
    const prevState = probePlacementState
    const tick = trackProbePlacementCenter(center, prevState)
    if (
      tick.mapDragging &&
      !prevState.mapDragging &&
      prevState.lastCenter &&
      (!hasProbeAnchorToken() ||
        getProbeAnchorOwnerId() !== distanceProbeItemId)
    ) {
      await ensureProbeAnchorToken(
        prevState.lastCenter,
        distanceProbeItemId,
        probeItem
      )
      if (hasProbeAnchorToken()) {
        probePointerHeld = true
      }
    }
    probePlacementState = tick.nextState
    if (tick.placed && (probeMapDragging || hasProbeAnchorToken())) {
      if (!probePlacementEndPending) {
        probePlacementEndPendingAt = Date.now()
      }
      probePlacementEndPending = true
    } else if (tick.mapDragging) {
      probeMapDragging = true
    }
  }

  /**
   * @param {{ id?: string, metadata?: Record<string, unknown> } | null | undefined} probeItem
   * @param {import('@owlbear-rodeo/sdk').Item[]} sceneItems
   * @param {import('./gridDistance.js').GridContext} gridContext
   */
  async function refreshProbeSpokesOnly(probeItem, sceneItems) {
    const probeMeta = probeItem.metadata?.[TRACKER_ITEM_META_KEY]
    const probeXSchritt = probeMeta ? readHeroDistClassXSchritt(probeMeta) : null
    const isGm = isGmSync()
    const listItems = filterItemsForListViewer(sceneItems ?? [], isGm)
    const others = listItems.filter(
      (i) =>
        i.id !== distanceProbeItemId &&
        i.metadata?.[TRACKER_ITEM_META_KEY] != null &&
        (isGm || isSceneItemVisibleOnMap(i))
    )
    await showDistanceSpokesFor(probeItem, others, probeXSchritt, { isGm })
  }

  async function refreshProbeRingsForItem(probeItem) {
    // Spieler: keine Distanzringe fuer fremde Tokens anzeigen (Owner = createdUserId).
    if (!isGmSync() && !canEditSceneItem(probeItem)) {
      await hideDistanceRings()
      return
    }
    const meta = probeItem.metadata?.[TRACKER_ITEM_META_KEY]
    const combat = getCombat()
    const gsSchritt = meta
      ? readHeroGsSchritt(meta, {
          ownerIni: readOwnerIniReferenceForMods(meta),
          navIni: currentNavIniForRender,
          round: combat.started ? combat.round : null,
        })
      : null
    const ringVisible = meta ? readDistRingVisible(meta) : defaultDistRingVisible()
    const customRingSpecs =
      meta && ringVisible.custom
        ? buildCustomDistRingSpecs(readCustomDistProfiles(meta))
        : []
    const classXSchritt = meta ? readHeroDistClassXSchritt(meta) : null
    await showDistanceRingsFor(
      probeItem,
      gsSchritt,
      customRingSpecs,
      ringVisible,
      classXSchritt
    )
  }

  async function refreshProbeSpokesAndRings(probeItem, sceneItems, gridContext) {
    await refreshProbeRingsForItem(probeItem)
    await refreshProbeSpokesOnly(probeItem, sceneItems)
  }

  /**
   * @param {{ id?: string, metadata?: Record<string, unknown> } | null | undefined} probeItem
   */
  async function syncProbeAnchorSpokeLine(probeItem) {
    if (!hasProbeAnchorToken()) return
    const anchorPseudo = getProbeAnchorPseudoItem()
    if (!anchorPseudo || !probeItem) return
    const probeMeta = probeItem?.metadata?.[TRACKER_ITEM_META_KEY]
    const probeXSchritt = probeMeta ? readHeroDistClassXSchritt(probeMeta) : null
    await syncProbeAnchorSpoke(anchorPseudo, probeItem, probeXSchritt, {
      withClass: false,
      isGm: isGmSync(),
    })
  }

  async function runDistanceProbeMovementTick() {
    if (!distanceProbeItemId) return
    let sceneItems = []
    try {
      sceneItems = await OBR.scene.items.getItems()
    } catch {
      return
    }
    const probeItem = findDistanceProbeItem(sceneItems)
    if (!probeItem) return
    const gridContext = await getGridContext()
    if (!gridContext) return

    const trackerCenters = await collectTrackerCenterMap(sceneItems, gridContext)
    const { anyMoved: anyTrackerMoved, nextCenters } = detectTrackerCenterMoves(
      lastTrackerCentersById,
      trackerCenters
    )
    lastTrackerCentersById = nextCenters

    await updateProbePlacementFromScene(probeItem, gridContext)
    if (probeMapDragging) {
      const center = await resolveDistanceCenter(probeItem, gridContext)
      if (isGmSync() || canEditSceneItem(probeItem)) {
        const shifted = await shiftDistanceRingsCenter(center)
        if (!shifted) {
          await refreshProbeRingsForItem(probeItem)
        }
      } else {
        await hideDistanceRings()
      }
      await syncProbeAnchorSpokeLine(probeItem)
    } else {
      await updateExternalTrackerDragFromScene(sceneItems, gridContext, probeItem)
    }

    if (probeMapDragging || anyTrackerMoved) {
      await refreshProbeSpokesOnly(probeItem, sceneItems)
      applyDistanceOverlay()
    }

    await tryFinishProbePlacementWhenOrientationSynced(probeItem, gridContext)
  }

  /** @param {import('@owlbear-rodeo/sdk').Item[]} sceneItems */
  function findDistanceProbeItem(sceneItems) {
    if (!distanceProbeItemId) return null
    const listItems = filterItemsForListViewer(sceneItems ?? [], isGmSync())
    return (
      listItems.find((i) => i.id === distanceProbeItemId) ??
      sceneItems.find((i) => i.id === distanceProbeItemId) ??
      null
    )
  }

  /**
   * @param {{ redrawRings?: boolean, checkPlacement?: boolean, syncLine?: boolean }} [options]
   */
  async function runDistanceProbeRefresh(options = {}) {
    if (!distanceProbeItemId) return
    const redrawRings =
      options.redrawRings ?? !isProbeMapDragActive()
    const checkPlacement = options.checkPlacement ?? false
    const syncLine = options.syncLine ?? true
    let sceneItems = []
    try {
      sceneItems = await OBR.scene.items.getItems()
    } catch {
      return
    }
    const probeItem = findDistanceProbeItem(sceneItems)
    if (!probeItem) return
    const gridContext = await getGridContext({ forceRefresh: true })
    if (!gridContext) return
    if (checkPlacement) {
      await updateProbePlacementFromScene(probeItem, gridContext)
    }
    if (redrawRings) {
      await refreshProbeRingsForItem(probeItem)
    }
    await refreshProbeSpokesOnly(probeItem, sceneItems)
    if (syncLine) {
      await syncProbeAnchorSpokeLine(probeItem)
    }
  }

  /**
   * @param {{ redrawRings?: boolean, checkPlacement?: boolean, syncLine?: boolean }} [options]
   */
  function scheduleDistanceProbeRefresh(options = {}) {
    if (!distanceProbeItemId || distanceProbeRefreshPending) return
    const dragging = isProbeMapDragActive()
    const refreshOptions = {
      redrawRings: options.redrawRings ?? !dragging,
      checkPlacement: options.checkPlacement ?? false,
      syncLine: options.syncLine ?? !dragging,
      ...options,
    }
    distanceProbeRefreshPending = true
    requestAnimationFrame(() => {
      distanceProbeRefreshPending = false
      void runDistanceProbeRefresh(refreshOptions).catch((err) => {
        console.error('[vierpunkteins] distance probe refresh failed', err)
      })
    })
  }

  const DIST_PROBE_EYE_SVG =
    '<svg class="init-dist-cell__probe-eye" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'

  const DIST_CELL_TARGET_SVG =
    '<svg class="init-dist-cell__target-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>'

  async function refreshDistanceProbeRings() {
    await runDistanceProbeRefresh({
      redrawRings: true,
      checkPlacement: false,
      syncLine: true,
    })
  }

  async function refreshDistanceProbeMapOverlays() {
    await runDistanceProbeRefresh({
      redrawRings: true,
      checkPlacement: false,
      syncLine: true,
    })
  }

  async function applyDistanceOverlayAsync() {
    const all = element.querySelectorAll('.init-dist-cell')
    if (!distanceProbeItemId) {
      all.forEach((c) => {
        c.classList.remove('init-dist-cell--probe', 'init-dist-cell--target')
        applyDistCellIdleState(c)
      })
      return
    }
    const probeItem = lastItems.find((i) => i.id === distanceProbeItemId)
    const probeMeta = probeItem?.metadata?.[TRACKER_ITEM_META_KEY]
    const probeXSchritt = probeMeta ? readHeroDistClassXSchritt(probeMeta) : null
    /** @type {Promise<void>[]} */
    const pending = []
    all.forEach((c) => {
      const id = c.dataset.distCellItemId
      const valEl = c.querySelector('.init-dist-cell__value')
      if (!valEl) return
      if (id === distanceProbeItemId) {
        c.classList.add('init-dist-cell--probe')
        c.classList.remove('init-dist-cell--target', 'init-dist-cell--idle-rings')
        valEl.innerHTML = DIST_PROBE_EYE_SVG
      } else {
        const other = lastItems.find((i) => i.id === id)
        if (!probeItem || !other) {
          applyDistCellIdleState(c)
          return
        }
        c.classList.remove('init-dist-cell--probe', 'init-dist-cell--idle-rings')
        c.classList.add('init-dist-cell--target')
        pending.push(
          formatGridDistWithClass(probeItem, other, probeXSchritt).then((text) => {
            valEl.textContent = text
          })
        )
      }
    })
    await Promise.all(pending)
  }

  function applyDistanceOverlay() {
    void applyDistanceOverlayAsync().catch((err) => {
      console.error('[vierpunkteins] applyDistanceOverlay failed', err)
    })
  }

  onGridDistanceChange(() => {
    if (!distanceProbeItemId) return
    applyDistanceOverlay()
    scheduleDistanceProbeRefresh({
      redrawRings: !isProbeMapDragActive(),
      syncLine: false,
    })
  })

  function applyDistCellIdleState(cell) {
    const valEl = cell.querySelector('.init-dist-cell__value')
    if (!valEl) return
    if (
      cell.classList.contains('init-dist-cell--probe') ||
      cell.classList.contains('init-dist-cell--target')
    ) {
      return
    }
    const id = cell.dataset.distCellItemId
    const item = lastItems.find((i) => i.id === id)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    const prefs = meta ? readDistRingVisible(meta) : defaultDistRingVisible()
    const xSchritt = meta ? readHeroDistClassXSchritt(meta) : null
    cell.classList.toggle(
      'init-dist-cell--idle-rings',
      isDistMapRingsInactive(prefs, xSchritt)
    )
    valEl.innerHTML = DIST_CELL_TARGET_SVG
  }

  function applyDistCellIdleStates() {
    if (distanceProbeItemId) return
    element.querySelectorAll('.init-dist-cell').forEach((c) => {
      applyDistCellIdleState(c)
    })
  }

  async function clearDistanceProbeOverlaysAsync() {
    distanceProbeItemId = null
    stopProbeMovementLoop()
    detachProbePointerListeners()
    await resetProbeMapDragState()
    await hideDistanceRings()
    await hideDistanceSpokes()
    applyDistanceOverlay()
  }

  function runClearDistanceProbeOverlays(reason) {
    void clearDistanceProbeOverlaysAsync().catch((err) => {
      console.warn(
        `[vierpunkteins] DIST overlay cleanup${reason ? ` (${reason})` : ''}`,
        err
      )
    })
  }

  function deactivateDistanceProbe() {
    runClearDistanceProbeOverlays()
  }

  /** Popover / Action-Panel zu: keine eingefrorenen DIST-Overlays auf der Karte. */
  function clearDistanceProbeForPanelHide() {
    runClearDistanceProbeOverlays('panel hide')
  }

  const onDistanceProbePanelHide = () => {
    clearDistanceProbeForPanelHide()
  }

  const onDistanceProbeVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      clearDistanceProbeForPanelHide()
    }
  }

  document.addEventListener('visibilitychange', onDistanceProbeVisibilityChange)
  window.addEventListener('pagehide', onDistanceProbePanelHide)

  const offActionOpenChange = OBR.action.onOpenChange((isOpen) => {
    if (!isOpen) {
      runClearDistanceProbeOverlays('action close')
    }
  })

  void OBR.action.isOpen().then((isOpen) => {
    if (!isOpen) {
      runClearDistanceProbeOverlays('action already closed')
    }
  })

  async function activateDistanceProbe(itemId) {
    if (distanceProbeItemId && distanceProbeItemId !== itemId) {
      stopProbeMovementLoop()
      detachProbePointerListeners()
      void removeProbeAnchorToken()
      void hideDistanceRings()
      void hideDistanceSpokes()
    }
    distanceProbeItemId = itemId
    resetProbeMapDragState()
    const probeAtDown = lastItems.find((i) => i.id === itemId)
    const gridContext = await getGridContext({ forceRefresh: true })
    if (probeAtDown && gridContext) {
      probeMovementAnchor = await resolveDistanceCenter(
        probeAtDown,
        gridContext
      )
    }
    attachProbePointerListeners()
    applyDistanceOverlay()
    const item = lastItems.find((i) => i.id === itemId)
    if (!item || !gridContext) return
    startProbeMovementLoop()
    await runDistanceProbeRefresh({
      redrawRings: true,
      checkPlacement: false,
      syncLine: true,
    })
  }

  function wireDistanceProbeCell(cell, itemId) {
    cell.title = 'Distanz anzeigen (erneut klicken zum Ausblenden)'
    cell.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (distanceProbeItemId === itemId) {
        deactivateDistanceProbe()
        return
      }
      void activateDistanceProbe(itemId).catch((err) => {
        console.warn('[vierpunkteins] DIST-Probe aktivieren', err)
      })
    })
    cell.addEventListener('pointerup', (e) => {
      e.stopPropagation()
    })
    cell.addEventListener('pointercancel', (e) => {
      e.stopPropagation()
    })
  }

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
            safeRenderList(afterIni)
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
          <span><strong>Bis einschließlich erster INI-Phase:</strong> Solange die globale Kampf-Navigation noch nicht den Mutter-Zug dieses Helden verlassen hat (einschließlich seiner 2.-Aktionszeilen mit gleicher INI), darf der Spieler die Umwandlungs-Pfeile nutzen.</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-convert-announce" value="entireRound" />
          <span><strong>Gesamte Kampfrunde:</strong> Der Spieler darf die Umwandlungs-Pfeile in jeder Navigations-Position der Kampfrunde nutzen; dabei gilt automatisch auch der frühere „Umwandeln jederzeit“-Effekt (inkl. Spiegelanzeige an regulären 2.-Aktionszeilen, ohne Zusatzladungen).</span>
        </label>
      </fieldset>
    </div>
    <div class="kampf-settings-panel__section">
      <label class="init-row-extra-label" data-kampf-hero-color-field-label>Heldenfarbe</label>
      <p class="kampf-settings-panel__microhint" id="kampf-hero-color-microhint">Für alle in der Szene sichtbar (SL und Spieler). Klick setzt die Farbe sofort; „×“ entfernt sie.</p>
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
      <label class="kampf-settings-checkbox-label" data-kampf-hero-slot9-toggle-wrap>
        <input type="checkbox" data-kampf-hero-slot9-enabled />
        <span><strong>9. Trefferzone aktivieren</strong> (SW-Platzhalter im Heldenblock; optional für Wesen mit neun Zonen).</span>
      </label>
      <div data-kampf-hero-slot9-host hidden></div>
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only>
      <h3 class="kampf-settings-panel__sub">Feldsichtbarkeit</h3>
      <fieldset class="kampf-settings-convert-announce">
        <legend class="kampf-settings-convert-announce__legend">Zusatzfeld im Heldenblock (zwischen AE und IB-Kette)</legend>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-extra-field" value="none" />
          <span><strong>Keins</strong> (Platzhalter unsichtbar).</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-extra-field" value="ke" />
          <span><strong>KE</strong> — Karmaenergie.</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-extra-field" value="gw" />
          <span><strong>GW</strong> — Gefahrenwert.</span>
        </label>
        <label class="kampf-settings-radio-label">
          <input type="radio" name="kampf-hero-extra-field" value="lo" />
          <span><strong>LO</strong> — Loyalität.</span>
        </label>
      </fieldset>
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-hero-show-fk />
        <span><strong>FK anzeigen:</strong> bei Vierbeiner standardmäßig ausblendbar.</span>
      </label>
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-hero-show-au />
        <span><strong>AU anzeigen (Ausdauer):</strong> zwischen FK und AE in der Wertezeile; standardmäßig aus.</span>
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
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only data-kampf-hero-dist-ring-section>
      <h3 class="kampf-settings-panel__sub">Distanzkreise auf der Karte</h3>
      <p class="kampf-settings-panel__microhint">Beim Halten des Dist-Kästchens nur aktivierte Ring-Typen anzeigen.</p>
      <div class="kampf-hero-dist-ring__grid" data-kampf-hero-dist-ring-host></div>
      <label class="init-row-extra-label kampf-hero-dist-class-x__label" for="kampf-hero-dist-class-x-schritt">Grenze Klasse X (Schritt, 1–999)</label>
      <input type="text" id="kampf-hero-dist-class-x-schritt" class="init-row-extra-input kampf-hero-dist-class-x__input" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="3" title="Leer = Klasse X aus. Ring X nur mit gesetztem Wert und aktivierter Checkbox." />
    </div>
    <div class="kampf-settings-panel__section" data-kampf-hero-gm-only data-kampf-hero-custom-dist-section>
      <h3 class="kampf-settings-panel__sub">Reichweiten-Profile</h3>
      <p class="kampf-settings-panel__microhint">Für Fernkampf, Zauber und andere Reichweiten: beliebig viele Profile, je bis zu 99 Distanzstufen (+ / ×).</p>
      <div data-kampf-hero-custom-dist-host></div>
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
  const heroColorMicrohintEl = heroSettingsPanel.querySelector(
    '#kampf-hero-color-microhint'
  )
  const heroColorFieldLabelEl = heroSettingsPanel.querySelector(
    '[data-kampf-hero-color-field-label]'
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
  const heroSlot9EnabledCb = heroSettingsPanel.querySelector(
    '[data-kampf-hero-slot9-enabled]'
  )
  const heroSlot9Host = heroSettingsPanel.querySelector(
    '[data-kampf-hero-slot9-host]'
  )
  const heroSlot9ToggleWrap = heroSettingsPanel.querySelector(
    '[data-kampf-hero-slot9-toggle-wrap]'
  )
  const heroShowFkCb = heroSettingsPanel.querySelector('[data-kampf-hero-show-fk]')
  const heroShowAuCb = heroSettingsPanel.querySelector('[data-kampf-hero-show-au]')
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
  const heroCustomDistHost = heroSettingsPanel.querySelector(
    '[data-kampf-hero-custom-dist-host]'
  )
  const heroDistRingHost = heroSettingsPanel.querySelector(
    '[data-kampf-hero-dist-ring-host]'
  )

  const heroDistClassXInp = heroSettingsPanel.querySelector('#kampf-hero-dist-class-x-schritt')

  const DIST_RING_LABELS = {
    H: '(H) Handnah',
    N: '(N) Nah',
    S: '(S) Mittel',
    P: '(P) Fern',
    X: '(X) frei',
    m1: '1 Akt. Bewegen',
    m2: '2 Akt. Bewegen',
    sp: 'Sprint',
    custom: 'Benutzerdefinierte Distanzen',
  }

  /** @type {Record<string, HTMLInputElement>} */
  let heroDistRingCheckboxRefs = {}

  const pullDistRingPendingFromUi = () => {
    if (!heroPending) return
    const prefs = defaultDistRingVisible()
    for (const code of CLASS_CODES) {
      prefs[code] = Boolean(heroDistRingCheckboxRefs[code]?.checked)
    }
    for (const code of MOVEMENT_CODES) {
      prefs[code] = Boolean(heroDistRingCheckboxRefs[code]?.checked)
    }
    prefs.custom = Boolean(heroDistRingCheckboxRefs.custom?.checked)
    heroPending.distRingVisible = prefs
  }

  const syncDistRingUiFromPending = () => {
    if (!heroPending) return
    const prefs = heroPending.distRingVisible ?? defaultDistRingVisible()
    for (const code of [...CLASS_CODES, ...MOVEMENT_CODES, 'custom']) {
      const cb = heroDistRingCheckboxRefs[code]
      if (cb) {
        cb.checked = Boolean(/** @type {Record<string, boolean>} */ (prefs)[code])
        cb.disabled = !heroSettingsGmMode
      }
    }
  }

  const initHeroDistRingUi = () => {
    if (!(heroDistRingHost instanceof HTMLElement) || Object.keys(heroDistRingCheckboxRefs).length > 0) {
      return
    }
    heroDistRingHost.replaceChildren()
    for (const code of [...CLASS_CODES, ...MOVEMENT_CODES, 'custom']) {
      const label = document.createElement('label')
      label.className = 'kampf-settings-checkbox-label kampf-hero-dist-ring__item'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.dataset.distRingCode = code
      const span = document.createElement('span')
      span.textContent = DIST_RING_LABELS[code] ?? code
      label.append(cb, span)
      heroDistRingHost.appendChild(label)
      heroDistRingCheckboxRefs[code] = cb
      cb.addEventListener('change', pullDistRingPendingFromUi)
    }
  }

  initHeroDistRingUi()

  /** @type {{ profileEl: HTMLElement, enabled: HTMLInputElement, name: HTMLInputElement, removeBtn: HTMLButtonElement, bands: { row: HTMLElement, label: HTMLInputElement, schritt: HTMLInputElement, removeBtn: HTMLButtonElement }[], addBandBtn: HTMLButtonElement | null }[]} */
  let heroCustomDistUiRefs = []
  let heroCustomDistUiReady = false

  const setCustomDistProfileInputsDisabled = (profileRef, disabled) => {
    profileRef.name.disabled = disabled
    if (profileRef.addBandBtn instanceof HTMLButtonElement) {
      profileRef.addBandBtn.disabled =
        disabled || profileRef.bands.length >= CUSTOM_DIST_MAX_BANDS
    }
    for (const band of profileRef.bands) {
      band.label.disabled = disabled
      band.schritt.disabled = disabled
      band.removeBtn.disabled =
        disabled || !heroSettingsGmMode || profileRef.bands.length <= 1
    }
    profileRef.profileEl.classList.toggle('kampf-hero-custom-dist__profile--disabled', disabled)
  }

  const readCustomDistProfilesFromUi = () => {
    return heroCustomDistUiRefs.map((profileRef) => ({
      enabled: profileRef.enabled.checked,
      name: profileRef.name.value,
      bands: profileRef.bands.map((band) => ({
        label: band.label.value,
        schritt: band.schritt.value.trim() === '' ? null : band.schritt.value.trim(),
      })),
    }))
  }

  const pullCustomDistPendingFromUi = () => {
    if (!heroPending || heroCustomDistUiRefs.length === 0) return
    heroPending.customDistProfiles = readCustomDistProfilesFromUi()
  }

  const syncHeroDistClassXFromPending = () => {
    if (!(heroDistClassXInp instanceof HTMLInputElement) || !heroPending) return
    const x = heroPending.distClassXSchritt
    heroDistClassXInp.value = x != null && x > 0 ? String(x) : ''
    heroDistClassXInp.disabled = !heroSettingsGmMode
  }

  const pullHeroDistClassXFromUi = () => {
    if (!heroPending || !(heroDistClassXInp instanceof HTMLInputElement)) return
    const t = heroDistClassXInp.value.trim()
    heroPending.distClassXSchritt = t === '' ? null : t
  }

  /** @param {number} profileIndex */
  const createCustomDistBandRow = (profileIndex, bandIndex, profileRef) => {
    const row = document.createElement('div')
    row.className = 'kampf-hero-custom-dist__row'
    const label = document.createElement('input')
    label.type = 'text'
    label.className = 'init-row-extra-input kampf-hero-custom-dist__col-label'
    label.autocomplete = 'off'
    label.spellcheck = false
    label.maxLength = 32
    label.placeholder = DEFAULT_BAND_LABELS[bandIndex] ?? ''
    const schritt = document.createElement('input')
    schritt.type = 'text'
    schritt.className = 'init-row-extra-input kampf-hero-custom-dist__col-schritt'
    schritt.inputMode = 'numeric'
    schritt.autocomplete = 'off'
    schritt.spellcheck = false
    schritt.maxLength = 3
    schritt.title = 'Schritt 1–999'
    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'btn kampf-hero-custom-dist__band-remove'
    removeBtn.textContent = '×'
    removeBtn.title = 'Distanzstufe entfernen'
    removeBtn.setAttribute('aria-label', 'Distanzstufe entfernen')
    row.append(label, schritt, removeBtn)
    const bandRef = { row, label, schritt, removeBtn }
    label.addEventListener('input', pullCustomDistPendingFromUi)
    schritt.addEventListener('input', pullCustomDistPendingFromUi)
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault()
      if (profileRef.bands.length <= 1) return
      const idx = profileRef.bands.indexOf(bandRef)
      if (idx < 0) return
      profileRef.bands.splice(idx, 1)
      row.remove()
      setCustomDistProfileInputsDisabled(profileRef, !profileRef.enabled.checked)
      pullCustomDistPendingFromUi()
    })
    return bandRef
  }

  /**
   * @param {import('./heroCustomDist.js').CustomDistProfile} profile
   * @param {number} profileIndex
   * @param {number} profileCount
   */
  const appendCustomDistProfileUi = (profile, profileIndex, profileCount) => {
    const profileEl = document.createElement('div')
    profileEl.className = 'kampf-hero-custom-dist__profile'
    const head = document.createElement('div')
    head.className = 'kampf-hero-custom-dist__head'
    const name = document.createElement('input')
    name.type = 'text'
    name.className = 'init-row-extra-input kampf-hero-custom-dist__name'
    name.autocomplete = 'off'
    name.spellcheck = false
    name.maxLength = 48
    name.value = profile.name
    name.placeholder = 'Profilname'
    const enabledLabel = document.createElement('label')
    enabledLabel.className = 'kampf-settings-checkbox-label kampf-hero-custom-dist__enable'
    const enabled = document.createElement('input')
    enabled.type = 'checkbox'
    enabled.checked = profile.enabled
    const enableText = document.createElement('span')
    enableText.textContent = 'Aktiv'
    enabledLabel.append(enabled, enableText)
    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'btn kampf-hero-custom-dist__profile-remove'
    removeBtn.textContent = 'Profil ×'
    removeBtn.title = 'Profil entfernen'
    head.append(name, enabledLabel, removeBtn)
    profileEl.appendChild(head)
    const tableHead = document.createElement('div')
    tableHead.className = 'kampf-hero-custom-dist__row kampf-hero-custom-dist__row--head'
    tableHead.innerHTML =
      '<span class="kampf-hero-custom-dist__col-label">Bezeichnung</span><span class="kampf-hero-custom-dist__col-schritt">Schritt</span><span class="kampf-hero-custom-dist__col-actions"></span>'
    profileEl.appendChild(tableHead)
    const bandsHost = document.createElement('div')
    bandsHost.className = 'kampf-hero-custom-dist__bands'
    profileEl.appendChild(bandsHost)
    /** @type {typeof heroCustomDistUiRefs[0]['bands']} */
    const bands = []
    /** @type {typeof heroCustomDistUiRefs[0]} */
    const profileRef = {
      profileEl,
      enabled,
      name,
      removeBtn,
      bands,
      addBandBtn: null,
    }
    const profileBands = Array.isArray(profile.bands) ? profile.bands : []
    for (let b = 0; b < profileBands.length; b++) {
      const bandRef = createCustomDistBandRow(profileIndex, b, profileRef)
      bandRef.label.value = profileBands[b]?.label ?? ''
      const st = profileBands[b]?.schritt
      bandRef.schritt.value = st != null && st > 0 ? String(st) : ''
      bandsHost.appendChild(bandRef.row)
      bands.push(bandRef)
    }
    const addBandBtn = document.createElement('button')
    addBandBtn.type = 'button'
    addBandBtn.className = 'btn kampf-hero-custom-dist__add-band'
    addBandBtn.textContent = '+ Distanz'
    addBandBtn.title = 'Weitere Distanzstufe (max. 99)'
    profileEl.appendChild(addBandBtn)
    profileRef.addBandBtn = addBandBtn
    addBandBtn.addEventListener('click', (e) => {
      e.preventDefault()
      if (profileRef.bands.length >= CUSTOM_DIST_MAX_BANDS) return
      const bandRef = createCustomDistBandRow(profileIndex, profileRef.bands.length, profileRef)
      bandsHost.appendChild(bandRef.row)
      profileRef.bands.push(bandRef)
      setCustomDistProfileInputsDisabled(profileRef, !enabled.checked)
      pullCustomDistPendingFromUi()
    })
    enabled.addEventListener('change', () => {
      setCustomDistProfileInputsDisabled(profileRef, !enabled.checked)
      pullCustomDistPendingFromUi()
    })
    name.addEventListener('input', pullCustomDistPendingFromUi)
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault()
      if (!heroPending) return
      pullCustomDistPendingFromUi()
      const list = readCustomDistProfilesFromUi()
      if (list.length <= 1) return
      list.splice(profileIndex, 1)
      heroPending.customDistProfiles = list
      rebuildHeroCustomDistUi()
    })
    setCustomDistProfileInputsDisabled(profileRef, !profile.enabled)
    enabled.disabled = !heroSettingsGmMode
    name.disabled = !heroSettingsGmMode
    removeBtn.disabled = !heroSettingsGmMode || profileCount <= 1
    heroCustomDistHost.appendChild(profileEl)
    heroCustomDistUiRefs.push(profileRef)
  }

  const rebuildHeroCustomDistUi = () => {
    if (!(heroCustomDistHost instanceof HTMLElement)) return
    try {
      heroCustomDistHost.replaceChildren()
      heroCustomDistUiRefs = []
      const profiles = heroPending
        ? readCustomDistProfiles(
            heroPending.customDistProfiles
              ? { [HERO_CUSTOM_DIST]: heroPending.customDistProfiles }
              : undefined
          )
        : readCustomDistProfiles(undefined)
      for (let p = 0; p < profiles.length; p++) {
        appendCustomDistProfileUi(profiles[p], p, profiles.length)
      }
      const addProfileBtn = document.createElement('button')
      addProfileBtn.type = 'button'
      addProfileBtn.className = 'btn kampf-hero-custom-dist__add-profile'
      addProfileBtn.textContent = '+ Profil'
      addProfileBtn.disabled =
        !heroSettingsGmMode || profiles.length >= CUSTOM_DIST_MAX_PROFILES
      addProfileBtn.addEventListener('click', (e) => {
        e.preventDefault()
        if (!heroPending) return
        pullCustomDistPendingFromUi()
        const list = readCustomDistProfilesFromUi()
        if (list.length >= CUSTOM_DIST_MAX_PROFILES) return
        list.push({
          enabled: false,
          name: `Reichweite ${list.length + 1}`,
          bands: [{ label: '', schritt: null }],
        })
        heroPending.customDistProfiles = list
        rebuildHeroCustomDistUi()
      })
      heroCustomDistHost.appendChild(addProfileBtn)
      heroCustomDistUiReady = true
    } catch (err) {
      heroCustomDistUiReady = false
      console.error('[vierpunkteins] hero custom dist UI failed', err)
    }
  }

  const syncCustomDistUiFromPending = () => {
    rebuildHeroCustomDistUi()
  }

  if (heroDistClassXInp instanceof HTMLInputElement) {
    heroDistClassXInp.addEventListener('input', pullHeroDistClassXFromUi)
  }

  /** @type {ReturnType<typeof mountWappenEditor> | null} */
  let heroWappenEditor = null
  let heroWappenValid = true
  let heroSlot9Editor = null
  let heroSlot9Valid = true

  const applyHeroSettingsUiMode = () => {
    const gm = heroSettingsGmMode
    for (const el of heroGmOnlySections) {
      if (el instanceof HTMLElement) {
        el.hidden = !gm
        el.style.display = gm ? '' : 'none'
      }
    }
    if (heroSettingsHintEl instanceof HTMLElement) {
      if (gm) {
        heroSettingsHintEl.hidden = false
        heroSettingsHintEl.style.display = ''
        heroSettingsHintEl.textContent =
          'Spielleitung: Werte gelten für dieses Token in der Szene. Die Zeilen-Hintergrundfarbe ist für alle sichtbar.'
      } else {
        heroSettingsHintEl.textContent = ''
        heroSettingsHintEl.hidden = true
        heroSettingsHintEl.style.display = 'none'
      }
    }
    if (heroColorMicrohintEl instanceof HTMLElement) {
      heroColorMicrohintEl.hidden = !gm
      heroColorMicrohintEl.style.display = gm ? '' : 'none'
    }
    if (heroColorFieldLabelEl instanceof HTMLElement) {
      heroColorFieldLabelEl.hidden = !gm
      heroColorFieldLabelEl.style.display = gm ? '' : 'none'
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

  const readExtraFieldFromHeroSettingsPanel = () => {
    const checked = heroSettingsPanel.querySelector(
      'input[name="kampf-hero-extra-field"]:checked'
    )
    if (checked instanceof HTMLInputElement) {
      const v = checked.value
      if (v === 'ke' || v === 'gw' || v === 'lo') return v
    }
    return 'none'
  }

  const readHeroSlot9FromMeta = (m) => {
    const raw = m?.[HERO_EX_WAPPEN_SLOT9]
    const norm = normalizeSlot9Def(raw)
    if (norm?.active) return norm
    const ov = m?.[HERO_EX_WAPPEN_OVERRIDE]
    if (Array.isArray(ov)) {
      const fromOv = ov.find((d) => Number(d?.slot) === 9)
      const normOv = normalizeSlot9Def(fromOv)
      if (normOv?.active) return normOv
    }
    return null
  }

  const readHeroShowFk = (m, fallbackIsVierbeiner) => {
    const raw = String(m?.[HERO_EX_SHOW_FK] ?? '').trim().toLowerCase()
    if (!raw) return !fallbackIsVierbeiner
    return !['0', 'false', 'off', 'no', 'nein'].includes(raw)
  }

  const readHeroShowAu = (m) => {
    const raw = String(m?.[HERO_EX_SHOW_AU] ?? '').trim().toLowerCase()
    return raw === '1' || ['true', 'on', 'yes', 'ja'].includes(raw)
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
        sw.setAttribute('aria-label', `Heldenfarbe ${color}`)
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
    clearBtn.title = 'Heldenfarbe entfernen'
    clearBtn.setAttribute('aria-label', 'Heldenfarbe entfernen')
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
    if (heroSlot9Editor) {
      heroSlot9Editor.destroy()
      heroSlot9Editor = null
    }
    heroWappenValid = true
    heroSlot9Valid = true
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
    const energyMode = heroPending?.extraField ?? 'none'
    const extraRadios = heroSettingsPanel.querySelectorAll(
      'input[name="kampf-hero-extra-field"]'
    )
    for (const r of extraRadios) {
      if (r instanceof HTMLInputElement) {
        r.checked = r.value === energyMode
        r.disabled = !heroSettingsGmMode
      }
    }
    if (heroShowFkCb instanceof HTMLInputElement) {
      heroShowFkCb.checked = heroPending ? heroPending.showFk !== false : true
      heroShowFkCb.disabled = !heroSettingsGmMode
    }
    if (heroShowAuCb instanceof HTMLInputElement) {
      heroShowAuCb.checked = heroPending ? heroPending.showAu === true : false
      heroShowAuCb.disabled = !heroSettingsGmMode
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
      extraField: readHeroExtraField(m),
      showFk: readHeroShowFk(m, isVierbeinerDefault),
      showAu: readHeroShowAu(m),
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
      slot9Enabled: Boolean(readHeroSlot9FromMeta(m)),
      slot9Def: readHeroSlot9FromMeta(m) ?? { ...defaultSlot9Placeholder() },
      customDistProfiles: readCustomDistProfiles(m),
      distRingVisible: readDistRingVisible(m),
      distClassXSchritt: readHeroDistClassXSchritt(m),
    }
    if (titleHeroEl) {
      titleHeroEl.textContent = gm
        ? `Helden-Einstellungen: ${displayName}`
        : `Mein Held — Zeilenfarbe: ${displayName}`
    }
    applyHeroSettingsUiMode()
    syncHeroSettingsFields(lastItems)
    syncHeroSettingsCheckboxes()
    syncCustomDistUiFromPending()
    syncDistRingUiFromPending()
    syncHeroDistClassXFromPending()
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
    const showOwnEditor =
      heroSettingsGmMode && heroPending.wappenSource === 'own'
    const showSlot9Section =
      heroSettingsGmMode && heroPending.wappenSource !== 'own'
    if (heroSlot9ToggleWrap instanceof HTMLElement) {
      heroSlot9ToggleWrap.hidden = !showSlot9Section
    }
    if (heroSlot9EnabledCb instanceof HTMLInputElement) {
      heroSlot9EnabledCb.checked = Boolean(heroPending.slot9Enabled)
      heroSlot9EnabledCb.disabled = !heroSettingsGmMode || !showSlot9Section
    }
    if (heroWappenHost instanceof HTMLElement) {
      heroWappenHost.hidden = !showOwnEditor
    }
    if (heroSlot9Host instanceof HTMLElement) {
      heroSlot9Host.hidden =
        !showSlot9Section || !heroPending.slot9Enabled
    }
    if (heroWappenEditor) {
      heroWappenEditor.destroy()
      heroWappenEditor = null
    }
    if (heroSlot9Editor) {
      heroSlot9Editor.destroy()
      heroSlot9Editor = null
    }
    if (showOwnEditor && heroWappenHost instanceof HTMLElement) {
      const initial =
        heroPending.wappenOverride ??
        (Array.isArray(room?.wappenDefs) && room.wappenDefs.length > 0
          ? room.wappenDefs
          : cloneDefaultWappenDefs())
      heroPending.wappenOverride = initial
      heroWappenEditor = mountWappenEditor(heroWappenHost, {
        initial,
        maxSlots: 9,
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
    if (
      showSlot9Section &&
      heroPending.slot9Enabled &&
      heroSlot9Host instanceof HTMLElement
    ) {
      heroSlot9Editor = mountWappenEditor(heroSlot9Host, {
        initial: heroPending.slot9Def ?? defaultSlot9Placeholder(),
        onlySlot9: true,
        readOnly: false,
        onChange: (next) => {
          if (heroPending) {
            heroPending.slot9Def = next[0] ?? { ...defaultSlot9Placeholder() }
            heroPending.slot9Enabled = Boolean(heroPending.slot9Def?.active)
          }
        },
        onValidityChange: (ok) => {
          heroSlot9Valid = ok
          refreshHeroSaveDisabled()
        },
      })
      heroSlot9Valid = heroSlot9Editor.isValid()
    } else {
      heroSlot9Valid = true
    }
    refreshHeroSaveDisabled()
  }

  function refreshHeroSaveDisabled() {
    if (!(saveHeroBtn instanceof HTMLButtonElement)) return
    const blockingOwn =
      heroSettingsGmMode &&
      heroPending?.wappenSource === 'own' &&
      !heroWappenValid
    const blockingSlot9 =
      heroSettingsGmMode &&
      heroPending?.wappenSource !== 'own' &&
      heroPending?.slot9Enabled &&
      !heroSlot9Valid
    const blocking = blockingOwn || blockingSlot9
    saveHeroBtn.disabled = blocking
    saveHeroBtn.title = blocking
      ? blockingSlot9
        ? '9. Trefferzone unvollständig (Kürzel fehlt)'
        : 'Kästchen für Wunden/Trefferzonen unvollständig (W20 1–20 müssen abgedeckt sein)'
      : ''
  }

  /**
   * „Zusätzliche Angriffsaktion“ / „Zusätzliche Parade“: setzt die Flags im
   * Token-Meta und entfernt jegliche bestehenden heroExtra-Wurzeln und Slots.
   *
   * Zusätzliche Parade: schwarzes Schild (`krParadeExtra`) und Stempel-Einträge
   * mit `paradeExtra`; bei deaktiviertem Haken werden sie entfernt.
   *
   * Ein neues ZAO wird beim Speichern **nicht** automatisch erzeugt — beim
   * **Kampfstart** legt `resetAllTrackerStateForCombatStart` alle konfigurierten
   * z.AT wieder an; das rote „+" am Mutter-Primärfeld erscheint nur noch,
   * wenn mid-Kampf Wurzeln fehlen (`patchRestoreHeroExtraZao`).
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
        pruneOrphanZaoSlots(m)
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
    pullCustomDistPendingFromUi()
    pullDistRingPendingFromUi()
    pullHeroDistClassXFromUi()
    pend.extraField = readExtraFieldFromHeroSettingsPanel()
    if (heroShowAuCb instanceof HTMLInputElement) {
      pend.showAu = heroShowAuCb.checked
    }
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
    const heroItemBefore = lastItems.find((i) => i.id === id)
    const metaBefore = heroItemBefore?.metadata?.[TRACKER_ITEM_META_KEY]
    const prevAng = readHeroExtraAngCount(metaBefore)
    const prevPar = readHeroExtraParCount(metaBefore)
    const angCount = Math.max(
      0,
      Math.min(10, Math.floor(Number(pend.heroExtraAngCount)) || 0)
    )
    const parCount = Math.max(
      0,
      Math.min(10, Math.floor(Number(pend.heroExtraParCount)) || 0)
    )
    const extraCountsChanged = prevAng !== angCount || prevPar !== parCount
    if (extraCountsChanged) {
      await applyHeroExtraCounts(id, angCount, parCount)
      if (angCount > 0) {
        await patchRestoreHeroExtraZao(id)
      }
    }
    if (parCount > 0) {
      await ensureParadeExtraShield(id)
    }
    const prevPoolAng = readHeroActionPoolPair(metaBefore).ang
    const prevPoolAbw = readHeroActionPoolPair(metaBefore).abw
    const prevPoolMax = readHeroActionPoolMax(metaBefore)
    const poolChanged =
      prevPoolAng !== pend.heroActionPoolAng ||
      prevPoolAbw !== pend.heroActionPoolAbw ||
      prevPoolMax !== pend.heroActionPoolMax
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
        if (pend.extraField === 'ke' || pend.extraField === 'gw' || pend.extraField === 'lo') {
          m[HERO_EX_EXTRA_FIELD] = pend.extraField
        } else {
          delete m[HERO_EX_EXTRA_FIELD]
        }
        delete m.heroExEnergyMode
        m[HERO_EX_SHOW_FK] = pend.showFk === false ? '0' : '1'
        m[HERO_EX_SHOW_AU] = pend.showAu === true ? '1' : '0'
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
          delete m[HERO_EX_WAPPEN_SLOT9]
        } else if (pend.wappenSource === 'vierbeiner') {
          m[HERO_EX_WAPPEN_TEMPLATE] = 'vierbeiner'
          delete m[HERO_EX_WAPPEN_OVERRIDE]
          if (pend.slot9Enabled && pend.slot9Def?.active) {
            m[HERO_EX_WAPPEN_SLOT9] = normalizeSlot9Def(pend.slot9Def)
          } else {
            delete m[HERO_EX_WAPPEN_SLOT9]
          }
        } else {
          delete m[HERO_EX_WAPPEN_OVERRIDE]
          delete m[HERO_EX_WAPPEN_TEMPLATE]
          if (pend.slot9Enabled && pend.slot9Def?.active) {
            m[HERO_EX_WAPPEN_SLOT9] = normalizeSlot9Def(pend.slot9Def)
          } else {
            delete m[HERO_EX_WAPPEN_SLOT9]
          }
        }
        cleanupOrphanHitZoneKeys(m, room)
        writeCustomDistProfiles(m, pend.customDistProfiles)
        writeDistRingVisible(m, pend.distRingVisible ?? defaultDistRingVisible())
        writeHeroDistClassXSchritt(m, pend.distClassXSchritt)
        if (extraCountsChanged) pruneOrphanZaoSlots(m)
        if (poolChanged) initKrActionPoolsFromHeroDefaults(m)
        else pruneOrphanZaoSlots(m)
        applyIniLockCharges(m)
      }
    })
    await refreshAutoBundlesForItem(id)
    const itemsAfterSave = await OBR.scene.items.getItems()
    await renderList(itemsAfterSave)
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
    if (t.name !== 'kampf-hero-extra-field') return
    heroPending.extraField =
      t.value === 'ke' || t.value === 'gw' || t.value === 'lo' ? t.value : 'none'
  })

  heroSettingsPanel.addEventListener('change', (e) => {
    const t = e.target
    if (!(t instanceof HTMLInputElement) || !heroPending) return
    if (t.name === 'kampf-hero-extra-field') {
      heroPending.extraField =
        t.value === 'ke' || t.value === 'gw' || t.value === 'lo' ? t.value : 'none'
      return
    }
    if (t.matches('[data-kampf-hero-slot9-enabled]')) {
      heroPending.slot9Enabled = t.checked
      if (t.checked && !heroPending.slot9Def) {
        heroPending.slot9Def = {
          ...defaultSlot9Placeholder(),
          active: true,
        }
      } else if (heroPending.slot9Def) {
        heroPending.slot9Def = { ...heroPending.slot9Def, active: t.checked }
      }
      syncHeroWappenUi(getRoomSettings())
      return
    }
    if (t === heroShowFkCb) {
      heroPending.showFk = t.checked
      return
    }
    if (t === heroShowAuCb) {
      heroPending.showAu = t.checked
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

  /** Vor jedem Listen-Neuaufbau: offene Heldenblöcke persistieren (sonst gehen uncommitted Eingaben verloren). */
  const flushOpenHeroExpandPanelsBeforeRemount = async () => {
    const host = document.getElementById('initiative-list-host')
    if (!host) return
    const bodies = host.querySelectorAll('.init-row-extra-panel__body')
    /** @type {Promise<void>[]} */
    const tasks = []
    for (const body of bodies) {
      const fn = body[HERO_EXPAND_BODY_FLUSH]
      if (typeof fn === 'function') tasks.push(fn())
    }
    if (tasks.length === 0) return
    const settled = await Promise.allSettled(tasks)
    for (const r of settled) {
      if (r.status === 'rejected') {
        console.warn(
          '[vierpunkteins] hero expand flush before renderList failed',
          r.reason
        )
      }
    }
  }

  const renderList = async (items) => {
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
    await flushOpenHeroExpandPanelsBeforeRemount()
    const listItems = filterItemsForListViewer(items ?? [], isGmSync())
    if (
      distanceProbeItemId &&
      !listItems.some((i) => i.id === distanceProbeItemId)
    ) {
      deactivateDistanceProbe()
    }
    lastItems = listItems
    const tokenRows = collectSortedParticipants(
      listItems,
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
    currentNavIniForRender = resolveCurrentNavIniForCombat(
      tokenRows,
      listItems,
      getIniTieOrder(),
      combatRoundForMerged,
      combat
    )
    const stepsForNav = buildCombatTurnSteps(
      tokenRows,
      listItems,
      getIniTieOrder(),
      combatRoundForMerged,
      null
    )
    const combatStepIndex =
      combat.started && !combat.roundIntroPending
        ? findCombatStepIndex(stepsForNav, combat)
        : null
    const visibilityCtx = buildConvertListVisibilityCtx({
      combatStarted: combat.started,
      roundIntroPending: combat.roundIntroPending,
      rowActiveId,
      rowActivePhaseLinkId,
      currentNavIni: currentNavIniForRender,
      roundStartStepId: ROUND_START_STEP_ID,
      roundEndStepId: ROUND_END_STEP_ID,
      turnSteps: stepsForNav,
      combatStepIndex:
        combatStepIndex != null && combatStepIndex >= 0 ? combatStepIndex : null,
    })
    visibilityCtxForRender = visibilityCtx
    const merged = buildMergedDisplayRows(
      tokenRows,
      listItems,
      getIniTieOrder(),
      combatRoundForMerged,
      visibilityCtx
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
            shouldShowPhaseLinkInList(meta, l, visibilityCtx, row.id)
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
            safeRenderList(lastItems)
          })
          expandCol.appendChild(expandBtn)
        }

        const btnCol = document.createElement('div')
        btnCol.className = 'init-col-btn init-col-btn--phase-slot'

        const lhCol = document.createElement('div')
        lhCol.className = 'init-col-lh'

        const slotRow = document.createElement('div')
        slotRow.className = 'init-phase-slot-row'
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
            showDistanceCell: true,
            wireDistanceProbeCell,
            refreshDistCellIdle: applyDistCellIdleState,
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

        if (showHeroBg) {
          applyHeroAccent(nameEl, heroBg)
        }

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
          /** @type {HTMLElement[]} */
          const leadButtons = []
          if (isGmSync()) {
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
            leadButtons.push(infoHit)
          }
          if (isGmSync() || canEdit) {
            const gearHero = document.createElement('button')
            gearHero.type = 'button'
            gearHero.className = 'init-row-extra-gear'
            gearHero.innerHTML = KAMPF_GEAR_ICON_SVG
            gearHero.title = isGmSync()
              ? 'Helden-Einstellungen (Spielleitung)'
              : 'Mein Held: Heldenfarbe'
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

        const phaseNameCol = document.createElement('div')
        phaseNameCol.className = 'init-row-name-col'
        const nameEl = document.createElement('span')
        nameEl.className = 'init-row-name'
        if (!lhPending && canEdit) {
          nameEl.classList.add('init-row-name--drag-ini')
          nameEl.draggable = true
        }
        nameEl.textContent = ownerName
        nameEl.title = lhPending
          ? `L.H. (${lhProgressLabel ?? '?/?'}) — Fortschritt · ${ownerName}`
          : `2. Aktionsphase · Ziel-INI am Lineal ziehen · ${ownerName}`
        phaseNameCol.appendChild(nameEl)

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

        const { iniTailCol } = mountPhaseIniTail(iniInput, offsetDisplay)

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
          phaseNameCol,
          lhCol,
          iniTailCol,
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
        let showOwnerHeroBg = false
        /** @type {string | null} */
        let ownerHeroBg = null
        if (isZaoRoot) {
          ownerHeroBg = readHeroBgColor(ownerTrackerMeta)
          const ownerCanEdit = canEdit
          showOwnerHeroBg =
            Boolean(ownerHeroBg) &&
            (ownerCanEdit || !getHideForeignHeroColorsForViewer())
        }
        const isLhEndLink = isZaoRoot && link.lhEnd === true
        const isHeroExtraZao = isZaoRoot && Boolean(link.heroExtra)
        const ownerPhasesNorm = normalizePhases(ownerTrackerMeta?.phases)
        // Einheitliche Nummerierung über alle Wurzel-Typen (regulär + z.AT):
        // Mutter = 1, erste Zusatz-Zeile (höchste Ziel-INI) = 2, usw.
        const zaoOrderedRootIds = isZaoRoot
          ? orderedAllZaoRootIdsForBadge(
              ownerTrackerMeta,
              ownerPhasesNorm,
              ownerIniStr,
              visibilityCtx,
              ownerId
            )
          : null
        const zaoPhaseNum =
          isZaoRoot && zaoOrderedRootIds
            ? (() => {
                const ix = zaoOrderedRootIds.indexOf(link.id)
                return ix >= 0 ? ix + 2 : 2
              })()
            : 2
        const zaoSlot = isZaoRoot
          ? readZaoSlot(ownerTrackerMeta || {}, link.id) ||
            (isLhEndLink
              ? { kind: 'lh', marks: 1 }
              : !isHeroExtraZao
                ? defaultZaoSlotForPhaseNum(zaoPhaseNum)
                : null)
          : null
        if (
          canEdit &&
          isZaoRoot &&
          !isLhEndLink &&
          !isHeroExtraZao &&
          !readZaoSlot(ownerTrackerMeta || {}, link.id)
        ) {
          void patchEnsureZaoSlotForLink(ownerId, link.id, zaoPhaseNum)
        }

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
        if (isZaoRoot && zaoSlot) {
          zaoOverrideKind = readEffectiveZaoSlotKind(zaoSlot)
        }
        
        if (isHeroExtraZao) {
          zaoTextReplacement.textContent = ''
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
                  hideFa: true,
                  hideLh: true,
                  abwMirrorLinkUi: true,
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
                  hideFa: true,
                  hideLh: true,
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
                hideFa: true,
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

        let phaseNameCol = null
        /** @type {HTMLSpanElement | null} */
        let zaoIniDragNameEl = null
        if (isZaoRoot) {
          phaseNameCol = document.createElement('div')
          phaseNameCol.className = 'init-row-name-col'
          const nameEl = document.createElement('span')
          nameEl.className = 'init-row-name'
          if (canEdit) {
            nameEl.classList.add('init-row-name--drag-ini')
            nameEl.draggable = true
          }
          nameEl.textContent = ownerName
          nameEl.title = `${zaoPhaseNum}. Aktionsphase · ${ownerName}`
          zaoIniDragNameEl = nameEl
          phaseNameCol.appendChild(nameEl)
        } else {
          phaseNameCol = document.createElement('div')
          phaseNameCol.className =
            'init-row-name-col init-row-name-col--phase-link'
          const spine = document.createElement('div')
          spine.className = 'phase-spine'
          phaseNameCol.appendChild(spine)
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

        const { iniTailCol } = mountPhaseIniTail(
          iniInput,
          String(link.offset)
        )

        if (isZaoRoot && showOwnerHeroBg && zaoIniDragNameEl && ownerHeroBg) {
          applyHeroAccent(zaoIniDragNameEl, ownerHeroBg)
        }

        const swapSpacer = document.createElement('div')
        swapSpacer.className = 'init-col-swap init-col-swap--phase'
        swapSpacer.setAttribute('aria-hidden', 'true')

        const zaoSwapCol = document.createElement('div')
        zaoSwapCol.className = 'init-col-swap'

        const phaseExpandCell = createInitExpandSpacerCell()
        if (isZaoRoot && zaoBadgeUi && Number.isFinite(zaoBadgeUi.badgeNumber)) {
          mountExpandColActionCount(phaseExpandCell, zaoBadgeUi.badgeNumber, {
            minCount: 1,
            variant: 'child',
            title: zaoBadgeUi.title || `${zaoPhaseNum}. Aktionsphase`,
          })
        }
        if (isZaoRoot) {
          main.append(
            phaseExpandCell,
            btnCol,
            phaseNameCol,
            lhCol,
            iniTailCol,
            zaoSwapCol
          )
        } else {
          main.append(
            phaseExpandCell,
            btnCol,
            phaseNameCol,
            lhCol,
            iniTailCol,
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

    const shouldRestoreScroll =
      listScrollEl && savedListScrollTop != null
    if (shouldRestoreScroll) {
      listScrollEl.scrollTop = savedListScrollTop
    }

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
      const turnKey = `${cNow.roundIntroPending ? 'i' : 'z'}\0${cNow.currentItemId ?? ''}\0${cNow.currentPhaseLinkId ?? ''}\0${cNow.currentTurnSubStep ?? ''}\0${cNow.round}`
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

    if (shouldRestoreScroll) {
      listScrollEl.scrollTop = savedListScrollTop
    }
    syncListScrollHeight()
    runSwapLayout()

    requestAnimationFrame(() => {
      syncListScrollHeight()
      runSwapLayout()
      requestAnimationFrame(() => {
        syncListScrollHeight()
        const didScroll = scrollActiveRowIfTurnChanged()
        if (!didScroll && shouldRestoreScroll) {
          listScrollEl.scrollTop = savedListScrollTop
        }
        runSwapLayout()
      })
    })
    if (typeof ResizeObserver !== 'undefined') {
      if (!swapLayoutRo) {
        swapLayoutRo = new ResizeObserver(onListLayoutResize)
        swapLayoutRo.observe(element)
        if (listContentRoot) swapLayoutRo.observe(listContentRoot)
        if (listScrollEl) swapLayoutRo.observe(listScrollEl)
        const appEl = document.querySelector('#app')
        const listSection = listScrollEl?.closest('.kampf-list-section')
        if (appEl) swapLayoutRo.observe(appEl)
        if (listSection) swapLayoutRo.observe(listSection)
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

    try {
      applyDistanceOverlay()
    } catch (err) {
      console.error('[vierpunkteins] applyDistanceOverlay failed', err)
    }

    if (distanceProbeItemId) {
      scheduleDistanceProbeRefresh({
        redrawRings: !isProbeMapDragActive(),
        syncLine: false,
      })
    }

    onListChange?.(items)

    const hzOpen = hitZoneOverlay.getOpenItemId()
    if (hzOpen) hitZoneOverlay.syncFromItems(items)
  }

  const safeRenderList = (items) => {
    if (distanceProbeItemId) {
      scheduleDistanceProbeRefresh({
        redrawRings: !isProbeMapDragActive(),
        syncLine: false,
      })
    }
    void renderList(items).catch((err) => {
      console.error('[vierpunkteins] renderList failed', err)
      if (err instanceof Error && err.stack) {
        console.error(err.stack)
      }
    })
  }

  OBR.scene.items.getItems().then(safeRenderList)
  OBR.scene.items.onChange(safeRenderList)
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
      safeRenderList(fresh)
    })()
  })
  onIniTieOrderChange(() => safeRenderList(lastItems))
  const offZaoTie = onZaoRootTieOrderChange(() => safeRenderList(lastItems))
  const offFullIniTie = onFullIniTieOrderChange(() => safeRenderList(lastItems))
  const offManualOverrides = onManualIniTieOverridesChange(() =>
    safeRenderList(lastItems)
  )
  const offRoomSettings = onRoomSettingsChange(() => {
    if (!heroSettingsBackdrop.hidden) syncHeroSettingsCheckboxes()
    void OBR.scene.items.getItems().then(safeRenderList)
  })
  const offStampPref = onShowActionStampsChange(() => {
    void OBR.scene.items.getItems().then(safeRenderList)
  })
  const offForeignHeroPref = onHideForeignHeroColorsForViewerChange(() => {
    void OBR.scene.items.getItems().then(safeRenderList)
  })
  const offPlayer = OBR.player.onChange(() => {
    if (!isGmSync()) closeHeroSettings()
    void OBR.scene.items.getItems().then(safeRenderList)
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
    window.removeEventListener('resize', onWindowResize)
    swapLayoutRo?.disconnect()
    swapLayoutRo = null
    detachGlobalDragListeners()
    swapOverlay.remove()
    iniFloat.remove()
    document.removeEventListener(
      'visibilitychange',
      onDistanceProbeVisibilityChange
    )
    window.removeEventListener('pagehide', onDistanceProbePanelHide)
    offActionOpenChange()
    clearDistanceProbeForPanelHide()
  }
}
