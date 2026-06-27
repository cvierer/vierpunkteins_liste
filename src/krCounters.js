import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem, isGmSync } from './editAccess.js'
import {
  notifyKrSlotKindPatched,
  runWithKrSlotPatchSuppressed,
} from './krSlotPatchGate.js'
import {
  getTokenListDisplayName,
  TRACKER_ITEM_META_KEY,
} from './participants.js'
import {
  ACTION_STAMPS_KEY,
  getCombat,
  normalizeActionStamps,
  patchActionStamps,
} from './combatRoom.js'
import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'
import {
  canCreateSecondActionRoot,
  ensureExtraAttackPhaseRoot,
  finalizePhasesWithOrderedRoots,
  hookIniForLink,
  nextChainedZaoParentForTransfer,
  normalizePhases,
  sortedLinksForLayout,
} from './phaseLinks.js'
import {
  clearLhTrackerActivity,
  LH_COMMIT_INI,
  LH_DONE_INI,
  LH_DONE_ROUND,
  LH_KR_FIRED_MASK,
  LH_KR_FIRED_ROUND,
  LH_MAX,
  LH_REM,
  isLhActive,
  isLhLockingActions,
  phaseOffsetFromHeroExtraAngMeta,
  phaseOffsetFromHeroSecondAoMeta,
  phaseOffsetFromLhMeta,
  readLhState,
} from './lhMeta.js'
import { faMaxForInitiative, getRoomSettings } from './roomSettings.js'
export * from './krMetaKeys.js'
export { normalizeKrDigit } from './krDigit.js'
export * from './krStampPredicates.js'
import { motherPrimarySelfStamped } from './krStampPredicates.js'
export * from './krCounterRead.js'
export * from './krPrimaryField.js'
export * from './krIniLock.js'
import {
  applyIniLockCharges,
  ensureFullFreeActionQuota,
  isHeroIniBelowZero,
} from './krIniLock.js'
export * from './krActionPool.js'
export * from './krTransferMarks.js'
import {
  addOneAbwTransferChargeValue,
  krTransferMarkPresent,
} from './krTransferMarks.js'
export * from './krZaoSlots.js'
import {
  applyUoDefaultAbwChargeIfNeeded,
  defaultZaoSlotForPhaseNum,
  hasChargedRegularZaoAng,
  metaHasPendingLoadedNonHeroExtraZao,
  readEffectiveZaoSlotKind,
  readZaoSlot,
  readZaoSlots,
  syncReactionShieldForDualAng,
} from './krZaoSlots.js'
import {
  effectiveHeroPoolSplit,
  readHeroActionPoolMax,
  readHeroActionPoolPair,
  readKrActionPoolRem,
  readKrActionPoolRemFromStoredOrCfgPair,
} from './krActionPool.js'
import {
  KR_PAIR_MODE_VALID,
  krPairModeFieldForSlot,
  primaryFieldForKind,
  readKrFirstSlotKind,
  readKrPrimaryLadung,
  syncKrPrimaryLadungFromPrimaryField,
} from './krPrimaryField.js'
import {
  migrateHeroExtraCountFields,
  paradeExtraFieldForIndex,
  paradeExtraIndexForField,
  readHeroExtraAngCount,
  readHeroExtraParCount,
  readHeroFaMax,
  readHeroIniNegAngMode,
  readKrLhSecondCharge,
} from './krCounterRead.js'
import {
  normalizeKrDigit,
  marksFromChargeValue,
  chargeValueFromMarks,
  addOneChargeValue,
  consumeOneChargeValue,
} from './krDigit.js'
import {
  KR_ANG,
  KR_ABW,
  KR_MOTHER_PRIMARY_USED_THIS_ROUND,
  KR_PARADE_EXTRA,
  KR_SRA,
  KR_PAIR_MODE,
  KR_FIRST_SLOT_KIND,
  KR_PRIMARY_LADUNG,
  KR_LH_SECOND,
  KR_LH_ACTION,
  KR_FREE_ACTION,
  KR_LH_VOID_BY_TRANSFER,
  KR_PRIMARY_VOID_BY_ABW_TRANSFER,
  KR_INI_LOCK_MINUS_A,
  KR_INI_LOCK_MINUS_B,
  HERO_EXTRA_MAX,
  LEGACY_KR_ACTION,
  KR_ZAO_SLOTS,
  KR_ACTION_POOL_ANG_REM,
  KR_ACTION_POOL_ABW_REM,
  KR_INI_NEG_POOL_SHIFT_APPLIED,
  KR_COUNTER_MAX,
  DEFAULT_TRACKER_KR_COUNTERS,
} from './krMetaKeys.js'

/**
 * Aktive Kampfrunde fuer das `isLhLockingActions`-Praedikat. Liefert die
 * aktuelle KR, wenn der Kampf laeuft — sonst `null`. Ohne gueltige Runde
 * faellt `isLhLockingActions` defensiv auf das alte Sperr-Verhalten zurueck.
 *
 * @returns {number | null}
 */
function lhLockRoundFromCombat() {
  const c = getCombat()
  if (!c.started) return null
  return Number.isFinite(c.round) ? c.round : null
}

/**
 * Nach INI < 0 war die Mutter-Aktion oft auf S.R.A. migriert (`sra_ang`).
 * Beim Zurückkehren zu INI >= 0 und Neuaufbau der Ladungen muss der Paarmodus
 * wieder dem KR-Standard entsprechen — sonst bleiben Hilfs-Zähler inkonsistent
 * und "Nächste Aktion" / Umwandlung können einen leeren Primärslot erzeugen.
 *
 * @param {Record<string, unknown>} m
 */
function resetMotherPrimarySlotAfterIniRecoveryFromNegative(m) {
  if (!m || typeof m !== 'object') return
  m[KR_FIRST_SLOT_KIND] = 'ang'
  m[KR_PAIR_MODE] = 'ang_abw'
  m[KR_ANG] = 1
  m[KR_SRA] = 1
  m[KR_LH_ACTION] = 1
  delete m[KR_LH_SECOND]
  delete m[KR_LH_VOID_BY_TRANSFER]
  delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
}

/**
 * Bei INI-Zeichenwechsel über die Null: REM verschieben; beim Verlassen der
 * negativen INI Mutter-Slot und Visuals an positiven Split anbinden.
 *
 * @param {Record<string, unknown>} m
 * @param {boolean} iniWasBelowZero
 * @param {boolean} iniNowBelowZero
 */
export function applyIniNegativePoolShiftForMetaMutation(
  m,
  iniWasBelowZero,
  iniNowBelowZero
) {
  if (!m || typeof m !== 'object') return
  if (iniWasBelowZero === iniNowBelowZero) return
  const S = readHeroActionPoolMax(m)
  const cfg = readHeroActionPoolPair(m)
  const rem = readKrActionPoolRemFromStoredOrCfgPair(m)

  if (iniNowBelowZero) {
    if (cfg.ang < 1) return
    const prevAng = rem.ang
    const ang = Math.max(0, rem.ang - 1)
    m[KR_ACTION_POOL_ANG_REM] = ang
    m[KR_ACTION_POOL_ABW_REM] = S - ang
    if (prevAng > 0) m[KR_INI_NEG_POOL_SHIFT_APPLIED] = 1
    else delete m[KR_INI_NEG_POOL_SHIFT_APPLIED]
    return
  }

  // INI wieder >= 0: REM und ggf. Schilde/Aktionsobjekte an positiven Split anbinden
  // (m.initiative wurde vom Aufrufer bereits gesetzt).
  const splitPos = effectiveHeroPoolSplit(m)
  m[KR_ACTION_POOL_ANG_REM] = splitPos.ang
  m[KR_ACTION_POOL_ABW_REM] = splitPos.abw
  delete m[KR_INI_NEG_POOL_SHIFT_APPLIED]

  if (!getCombat().started) return

  const lhMaxActive = Math.max(0, Math.floor(Number(m[LH_MAX])) || 0) > 0
  if (!lhMaxActive) {
    resetMotherPrimarySlotAfterIniRecoveryFromNegative(m)
    rebuildKrActionPoolVisualsFromAngAbw(m, splitPos.ang, splitPos.abw)
  }
}

/**
 * Merkt, dass diese KR mit INI&lt;0-Umverteilung geladen wurde (REM + ggf. Visuals).
 *
 * @param {Record<string, unknown>} m
 */
function setIniNegPoolShiftAppliedFlagIfNegativeShift(m) {
  const cfg = readHeroActionPoolPair(m)
  const eff = effectiveHeroPoolSplit(m)
  if (isHeroIniBelowZero(m) && cfg.ang >= 1 && eff.ang < cfg.ang) {
    m[KR_INI_NEG_POOL_SHIFT_APPLIED] = 1
  }
}

/**
 * Baut Schilde und Aktionsobjekte aus fester ang/abw-Aufteilung (ohne REM).
 *
 * @param {Record<string, unknown>} m
 * @param {number} ang
 * @param {number} abw
 */
export function rebuildKrActionPoolVisualsFromAngAbw(m, ang, abw) {
  if (!m || typeof m !== 'object') return

  // --- Reaktionsschilde aus Abw.-Budget ---
  m[KR_ABW] = chargeValueFromMarks(abw)

  // --- Aktionsobjekte aus Ang.-Budget ---
  // 1. Vorhandene nicht-heroExtra ZAO-Links/-Slots aus der Vorrunde entfernen.
  const p = normalizePhases(m.phases)
  const nonHeroExtraIds = new Set(
    p.links
      .filter((l) => l.parentId === null && !l.heroExtra)
      .map((l) => l.id)
  )
  const slots = readZaoSlots(m)
  for (const id of nonHeroExtraIds) {
    delete slots[id]
  }
  m[KR_ZAO_SLOTS] = slots
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...p,
    links: p.links.filter((l) => !(l.parentId === null && !l.heroExtra)),
  })

  // 2. Mutter-Ladung setzen (ang >= 1).
  delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
  delete m[KR_LH_VOID_BY_TRANSFER]
  const field = primaryFieldForKind(m)
  if (ang >= 1) {
    m[field] = chargeValueFromMarks(1)
    syncKrPrimaryLadungFromPrimaryField(m)
  } else {
    m[field] = chargeValueFromMarks(0)
    syncKrPrimaryLadungFromPrimaryField(m)
  }

  // 3. Mindestens eine 2.AO-Wurzel (UO) ab ang >= 1; weitere nur bei ang > 1.
  if (ang >= 1) {
    const iniStr = m?.initiative
    const phaseOffset = phaseOffsetFromHeroSecondAoMeta(m)
    const p2 = normalizePhases(m.phases)
    const newSlots = readZaoSlots(m)
    if (typeof iniStr === 'string') {
      let phasesAcc = { ...p2, links: [...p2.links], rowPanelOpen: true }
      let lodgedUoAssigned = 0
      for (let i = 1; i < Math.max(ang, 2); i++) {
        phasesAcc = finalizePhasesWithOrderedRoots(m, phasesAcc)
        const next = nextChainedZaoParentForTransfer(
          iniStr,
          phasesAcc,
          phaseOffset
        )
        if (!next) break
        const newLinkId = crypto.randomUUID()
        phasesAcc = {
          ...phasesAcc,
          links: [
            ...phasesAcc.links,
            {
              id: newLinkId,
              parentId: next.parentId,
              offset: next.offset,
            },
          ],
        }
        const phaseNum = i + 1
        let slot = defaultZaoSlotForPhaseNum(phaseNum)
        if (slot.kind === 'uo' && slot.lodgedAbw && lodgedUoAssigned >= abw) {
          slot = { kind: 'uo', marks: 0 }
        } else if (slot.kind === 'uo' && slot.lodgedAbw) {
          lodgedUoAssigned++
        }
        newSlots[newLinkId] = slot
      }
      phasesAcc = finalizePhasesWithOrderedRoots(m, {
        ...phasesAcc,
        rowPanelOpen: true,
      })
      if (phasesAcc.links.length > p2.links.length) {
        m.phases = { ...phasesAcc, rowPanelOpen: true }
        m[KR_ZAO_SLOTS] = newSlots
      }
    }
  }
}

/**
 * Setzt die Laufzeit-Pools auf die SL-konfigurierten Werte (neue KR / SL-Änderung)
 * und befüllt beim Rundenstart automatisch Aktionsobjekte und Reaktionsschilde
 * entsprechend der Ang./Abw.-Aufteilung des Budgets.
 *
 * @param {Record<string, unknown>} m
 * @param {{ skipActionInit?: boolean }} [opts]
 *   skipActionInit: true = Aktionsobjekte / Schilde NICHT neu aufbauen (z. B. bei
 *   laufender L.H., wo Mutter-Ladung und ZAO-Slots separat verwaltet werden).
 */
export function initKrActionPoolsFromHeroDefaults(m, { skipActionInit = false } = {}) {
  if (!m || typeof m !== 'object') return
  delete m[KR_INI_NEG_POOL_SHIFT_APPLIED]
  const { ang, abw } = effectiveHeroPoolSplit(m)
  m[KR_ACTION_POOL_ANG_REM] = ang
  m[KR_ACTION_POOL_ABW_REM] = abw

  if (skipActionInit) {
    setIniNegPoolShiftAppliedFlagIfNegativeShift(m)
    return
  }

  rebuildKrActionPoolVisualsFromAngAbw(m, ang, abw)
  setIniNegPoolShiftAppliedFlagIfNegativeShift(m)
}

/**
 * Stellt nach einem L.H.-Ende/-Reset MITTEN in der KR die regulaere 2.AO-Wurzel
 * des Helden wieder her, falls sie fehlt oder im falschen Zustand ist.
 *
 * Hintergrund: Regulaere 2.AO-Wurzeln sind ephemer (`expiresNextRound`) und
 * werden beim KR-Wechsel ueber `clearEphemeralExtraIniRows` entfernt. Waehrend
 * einer laufenden L.H. baut `resetAllKrCountersInScene` (mit `skipActionInit`)
 * sie NICHT neu auf. Endet/resettet die L.H. dann mitten in der KR (z. B. per
 * Vorbei-Navigieren ueber das End-INI oder per Abschluss-Stempel), fehlt die
 * normale 2.AO-Wurzel bis zum naechsten KR-Reset.
 *
 * Der Ziel-Slot ist `{kind:'uo', marks:0, lodgedAbw:true}` — exakt der
 * Kampfstart-Default (`defaultZaoSlotForPhaseNum`). Gleichzeitig wird via
 * `applyUoDefaultAbwChargeIfNeeded` eine Schildmarke in `KR_ABW` gebucht,
 * damit der Transfer (uo→ang) moeglich bleibt und die zwei Schilde wie zu
 * Kampfbeginn am Mutterobjekt erscheinen statt auf der 2.AO-Zeile.
 *
 * Idempotenz: Korrigiert nur wenn der Slot fehlt, `kind !== 'uo'` ist, oder
 * `lodgedAbw` fehlt — ein bereits gueltiger `uo/lodgedAbw`-Slot wird nicht
 * angetastet (keine doppelte Schildmarke).
 *
 * No-op, wenn bereits eine navigierbare regulaere Wurzel im Soll-Zustand
 * existiert, das Budget keine zweite Aktion hergibt oder die Ziel-INI negativ
 * waere. `heroExtra`- und `lhEnd`-Wurzeln bleiben unberuehrt; die neue Wurzel
 * ist wieder ephemer.
 *
 * @param {Record<string, unknown>} m
 * @returns {boolean} true, wenn eine Wurzel angelegt oder korrigiert wurde
 */
export function restoreRegularSecondActionRootAfterLh(m) {
  if (!m || typeof m !== 'object') return false
  const ownerIniStr = m.initiative
  if (typeof ownerIniStr !== 'string') return false
  const phaseOffset = phaseOffsetFromHeroSecondAoMeta(m)
  if (!canCreateSecondActionRoot(ownerIniStr, phaseOffset)) return false
  const { ang } = effectiveHeroPoolSplit(m)
  if (ang < 1) return false

  const p = normalizePhases(m.phases)
  const links = p.links
  const regularRoots = links.filter(
    (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
  )
  for (const r of regularRoots) {
    const hook = hookIniForLink(r.id, ownerIniStr, links)
    if (Number.isFinite(hook) && hook >= 0) {
      // Es existiert bereits eine navigierbare regulaere 2.AO-Wurzel.
      // Soll-Zustand: {kind:'uo', marks:0, lodgedAbw:true} — wie zu Kampfbeginn.
      // Nur korrigieren, wenn der Slot fehlt, kind !== 'uo', oder lodgedAbw
      // fehlt (Halbzustand). Ein bereits gueltiger uo/lodgedAbw-Slot wird
      // nicht angetastet (Idempotenz — keine doppelte Schildmarke).
      const slots = readZaoSlots(m)
      const existing = slots[r.id]
      const slotNeedsFix =
        !existing || existing.kind !== 'uo' || existing.lodgedAbw !== true
      if (slotNeedsFix) {
        const newSlot = { kind: 'uo', marks: 0, lodgedAbw: true }
        slots[r.id] = newSlot
        m[KR_ZAO_SLOTS] = slots
        applyUoDefaultAbwChargeIfNeeded(m, newSlot)
        return true
      }
      return false
    }
  }

  const newId = crypto.randomUUID()
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...p,
    rowPanelOpen: true,
    links: [
      ...links,
      { id: newId, parentId: null, offset: phaseOffset, expiresNextRound: true },
    ],
  })
  const slots = readZaoSlots(m)
  // Kampfstart-Default: leeres 2.AO mit eingelagertem Schild. Die zugehoerige
  // Schildmarke wird via applyUoDefaultAbwChargeIfNeeded in KR_ABW gebucht,
  // damit Transfer (uo->ang) moeglich ist und die Schilde am Mutterobjekt
  // erscheinen (marks:0 haelt den Spiegel isMirrorAbwUiActive inaktiv).
  const newSlot = { kind: 'uo', marks: 0, lodgedAbw: true }
  slots[newId] = newSlot
  m[KR_ZAO_SLOTS] = slots
  applyUoDefaultAbwChargeIfNeeded(m, newSlot)
  return true
}

/**
 * @param {unknown} meta
 * @returns {Record<string, { kind: 'ang'|'sra'|'lh'|'uo', marks: 0|1, lodgedAbw?: true }>}
 */
/**
 * Sperre „Abwehr → leeres Mutterfeld“, solange eine reguläre 2.A.-Ladung offen ist.
 * Beim UO-Ausstieg (`exitingUo`) gilt die Sperre nicht — die Ladung kommt aus dem Speicher.
 *
 * @param {unknown} meta
 * @param {{ exitingUo?: boolean }} [opts]
 * @returns {boolean}
 */
export function abwToPrimaryBlockedByPendingZao(meta, opts = {}) {
  const exitingUo = opts.exitingUo === true
  return (
    !exitingUo &&
    !isConvertAnytimeEnabled(meta) &&
    metaHasPendingLoadedNonHeroExtraZao(meta)
  )
}

/**
 * End-KR: Abwehr→Primär blockieren, solange eine reguläre 2.A.-Ladung offen ist.
 * UO-Ausstieg ist ausgenommen.
 *
 * @param {unknown} meta
 * @param {number | null | undefined} combatRound
 * @param {{ exitingUo?: boolean }} [opts]
 * @returns {boolean}
 */
export function abwToPrimaryBlockedByEndKrPendingZao(meta, combatRound, opts = {}) {
  const exitingUo = opts.exitingUo === true
  return (
    !exitingUo &&
    !isConvertAnytimeEnabled(meta) &&
    lhEndKrConvertMode(meta, combatRound) &&
    metaHasPendingLoadedNonHeroExtraZao(meta)
  )
}

/** Primär-Stempel am Mutteranker (kein Phasen-Link) — für Umwandlungs-Sperre. */
/**
 * KR, in der eine L.H. endet: Tracker noch aktiv, aber keine „mittendrin“-Sperre.
 *
 * @param {unknown} meta
 * @param {number | null | undefined} combatRound
 * @returns {boolean}
 */
export function lhEndKrConvertMode(meta, combatRound) {
  return isLhActive(meta) && !isLhLockingActions(meta, combatRound)
}

/** @param {unknown} meta */
function isConvertAnytimeEnabled(meta) {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (/** @type {{ convertAnytimeEnabled?: unknown }} */ (meta)
      .convertAnytimeEnabled === true ||
      /** @type {{ convertAllowEntireRound?: unknown }} */ (meta)
        .convertAllowEntireRound === true)
  )
}

/**
 * End-KR-Umwandlung: fixe L.H. am Mutterfeld vs. reguläre 2.A.-Kette — exklusive Pfeile.
 *
 * @param {unknown} meta
 * @param {number | null | undefined} combatRound
 * @returns {{ blockUpperLhMotherNoZao: boolean, blockLowerPendingZao: boolean }}
 */
export function lhEndKrConvertArrowGates(meta, combatRound) {
  if (isConvertAnytimeEnabled(meta)) {
    return { blockUpperLhMotherNoZao: false, blockLowerPendingZao: false }
  }
  if (!lhEndKrConvertMode(meta, combatRound)) {
    return { blockUpperLhMotherNoZao: false, blockLowerPendingZao: false }
  }
  const anyZao = metaHasPendingLoadedNonHeroExtraZao(meta)
  const firstKind = readKrFirstSlotKind(meta)
  return {
    blockUpperLhMotherNoZao: firstKind === 'lh' && !anyZao,
    blockLowerPendingZao: anyZao,
  }
}

/**
 * @param {string} itemId
 * @param {string} linkId
 * @param {{ kind?: 'ang'|'sra'|'lh'|'uo', marks?: 0|1, lodgedAbw?: boolean }} patch
 */
export async function patchZaoSlot(itemId, linkId, patch, opts = {}) {
  if (!opts.skipFetch) {
    const items = await OBR.scene.items.getItems([itemId])
    const item = items?.[0]
    if (!item || !canEditSceneItem(item)) return false
  }
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const slots = readZaoSlots(m)
      const prev = slots[linkId] || {
        kind: readKrFirstSlotKind(m),
        marks: 1,
      }
      const nextKind =
        patch.kind === 'ang' ||
        patch.kind === 'sra' ||
        patch.kind === 'lh' ||
        patch.kind === 'uo'
          ? patch.kind
          : prev.kind
      let nextMarks =
        patch.marks === 0 || patch.marks === 1 ? patch.marks : prev.marks
      if (nextKind === 'uo') {
        nextMarks = 0
      }
      let nextLodged =
        nextKind === 'uo'
          ? true
          : patch.lodgedAbw === true
            ? true
            : patch.lodgedAbw === false
              ? false
              : nextMarks === 1
                ? false
                : prev.lodgedAbw === true
      const next = /** @type {Record<string, unknown>} */ ({
        kind: nextKind,
        marks: nextMarks,
      })
      if (nextLodged) next.lodgedAbw = true
      slots[linkId] = /** @type {{ kind: 'ang'|'sra'|'lh'|'uo', marks: 0|1, lodgedAbw?: true }} */ (
        next
      )
      m[KR_ZAO_SLOTS] = slots
      syncReactionShieldForDualAng(m)
    }
  })
  return true
}

/**
 * @param {ReturnType<typeof normalizePhases>} phases
 * @returns {{ links: typeof phases.links, dropIds: Set<string> }}
 */
function linksWithoutHeroExtraRoots(phases) {
  const extraRoots = phases.links.filter(
    (l) => l.parentId === null && (l.heroExtra === 'ang' || l.heroExtra === 'par')
  )
  const dropIds = new Set(extraRoots.map((l) => l.id))
  return {
    links: phases.links.filter((l) => !dropIds.has(l.id)),
    dropIds,
  }
}

/**
 * Nach Kampfende (`resetAllTrackerStateForCombatStart` ohne restoreHeroExtraZat):
 * z.AT-Phasenwurzeln und zugehörige ZAO-Slots entfernen — Spieler holt sie
 * beim nächsten Kampfstart automatisch wieder (restoreHeroExtraZat) oder mid-
 * Kampf per rotes „+" (`patchRestoreHeroExtraZao`).
 *
 * @param {Record<string, unknown>} m Token-Tracker-Meta (Mutationsziel)
 */
function stripHeroExtraZatAfterCombatFullReset(m) {
  if (!m || typeof m !== 'object') return
  migrateHeroExtraCountFields(m)
  const phases = normalizePhases(m.phases)
  const { links } = linksWithoutHeroExtraRoots(phases)
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...phases,
    links,
    rowPanelOpen: false,
  })
}

/**
 * Helden-Einstellungs-Zusatzobjekt (z.AT):
 * - Pro **Kampfrunden**-Reset (nicht beim vollen Kampf-Start/-Ende-Reset oben)
 *   werden heroExtra-Wurzeln verworfen und aus den Helden-Einstellungen neu
 *   aufgebaut (Soll-Anzahl, stabile Offsets).
 * - Das Objekt trägt pro Wurzel eine stempelbare Ladung (`kind:'ang', marks:1`).
 *
 * @param {Record<string, unknown>} m Token-Tracker-Meta (Mutationsziel)
 */
function rebuildHeroExtraAttackRootAndSlot(m) {
  if (!m || typeof m !== 'object') return
  migrateHeroExtraCountFields(m)
  const wanted = readHeroExtraAngCount(m)
  const phases = normalizePhases(m.phases)
  const { links: linksBase, dropIds } = linksWithoutHeroExtraRoots(phases)
  let links = linksBase
  if (wanted > 0) {
    const off = Math.max(1, phaseOffsetFromHeroExtraAngMeta(m))
    for (let i = 0; i < wanted; i++) {
      links.push({
        id: crypto.randomUUID(),
        parentId: null,
        offset: off * (i + 1),
        heroExtra: 'ang',
        expiresNextRound: false,
      })
    }
  }
  m.phases = finalizePhasesWithOrderedRoots(m, { ...phases, links })
  const slots = readZaoSlots(m)
  for (const id of dropIds) delete slots[id]
  if (wanted > 0) {
    const roots = normalizePhases(m.phases).links.filter(
      (l) => l.parentId === null && l.heroExtra === 'ang'
    )
    for (const r of roots) slots[r.id] = { kind: 'ang', marks: 1 }
  }
  m[KR_ZAO_SLOTS] = slots
}

/**
 * Prüft, ob für das Token „Zusätzliche Angriffsaktion" in den Helden-
 * einstellungen aktiv ist, aktuell aber kein heroExtra-Wurzel-Link (ZAO)
 * mehr existiert – z. B. weil der Spieler das ZAO innerhalb der Runde per
 * X-Button geschlossen hat, ohne die Ladung zu stempeln. In diesem Zustand
 * soll die UI ein kleines rotes „+" am Mutter-Aktionsfeld anzeigen.
 *
 * @param {Record<string, unknown> | null | undefined} meta
 */
export function heroExtraZaoAvailableForRestore(meta) {
  if (!meta || typeof meta !== 'object') return false
  const wanted = readHeroExtraAngCount(meta)
  if (wanted <= 0) return false
  // Mutex-Schutz: Wenn das schwarze Schild dieser KR bereits gestempelt wurde,
  // ist die z.AT in dieser KR endgueltig vergeben — kein "+" mehr anbieten.
  if (meta.krExtraChoiceUsed === 'par') return false
  const phases = normalizePhases(meta.phases)
  const existing = phases.links.filter((l) => l.parentId === null && l.heroExtra === 'ang')
  return existing.length < wanted
}

/**
 * Erzeugt im Token-Meta `m` (Mutationsziel) eine frische heroExtra-'ang'-
 * Wurzel mit einer Ladung. Vorhandene heroExtra-Wurzeln + ihre Slots werden
 * vorher entfernt. No-op, wenn `heroExtraAng` nicht aktiv ist.
 *
 * Wiederverwendet von `patchRestoreHeroExtraZao` (manuelles "+") und vom
 * `undoKrActionStamp`-Pfad fuer das schwarze Schild (Mutex-Wiederherstellung).
 *
 * @param {Record<string, unknown>} m Token-Tracker-Meta (Mutationsziel)
 */
function restoreHeroExtraAttackInPlace(m) {
  if (!m || typeof m !== 'object') return
  migrateHeroExtraCountFields(m)
  const wanted = readHeroExtraAngCount(m)
  if (wanted <= 0) return
  const phases = normalizePhases(m.phases)
  const existingAngRoots = phases.links.filter(
    (l) => l.parentId === null && l.heroExtra === 'ang'
  )
  if (existingAngRoots.length >= wanted) return
  const off = Math.max(1, phaseOffsetFromHeroExtraAngMeta(m))
  const nextIndex = existingAngRoots.length + 1
  const links = [...phases.links]
  const newId = crypto.randomUUID()
  links.push({
    id: newId,
    parentId: null,
    offset: off * nextIndex,
    heroExtra: 'ang',
    expiresNextRound: false,
  })
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...phases,
    links,
    rowPanelOpen: true,
  })
  const slots = readZaoSlots(m)
  slots[newId] = { kind: 'ang', marks: 1 }
  m[KR_ZAO_SLOTS] = slots
}

/**
 * Stellt das zusätzliche Angriffsaktions-Objekt (ZAO) wieder her, falls es
 * innerhalb der Runde über den X-Button geschlossen wurde. Hat genau den
 * gleichen Effekt wie ein erneutes Öffnen + „Speichern und Beenden" in den
 * Helden-Einstellungen: ein frischer `heroExtra:'ang'`-Wurzel-Link bei
 * +4 INI mit einer Ladung.
 *
 * Erfordert, dass in den Token-Einstellungen `heroExtraAng === true` gesetzt
 * ist; andernfalls ist die Aktion ein No-op (die UI sollte das „+" in diesem
 * Fall ohnehin nicht anzeigen).
 *
 * @param {string} itemId
 */
export async function patchRestoreHeroExtraZao(itemId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta || readHeroExtraAngCount(meta) <= 0) return
  // Mutex-Schutz: Wenn der Held in dieser KR bereits das schwarze Schild
  // gestempelt hat, darf die z.AT-Wurzel NICHT wiederkehren.
  if (meta.krExtraChoiceUsed === 'par') return
  if (!heroExtraZaoAvailableForRestore(meta)) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      restoreHeroExtraAttackInPlace(m)
    }
  })
}

/**
 * `krFreeAction` zählt verbrauchte freie Aktionen (0 = volles Kontingent).
 * Explizit setzen, damit nach KR-/Kampf-Reset kein Altlast-Wert stehen bleibt.
 *
 * @param {Record<string, unknown>} m Token-Tracker-Meta (Mutationsziel)
 */
/**
 * @param {string} itemId
 * @param {import('./krPrimaryField.js').KrPairMode} mode
 */
export async function patchKrPairMode(itemId, mode) {
  if (!KR_PAIR_MODE_VALID.has(mode)) return
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (m) {
        m[KR_PAIR_MODE] = mode
        m[KR_FIRST_SLOT_KIND] =
          krPairModeFieldForSlot(mode, 0) === KR_SRA ? 'sra' : 'ang'
      }
    }
  })
}

/**
 * Mutter-Aktion tauschen (Ang ↔ SRA ↔ L.H.).
 *
 * Ladungs-Erhaltungsgesetz pro Token (Mutter-Ebene, **nur Zähler/Marks**):
 * Die sichtbare Primärladung (Marks auf dem neu gewählten Primärfeld) entspricht
 * der bisherigen Ladung auf dem alten Primärfeld — ohne doppelte Markierung.
 *
 * Umsetzung:
 * 1. Altes Primärfeld wird auf „leer" (1) zurückgesetzt — sonst bliebe dort
 *    eine unsichtbare Mark übrig und würde sich beim nächsten Tausch wieder
 *    „aufaddieren".
 * 2. Neues Primärfeld übernimmt die **selbe Anzahl Marks** (`newCounter =
 *    chargeValueFromMarks(oldMarks)`).
 * 3. **Mutter-Stempel** (Raum-Metadaten) werden **nicht** umgeschrieben: `field`
 *    bleibt die Aktion zum Zeitpunkt des Stempelns; ×/Undo bucht weiter über
 *    dieses Feld zurück.
 * 4. L.H.-Begleitfelder (`KR_LH_SECOND`, `KR_LH_VOID_BY_TRANSFER`) werden
 *    bereinigt bzw. initialisiert.
 *
 * ZAO-Slots (`KR_ZAO_SLOTS`) bleiben unverändert — jeder 2.A.O.-Slot hat
 * seine eigene `kind` und wird separat über den Slot-Tauscher umgeschaltet.
 *
 * @param {string} itemId
 * @param {'ang' | 'sra' | 'lh'} kind
 * @param {{ skipFetch?: boolean, metaSnapshot?: unknown }} [opts]
 * @returns {Promise<boolean>}
 */
export async function patchKrFirstSlotKind(itemId, kind, opts = {}) {
  if (kind !== 'ang' && kind !== 'sra' && kind !== 'lh') return false
  /** @type {Record<string, unknown>} */
  let meta = {}
  if (opts.metaSnapshot && typeof opts.metaSnapshot === 'object') {
    meta = /** @type {Record<string, unknown>} */ (opts.metaSnapshot)
  } else {
    const items = await OBR.scene.items.getItems([itemId])
    const item = items?.[0]
    if (!item || !canEditSceneItem(item)) return false
    meta =
      /** @type {Record<string, unknown>} */ (
        item?.metadata?.[TRACKER_ITEM_META_KEY] || {}
      )
  }
  const prevKind = readKrFirstSlotKind(meta || {})
  if (prevKind === kind) return false
  if (prevKind === 'uo') return false

  const oldPF = primaryFieldForKind(meta || {})
  const newPF =
    kind === 'sra' ? KR_SRA : kind === 'lh' ? KR_LH_ACTION : KR_ANG

  // Anzahl Marks auf der alten Primärseite ermitteln. L.H. hat Sonderlogik:
  // LH_ACTION=0 heißt geladen, aber nur wenn NICHT gerade per Transfer ins
  // Abwehr-Schild geleert (dann ist die Ladung woanders sichtbar, nicht in
  // der Primärbilanz).
  let oldMarks
  if (prevKind === 'lh') {
    const lhVal = normalizeKrDigit(meta?.[KR_LH_ACTION])
    const loaded = lhVal === 0 && !meta?.[KR_LH_VOID_BY_TRANSFER]
    oldMarks = loaded ? 1 : 0
  } else {
    oldMarks = marksFromChargeValue(normalizeKrDigit(meta?.[oldPF]))
  }
  const newCounter = chargeValueFromMarks(oldMarks)
  const pair = kind === 'sra' ? 'sra_ang' : 'ang_abw'

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_FIRST_SLOT_KIND] = kind
      m[KR_PAIR_MODE] = pair
      if (oldPF !== newPF) {
        if (oldPF === KR_LH_ACTION) {
          m[KR_LH_ACTION] = 1
          delete m[KR_LH_SECOND]
          delete m[KR_LH_VOID_BY_TRANSFER]
        } else {
          m[oldPF] = 1
        }
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
      }
      if (kind === 'lh') {
        m[KR_LH_ACTION] = newCounter
        m[KR_LH_SECOND] = 0
        delete m[KR_LH_VOID_BY_TRANSFER]
      } else {
        m[newPF] = newCounter
      }
      m[KR_PRIMARY_LADUNG] = newCounter
      if (kind === 'ang') {
        syncReactionShieldForDualAng(m)
      }
    }
  })
  return true
}

/** @param {'ang' | 'sra' | 'lh' | 'uo'} k */
export function nextKrPrimarySlotKind(k) {
  if (k === 'ang') return 'sra'
  if (k === 'sra') return 'lh'
  if (k === 'lh') return 'uo'
  return 'ang'
}

/** @param {'ang' | 'sra' | 'lh' | 'uo'} k */
export function prevKrPrimarySlotKind(k) {
  if (k === 'ang') return 'uo'
  if (k === 'sra') return 'ang'
  if (k === 'lh') return 'sra'
  return 'lh'
}

/**
 * Zyklus der Mutter-/ZAO-Primäraktion (AN → A → L.H. → UO → AN …).
 *
 * @param {'ang' | 'sra' | 'lh' | 'uo'} k
 * @param {'next' | 'prev'} dir
 * @param {boolean} [iniLocked]
 * @returns {'ang' | 'sra' | 'lh' | 'uo'}
 */
export function cycleKrPrimarySlotKind(k, dir, iniLocked = false) {
  let next =
    dir === 'next' ? nextKrPrimarySlotKind(k) : prevKrPrimarySlotKind(k)
  if (iniLocked && next === 'ang') {
    next =
      dir === 'next'
        ? nextKrPrimarySlotKind(next)
        : prevKrPrimarySlotKind(next)
  }
  return next
}

/**
 * Wie `cycleKrPrimarySlotKind`, überspringt zusätzlich UO wenn Umwandeln gesperrt.
 *
 * @param {'ang' | 'sra' | 'lh' | 'uo'} k
 * @param {'next' | 'prev'} dir
 * @param {{ iniLocked?: boolean, uoAllowed?: boolean }} [locks]
 * @returns {'ang' | 'sra' | 'lh' | 'uo'}
 */
export function cycleKrPrimarySlotKindRespectingLocks(k, dir, locks = {}) {
  const iniLocked = locks.iniLocked ?? false
  const uoAllowed = locks.uoAllowed !== false
  let next = cycleKrPrimarySlotKind(k, dir, iniLocked)
  if (!uoAllowed && next === 'uo') {
    next = cycleKrPrimarySlotKind(next, dir, iniLocked)
  }
  return next
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo'} startKind
 * @param {number} netSteps positiv = next, negativ = prev
 * @param {boolean} [iniLocked]
 * @returns {'ang' | 'sra' | 'lh' | 'uo'}
 */
export function advanceKrPrimarySlotKindSteps(startKind, netSteps, iniLocked = false) {
  const steps = Math.abs(Math.floor(netSteps))
  if (steps === 0) return startKind
  const dir = netSteps > 0 ? 'next' : 'prev'
  let k = startKind
  for (let i = 0; i < steps; i++) {
    k = cycleKrPrimarySlotKind(k, dir, iniLocked)
  }
  return k
}

/**
 * @param {unknown} meta
 * @param {string | null | undefined} [linkId]
 * @returns {'ang' | 'sra' | 'lh' | 'uo'}
 */
export function resolveKrPrimarySlotKind(meta, linkId = null) {
  const isZao = typeof linkId === 'string' && linkId.length > 0
  if (isZao) {
    return readEffectiveZaoSlotKind(readZaoSlot(meta, linkId))
  }
  return readKrFirstSlotKind(meta)
}

/**
 * @param {unknown} meta
 * @param {string | null | undefined} [linkId]
 */
export function isKrPrimarySlotIniLocked(meta, linkId = null) {
  const isZao = typeof linkId === 'string' && linkId.length > 0
  return (
    !isZao &&
    isHeroIniBelowZero(meta) &&
    readHeroIniNegAngMode(meta) !== 'yes'
  )
}

/**
 * Primär-Aktionsmodus per Pfeil schalten — liest den Slot-Typ frisch aus der Szene.
 *
 * @param {string} itemId
 * @param {'next' | 'prev'} dir
 * @param {{ linkId?: string | null, uoAllowed?: boolean }} [opts]
 * @returns {Promise<{ applied: boolean, kind: 'ang' | 'sra' | 'lh' | 'uo', prevKind: 'ang' | 'sra' | 'lh' | 'uo', nextKind: 'ang' | 'sra' | 'lh' | 'uo' } | null>}
 */
export async function patchKrStepPrimarySlotKind(itemId, dir, opts = {}) {
  if (dir !== 'next' && dir !== 'prev') return null
  return runWithKrSlotPatchSuppressed(async () => {
    const linkId = opts.linkId ?? null
    const motherEndBypass = Boolean(opts.motherEndBypass)
    // Bei Mutter-Ende-Bypass: uo immer erlaubt, da kein Shield-Transfer noetig.
    const uoAllowed = motherEndBypass || opts.uoAllowed !== false
    const patchOpts =
      typeof linkId === 'string' && linkId.length > 0 ? { linkId } : {}

    const items = await OBR.scene.items.getItems([itemId])
    const item = items?.[0]
    if (!item || !canEditSceneItem(item)) return null
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) return null

    const prevKind = resolveKrPrimarySlotKind(meta, linkId)
    const iniLocked = isKrPrimarySlotIniLocked(meta, linkId)
    const nextKind = cycleKrPrimarySlotKindRespectingLocks(prevKind, dir, {
      iniLocked,
      uoAllowed,
    })
    if (prevKind === nextKind) {
      return { applied: false, kind: prevKind, prevKind, nextKind }
    }

    const applied = await patchKrCyclePrimarySlotKind(itemId, nextKind, {
      ...patchOpts,
      preloadedItem: item,
      motherEndBypass,
    })
    if (!applied) {
      return { applied: false, kind: prevKind, prevKind, nextKind }
    }

    notifyKrSlotKindPatched(itemId, linkId, nextKind)
    return {
      applied: true,
      kind: nextKind,
      prevKind,
      nextKind,
    }
  })
}

/**
 * Primär-Aktionsmodus zyklisch wechseln inkl. UO (Umwandel-Objekt).
 *
 * @param {string} itemId
 * @param {'ang' | 'sra' | 'lh' | 'uo'} nextKind
 * @param {{
 *   linkId?: string | null,
 *   preloadedItem?: import('@owlbear-rodeo/sdk').Item | null,
 *   motherEndBypass?: boolean,
 * }} [opts]
 * @returns {Promise<boolean>}
 */
export async function patchKrCyclePrimarySlotKind(itemId, nextKind, opts = {}) {
  if (
    nextKind !== 'ang' &&
    nextKind !== 'sra' &&
    nextKind !== 'lh' &&
    nextKind !== 'uo'
  ) {
    return false
  }
  const linkId = opts.linkId ?? null
  const isZao = typeof linkId === 'string' && linkId.length > 0
  // Bei L.H.-Mutter-Ende-2.AO: Umwandel-Transfer-Logik umgehen (keine Shield-
  // Marks vorhanden), direkt den Slot schreiben. Alle 4 Kinds sind erreichbar.
  const motherEndBypass = Boolean(opts.motherEndBypass) && isZao

  let item = opts.preloadedItem ?? null
  if (!item) {
    const items = await OBR.scene.items.getItems([itemId])
    item = items?.[0] ?? null
  }
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false

  if (isZao) {
    const slot = readZaoSlot(meta, linkId)
    const prev = readEffectiveZaoSlotKind(slot)
    if (prev === nextKind) return false

    if (motherEndBypass) {
      // Direkt schreiben: keine Shield-Transfer-Marks noetig.
      // patchZaoSlot wuerde fuer kind='uo' immer lodgedAbw:true erzwingen;
      // hier schreiben wir direkt (lodgedAbw:false = freies Leer-Objekt, nicht
      // eingelagerte Abwehr-Ladung).
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const d of drafts) {
          const m = d.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const slots = readZaoSlots(m)
          if (nextKind === 'uo') {
            slots[linkId] = { kind: 'uo', marks: 0 }
          } else {
            slots[linkId] = { kind: nextKind, marks: 1 }
          }
          m[KR_ZAO_SLOTS] = slots
        }
      })
      return true
    }

    if (nextKind === 'uo') {
      await patchKrTransferZaoPrimaryToAbw(itemId, linkId)
      return true
    }
    if (prev === 'uo') {
      await patchKrTransferAbwToZaoPrimary(itemId, linkId, nextKind)
      return true
    }
    return patchZaoSlot(itemId, linkId, { kind: nextKind }, { skipFetch: true })
  }

  const prev = readKrFirstSlotKind(meta)
  if (prev === nextKind) return false

  if (nextKind === 'uo') {
    const transferred = await patchKrTransferPrimaryToAbw(itemId)
    if (transferred) return true
    return false
  }
  if (prev === 'uo') {
    const transferred = await patchKrTransferAbwToPrimary(itemId, nextKind)
    if (transferred) return true
    const abw = normalizeKrDigit(meta[KR_ABW])
    if (
      !krTransferMarkPresent(abw) &&
      !motherHasTransferablePrimaryCharge(meta)
    ) {
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const d of drafts) {
          const m = d.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          m[KR_FIRST_SLOT_KIND] = nextKind
          delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
          if (nextKind === 'lh') {
            m[KR_LH_ACTION] = 1
            m[KR_LH_SECOND] = 0
            delete m[KR_LH_VOID_BY_TRANSFER]
          } else if (nextKind === 'sra') {
            m[KR_PAIR_MODE] = 'sra_ang'
            m[KR_ANG] = 1
            m[KR_SRA] = 1
          } else {
            m[KR_PAIR_MODE] = 'ang_abw'
            m[KR_ANG] = 1
          }
          syncKrPrimaryLadungFromPrimaryField(m)
          if (nextKind === 'ang') {
            syncReactionShieldForDualAng(m)
          }
        }
      })
      return true
    }
    return false
  }
  return patchKrFirstSlotKind(itemId, nextKind, { metaSnapshot: meta })
}

/**
 * Legt fehlenden ZAO-Slot-Metadaten-Eintrag an (z. B. nach neuem Phasen-Link).
 *
 * @param {string} itemId
 * @param {string} linkId
 * @param {number} phaseNum Mutter = 1, erste Wurzel = 2, …
 */
export async function patchEnsureZaoSlotForLink(itemId, linkId, phaseNum) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const s = readZaoSlots(m)
      if (s[linkId]) continue
      const slot = defaultZaoSlotForPhaseNum(phaseNum)
      s[linkId] = slot
      m[KR_ZAO_SLOTS] = s
      const p = normalizePhases(m.phases)
      if (p.links.length > 0) {
        m.phases = finalizePhasesWithOrderedRoots(m, {
          ...p,
          rowPanelOpen: true,
        })
      }
    }
  })
}

/**
 * Primärladung → Abwehr-Schild.
 * Ladungs-Erhaltungsgesetz: 1 Ladung pro Objekt. Beim Umwandeln von der
 * **Mutter** zuerst die Mutter-Ladung — reguläre 2.AO-Zeilen bleiben erhalten.
 * Nur wenn die Mutter leer ist, wird die Ladung aus dem letzten geladenen
 * 2.A.-Slot geholt (und dieser entfernt). Gilt für Ang., S.R.A. und L.H.
 */
/**
 * Primär-Ladung stempelbar (nutzt `readKrPrimaryLadung`, nicht nur `meta[field]`).
 *
 * @param {unknown} meta
 */
export function primaryChargeStampEligible(meta) {
  if (!meta || typeof meta !== 'object') return false
  const firstKind = readKrFirstSlotKind(meta)
  if (firstKind === 'uo') return false
  if (firstKind === 'lh') {
    if (isLhActive(meta)) return false
    const lh = normalizeKrDigit(meta[KR_LH_ACTION])
    return lh === 0 && !meta[KR_LH_VOID_BY_TRANSFER]
  }
  return krTransferMarkPresent(normalizeKrDigit(readKrPrimaryLadung(meta)))
}

export function motherHasTransferablePrimaryCharge(meta) {
  return primaryChargeStampEligible(meta)
}

/** @param {unknown} meta @param {string} field @param {number} maxDigit */
function krCounterCurForField(meta, field, maxDigit) {
  if (!meta || typeof meta !== 'object') {
    return normalizeKrDigit(undefined, maxDigit)
  }
  const pf = primaryFieldForKind(meta)
  const isPrimaryField =
    field === pf ||
    field === KR_ANG ||
    field === KR_SRA ||
    field === KR_LH_ACTION
  if (isPrimaryField) {
    return normalizeKrDigit(readKrPrimaryLadung(meta))
  }
  return normalizeKrDigit(meta[field], maxDigit)
}

export async function patchKrTransferPrimaryToAbw(itemId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return false
  const abw = normalizeKrDigit(meta[KR_ABW])

  {
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    if (motherPrimarySelfStamped(stamps.entries, itemId)) return false
  }

  if (motherHasTransferablePrimaryCharge(meta)) {
    const firstKind = readKrFirstSlotKind(meta)
    const field = primaryFieldForKind(meta)
    const nextAbw = addOneAbwTransferChargeValue(abw)
    if (nextAbw === abw) return false

    if (firstKind === 'lh') {
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const d of drafts) {
          const m = d.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          m[KR_ABW] = nextAbw
          m[KR_LH_ACTION] = 1
          m[KR_LH_SECOND] = 0
          m[KR_LH_VOID_BY_TRANSFER] = true
          m[KR_FIRST_SLOT_KIND] = 'uo'
          delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
          syncKrPrimaryLadungFromPrimaryField(m)
        }
      })
      return true
    }
    const primary = normalizeKrDigit(meta[field])
    const nextPrimary = consumeOneChargeValue(primary)
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        m[field] = nextPrimary
        m[KR_ABW] = nextAbw
        m[KR_PRIMARY_VOID_BY_ABW_TRANSFER] = true
        m[KR_FIRST_SLOT_KIND] = 'uo'
        syncKrPrimaryLadungFromPrimaryField(m)
      }
    })
    return true
  }

  // Fallback: Mutter leer — letzter regulärer 2.A.-Slot mit Ladung → entladen & entfernen.
  const phases = normalizePhases(meta.phases)
  const roots = sortedLinksForLayout(phases.links).filter(
    (l) => l.parentId === null && !l.heroExtra
  )
  const slots = readZaoSlots(meta)
  let sourceZaoId = null
  for (let i = roots.length - 1; i >= 0; i--) {
    const slot = slots[roots[i].id]
    if (slot && slot.marks === 1) {
      if (slot.kind === 'ang' && !slot.lodgedAbw) continue
      sourceZaoId = roots[i].id
      break
    }
  }
  if (sourceZaoId) {
    const nextAbw = addOneAbwTransferChargeValue(abw)
    if (nextAbw === abw) return false
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        m[KR_ABW] = nextAbw
        const s = readZaoSlots(m)
        delete s[sourceZaoId]
        m[KR_ZAO_SLOTS] = s
        const p = normalizePhases(m.phases)
        const keep = new Set(p.links.map((l) => l.id))
        keep.delete(sourceZaoId)
        for (const l of p.links) {
          if (l.parentId != null && !keep.has(l.parentId)) keep.delete(l.id)
        }
        m.phases = finalizePhasesWithOrderedRoots(m, {
          ...p,
          links: p.links.filter((l) => keep.has(l.id)),
        })
      }
    })
    return true
  }
  return false
}

/**
 * Regulärer ZAO-Wurzel-Link ohne heroExtra/lhEnd (spiegelte Umwandlungs-Spalte).
 * @param {{ parentId?: string | null, heroExtra?: unknown, lhEnd?: boolean } | undefined} link
 * @returns {boolean}
 */
function zaoRootEligibleForLodgedScopedTransfer(link) {
  return Boolean(
    link &&
      link.parentId === null &&
      !link.heroExtra &&
      link.lhEnd !== true
  )
}

/**
 * Umwandeln wie an der Zeile selbst („Aktion→Schild“): nur diese ZAO erhält
 * `lodgedAbw`; Phasen-Link bleibt (keine Lösch-Logik wie `patchKrTransferPrimaryToAbw`).
 *
 * @param {string} itemId
 * @param {string} linkId
 */
export async function patchKrTransferZaoPrimaryToAbw(itemId, linkId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  // Regulaere 2.AO-Wurzeln bleiben wie zu Kampfbeginn frei umwandelbar, auch
  // bei aktiver L.H. am Mutterobjekt. lhEnd/heroExtra unberuehrt (s.u.).
  const phases = normalizePhases(meta.phases)
  const linkRef = phases.links.find((l) => l.id === linkId)
  if (!zaoRootEligibleForLodgedScopedTransfer(linkRef)) return

  const slot = readZaoSlots(meta)[linkId]
  if (!slot || slot.marks !== 1 || slot.lodgedAbw) return

  const abw = normalizeKrDigit(meta[KR_ABW])
  const nextAbw = addOneAbwTransferChargeValue(abw)
  if (nextAbw === abw) return

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_ABW] = nextAbw
      const s = readZaoSlots(m)
      const cur = s[linkId]
      if (!cur || cur.marks !== 1) continue
      s[linkId] = {
        kind: 'uo',
        marks: 0,
        lodgedAbw: true,
      }
      m[KR_ZAO_SLOTS] = s
    }
  })
}

/**
 * Gegenstück zu `patchKrTransferZaoPrimaryToAbw`: Ladung zurück auf Primär dieser ZAO-Zeile.
 *
 * @param {string} itemId
 * @param {string} linkId
 */
export async function patchKrTransferAbwToZaoPrimary(
  itemId,
  linkId,
  targetKind = 'ang'
) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  // Regulaere 2.AO-Wurzeln bleiben wie zu Kampfbeginn frei umwandelbar, auch
  // bei aktiver L.H. am Mutterobjekt. lhEnd/heroExtra unberuehrt (s.u.).
  const phases = normalizePhases(meta.phases)
  const linkRef = phases.links.find((l) => l.id === linkId)
  if (!zaoRootEligibleForLodgedScopedTransfer(linkRef)) return

  const slot = readZaoSlots(meta)[linkId]
  if (!slot?.lodgedAbw || slot.marks !== 0) return

  const abw = normalizeKrDigit(meta[KR_ABW])
  if (!krTransferMarkPresent(abw)) return
  const nextAbw = consumeOneChargeValue(abw)
  if (nextAbw === abw) return

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_ABW] = nextAbw
      const s = readZaoSlots(m)
      const cur = s[linkId]
      if (!cur?.lodgedAbw || cur.marks !== 0) continue
      const kind =
        targetKind === 'sra' || targetKind === 'lh' ? targetKind : 'ang'
      s[linkId] = { kind, marks: 1 }
      m[KR_ZAO_SLOTS] = s
      syncReactionShieldForDualAng(m)
    }
  })
}

/**
 * Abwehr-Schild → Primärladung.
 * Ladungs-Erhaltungsgesetz: 1 Ladung pro Objekt. Wenn das Mutter-Primärfeld
 * schon eine Ladung hat, wird ein neuer 2.A.-Slot (Mutter-Kind, marks=1)
 * erzeugt. Gilt für Ang., S.R.A. und L.H.
 */
export async function patchKrTransferAbwToPrimary(itemId, targetKind = null) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return false
  const roundForLh = lhLockRoundFromCombat()
  const rawFirstKind = readKrFirstSlotKind(meta)
  const exitingUo = rawFirstKind === 'uo'
  if (abwToPrimaryBlockedByEndKrPendingZao(meta, roundForLh, { exitingUo })) {
    return false
  }
  if (!isConvertAnytimeEnabled(meta)) {
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    if (motherPrimarySelfStamped(stamps.entries, itemId)) return false
  }
  const firstKind =
    exitingUo && targetKind && (targetKind === 'ang' || targetKind === 'sra' || targetKind === 'lh')
      ? targetKind
      : rawFirstKind === 'uo'
        ? 'ang'
        : rawFirstKind
  // Edge-Case 3: Schild → L.H.-Stempel-Slot nur solange die „mittendrin“-
  // Sperre gilt; in der End-KR (`lhEndKrConvertMode`) ist Umwandeln erlaubt.
  if (
    firstKind === 'lh' &&
    isLhActive(meta) &&
    !lhEndKrConvertMode(meta, roundForLh)
  ) {
    return false
  }
  /* INI < 0: kein Schwert — wie bei den Tauschpfeilen wird Angriff wie S.R.A. behandelt. */
  const transferKind =
    firstKind === 'ang' && isHeroIniBelowZero(meta) ? 'sra' : firstKind
  const field = primaryFieldForKind(meta)
  const abw = normalizeKrDigit(meta[KR_ABW])

  const motherHasCharge = exitingUo
    ? false
    : firstKind === 'lh'
      ? normalizeKrDigit(meta[KR_LH_ACTION]) === 0 &&
        !meta[KR_LH_VOID_BY_TRANSFER]
      : krTransferMarkPresent(normalizeKrDigit(meta[field]))
  const iniStr = meta?.initiative
  const phaseOffset = phaseOffsetFromHeroSecondAoMeta(meta)

  const zaoHoldsChargedAng = hasChargedRegularZaoAng(meta)
  const exitTarget =
    targetKind === 'ang' || targetKind === 'sra' || targetKind === 'lh'
      ? targetKind
      : exitingUo
        ? 'ang'
        : null
  const exitTransferKind =
    exitTarget === 'ang' && isHeroIniBelowZero(meta) ? 'sra' : exitTarget

  if (
    !krTransferMarkPresent(abw) &&
    exitingUo &&
    zaoHoldsChargedAng &&
    exitTarget
  ) {
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        if (exitTransferKind === 'lh') {
          m[KR_LH_ACTION] = 0
          m[KR_LH_SECOND] = 0
          delete m[KR_LH_VOID_BY_TRANSFER]
          delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
          m[KR_FIRST_SLOT_KIND] = 'lh'
        } else if (exitTransferKind === 'sra') {
          m[KR_FIRST_SLOT_KIND] = 'sra'
          m[KR_PAIR_MODE] = 'sra_ang'
          m[KR_ANG] = 1
          m[KR_SRA] = 0
        } else {
          m[KR_FIRST_SLOT_KIND] = 'ang'
          m[KR_PAIR_MODE] = 'ang_abw'
          m[KR_ANG] = 0
        }
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        syncKrPrimaryLadungFromPrimaryField(m)
        if (exitTransferKind === 'ang') {
          syncReactionShieldForDualAng(m)
        }
      }
    })
    return true
  }

  if (!krTransferMarkPresent(abw)) return false
  const nextAbw = consumeOneChargeValue(abw)
  if (nextAbw === abw) return false

  if (!motherHasCharge) {
    if (abwToPrimaryBlockedByPendingZao(meta, { exitingUo })) {
      return false
    }
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        m[KR_ABW] = nextAbw
        if (transferKind === 'lh') {
          m[KR_LH_ACTION] = 0
          m[KR_LH_SECOND] = 0
          delete m[KR_LH_VOID_BY_TRANSFER]
          delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
          m[KR_FIRST_SLOT_KIND] = 'lh'
        } else if (transferKind === 'sra') {
          m[KR_FIRST_SLOT_KIND] = 'sra'
          m[KR_PAIR_MODE] = 'sra_ang'
          m[KR_ANG] = 1
          m[KR_SRA] = 0
        } else {
          m[KR_FIRST_SLOT_KIND] = 'ang'
          m[KR_ANG] = 0
        }
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        syncKrPrimaryLadungFromPrimaryField(m)
        syncReactionShieldForDualAng(m)
      }
    })
    return true
  }

  const pSnap = normalizePhases(meta.phases)
  const nextSpec =
    typeof iniStr === 'string'
      ? nextChainedZaoParentForTransfer(iniStr, pSnap, phaseOffset)
      : null
  if (!nextSpec) {
    return false
  }
  const newLinkId = crypto.randomUUID()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_ABW] = nextAbw
      const p = normalizePhases(m.phases)
      const nextLinks = [
        ...p.links,
        {
          id: newLinkId,
          parentId: nextSpec.parentId,
          offset: nextSpec.offset,
        },
      ]
      m.phases = finalizePhasesWithOrderedRoots(m, {
        ...p,
        rowPanelOpen: true,
        links: nextLinks,
      })
      const s = readZaoSlots(m)
      // Aus Schild-Umwandlung: Ladung landet als stempelbare Primärladung am neuen Slot.
      s[newLinkId] = { kind: 'ang', marks: 1 }
      m[KR_ZAO_SLOTS] = s
    }
  })
  return true
}

/**
 * Klick auf das Primärfeld eines 2.A.-Slots: Ladung verbrauchen + Stempel
 * an dieser Zeile (mit `zaoLinkId`) anlegen. Slot bleibt sichtbar (marks=0),
 * damit der Pfeil zum Schild weiterhin verfügbar ist und der Stempel per X
 * die Ladung wieder zurückführt.
 *
 * @param {string} itemId
 * @param {string} linkId
 */
export async function patchZaoSlotStampPrimary(itemId, linkId) {
  const item = await findSceneItemById(itemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false
  const slot = readZaoSlots(meta)[linkId]
  if (!slot || slot.marks !== 1) return false
  const field =
    slot.kind === 'sra'
      ? KR_SRA
      : slot.kind === 'lh'
        ? KR_LH_ACTION
        : KR_ANG
  // L.H. laeuft (und endet NICHT in dieser KR): ZAO-Slots duerfen fuer
  // Ang/SRA nicht gestempelt werden. In der End-KR ist Ang/SRA wieder frei.
  // Der L.H.-Slot selbst wird ueber `stampLhCompletion` (separater Pfad)
  // bedient — hier wird er sicherheitshalber blockiert, damit der ZAO-
  // Stempelpfad nicht versehentlich einen LH-Stempel setzt.
  if (
    field === KR_LH_ACTION ||
    (isLhLockingActions(meta, lhLockRoundFromCombat()) && field !== KR_LH_ACTION)
  ) {
    return false
  }
  // Symmetrischer Slot-Konflikt (Phase D): liegt am gleichen Anker (n.A.-
  // Slot via `linkId`) bereits ein L.H.-Abschluss-Stempel, blockt das den
  // Ang/SRA-Stempel — pro Aktionsslot nur EIN Primaer-Stempel.
  {
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    const conflict = stamps.entries.some(
      (e) =>
        e.itemId === itemId &&
        (e.anchorRowId || itemId) === itemId &&
        (e.anchorPhaseLinkId || null) === linkId &&
        !e.paradeExtra &&
        e.field === KR_LH_ACTION
    )
    if (conflict) return false
  }
  const ownerName =
    getTokenListDisplayName(item) || String(item?.name ?? '')
  // Mutex z.AT vs schwarzes Schild: Wenn der gestempelte ZAO-Slot zu einer
  // heroExtra-'ang'-Wurzel gehoert, beansprucht der Held mit diesem Stempel
  // die "Zusatzaktion oder Zusatzparade"-Wahl auf 'ang'. Das schwarze Schild
  // wird in dieser KR vollstaendig entfernt; die Wahl wird in
  // `m.krExtraChoiceUsed` festgehalten, damit `ensureParadeExtraShield` die
  // Schild-Ladung nicht stillschweigend wieder herstellt.
  const isHeroExtraAngStamp = (() => {
    const phases = normalizePhases(meta.phases)
    const link = phases.links.find((l) => l.id === linkId)
    return Boolean(link && link.parentId === null && link.heroExtra === 'ang')
  })()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const s = readZaoSlots(m)
      if (s[linkId]) {
        s[linkId] = { ...s[linkId], marks: 0 }
        m[KR_ZAO_SLOTS] = s
      }
      if (isHeroExtraAngStamp) {
        m.krExtraChoiceUsed = 'ang'
        for (let i = 0; i < HERO_EXTRA_MAX; i++) {
          delete m[paradeExtraFieldForIndex(i)]
        }
      }
    }
  })
  const skipGmStampZao = canEditSceneItem(item) && !isGmSync()
  await patchActionStamps((stamps) => {
    const entries = [...stamps.entries]
    const stampEntry = {
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      ownerName,
      field,
      anchorRowId: itemId,
      anchorPhaseLinkId: linkId,
      zaoLinkId: linkId,
    }
    if (isHeroExtraAngStamp) stampEntry.heroExtraStamp = true
    entries.push(stampEntry)
    const curId = getCombat().currentItemId
    const anchorId =
      stamps.anchorId ||
      (typeof curId === 'string' &&
      curId !== ROUND_START_STEP_ID &&
      curId !== ROUND_END_STEP_ID
        ? curId
        : itemId)
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStampZao })
  return true
}

/**
 * Letzten Stempel zu (itemId, zaoLinkId) entfernen und die Slot-Ladung
 * (marks=1) wiederherstellen.
 * @param {string} itemId
 * @param {string} linkId
 */
export async function undoLastZaoSlotStamp(itemId, linkId) {
  const roomMeta = await OBR.room.getMetadata()
  const cur = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
  for (let i = cur.entries.length - 1; i >= 0; i--) {
    const e = cur.entries[i]
    if (e.itemId === itemId && e.zaoLinkId === linkId) {
      await undoKrActionStamp(e.id)
      return
    }
  }
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
 * @param {{ stampAnchor?: { rowId: string, phaseLinkId: string | null }, skipLhSecondCheck?: boolean }} [options]
 */
export async function patchKrCounterByDelta(itemId, field, delta, options = {}) {
  const inc = delta > 0
  const paradeExtraSlotIdx = paradeExtraIndexForField(field)
  const isParadeExtraField = paradeExtraSlotIdx !== null
  if (field === KR_FREE_ACTION && !getCombat().started) return false
  const item = await findSceneItemById(itemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false
  migrateHeroExtraCountFields(meta)
  // Laengerfristige Handlung laeuft und endet NICHT in dieser KR:
  // Ang/SRA/Schild/Parade gesperrt; FA und L.H.-Action selbst bleiben frei.
  // In der End-KR werden alle Felder freigegeben (Held kann weiterkaempfen).
  if (
    isLhLockingActions(meta, lhLockRoundFromCombat()) &&
    (field === KR_ANG ||
      field === KR_SRA ||
      field === KR_ABW ||
      isParadeExtraField)
  ) {
    return false
  }
  let maxDigit = KR_COUNTER_MAX
  if (field === KR_FREE_ACTION) {
    const iniStr = meta?.initiative
    const settings = getRoomSettings()
    maxDigit = readHeroFaMax(meta, iniStr, settings)
  }
  if (isParadeExtraField) {
    maxDigit = 1
  }
  const mod = maxDigit + 1
  const cur = krCounterCurForField(meta, field, maxDigit)
  if (field === KR_FREE_ACTION && !inc && cur === 0) {
    return false
  }
  let next = inc ? (cur + 1) % mod : (cur + mod - 1) % mod
  const lhSecondBefore =
    field === KR_LH_ACTION ? readKrLhSecondCharge(meta) : 1
  if (
    field === KR_LH_ACTION &&
    inc &&
    !options.skipLhSecondCheck &&
    lhSecondBefore === 0
  ) {
    return false
  }

  let addCount = 0
  let removeCount = 0
  if (inc) {
    if (next === 0 && cur > 0) removeCount = cur
    else if (next > cur) addCount = next - cur
  } else {
    if (cur === 0 && next > 0) addCount = next
    else if (next < cur) removeCount = cur - next
  }
  if (
    inc &&
    addCount <= 0 &&
    removeCount <= 0 &&
    primaryChargeStampEligible(meta) &&
    (field === KR_ANG || field === KR_SRA || field === KR_LH_ACTION)
  ) {
    const marks = marksFromChargeValue(cur)
    if (marks > 0) {
      addCount = 1
      next = consumeOneChargeValue(cur)
    }
  }
  if (addCount <= 0 && removeCount <= 0) return false

  const ownerName =
    getTokenListDisplayName(item) || String(item?.name ?? '')
  const pfBefore = primaryFieldForKind(meta)

  // Symmetrischer Slot-Konflikt (Phase D): wenn an diesem Anker bereits ein
  // L.H.-Abschluss-Stempel (KR_LH_ACTION) liegt, darf an gleicher Stelle
  // KEIN Ang/SRA-Stempel hinzukommen — pro Aktionsslot nur EIN Primaer-
  // Stempel. Symmetrisch zur Slot-Konfliktpruefung in `stampLhCompletion`.
  if (
    inc &&
    (field === KR_ANG || field === KR_SRA || field === KR_LH_ACTION)
  ) {
    const c = getCombat()
    const forcedAnchor = options?.stampAnchor
    let anchorRowIdForCheck = itemId
    let anchorPhaseLinkIdForCheck = null
    if (forcedAnchor && typeof forcedAnchor.rowId === 'string') {
      anchorRowIdForCheck = forcedAnchor.rowId
      anchorPhaseLinkIdForCheck =
        typeof forcedAnchor.phaseLinkId === 'string'
          ? forcedAnchor.phaseLinkId
          : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowIdForCheck = c.currentItemId
      anchorPhaseLinkIdForCheck =
        typeof c.currentPhaseLinkId === 'string'
          ? c.currentPhaseLinkId
          : null
    }
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    const conflict = stamps.entries.some((e) => {
      if (e.itemId !== itemId) return false
      if ((e.anchorRowId || itemId) !== anchorRowIdForCheck) return false
      if ((e.anchorPhaseLinkId || null) !== anchorPhaseLinkIdForCheck) {
        return false
      }
      if (e.paradeExtra) return false
      if (
        e.field !== KR_ANG &&
        e.field !== KR_SRA &&
        e.field !== KR_LH_ACTION
      ) {
        return false
      }
      // Slot-Konflikt: ein anderer Primaer-Stempel als der eigene Stempel-
      // Typ blockiert. (Weiter-Inkrement gleicher Field-Typ ist hier ok —
      // der Code unten erlaubt sowieso nur addCount > 0.)
      return e.field !== field
    })
    if (conflict) return false
  }

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[field] = next
      if (field === KR_LH_ACTION && inc && cur === 0) {
        m[KR_LH_SECOND] = 0
        delete m[KR_LH_VOID_BY_TRANSFER]
      }
      if (field === KR_LH_ACTION && !inc && cur === 1 && next === 0) {
        if (m[KR_LH_VOID_BY_TRANSFER]) {
          delete m[KR_LH_VOID_BY_TRANSFER]
        } else {
          m[KR_LH_SECOND] = 1
        }
      }
      if (
        field === pfBefore &&
        (field === KR_ANG || field === KR_SRA) &&
        krTransferMarkPresent(next)
      ) {
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
      }
      if (field === pfBefore) {
        m[KR_PRIMARY_LADUNG] = next
      }
    }
  })

  const skipGmStamp = canEditSceneItem(item) && !isGmSync()
  await patchActionStamps((stamps) => {
    const entries = [...stamps.entries]
    if (removeCount > 0) {
      let remaining = removeCount
      for (let i = entries.length - 1; i >= 0 && remaining > 0; i--) {
        const e = entries[i]
        if (e.itemId !== itemId || e.field !== field) continue
        if (field === KR_ABW && e.paradeExtra) continue
        if (isParadeExtraField && !e.paradeExtra) continue
        if (isParadeExtraField && e.paradeExtraSlot !== paradeExtraSlotIdx) continue
        // Mutter-Counter-Undo darf nur Mutter-Stempel entfernen;
        // ZAO-Stempel werden ausschließlich über × (undoKrActionStamp)
        // bzw. Slot-Schließen behandelt.
        if (e.zaoLinkId) continue
        entries.splice(i, 1)
        remaining--
      }
    }
    if (addCount > 0) {
      const c = getCombat()
      let anchorRowId = itemId
      let anchorPhaseLinkId = null
      const forced = options?.stampAnchor
      if (forced && typeof forced.rowId === 'string') {
        anchorRowId = forced.rowId
        anchorPhaseLinkId =
          typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
      } else if (
        c.started &&
        !c.roundIntroPending &&
        typeof c.currentItemId === 'string' &&
        c.currentItemId !== ROUND_START_STEP_ID &&
        c.currentItemId !== ROUND_END_STEP_ID
      ) {
        anchorRowId = c.currentItemId
        anchorPhaseLinkId =
          typeof c.currentPhaseLinkId === 'string'
            ? c.currentPhaseLinkId
            : null
      }
      for (let i = 0; i < addCount; i++) {
        const stampEntry = {
          id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          itemId,
          ownerName,
          field: isParadeExtraField ? KR_ABW : field,
          anchorRowId,
          anchorPhaseLinkId,
        }
        if (isParadeExtraField) {
          stampEntry.paradeExtra = true
          stampEntry.paradeExtraSlot = paradeExtraSlotIdx
        }
        entries.push(stampEntry)
      }
    }
    const curId = getCombat().currentItemId
    const anchorId =
      entries.length > 0
        ? stamps.anchorId ||
          (typeof curId === 'string' &&
          curId !== ROUND_START_STEP_ID &&
          curId !== ROUND_END_STEP_ID
            ? curId
            : itemId)
        : null
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStamp })

  if (
    inc &&
    addCount > 0 &&
    !isParadeExtraField &&
    (field === KR_ANG || field === KR_SRA || field === KR_ABW)
  ) {
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = /** @type {string | null} */ (null)
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string'
          ? c.currentPhaseLinkId
          : null
    }
    /* Gleiche Logik wie Abwehr-/Parade-Stempel: Zähler am Token itemId. */
    if (anchorPhaseLinkId === null && addCount > 0) {
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const prev = Math.max(
            0,
            Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
          )
          m[KR_MOTHER_PRIMARY_USED_THIS_ROUND] = prev + addCount
        }
      })
    }
  }

  if (
    (field === KR_ANG || field === KR_SRA) &&
    inc &&
    next >= 2 &&
    ((field === KR_ANG && readKrFirstSlotKind(meta) === 'ang') ||
      (field === KR_SRA && readKrFirstSlotKind(meta) === 'sra'))
  ) {
    const iniStr = meta?.initiative
    if (
      typeof iniStr === 'string' &&
      canCreateSecondActionRoot(iniStr, phaseOffsetFromHeroSecondAoMeta(meta))
    ) {
      await ensureExtraAttackPhaseRoot(itemId, iniStr)
    }
  }
  return true
}

/**
 * L.H.-Abschluss manuell stempeln (Klick auf vollen LH-Pie-Stern).
 *
 * Verhalten:
 *  - Anker = entweder Mutter-Slot (`anchorPhaseLinkId === null`) oder
 *    n.A.-Slot (`anchorPhaseLinkId === <lhEndLinkId>`).
 *  - Slot-Konflikt: existiert am gleichen Anker bereits ein Primaer-Stempel
 *    (KR_ANG / KR_SRA / KR_LH_ACTION ohne paradeExtra), wird der LH-Stempel
 *    NICHT gesetzt — pro Aktionsslot kann nur EINER aktiv sein.
 *  - Setzt einen `KR_LH_ACTION`-Stempel an diesem Anker.
 *  - Setzt die Tracker-Aktivitaet zurueck (`clearLhTrackerActivity`), sodass
 *    das LH-Wertfeld wieder frei und editierbar wird.
 *
 * @param {string} itemId
 * @param {string | null} anchorPhaseLinkId  null = Mutter-Slot, sonst LH-End n.A.-Link
 */
export async function stampLhCompletion(itemId, anchorPhaseLinkId = null) {
  const item = await findSceneItemById(itemId)
  if (!item || !canEditSceneItem(item)) return false
  const ownerName = getTokenListDisplayName(item) || String(item?.name ?? '')
  const skipGmStamp = canEditSceneItem(item) && !isGmSync()
  let stamped = false
  await patchActionStamps((stamps) => {
    const anchorRowId = itemId
    const anchorPid =
      typeof anchorPhaseLinkId === 'string' && anchorPhaseLinkId
        ? anchorPhaseLinkId
        : null
    // Slot-Konflikt: existiert hier bereits ein Primaer-Stempel?
    const conflict = stamps.entries.some(
      (e) =>
        e.itemId === itemId &&
        (e.anchorRowId || itemId) === anchorRowId &&
        ((e.anchorPhaseLinkId || null) === anchorPid) &&
        (e.field === KR_ANG ||
          e.field === KR_SRA ||
          e.field === KR_LH_ACTION) &&
        !e.paradeExtra
    )
    if (conflict) return stamps
    const entries = [...stamps.entries]
    entries.push({
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      ownerName,
      field: KR_LH_ACTION,
      anchorRowId,
      anchorPhaseLinkId: anchorPid,
    })
    const curId = getCombat().currentItemId
    const anchorId =
      stamps.anchorId ||
      (typeof curId === 'string' &&
      curId !== ROUND_START_STEP_ID &&
      curId !== ROUND_END_STEP_ID
        ? curId
        : itemId)
    stamped = true
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStamp })

  if (!stamped) return false

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      clearLhTrackerActivity(m)
      restoreRegularSecondActionRootAfterLh(m)
    }
  })
  return true
}

/**
 * Abwehr-Ladung direkt stempeln (auch bei mehreren geladenen Schildladungen).
 * Verbraucht genau eine Abwehr-Markierung und legt einen Abwehr-Stempel an.
 * @param {{ stampAnchor?: { rowId: string, phaseLinkId: string | null } }} [options]
 */
export async function patchKrStampAbwFromCharge(itemId, options = {}) {
  const item = await findSceneItemById(itemId)
  if (!item || !canEditSceneItem(item)) return false
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return false
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return false
  const forcedAnchor = options?.stampAnchor
  const isReactionStamp =
    forcedAnchor != null && typeof forcedAnchor.rowId === 'string'
  {
    const c = getCombat()
    if (!c.started) return false
    if (!isReactionStamp) {
      if (c.roundIntroPending) return false
      const cid = c.currentItemId
      if (cid === ROUND_START_STEP_ID || cid === ROUND_END_STEP_ID) return false
    }
  }
  const cur = normalizeKrDigit(meta?.[KR_ABW])
  if (!krTransferMarkPresent(cur)) return false
  const next = consumeOneChargeValue(cur)
  if (next === cur) return false

  const ownerName = getTokenListDisplayName(item) || String(item?.name ?? '')
  const skipGmStampAbw = canEditSceneItem(item) && !isGmSync()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_ABW] = next
    }
  })
  await patchActionStamps((stamps) => {
    const entries = [...stamps.entries]
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = null
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string' ? c.currentPhaseLinkId : null
    }
    entries.push({
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      ownerName,
      field: KR_ABW,
      anchorRowId,
      anchorPhaseLinkId,
    })
    const curId = getCombat().currentItemId
    const anchorId =
      entries.length > 0
        ? stamps.anchorId ||
          (typeof curId === 'string' &&
          curId !== ROUND_START_STEP_ID &&
          curId !== ROUND_END_STEP_ID
            ? curId
            : itemId)
        : null
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStampAbw })

  {
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = /** @type {string | null} */ (null)
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string'
          ? c.currentPhaseLinkId
          : null
    }
    /* Primärverbrauch gilt für dieses Token (itemId), auch wenn die Navigation
       gerade auf einer anderen Heldenzeile steht (anchorRowId ≠ itemId). */
    if (anchorPhaseLinkId === null) {
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const prev = Math.max(
            0,
            Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
          )
          m[KR_MOTHER_PRIMARY_USED_THIS_ROUND] = prev + 1
        }
      })
    }
  }
  return true
}

/**
 * Stempelt die Zusatz-Parade (schwarzes Schild); berührt `KR_ABW` nicht.
 * @param {{ stampAnchor?: { rowId: string, phaseLinkId: string | null } }} [options]
 */
export async function patchKrStampParadeExtraFromCharge(itemId, options = {}) {
  const item = await findSceneItemById(itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  migrateHeroExtraCountFields(meta)
  const slotIndex = Math.max(
    0,
    Math.min(
      HERO_EXTRA_MAX - 1,
      Math.floor(Number(options?.paradeExtraSlot ?? 0)) || 0
    )
  )
  const slotField = paradeExtraFieldForIndex(slotIndex)
  if (readHeroExtraParCount(meta) <= slotIndex) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  if (normalizeKrDigit(meta[slotField], 1) !== 0) return
  {
    const c = getCombat()
    if (!c.started || c.roundIntroPending) return
    const cid = c.currentItemId
    if (cid === ROUND_START_STEP_ID || cid === ROUND_END_STEP_ID) return
  }

  // Mutex z.AT vs schwarzes Schild: vor dem Update die heroExtra-'ang'-
  // Wurzel-IDs sammeln, damit nach dem Stempel auch zugehoerige Stempel-
  // Eintraege im Raum-State entfernt werden koennen (defensiv: durch den
  // Mutex sollte es eigentlich keinen z.AT-Stempel geben, wenn jetzt das
  // Schild gestempelt wird).
  const droppedHeroExtraLinkIds = new Set()
  {
    const phases = normalizePhases(meta.phases)
    for (const l of phases.links) {
      if (
        l.parentId === null &&
        (l.heroExtra === 'ang' || l.heroExtra === 'par')
      ) {
        droppedHeroExtraLinkIds.add(l.id)
      }
    }
  }

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[slotField] = 1
      m.krExtraChoiceUsed = 'par'
      // heroExtra-Wurzel + Slot entfernen (Mutex): die z.AT verschwindet aus
      // der Liste, das rote "+" erscheint nicht (Guard in
      // `heroExtraZaoAvailableForRestore`).
      if (droppedHeroExtraLinkIds.size > 0) {
        const phases = normalizePhases(m.phases)
        const keptLinks = phases.links.filter(
          (l) => !droppedHeroExtraLinkIds.has(l.id)
        )
        m.phases = finalizePhasesWithOrderedRoots(m, { ...phases, links: keptLinks })
        const slots = readZaoSlots(m)
        for (const id of droppedHeroExtraLinkIds) delete slots[id]
        m[KR_ZAO_SLOTS] = slots
      }
    }
  })

  const ownerName = getTokenListDisplayName(item) || String(item?.name ?? '')
  const skipGmStampAbw = canEditSceneItem(item) && !isGmSync()
  await patchActionStamps((stamps) => {
    // Mutex-defensiv: vorhandene Stempel auf der entfernten heroExtra-Wurzel
    // (sollten durch Mutex eigentlich nicht existieren, koennen aber durch
    // Race-Conditions/Altzustaende vorkommen) mit weg-filtern.
    const baseEntries =
      droppedHeroExtraLinkIds.size > 0
        ? stamps.entries.filter(
            (e) =>
              !(
                e.itemId === itemId &&
                typeof e.zaoLinkId === 'string' &&
                droppedHeroExtraLinkIds.has(e.zaoLinkId)
              )
          )
        : stamps.entries
    const entries = [...baseEntries]
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = null
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string' ? c.currentPhaseLinkId : null
    }
    entries.push({
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      ownerName,
      field: KR_ABW,
      anchorRowId,
      anchorPhaseLinkId,
      paradeExtra: true,
      paradeExtraSlot: slotIndex,
    })
    const curId = getCombat().currentItemId
    const anchorId =
      entries.length > 0
        ? stamps.anchorId ||
          (typeof curId === 'string' &&
          curId !== ROUND_START_STEP_ID &&
          curId !== ROUND_END_STEP_ID
            ? curId
            : itemId)
        : null
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStampAbw })

  {
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = /** @type {string | null} */ (null)
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string'
          ? c.currentPhaseLinkId
          : null
    }
    if (anchorPhaseLinkId === null) {
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const prev = Math.max(
            0,
            Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
          )
          m[KR_MOTHER_PRIMARY_USED_THIS_ROUND] = prev + 1
        }
      })
    }
  }
}

const paradeExtraEnsureInFlight = new Set()

/**
 * Stellt sicher: bei aktivem Haken „Zusätzliche Parade“ existiert genau ein
 * Parade-Schild (Slot oder Stempel). Setzt `krParadeExtra = 0`, wenn noch keins da ist.
 * Nur Spielleitung (Schreibzugriff auf Raum-Stempel).
 *
 * @param {string} itemId
 */
export async function ensureParadeExtraShield(itemId) {
  if (!isGmSync()) return
  if (paradeExtraEnsureInFlight.has(itemId)) return
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  migrateHeroExtraCountFields(meta)
  const targetCount = readHeroExtraParCount(meta)
  if (targetCount <= 0) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  // Mutex z.AT vs schwarzes Schild: Wenn der Held in dieser KR bereits den
  // z.AT gestempelt hat, darf das Schild NICHT stillschweigend
  // wiederhergestellt werden — sonst waere die Mutex-Wahl wirkungslos.
  if (meta.krExtraChoiceUsed === 'ang') return

  paradeExtraEnsureInFlight.add(itemId)
  try {
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    const stampedSlots = new Set(
      stamps.entries
        .filter((e) => e.itemId === itemId && e.paradeExtra)
        .map((e) => Math.max(0, Math.floor(Number(e.paradeExtraSlot)) || 0))
    )
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        migrateHeroExtraCountFields(m)
        const count = readHeroExtraParCount(m)
        for (let i = 0; i < HERO_EXTRA_MAX; i++) {
          const key = paradeExtraFieldForIndex(i)
          if (i >= count) {
            delete m[key]
            continue
          }
          if (stampedSlots.has(i)) continue
          if (m[key] !== 0) m[key] = 0
        }
      }
    })
  } finally {
    paradeExtraEnsureInFlight.delete(itemId)
  }
}

/**
 * Einen Aktions-Stempel schließen: Zähler um eins wie Rechtsklick (−1), Stempel aus der Liste.
 */
export async function undoKrActionStamp(stampId) {
  if (typeof stampId !== 'string' || !stampId) return
  const roomMeta = await OBR.room.getMetadata()
  const curStamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
  const entry = curStamps.entries.find((e) => e.id === stampId)
  if (!entry) return

  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === entry.itemId)
  if (!canEditSceneItem(item)) return

  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (entry.zaoLinkId) {
    // Stempel eines 2.A.-Slots: Ladung zurück in den Slot (marks=1), Mutter-
    // Zähler (Ang./S.R.A./L.H.) unverändert.
    const slotExists = Boolean(readZaoSlots(meta || {})[entry.zaoLinkId])
    const skipGmStampZao = canEditSceneItem(item) && !isGmSync()
    // Mutex z.AT vs schwarzes Schild: war dies der entscheidende heroExtra-
    // 'ang'-Stempel, gibt der Undo die Wahl wieder frei und stellt — falls
    // `heroExtraPar` aktiv ist — das geladene schwarze Schild wieder her.
    const isHeroExtraAngUndo =
      Boolean(entry.heroExtraStamp) ||
      (() => {
        const phases = normalizePhases(meta?.phases)
        const link = phases.links.find((l) => l.id === entry.zaoLinkId)
        return Boolean(
          link && link.parentId === null && link.heroExtra === 'ang'
        )
      })()
    if (slotExists) {
      await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const s = readZaoSlots(m)
          if (s[entry.zaoLinkId]) {
            s[entry.zaoLinkId] = { ...s[entry.zaoLinkId], marks: 1 }
            m[KR_ZAO_SLOTS] = s
          }
          if (isHeroExtraAngUndo) {
            delete m.krExtraChoiceUsed
            if (readHeroExtraParCount(m) > 0) m[KR_PARADE_EXTRA] = 0
          }
        }
      })
    } else if (entry.restoreZao && typeof entry.restoreZao === 'object') {
      // Legacy-Pfad (V335): damals hinterließ ein 2.A.O.-Close mit aktivem
      // Stempel einen verwaisten Stempel mit `restoreZao`. × stellte Slot
      // und Link wieder her. Neue Schließvorgänge erzeugen kein
      // `restoreZao` mehr (siehe `patchKrCloseZaoSlotToAbw`), aber alte
      // Raum-Metadaten können solche Stempel noch enthalten — für die
      // bleibt das Verhalten hier erhalten.
      const r = entry.restoreZao
      const slotKind =
        r.slotKind === 'sra' || r.slotKind === 'lh' || r.slotKind === 'ang'
          ? r.slotKind
          : 'ang'
      const linkParentId =
        typeof r.linkParentId === 'string' ? r.linkParentId : null
      const linkOffset =
        typeof r.linkOffset === 'number' && Number.isFinite(r.linkOffset)
          ? r.linkOffset
          : 0
      const linkHeroExtra =
        r.linkHeroExtra === 'ang' || r.linkHeroExtra === 'par'
          ? r.linkHeroExtra
          : null
      const linkExpiresNextRound = Boolean(r.linkExpiresNextRound)
      await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const p = normalizePhases(m.phases)
          const alreadyThere = p.links.some((l) => l.id === entry.zaoLinkId)
          if (!alreadyThere) {
            const newLink = {
              id: entry.zaoLinkId,
              parentId: linkParentId,
              offset: linkOffset,
            }
            if (linkHeroExtra) newLink.heroExtra = linkHeroExtra
            if (linkExpiresNextRound) newLink.expiresNextRound = true
            m.phases = finalizePhasesWithOrderedRoots(m, {
              ...p,
              links: [...p.links, newLink],
              rowPanelOpen: true,
            })
          }
          const s = readZaoSlots(m)
          s[entry.zaoLinkId] = { kind: slotKind, marks: 1 }
          m[KR_ZAO_SLOTS] = s
          if (isHeroExtraAngUndo || linkHeroExtra === 'ang') {
            delete m.krExtraChoiceUsed
            if (readHeroExtraParCount(m) > 0) m[KR_PARADE_EXTRA] = 0
          }
        }
      })
    } else if (isHeroExtraAngUndo) {
      // Verwaister heroExtra-Stempel ohne Slot/restoreZao: Mutex trotzdem
      // freigeben, damit der Spieler das schwarze Schild wieder bekommt
      // (falls `heroExtraPar` gesetzt ist) bzw. die Wahl neu treffen kann.
      await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          delete m.krExtraChoiceUsed
          if (readHeroExtraParCount(m) > 0) m[KR_PARADE_EXTRA] = 0
        }
      })
    }
    // In allen Fällen: Stempel entfernen. Wenn Slot existierte oder
    // wiederhergestellt wurde, ist die Ladung bereits zurückgebucht.
    // Verwaister Legacy-Stempel ohne restoreZao wird stumm entfernt
    // (keine Mutter-Erstattung — das würde Ladungen aus dem Nichts
    // erschaffen).
    await patchActionStamps(
      (stamps) => {
        const entries = stamps.entries.filter((e) => e.id !== stampId)
        const anchorId =
          entries.length > 0
            ? stamps.anchorId ||
              (typeof getCombat().currentItemId === 'string'
                ? getCombat().currentItemId
                : entry.itemId)
            : null
        return { anchorId, entries }
      },
      { skipGmCheck: skipGmStampZao }
    )
    return
  }
  if (entry.field === KR_ABW && entry.abwFromSplit) {
    const skipGmLegacy = canEditSceneItem(item) && !isGmSync()
    await patchActionStamps(
      (stamps) => {
        const entries = stamps.entries.filter((e) => e.id !== stampId)
        const anchorId =
          entries.length > 0
            ? stamps.anchorId ||
              (typeof getCombat().currentItemId === 'string'
                ? getCombat().currentItemId
                : entry.itemId)
            : null
        return { anchorId, entries }
      },
      { skipGmCheck: skipGmLegacy }
    )
    return
  }
  if (entry.paradeExtra) {
    await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
      for (const draft of drafts) {
        const m = draft.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        const slotIdx = Math.max(
          0,
          Math.floor(Number(entry.paradeExtraSlot)) || 0
        )
        m[paradeExtraFieldForIndex(slotIdx)] = 0
        // Mutex z.AT vs schwarzes Schild: Undo des Schild-Stempels gibt die
        // Wahl wieder frei. Falls `heroExtraAng` aktiv ist und keine
        // heroExtra-Wurzel mehr existiert (sie wurde beim Stempel entfernt),
        // bauen wir sie geladen wieder auf — symmetrisch zur Wiederherstellung
        // des Schilds beim Undo eines z.AT-Stempels.
        delete m.krExtraChoiceUsed
        if (readHeroExtraAngCount(m) > 0) {
          const phases = normalizePhases(m.phases)
          const hasRoot = phases.links.some(
            (l) =>
              l.parentId === null &&
              (l.heroExtra === 'ang' || l.heroExtra === 'par')
          )
          if (!hasRoot) restoreHeroExtraAttackInPlace(m)
        }
      }
    })
    const skipGmStampPar = canEditSceneItem(item) && !isGmSync()
    await patchActionStamps(
      (stamps) => {
        const entries = stamps.entries.filter((e) => e.id !== stampId)
        const anchorId =
          entries.length > 0
            ? stamps.anchorId ||
              (typeof getCombat().currentItemId === 'string'
                ? getCombat().currentItemId
                : entry.itemId)
            : null
        return { anchorId, entries }
      },
      { skipGmCheck: skipGmStampPar }
    )
    return
  }
  let maxDigit = KR_COUNTER_MAX
  if (entry.field === KR_FREE_ACTION) {
    const iniStr = meta?.initiative
    const settings = getRoomSettings()
    maxDigit = faMaxForInitiative(iniStr, settings.highIniFreeActions)
  }
  const mod = maxDigit + 1
  const cur = normalizeKrDigit(meta?.[entry.field], maxDigit)
  /**
   * Abwehr wird beim Stempeln mit `consumeOneChargeValue` verringert (0/1/≥2-
   * Kodierung), nicht mit zyklischem +1 wie Ang./S.R.A. Ein Undo mit
   * `(cur+mod-1)%mod` würde z. B. bei cur===0 (eine Ladung) zu Ziffer 10
   * springen (= scheinbar viele Schildladungen). Rückgängig = eine Markierung
   * zurückgeben: `addOneChargeValue` (invers zu `consumeOneChargeValue`).
   */
  const next =
    entry.field === KR_ABW
      ? addOneChargeValue(cur)
      : (cur + mod - 1) % mod
  if (entry.field === KR_ABW && next === cur) return
  const pfBefore = primaryFieldForKind(meta)

  await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[entry.field] = next
      if (entry.field === pfBefore) {
        m[KR_PRIMARY_LADUNG] = next
      }
    }
  })

  const skipGmStamp = canEditSceneItem(item) && !isGmSync()
  await patchActionStamps(
    (stamps) => {
      const entries = stamps.entries.filter((e) => e.id !== stampId)
      const anchorId =
        entries.length > 0
          ? stamps.anchorId ||
            (typeof getCombat().currentItemId === 'string'
              ? getCombat().currentItemId
              : entry.itemId)
          : null
      return { anchorId, entries }
    },
    { skipGmCheck: skipGmStamp }
  )

  if (
    !entry.zaoLinkId &&
    !entry.paradeExtra &&
    (entry.field === KR_ANG ||
      entry.field === KR_SRA ||
      entry.field === KR_ABW) &&
    (entry.anchorPhaseLinkId || null) === null &&
    (entry.anchorRowId || entry.itemId) === entry.itemId
  ) {
    await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
      for (const draft of drafts) {
        const m = draft.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        const prev = Math.max(
          0,
          Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
        )
        m[KR_MOTHER_PRIMARY_USED_THIS_ROUND] = Math.max(0, prev - 1)
      }
    })
  }
}

function lhStampMatchesAnchorRemoval(e, itemId, onlyAnchorPhaseLinkId) {
  if (e.itemId !== itemId || e.field !== KR_LH_ACTION) return false
  if (onlyAnchorPhaseLinkId === undefined) return true
  const apl = e.anchorPhaseLinkId
  if (onlyAnchorPhaseLinkId === null)
    return apl == null || apl === ''
  return apl === onlyAnchorPhaseLinkId
}

/**
 * L.H.-Stempel für das Token entfernen und krLhAction an verbleibende Stempel anpassen.
 * @param {string | null | undefined} [onlyAnchorPhaseLinkId] — `undefined`: alle L.H.-Stempel; `null`: nur unter Token-Zeile; `string`: nur dieser Phasen-Link (2.A. / lhDone).
 */
export async function clearKrLhStampsForItem(itemId, onlyAnchorPhaseLinkId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!canEditSceneItem(item)) return
  const skipGmStamp = canEditSceneItem(item) && !isGmSync()
  let newLhCount = 0
  await patchActionStamps(
    (stamps) => {
      const entries = stamps.entries.filter(
        (e) =>
          !lhStampMatchesAnchorRemoval(e, itemId, onlyAnchorPhaseLinkId)
      )
      newLhCount = entries.filter(
        (e) => e.itemId === itemId && e.field === KR_LH_ACTION
      ).length
      const anchorId =
        entries.length > 0
          ? stamps.anchorId ||
            (typeof getCombat().currentItemId === 'string'
              ? getCombat().currentItemId
              : itemId)
          : null
      return { anchorId, entries }
    },
    { skipGmCheck: skipGmStamp }
  )
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (m) {
        m[KR_LH_ACTION] = newLhCount
        if (readKrFirstSlotKind(m) === 'lh') {
          syncKrPrimaryLadungFromPrimaryField(m)
        }
      }
    }
  })
}

/**
 * Wie einmal S.R.A. o. ä. klicken: Stempel + Zähler 1 (vorher L.H.-Stempel dieses Tokens leeren).
 * @param {string | null | undefined} [stampPhaseLinkId] — `null` = Token-Zeile; String = Phasen-Link (2.A. …); `undefined` = Anker wie aktueller Kampfschritt.
 */
export async function applyLhOneClickStamp(itemId, stampPhaseLinkId) {
  if (stampPhaseLinkId === undefined) {
    await clearKrLhStampsForItem(itemId)
  } else {
    await clearKrLhStampsForItem(itemId, stampPhaseLinkId)
  }
  const stampOpts =
    stampPhaseLinkId !== undefined
      ? {
          stampAnchor: {
            rowId: itemId,
            phaseLinkId:
              typeof stampPhaseLinkId === 'string' ? stampPhaseLinkId : null,
          },
        }
      : {}
  await patchKrCounterByDelta(itemId, KR_LH_ACTION, 1, {
    ...stampOpts,
    skipLhSecondCheck: true,
  })
}

/**
 * Alle Kampfteilnehmer: Ang./Abw./S.R.A./F.A. auf 0 (neue Kampfrunde / Kampfstart).
 *
 * Wichtig: Wenn eine Längerfristige Handlung (LH_MAX > 0) noch läuft UND in
 * dieser Runde NICHT endet, darf weder `KR_FIRST_SLOT_KIND` noch die
 * L.H.-Ladung (`KR_LH_ACTION`) zurückgesetzt werden. Endet die L.H. jedoch in
 * `targetRound`, wird `skipActionInit: false` verwendet — der Pool-Rebuild
 * stellt das vollständige Aktionsbudget wieder her, sodass das 2.AO als
 * reguläres Objekt (volles ang/abw, Slot `ang/marks:1`) starten kann.
 *
 * @param {{ resetStamps?: boolean, targetRound?: number }} [opts]
 */
export async function resetAllKrCountersInScene(opts = {}) {
  const { resetStamps = true, targetRound } = opts
  const items = await OBR.scene.items.getItems((item) =>
    Boolean(item.metadata?.[TRACKER_ITEM_META_KEY])
  )
  if (items.length === 0) {
    if (resetStamps) {
      await patchActionStamps(() => ({ anchorId: null, entries: [] }))
    }
    return
  }
  await OBR.scene.items.updateItems(
    items.map((i) => i.id),
    (drafts) => {
      for (const draft of drafts) {
        const m = draft.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        migrateHeroExtraCountFields(m)
        const lhSt = readLhState(m)
        const lhMaxActive = lhSt.max > 0
        // skipActionInit nur wenn die L.H. in dieser Runde NOCH NICHT endet.
        // Endet sie in targetRound (oder targetRound unbekannt und L.H. aktiv),
        // wird der Pool voll neu aufgebaut — damit ist das 2.AO ein vollwertiges
        // Objekt mit komplettem ang/abw-Budget statt eines leer verbrauchten.
        const lhStillRunning =
          lhMaxActive &&
          (targetRound == null || isLhLockingActions(m, targetRound))
        const phasesSnap = normalizePhases(m.phases)
        const keepPhasePanelOpen =
          lhMaxActive && phasesSnap.links.length > 0
        const commitIniN = Number(m[LH_COMMIT_INI])
        const ownerIniN = Number(
          String(m.initiative ?? '')
            .trim()
            .replace(',', '.')
        )
        const lhFrom2A =
          lhMaxActive &&
          Number.isFinite(commitIniN) &&
          Number.isFinite(ownerIniN) &&
          commitIniN !== ownerIniN
        const keepKind = lhMaxActive
          ? lhFrom2A
            ? 'lh'
            : m[KR_FIRST_SLOT_KIND]
          : undefined
        const keepPairMode = lhMaxActive ? m[KR_PAIR_MODE] : undefined
        const keepLhSecond = lhMaxActive ? m[KR_LH_SECOND] : undefined
        Object.assign(m, DEFAULT_TRACKER_KR_COUNTERS)
        delete m[LEGACY_KR_ACTION]
        delete m[KR_LH_VOID_BY_TRANSFER]
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        if (lhMaxActive) {
          if (keepKind === 'lh' || keepKind === 'ang' || keepKind === 'sra') {
            m[KR_FIRST_SLOT_KIND] = keepKind
          }
          if (
            typeof keepPairMode === 'string' &&
            KR_PAIR_MODE_VALID.has(keepPairMode)
          ) {
            m[KR_PAIR_MODE] = keepPairMode
          }
          if (keepLhSecond === 0 || keepLhSecond === 1) {
            m[KR_LH_SECOND] = keepLhSecond
          }
          // In jeder neuen KR die Mutter-Ladung der laufenden L.H. wieder
          // bereitstellen (Stern darf nicht „verblasst" aus der Vorrunde
          // übernommen werden). Die Zähler `KR_LH_ACTION` / `KR_PRIMARY_LADUNG`
          // starten deshalb bei 0 (geladen); die Auslöser-Logik in
          // `runLongHandlungAfterCombatUpdate` entscheidet über das Feuern.
          m[KR_LH_ACTION] = 0
          m[KR_PRIMARY_LADUNG] = 0
          const slots = readZaoSlots(m)
          let slotsChanged = false
          for (const key of Object.keys(slots)) {
            if (slots[key].kind === 'lh' && slots[key].marks !== 1) {
              slots[key] = { ...slots[key], marks: 1 }
              slotsChanged = true
            }
          }
          if (slotsChanged) m[KR_ZAO_SLOTS] = slots
        }
        // Mutex z.AT vs schwarzes Schild: jede neue KR startet die Wahl
        // wieder neutral — beide Optionen sind verfuegbar, bis der Spieler
        // den ersten Mutex-Stempel setzt.
        delete m.krExtraChoiceUsed
        // Pro KR-Ladevorgang: heroExtra-ZAO verworfen und frisch — außer eine
        // L.H. läuft noch; dann bleibt die zweite Aktionszeile (L.H. auf ZAO)
        // erhalten, sonst fehlt der Slot nach dem KR-Wechsel.
        if (!lhMaxActive) {
          rebuildHeroExtraAttackRootAndSlot(m)
        }
        const parCount = readHeroExtraParCount(m)
        if (parCount > 0) {
          for (let i = 0; i < parCount; i++) {
            m[paradeExtraFieldForIndex(i)] = 0
          }
          for (let i = parCount; i < HERO_EXTRA_MAX; i++) {
            delete m[paradeExtraFieldForIndex(i)]
          }
        } else {
          for (let i = 0; i < HERO_EXTRA_MAX; i++) {
            delete m[paradeExtraFieldForIndex(i)]
          }
        }
        ensureFullFreeActionQuota(m)
        initKrActionPoolsFromHeroDefaults(m, { skipActionInit: lhStillRunning })
        applyIniLockCharges(m)
        // 2.A.-Panel offen lassen: Liste zeigt Phasen-Zeilen nur bei
        // rowPanelOpen; nach KR-Reset sonst nur Mutterzeile trotz laufender L.H.
        if (keepPhasePanelOpen) {
          const p = normalizePhases(m.phases)
          if (p.links.length > 0) {
            m.phases = finalizePhasesWithOrderedRoots(m, {
              ...p,
              rowPanelOpen: true,
            })
          }
        }
      }
    }
  )
  if (resetStamps) {
    await patchActionStamps(() => ({ anchorId: null, entries: [] }))
  }
}

/**
 * Voll-Reset für Kampfstart / Kampfende: löscht zusätzlich die
 * 2.A.-Slot-Zustände (`KR_ZAO_SLOTS`) und die komplette L.H.-Aktivität
 * (`LH_MAX`, `LH_REM`, `LH_KR_FIRED_ROUND`, `LH_KR_FIRED_MASK`,
 * `LH_DONE_ROUND`, `LH_DONE_INI`) sowie alle Paar-Modi zurück auf Standard
 * (Angriff + Abwehr, Zähler leer).
 *
 * Die 2.A.-Wurzel-Phasen-Links werden separat über
 * `clearAllRootPhaseLinksInScene` aus `phaseLinks.js` geleert.
 *
 * @param {{ restoreHeroExtraZat?: boolean }} [opts]
 *   `restoreHeroExtraZat: true` beim Kampfstart — legt konfigurierte z.AT an.
 */
export async function resetAllTrackerStateForCombatStart(
  { restoreHeroExtraZat = false } = {}
) {
  const items = await OBR.scene.items.getItems((item) =>
    Boolean(item.metadata?.[TRACKER_ITEM_META_KEY])
  )
  if (items.length === 0) {
    await patchActionStamps(() => ({ anchorId: null, entries: [] }))
    return
  }
  await OBR.scene.items.updateItems(
    items.map((i) => i.id),
    (drafts) => {
      for (const draft of drafts) {
        const m = draft.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        migrateHeroExtraCountFields(m)
        Object.assign(m, DEFAULT_TRACKER_KR_COUNTERS)
        delete m[LEGACY_KR_ACTION]
        delete m[KR_LH_VOID_BY_TRANSFER]
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        delete m[KR_ZAO_SLOTS]
        delete m[LH_MAX]
        delete m[LH_REM]
        delete m[LH_KR_FIRED_ROUND]
        delete m[LH_KR_FIRED_MASK]
        delete m[LH_DONE_ROUND]
        delete m[LH_DONE_INI]
        delete m[KR_INI_LOCK_MINUS_A]
        delete m[KR_INI_LOCK_MINUS_B]
        // Mutex z.AT vs schwarzes Schild: Voll-Reset gibt die Wahl wieder
        // vollstaendig frei.
        delete m.krExtraChoiceUsed
        if (restoreHeroExtraZat) {
          rebuildHeroExtraAttackRootAndSlot(m)
        } else {
          stripHeroExtraZatAfterCombatFullReset(m)
        }
        const parCount = readHeroExtraParCount(m)
        if (parCount > 0) {
          for (let i = 0; i < parCount; i++) {
            m[paradeExtraFieldForIndex(i)] = 0
          }
          for (let i = parCount; i < HERO_EXTRA_MAX; i++) {
            delete m[paradeExtraFieldForIndex(i)]
          }
        } else {
          for (let i = 0; i < HERO_EXTRA_MAX; i++) {
            delete m[paradeExtraFieldForIndex(i)]
          }
        }
        ensureFullFreeActionQuota(m)
        initKrActionPoolsFromHeroDefaults(m)
        applyIniLockCharges(m)
      }
    }
  )
  await patchActionStamps(() => ({ anchorId: null, entries: [] }))
}
