import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'
import { LH_DONE_STEP_ID } from './phaseLinks.js'

/**
 * Trifft ein Merged-Listeneintrag die aktive Navigationsposition
 * (Owner + Phasen-Link-ID)? Rein, ohne DOM.
 *
 * @param {any} e
 * @param {string | null | undefined} rowActiveId
 * @param {string | null | undefined} rowActivePhaseLinkId
 * @returns {boolean}
 */
export function matchesMergedEntryActive(e, rowActiveId, rowActivePhaseLinkId) {
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
    return e.ownerId === rowActiveId && rowActivePhaseLinkId === LH_DONE_STEP_ID
  }
  if (e.kind === 'phase') {
    return e.ownerId === rowActiveId && e.link?.id === rowActivePhaseLinkId
  }
  return false
}

/**
 * Fuegt Aktionsstempel als `actionStamp`-Eintraege hinter ihre Anker-Zeile in
 * die Merged-Liste ein. Anker-Aufloesung mit Fallback-Kette:
 *   1) exakte Owner+Phase-Zeile,
 *   2) (bei gesetzter, aber nicht mehr existenter Phasen-Link-ID — UUID-Churn
 *      der ephemeren 2.AO-Wurzel) irgendeine Phasenzeile des Owners,
 *   3) Token-Zeile des Owners,
 *   4) erste Token-Zeile.
 * So bleiben Schild-/F.A.-Stempel an der sichtbaren 2.AO-Zeile statt auf die
 * Mutter-Zeile zu springen. Rein, ohne DOM.
 *
 * @param {any[]} merged
 * @param {any[]} stampEntries
 * @returns {any[]}
 */
export function mergeActionStampsIntoMerged(merged, stampEntries) {
  const working = [...merged]
  for (const stamp of stampEntries) {
    const ar = typeof stamp.anchorRowId === 'string' ? stamp.anchorRowId : null
    const apl =
      typeof stamp.anchorPhaseLinkId === 'string'
        ? stamp.anchorPhaseLinkId
        : null
    let matchIdx = -1
    if (ar != null) {
      matchIdx = working.findIndex((e) => matchesMergedEntryActive(e, ar, apl))
    }
    if (matchIdx < 0 && ar != null && apl !== null) {
      // Veraltete Phase-Link-ID (UUID-Churn der ephemeren 2.AO-Wurzel): die
      // exakte Phase-Zeile existiert nicht mehr. Auf irgendeine Phase-Zeile des
      // Owners zuruckfallen, damit der Stempel an der 2.AO-Zeile sichtbar bleibt
      // statt auf die Mutter-Zeile zu springen.
      matchIdx = working.findIndex(
        (e) => e.kind === 'phase' && e.ownerId === ar
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
    while (pos < working.length && working[pos].kind === 'actionStamp') {
      pos++
    }
    working.splice(pos, 0, { kind: 'actionStamp', stamp })
  }
  return working
}
