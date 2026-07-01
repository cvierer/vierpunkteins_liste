/**
 * lhEngine.js — Zentrale Quelle der Längerfristigen-Handlung-Wahrheit (V2).
 *
 * Diese Datei ist die einheitliche Fassade für alles rund um die L.H.:
 *   • Datenmodell + Migration alter Felder (verlustarm)
 *   • Lifecycle:  startOrCancelLh / cancelLh
 *   • Trigger an Helden-INI und Helden-INI − 8 (bestehende Engine-Logik)
 *   • KR-Übertrag (firedMask reset pro Kampfrunde)
 *   • INI < 0 Sonderregel: nur ein Trigger pro KR (bereits implizit, weil
 *     T = heroIni − 8 < 0 herausgefiltert wird)
 *   • Sperr-Prädikat `isLhActive(meta)` in lhMeta.js für Ang/SRA/Schild/Parade/ZAO/Transfer
 *   • UI-Helfer: "Aktion N / M"-Text + Pie-Füllgrad
 *   • Phase-Links: 1 Wurzel auf Offset 8 (an INI − 8) beim Start anlegen
 *
 * Bestehendes Trigger-/Maskenverhalten in `runLongHandlungAfterCombatUpdate`
 * (siehe `longHandlung.js`) bleibt unverändert — diese Datei wird zur
 * einzigen öffentlichen API für UI/Locks und delegiert bei Bedarf.
 */

import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem } from './editAccess.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'
import { getCombat } from './combatRoom.js'
import {
  clearKrLhStampsForItem,
  KR_MOTHER_PRIMARY_USED_THIS_ROUND,
  normalizeHeroKrStateAfterLhEnd,
  patchZaoSlot,
} from './krCounters.js'
import {
  hookIniForLink,
  normalizePhases,
  patchItemPhases,
  sortedLinksForLayout,
} from './phaseLinks.js'
import {
  freezeLhCommitKrPriorSpendFromLive,
  LH_COMMIT_INI,
  LH_COMMIT_KR_PRIOR_SPEND,
  LH_COMMIT_ROUND,
  LH_DONE_INI,
  LH_DONE_ROUND,
  LH_KR_FIRED_MASK,
  LH_KR_FIRED_ROUND,
  LH_MAX,
  LH_REM,
  readLhMechanics,
  readLhState,
} from './lhMeta.js'

/** @type {Promise<void> | null} */
let lhLifecyclePromise = null

/** @type {(() => void) | null} */
let onLhCommitRenderFlush = null
/** @type {Promise<void> | null} */
let lhRenderFlushPromise = null

/**
 * @param {() => void | Promise<void>} fn
 */
export function registerLhCommitRenderFlush(fn) {
  onLhCommitRenderFlush = fn
}

function notifyLhCommitRenderFlush() {
  if (!onLhCommitRenderFlush) return
  try {
    const result = onLhCommitRenderFlush()
    if (result && typeof result.then === 'function') {
      lhRenderFlushPromise = result.finally(() => {
        if (lhRenderFlushPromise === result) lhRenderFlushPromise = null
      })
    }
  } catch {
    /* ignore */
  }
}

/**
 * Wartet auf laufenden L.H.-Start/Abbrechen (Counter-Blur vs. Kampf-Navigation).
 */
export async function awaitLhLifecycleIdle() {
  if (lhLifecyclePromise) await lhLifecyclePromise
  if (lhRenderFlushPromise) {
    await Promise.race([
      lhRenderFlushPromise,
      new Promise((r) => setTimeout(r, 400)),
    ])
  }
}

function trackLhLifecyclePromise(promise) {
  lhLifecyclePromise = promise.finally(() => {
    if (lhLifecyclePromise === promise) lhLifecyclePromise = null
  })
  return lhLifecyclePromise
}

/**
 * Migrationshelfer: bereinigt ausgelaufene Legacy-Felder, falls vorhanden.
 * In-place; idempotent.
 *
 * Default-Strategie: `migrate_lossy` — alte Hilfsfelder werden gelöscht;
 * `lhMax`/`lhRemaining`/`lhKrFiredRound`/`lhKrFiredMask` bleiben aktive
 * Fortschrittsdaten (Schemata sind kompatibel).
 *
 * @param {Record<string, unknown>} m
 */
function migrateLegacyLhFields(m) {
  if (!m || typeof m !== 'object') return
  delete m.lhPendingSecondRound
  delete m.lhPendingSecondTargetIni
}

/**
 * Komfort-Text "Aktion N / M" für UI-Badges. Liefert leeren String, wenn
 * keine L.H. aktiv ist. Bei `GO!` (letzter offener Auslöser einer mehrteiligen
 * L.H.) wird `M / M` ausgegeben — die UI kann das `GO!`-Label parallel
 * anzeigen (Pie-Text kommt aus lhMeta: lhProgressFractionText).
 *
 * @param {unknown} meta
 * @param {number | null | undefined} combatRound
 */
export function actionStepText(meta, combatRound = null) {
  const st = readLhState(meta)
  if (!(st.max > 0 && st.rem > 0)) return ''
  if (st.max > 1 && st.rem === 1) return `${st.max} / ${st.max}`
  const naive = st.max - st.rem + 1
  return `${naive} / ${st.max}`
}

/**
 * Längerfristige Handlung starten oder beenden.
 *  • `n >= 1` startet (oder ersetzt) die L.H. mit `n` Aktionen.
 *  • `n <= 0` (oder leerer String) bricht eine laufende L.H. ab.
 *
 * @param {string} itemId
 * @param {string | number} text
 * @param {{ stampPhaseLinkId?: string | null, commitIni?: number | null }} [opts]
 */
export async function startOrCancelLh(itemId, text, opts) {
  const run = async () => {
    const o = opts ?? {}
    const trimmed = String(text ?? '').trim()
    const n =
      trimmed === '' ? 0 : Math.floor(Number(trimmed.replace(',', '.')))
    if (trimmed !== '' && (!Number.isFinite(n) || n < 0)) return
    const round = getCombat().started ? getCombat().round : 1
    await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      if (n <= 0) {
        normalizeHeroKrStateAfterLhEnd(m, { forcePrimaryReset: true })
      } else {
        migrateLegacyLhFields(m)
        m[LH_MAX] = n
        m[LH_REM] = n
        m[LH_KR_FIRED_ROUND] = round
        m[LH_KR_FIRED_MASK] = 0
        m[LH_COMMIT_ROUND] = round
        delete m[LH_COMMIT_INI]
        if (Number.isFinite(Number(o.commitIni))) {
          m[LH_COMMIT_INI] = Number(o.commitIni)
        }
        delete m[LH_DONE_ROUND]
        delete m[LH_DONE_INI]
        const liveMother = Math.max(
          0,
          Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
        )
        const ownerIniStart = Number(
          String((d.metadata && d.metadata.initiative) ?? d.initiative ?? '')
            .trim()
            .replace(',', '.')
        )
        const mechStart = readLhMechanics(m)
        const commitIniOpt = Number.isFinite(Number(o.commitIni))
          ? Number(o.commitIni)
          : undefined
        m[LH_COMMIT_KR_PRIOR_SPEND] = freezeLhCommitKrPriorSpendFromLive(
          ownerIniStart,
          mechStart.actionsPerKr,
          mechStart.triggerIniStep,
          commitIniOpt,
          liveMother
        )
      }
    }
  })

  const itemsAfter = await OBR.scene.items.getItems()
  const itemAfter = itemsAfter.find((i) => i.id === itemId)
  if (!canEditSceneItem(itemAfter)) return

  // L.H. von der 2.A.-Wurzel (n.A., nicht T0): Padlock schließen und ZAO-Slot
  // „lh“ wieder geladen — sonst verschwindet die Wurzel vor KR-Reset (ephemeral)
  // und der Pie-Slot bleibt verbraucht.
  if (n > 0) {
    const mAfter = itemAfter.metadata?.[TRACKER_ITEM_META_KEY]
    const commitIniStored = mAfter?.[LH_COMMIT_INI]
    const commitN = Number(commitIniStored)
    const ownerIni = Number(
      String(itemAfter.metadata?.initiative ?? '')
        .trim()
        .replace(',', '.')
    )
    if (
      Number.isFinite(commitN) &&
      Number.isFinite(ownerIni) &&
      commitN !== ownerIni
    ) {
      try {
        const metaFull = itemAfter.metadata || {}
        const p0 = normalizePhases(metaFull.phases)
        const links = p0.links
        const ownerIniStr = String(metaFull.initiative ?? '')
        let targetId = null
        const roots = sortedLinksForLayout(links).filter(
          (l) =>
            l.parentId === null &&
            !l.heroExtra &&
            l.lhEnd !== true
        )
        for (const r of roots) {
          const hook = hookIniForLink(r.id, ownerIniStr, links)
          if (Number.isFinite(hook) && hook === commitN) {
            targetId = r.id
            break
          }
        }
        if (targetId) {
          await patchItemPhases(itemId, (p) => ({
            ...p,
            links: p.links.map((l) =>
              l.id === targetId ? { ...l, expiresNextRound: false } : l
            ),
          }))
          try {
            await patchZaoSlot(itemId, targetId, { kind: 'lh', marks: 1 })
          } catch {
            /* nicht kritisch */
          }
        }
      } catch {
        /* nicht kritisch */
      }
    }
  }

  // Neue Mechanik: L.H.-Start erzeugt KEINE 2.A.-Wurzel mehr. Die L.H. läuft
  // passiv ab; ein temporäres n.A.-Objekt wird – falls nötig – erst zu Beginn
  // jener KR erzeugt, in der die L.H. endet (siehe applyLhKrStartObjects in
  // longHandlung.js). Bis dahin füllt sich nur der Pie am Mutter-Stern.

  // Stempel: laufende L.H. erzeugt erst beim manuellen Abschluss-Stempel
  // eine Linie. Bestehende L.H.-Stempel dieses Tokens werden hier bereinigt
  // (entweder ganz oder nur am angegebenen Phasen-Anker).
  if (
    Object.prototype.hasOwnProperty.call(o, 'stampPhaseLinkId') &&
    o.stampPhaseLinkId !== null
  ) {
    void clearKrLhStampsForItem(itemId, o.stampPhaseLinkId)
  } else {
    void clearKrLhStampsForItem(itemId)
  }
  notifyLhCommitRenderFlush()
  }

  return trackLhLifecyclePromise(run())
}

/**
 * Komfort-Wrapper: laufende L.H. abbrechen (Abbrechen-Button).
 * @param {string} itemId
 */
export async function cancelLh(itemId) {
  await cancelLhAndRestoreHeroCombatDefault(itemId)
}

/**
 * L.H. abbrechen und Held auf lokalen Kampfstart-Default zurücksetzen
 * (wie × am L.H.-Feld; auch für Umwandel-Pfeile während laufender L.H.).
 *
 * @param {string} itemId
 */
export async function cancelLhAndRestoreHeroCombatDefault(itemId) {
  await startOrCancelLh(itemId, '')
}
