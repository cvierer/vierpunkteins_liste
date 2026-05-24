import { isGmSync } from './editAccess.js'
import { getRoomSettings } from './roomSettings.js'
import {
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
} from './phaseLinks.js'

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
 *     · `convertAllowFirstPhase`  → erlaubt, solange die Navigation noch nicht
 *       hinter die erste INI-Phase des Helden gewandert ist
 *       (`currentNavIni >= heroIni`).
 *     · andernfalls → nicht erlaubt.
 */
export function isHeroConvertAllowedForViewer(
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

/** Primär-Umtauschpfeile anzeigen (nicht nur klickbar). */
export function shouldShowKrPrimaryConvertSwitch(
  convertAllowedByLock,
  switchLocked
) {
  return convertAllowedByLock && !switchLocked
}
