import { isGmSync } from './editAccess.js'
import {
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
} from './combatStepIds.js'
import { getRoomSettings } from './roomSettings.js'
import { readEffectiveZaoSlotKind, readZaoSlot } from './krCounters.js'

export function isHeroConvertAnytimeMode(m) {
  if (!m || typeof m !== 'object') return false
  return m.convertAllowEntireRound === true || m.convertAnytimeEnabled === true
}

/**
 * Entscheidet, ob der aktuelle Betrachter (kein SL) bei diesem Token die
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
 *     · `convertAllowFirstPhase`  → erlaubt bis einschließlich Mutter-Zug in der
 *       globalen Zugreihenfolge (nicht nur gleiche INI-Zahl).
 *     · andernfalls → nicht erlaubt.
 */

/**
 * @param {string} ownerId
 * @param {ReturnType<typeof buildConvertListVisibilityCtx>} ctx
 */
export function hasPassedHeroMotherTurnStep(ownerId, ctx) {
  if (!ownerId || !ctx?.turnSteps) return false
  const idx = ctx.combatStepIndex
  if (idx == null || idx < 0) return false
  const motherIdx = ctx.turnSteps.findIndex(
    (s) => s.kind === 'token' && s.id === ownerId
  )
  if (motherIdx < 0) return false
  return idx > motherIdx
}

function isFirstPhaseConvertAllowed(
  trackerMeta,
  ownerItemId,
  visibilityCtx,
  currentNavIni
) {
  if (ownerItemId && visibilityCtx?.turnSteps && visibilityCtx.combatStepIndex != null) {
    return !hasPassedHeroMotherTurnStep(ownerItemId, visibilityCtx)
  }
  if (currentNavIni == null) return true
  const heroIni = Number(
    String(trackerMeta.initiative ?? '').trim().replace(',', '.')
  )
  if (!Number.isFinite(heroIni)) return false
  return currentNavIni >= heroIni
}

/**
 * @param {unknown} trackerMeta
 * @param {string | null | undefined} rowActiveId
 * @param {string | null | undefined} rowActivePhaseLinkId
 * @param {number | null | undefined} currentNavIni
 * @param {{ ownerItemId?: string | null, visibilityCtx?: ReturnType<typeof buildConvertListVisibilityCtx> | null } | null | undefined} [options]
 */
export function isHeroConvertAllowedForViewer(
  trackerMeta,
  rowActiveId,
  rowActivePhaseLinkId,
  currentNavIni,
  options = null
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
    const ownerItemId = options?.ownerItemId ?? null
    const visibilityCtx = options?.visibilityCtx ?? null
    return isFirstPhaseConvertAllowed(
      trackerMeta,
      ownerItemId,
      visibilityCtx,
      currentNavIni
    )
  }
  return false
}

/** Primär-Umtauschpfeile anzeigen (nicht nur klickbar). */
export function shouldShowKrPrimaryConvertSwitch(
  convertAllowedByLock,
  switchLocked
) {
  return convertAllowedByLock && !switchLocked
}

/** Reguläre 2.AO-Wurzel (kein z.AT, kein L.H.-Ende). */
export function isRegularZaoRootLink(link) {
  return (
    link != null &&
    link.parentId === null &&
    !link.heroExtra &&
    link.lhEnd !== true
  )
}

/**
 * Keine Aktion im 2.AO-Primärfeld: Slot fehlt oder effektiver Typ UO.
 * @param {unknown} meta
 * @param {{ id?: string, parentId?: string | null, heroExtra?: string, lhEnd?: boolean }} link
 */
export function isRegularZaoUnset(meta, link) {
  if (!isRegularZaoRootLink(link)) return false
  const linkId = link.id
  if (typeof linkId !== 'string') return false
  const slot = readZaoSlot(meta, linkId)
  if (!slot) return true
  return readEffectiveZaoSlotKind(slot) === 'uo'
}

/**
 * @param {{
 *   combatStarted?: boolean
 *   roundIntroPending?: boolean
 *   rowActiveId?: string | null
 *   rowActivePhaseLinkId?: string | null
 *   roundStartStepId?: string
 *   roundEndStepId?: string
 * } | null | undefined} ctx
 */
export function isConvertListAtRoundBoundary(ctx) {
  if (!ctx) return false
  if (ctx.roundIntroPending) return true
  if (!ctx.combatStarted) return true
  if (!ctx.rowActivePhaseLinkId) {
    const id = ctx.rowActiveId
    const startId = ctx.roundStartStepId ?? ROUND_START_STEP_ID
    const endId = ctx.roundEndStepId ?? ROUND_END_STEP_ID
    if (id === startId || id === endId) return true
  }
  return false
}

/**
 * Spieler: reguläre 2.AO-Zeile ausblenden (Schloss + leerer Slot).
 * @param {unknown} meta
 * @param {{ id?: string, parentId?: string | null, heroExtra?: string, lhEnd?: boolean }} link
 * @param {ReturnType<typeof buildConvertListVisibilityCtx>} ctx
 */
/**
 * @param {string | null | undefined} [ownerItemId]
 */
export function shouldHideEmptySecondActionRow(meta, link, ctx, ownerItemId = null) {
  if (isGmSync()) return false
  if (!ctx || !isRegularZaoRootLink(link)) return false
  if (!isRegularZaoUnset(meta, link)) return false
  if (isConvertListAtRoundBoundary(ctx)) return false

  const lock = getRoomSettings().convertLockState
  if (lock === 'open') return false
  if (lock === 'closed') return true

  if (isHeroConvertAnytimeMode(meta)) return false
  const convertAllowed = isHeroConvertAllowedForViewer(
    meta,
    ctx.rowActiveId,
    ctx.rowActivePhaseLinkId,
    ctx.currentNavIni,
    { ownerItemId, visibilityCtx: ctx }
  )
  return !convertAllowed
}

/**
 * @param {{
 *   combatStarted?: boolean
 *   roundIntroPending?: boolean
 *   rowActiveId?: string | null
 *   rowActivePhaseLinkId?: string | null
 *   currentNavIni?: number | null
 *   roundStartStepId?: string
 *   roundEndStepId?: string
 *   turnSteps?: Array<{ kind: string, id?: string, ownerId?: string, linkId?: string }>
 *   combatStepIndex?: number | null
 * }} params
 */
export function buildConvertListVisibilityCtx(params) {
  const p = params ?? {}
  const stepIdx = p.combatStepIndex
  return {
    combatStarted: Boolean(p.combatStarted),
    roundIntroPending: Boolean(p.roundIntroPending),
    rowActiveId: p.rowActiveId ?? null,
    rowActivePhaseLinkId: p.rowActivePhaseLinkId ?? null,
    currentNavIni: p.currentNavIni ?? null,
    roundStartStepId: p.roundStartStepId ?? ROUND_START_STEP_ID,
    roundEndStepId: p.roundEndStepId ?? ROUND_END_STEP_ID,
    turnSteps: Array.isArray(p.turnSteps) ? p.turnSteps : null,
    combatStepIndex:
      stepIdx != null && Number.isFinite(Number(stepIdx)) ? Number(stepIdx) : null,
  }
}
