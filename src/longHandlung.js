/**
 * longHandlung.js — passiver L.H.-Lebenszyklus.
 *
 * Architekturwechsel (V409+): Die L.H. ist jetzt ein passiver Zähler, der
 * sich rein über die Navigation aufbaut (siehe Pie am Stern). Diese Datei
 * tut deutlich weniger als früher:
 *
 *   • KEINE rem-Reduktion mehr beim Vorbei-Navigieren über Auslöser-INIs.
 *   • KEIN automatischer Abschluss-Stempel mehr (`applyLhOneClickStamp`).
 *   • KEINE synthetische 2.A.-Done-Zeile mehr (`LH_DONE_ROUND/INI`).
 *   • KEIN automatisches 2.A.-Schloss (`setFirstZaoRootExpiresNextRound`).
 *
 *   • Bei KR-Beginn pruefen, ob die L.H. in dieser KR endet — falls ja und
 *     End-INI < Helden-INI, ein temporaeres n.A.-Objekt am End-INI-Schritt
 *     anlegen (Helper `applyLhKrStartObjects`).
 *   • Beim Vorbei-Navigieren ueber die berechnete End-INI ohne Stempel:
 *     Tracker-Aktivitaet zuruecksetzen — das LH-Wertfeld wird wieder frei
 *     und editierbar. Das n.A.-Objekt bleibt sichtbar bis zum KR-Ende
 *     (`expiresNextRound: true` regelt den Lifecycle).
 */

import OBR from '@owlbear-rodeo/sdk'
import { isGmSync } from './editAccess.js'
import { getCombat } from './combatRoom.js'
import {
  buildCombatTurnSteps,
  buildMergedDisplayRows,
  findCombatStepIndex,
  hookIniForLink,
  normalizePhases,
  sortedLinksForLayout,
  upsertLhLinkedZaoRoot,
} from './phaseLinks.js'
import {
  collectSortedParticipants,
  TRACKER_ITEM_META_KEY,
} from './participants.js'
import { getManualIniTieOverridePairs } from './manualIniTieOverrides.js'
import {
  LH_COMMIT_INI,
  LH_COMMIT_ROUND,
  LH_DONE_INI,
  LH_DONE_ROUND,
  lhAwaitingCompletionStamp,
  lhDisplayStepFromNav,
  lhEndsInRound,
  readLhCommitKrPriorSpendForRound,
  readLhMechanics,
  readLhState,
} from './lhMeta.js'
import { cancelLh, startOrCancelLh } from './lhEngine.js'
import {
  ensureLhEndRootAtHook,
  normalizeHeroKrStateAfterLhEnd,
  restoreRegularSecondActionRootAfterLh,
} from './krCounters.js'

export { LH_DONE_INI } from './lhMeta.js'

let lhPrevCombat = null
let lhRunInFlight = false
/** @type {{ items: import('@owlbear-rodeo/sdk').Item[], tieOrderIds: string[] } | null} */
let lhRunPendingArgs = null
/**
 * Migrationsflag (Phase 8): einmal pro Session beim ersten echten runLong
 * werden die ausgemusterten Felder `LH_DONE_ROUND` / `LH_DONE_INI` entfernt
 * (sie haben in der neuen passiven Mechanik keine Funktion mehr).
 */
let lhDoneFieldsMigrated = false

function combatSnapshot(c) {
  return {
    started: Boolean(c.started),
    round: c.round,
    roundIntroPending: Boolean(c.roundIntroPending),
    currentItemId: c.currentItemId,
    currentPhaseLinkId: c.currentPhaseLinkId,
  }
}

function parseIni(value) {
  const n = Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function getCurrentStepContext(rows, items, tieOrderIds, combat) {
  const combatRound = combat.started ? combat.round : null
  const merged = buildMergedDisplayRows(rows, items, tieOrderIds, combatRound)
  const steps = buildCombatTurnSteps(rows, items, tieOrderIds, combatRound)
  const idx = findCombatStepIndex(steps, combat)
  const ownerIniById = new Map(rows.map((r) => [r.id, parseIni(r.initiative)]))
  if (idx < 0 || idx >= merged.length) {
    return {
      idx: -1,
      activeIni: null,
      ownerIniById,
      atRoundBoundaryStep: false,
    }
  }
  const current = merged[idx]
  const atRoundBoundaryStep =
    current.kind === 'roundEnd' || current.kind === 'roundStart'
  const activeIni =
    atRoundBoundaryStep
      ? 0
      : current.kind === 'token'
        ? parseIni(current.row.initiative)
        : Number.isFinite(current.hookIni)
          ? current.hookIni
          : null
  return { idx, activeIni, ownerIniById, atRoundBoundaryStep }
}

/**
 * Liste „Beginn/Ende Kampfrunde“: keine echte INI — Phase-6-L.H.-Reset nicht anwenden.
 *
 * @param {string | undefined} kind
 * @returns {boolean}
 */
export function isRoundBoundaryMergedKind(kind) {
  return kind === 'roundStart' || kind === 'roundEnd'
}

/**
 * L.H.-Wert setzen (leer / 0 = aus). Adapter-Wrapper über `lhEngine.startOrCancelLh`.
 *
 * @param {{ stampPhaseLinkId?: string | null, commitIni?: number | null }} [opts] — Liste: `null` = Token-Zeile; Phasen-Link-ID = 2.A.-Zeile; weglassen = Stempel-Anker wie Kampfschritt. `commitIni` = Nav-INI beim Zähler-Commit (n.A.-Start).
 */
export async function commitLhValue(itemId, text, opts) {
  await startOrCancelLh(itemId, text, opts)
}

export { cancelLh }

/** Entfernt Legacy-Felder `LH_DONE_ROUND` / `LH_DONE_INI` aus den Tracker-Metadaten. */
export async function removeLhDoneRow(itemId) {
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      delete m[LH_DONE_ROUND]
      delete m[LH_DONE_INI]
    }
  })
}

/**
 * Legacy-No-op: in der neuen passiven Mechanik existiert keine L.H.-Done-Zeile
 * mehr, deren Ziel-INI der Spieler verschieben koennte. Bleibt als Export,
 * damit Aufrufer (`initiativeList.js`) ohne Refactor weiter compile-fest
 * bleiben.
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function tryCommitLhDoneTargetIni(_itemId, _iniStr) {
  return { ok: false }
}

/**
 * Phase 8 (Migration): einmalig je Session ausgemusterte Done-Felder von allen
 * Tracker-Items entfernen. Ist idempotent: wenn keine Done-Felder mehr
 * existieren, kein Schreibvorgang.
 */
async function migrateAwayLhDoneFields() {
  if (lhDoneFieldsMigrated) return
  lhDoneFieldsMigrated = true
  if (!isGmSync()) return
  const all = await OBR.scene.items.getItems()
  const targets = []
  for (const item of all) {
    const m = item.metadata?.[TRACKER_ITEM_META_KEY]
    if (!m) continue
    if (m[LH_DONE_ROUND] != null || m[LH_DONE_INI] != null) {
      targets.push(item.id)
    }
  }
  if (targets.length === 0) return
  await OBR.scene.items.updateItems(targets, (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      delete m[LH_DONE_ROUND]
      delete m[LH_DONE_INI]
    }
  })
}

/**
 * KR-Beginn-Hook (Phase 3): fuer jedes Token mit aktiver L.H. pruefen, ob
 * sie in dieser KR endet, und falls End-INI < Helden-INI, ein temporaeres
 * n.A.-Objekt am End-INI-Schritt anlegen. Endet sie am Mutterobjekt
 * (End-INI === Helden-INI), wird kein Extra-Objekt erzeugt — der LH-Stern
 * an der Mutter ist dann beim Helden-Turn voll und manuell stempelbar.
 *
 * Aufruf-Punkt: `applyCombatNext` in `combatControls.js`, direkt nach
 * `resetAllKrCountersInScene()` im roundIntroPending-Pfad.
 *
 * @param {number} currentRound aktive KR (>= 1)
 */
export async function applyLhKrStartObjects(currentRound) {
  if (!isGmSync()) return
  const cr = Math.max(1, Math.floor(Number(currentRound)) || 1)
  const items = await OBR.scene.items.getItems((it) =>
    Boolean(it.metadata?.[TRACKER_ITEM_META_KEY])
  )
  for (const item of items) {
    const meta = item.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    const { max, rem } = readLhState(meta)
    if (max <= 0 || rem <= 0) continue
    const ownerIni = parseIni(meta.initiative)
    if (!Number.isFinite(ownerIni)) continue
    const mech = readLhMechanics(meta)
    const commitRound =
      Math.max(1, Math.floor(Number(meta[LH_COMMIT_ROUND])) || 0) || cr
    const commitIniN = Number(meta[LH_COMMIT_INI])
    const priorSpend = readLhCommitKrPriorSpendForRound(meta, cr)
    const { endsInThisRound, endIni } = lhEndsInRound(
      max,
      commitRound,
      cr,
      ownerIni,
      mech.actionsPerKr,
      mech.triggerIniStep,
      Number.isFinite(commitIniN) ? commitIniN : null,
      priorSpend
    )
    // Zwischen-KRs: L.H. von der 2.A. gestartet — Wurzel ggf. wiederherstellen
    // (ephemeral gelöscht / manuell geschlossen), ohne V490 am Mutter-Start zu stören.
    if (
      !endsInThisRound &&
      Number.isFinite(commitIniN) &&
      Number.isFinite(ownerIni) &&
      commitIniN !== ownerIni
    ) {
      try {
        const fullMeta = item.metadata || {}
        const p0 = normalizePhases(meta.phases)
        const links = p0.links
        const ownerIniStr = String(fullMeta.initiative ?? '')
        const roots = sortedLinksForLayout(links).filter(
          (l) =>
            l.parentId === null &&
            !l.heroExtra &&
            l.lhEnd !== true
        )
        let hasLhSecondRoot = false
        for (const r of roots) {
          const hook = hookIniForLink(r.id, ownerIniStr, links)
          if (Number.isFinite(hook) && hook === commitIniN) {
            hasLhSecondRoot = true
            break
          }
        }
        if (!hasLhSecondRoot) {
          await upsertLhLinkedZaoRoot(item.id, max, ownerIniStr)
        }
      } catch {
        /* nicht kritisch */
      }
    }
    if (!endsInThisRound) continue
    if (endIni == null || !Number.isFinite(endIni)) continue
    if (endIni === ownerIni) {
      // L.H. endet am Mutterobjekt (erste Aktion): es wird kein lhEnd-Objekt
      // erzeugt. Die regulaere 2.AO-Wurzel wurde beim KR-Start als ephemere
      // Wurzel entfernt und wegen skipActionInit (laufende L.H.) nicht neu
      // aufgebaut. Hier — als letzter KR-Start-Hook, vor jeder Navigation in
      // dieser KR — wiederherstellen, sonst ueberspringt „Weiter" das 2.AO.
      // Idempotent: No-op, wenn bereits eine navigierbare regulaere Wurzel da
      // ist bzw. Budget/INI es nicht hergeben.
      try {
        await OBR.scene.items.updateItems([item.id], (drafts) => {
          for (const d of drafts) {
            const m2 = d.metadata?.[TRACKER_ITEM_META_KEY]
            if (!m2) continue
            restoreRegularSecondActionRootAfterLh(m2)
          }
        })
      } catch {
        /* nicht kritisch */
      }
      continue
    }
    const offset = ownerIni - endIni
    if (!(offset > 0)) continue
    try {
      await OBR.scene.items.updateItems([item.id], (drafts) => {
        for (const d of drafts) {
          const m2 = d.metadata?.[TRACKER_ITEM_META_KEY]
          if (!m2) continue
          ensureLhEndRootAtHook(m2, endIni, offset)
        }
      })
    } catch {
      /* nicht kritisch */
    }
  }
}

/**
 * Nav-Hook (Phase 6): wird bei jeder Navigation aufgerufen. Reduziert NICHTS
 * mehr im Tracker, sondern setzt die L.H. nur dann zurueck, wenn die
 * Navigation strikt unter die berechnete End-INI faellt (Vorbei-Navigieren
 * ohne Stempel). Das n.A.-Objekt selbst bleibt sichtbar bis zum KR-Ende
 * (`expiresNextRound: true` regelt den Lifecycle bei der nächsten KR).
 *
 * @returns {Promise<boolean>} true, wenn Items mutiert wurden (Re-Render noetig)
 */
export async function runLongHandlungAfterCombatUpdate(items, tieOrderIds) {
  // Re-entrant Calls aus der Notify-Kaskade verwerfen — sonst kaskadieren
  // Render und State-Updates ineinander und die Liste kann transient
  // einen leeren Zwischenstand zeigen (Symptom: Spielerliste leer,
  // GM-Navigation tot).
  if (lhRunInFlight) {
    lhRunPendingArgs = { items, tieOrderIds }
    return false
  }
  lhRunInFlight = true
  let mutated = false
  try {
    mutated = await runLongHandlungAfterCombatUpdateInner(items, tieOrderIds)
  } finally {
    lhRunInFlight = false
    if (lhRunPendingArgs) {
      const pending = lhRunPendingArgs
      lhRunPendingArgs = null
      void runLongHandlungAfterCombatUpdate(pending.items, pending.tieOrderIds)
    }
  }
  return mutated
}

async function runLongHandlungAfterCombatUpdateInner(items, tieOrderIds) {
  await migrateAwayLhDoneFields()

  const curr = getCombat()
  const prev = lhPrevCombat

  if (!curr.started || curr.roundIntroPending) {
    lhPrevCombat = combatSnapshot(curr)
    return false
  }

  const rows = collectSortedParticipants(
    items,
    tieOrderIds,
    getManualIniTieOverridePairs()
  )
  const currCtx = getCurrentStepContext(rows, items, tieOrderIds, curr)

  if (currCtx.idx < 0 || !isGmSync()) {
    lhPrevCombat = combatSnapshot(curr)
    return false
  }

  if (!prev || !prev.started) {
    lhPrevCombat = combatSnapshot(curr)
    return false
  }

  const prevCtx = getCurrentStepContext(rows, items, tieOrderIds, prev)
  const prevIni = prevCtx.activeIni
  const currIni = currCtx.activeIni
  const trackerItems = items.filter((i) => i.metadata?.[TRACKER_ITEM_META_KEY])

  // Phase 6: Vorbei-Navigieren ohne Stempel = Tracker-Reset.
  // Trigger: aktuelle Navigation strikt unter endIni UND vorherige Position
  // war auf/oberhalb endIni (Helden- oder n.A.-Objekt-Phase). Beruecksichtigt
  // wird nur Vorwaertsnavigation (currIni < prevIni) innerhalb derselben KR.
  // KR-Beginn/-Ende-Marker nutzen activeIni=0 — Navigation dorthin darf keine L.H. abbrechen.
  if (
    !currCtx.atRoundBoundaryStep &&
    Number.isFinite(currIni) &&
    Number.isFinite(prevIni) &&
    Number.isFinite(curr.round) &&
    Number.isFinite(prev.round) &&
    curr.round === prev.round
  ) {
    /** @type {string[]} */
    const resetIds = []
    for (const item of trackerItems) {
      const meta = item.metadata[TRACKER_ITEM_META_KEY]
      const { max, rem } = readLhState(meta)
      if (max <= 0 || rem <= 0) continue
      // „GO!“ / letzter Auslöser: Stempel noch möglich — nicht zurücksetzen.
      if (lhAwaitingCompletionStamp(meta)) continue
      const ownerIni = currCtx.ownerIniById.get(item.id)
      if (!Number.isFinite(ownerIni)) continue
      const mech = readLhMechanics(meta)
      const commitRound =
        Math.max(1, Math.floor(Number(meta[LH_COMMIT_ROUND])) || 0) ||
        curr.round
      const commitIniN = Number(meta[LH_COMMIT_INI])
      const priorSpend = readLhCommitKrPriorSpendForRound(meta, curr.round)
      const { endsInThisRound, endIni } = lhEndsInRound(
        max,
        commitRound,
        curr.round,
        ownerIni,
        mech.actionsPerKr,
        mech.triggerIniStep,
        Number.isFinite(commitIniN) ? commitIniN : null,
        priorSpend
      )
      if (!endsInThisRound) continue
      if (endIni == null || !Number.isFinite(endIni)) continue
      // Ergänzung zu rem===1 (lhAwaitingCompletionStamp): Nav-Schritt wie Pie /
      // „x/max“ — kann bei noch höherem rem schon max erreichen (Maske/Bits).
      const navCompletionStep = lhDisplayStepFromNav(
        ownerIni,
        mech,
        commitRound,
        curr.round,
        currIni,
        max,
        Number.isFinite(commitIniN) ? commitIniN : undefined,
        priorSpend
      )
      if (navCompletionStep >= max) continue
      // Vorbei-Navigation: vorher >= endIni, jetzt strikt < endIni.
      if (prevIni < endIni) continue
      if (currIni >= endIni) continue
      resetIds.push(item.id)
    }
    if (resetIds.length > 0) {
      await OBR.scene.items.updateItems(resetIds, (drafts) => {
        for (const d of drafts) {
          const m = d.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          // Vorbei-Navigieren ohne Stempel = L.H.-Ende: Held auf sauberen
          // Kampfstart-Zustand bringen (alle regulaeren 2.AO-Wurzeln voll
          // umwandelbar), statt nur eine einzelne Wurzel zu reparieren.
          normalizeHeroKrStateAfterLhEnd(m)
        }
      })
      lhPrevCombat = combatSnapshot(curr)
      return true
    }
  }

  lhPrevCombat = combatSnapshot(curr)
  return false
}
