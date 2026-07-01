import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'
import { LH_DONE_STEP_ID } from './phaseLinks.js'
import { resolveActivePhaseLinkId } from './navActivePhaseLink.js'

/**
 * Stabile Signatur der Raum-Action-Stempel (Reihenfolge-/Anker-sensitiv).
 * Aendert sich, sobald ein Stempel hinzukommt/verschwindet ODER seinen Anker
 * (Zeile/Phase) wechselt — auch wenn dabei keine Item-Meta veraendert wurde.
 * Dient `safeRenderList`, um Stempel auch waehrend einer L.H.-Render-Suppression
 * sofort sichtbar zu machen (Stempel leben in Raum-Meta, nicht in Item-Meta).
 *
 * @param {{ entries?: Array<{ id?: unknown, field?: unknown, anchorRowId?: unknown, anchorPhaseLinkId?: unknown }> } | null | undefined} stamps
 * @returns {string}
 */
export function actionStampsSignature(stamps) {
  const entries = Array.isArray(stamps?.entries) ? stamps.entries : []
  return entries
    .map(
      (e) =>
        `${e?.id ?? ''}:${e?.field ?? ''}:${e?.anchorRowId ?? ''}:${
          e?.anchorPhaseLinkId ?? ''
        }`
    )
    .join('|')
}

/**
 * Normalisiert die `anchorPhaseLinkId` jedes Stempels gegen die aktuell
 * gerenderten Navigationsschritte. Waehrend einer L.H. wechselt die ephemere
 * 2.AO-Wurzel pro Render ihre UUID, wodurch die beim Stempeln gespeicherte
 * `anchorPhaseLinkId` zur Ghost-ID wird. Ohne Normalisierung loest
 * `mergeActionStampsIntoMerged` den Anker je Frame unterschiedlich auf (mal
 * Owner-Phasenzeile, mal Mutter-/Token-Zeile) -> Stempel flackert ("instabil").
 *
 * `resolveActivePhaseLinkId` snappt eine veraltete Phase-Link-ID auf die
 * aktuell sichtbare Phasenzeile desselben Owners; eine noch gueltige ID bleibt
 * unveraendert. Damit trifft Fallback 1 (exakte Owner+Phase) jeden Frame
 * dieselbe sichtbare Zeile. Rein, ohne DOM.
 *
 * @param {any[]} stampEntries
 * @param {import('./navActivePhaseLink.js').CombatTurnStep[] | null | undefined} stepsForNav
 * @returns {any[]}
 */
export function normalizeStampEntryAnchors(stampEntries, stepsForNav) {
  if (!Array.isArray(stampEntries)) return []
  return stampEntries.map((stamp) => {
    const ar = typeof stamp?.anchorRowId === 'string' ? stamp.anchorRowId : null
    const apl =
      typeof stamp?.anchorPhaseLinkId === 'string'
        ? stamp.anchorPhaseLinkId
        : null
    if (ar == null || apl == null) return stamp
    const resolved = resolveActivePhaseLinkId(
      { currentItemId: ar, currentPhaseLinkId: apl },
      stepsForNav
    )
    if (resolved === apl) return stamp
    return { ...stamp, anchorPhaseLinkId: resolved }
  })
}

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
 *   3) Token-Zeile des Owners (anchorRowId) — greift auch, wenn eine laufende
 *      L.H. die 2.AO-/Phasenzeile komplett aus der Liste entfernt hat,
 *   4) Token-Zeile von `stamp.itemId` (bei Reaktionen der Verteidiger),
 *   5) erste Token-Zeile.
 * So bleiben Schild-/F.A.-Stempel an der platzierten Zeile statt auf die
 * Verteidiger-/Mutter-Zeile zu springen. Rein, ohne DOM.
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
    if (matchIdx < 0 && ar != null) {
      // Owner-Phasenzeile existiert gar nicht mehr (z. B. weil eine laufende
      // L.H. die 2.AO-/Phasenzeile aus der Liste entfernt). Auf die TOKEN-Zeile
      // des platzierenden Helden (anchorRowId) zuruckfallen, BEVOR auf
      // stamp.itemId (bei Reaktionen der Verteidiger) ausgewichen wird — sonst
      // verschwindet der Stempel von der Zeile, an der navigiert/platziert wurde.
      matchIdx = working.findIndex(
        (e) => e.kind === 'token' && e.row.id === ar
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

/**
 * Anker-Schlüssel einer Merged-Zeile fuer Stempel-Zuordnung (`ownerId|phaseLinkId`).
 *
 * @param {any} entry
 * @returns {string | null}
 */
export function mergedListEntryAnchorKey(entry) {
  if (entry.kind === 'token') return `${entry.row.id}|`
  if (entry.kind === 'phase') return `${entry.ownerId}|${entry.link.id}`
  if (entry.kind === 'lhDone') return `${entry.ownerId}|${LH_DONE_STEP_ID}`
  return null
}

/**
 * Ordnet Stempel den sichtbaren Listen-Zeilen zu (gleiche Logik wie renderList).
 *
 * @param {any[]} merged
 * @param {any[]} stampEntries
 * @returns {Map<string, any[]>}
 */
export function groupStampsByMergedAnchor(merged, stampEntries) {
  const mergedWithStamps = mergeActionStampsIntoMerged(merged, stampEntries)
  /** @type {Map<string, any[]>} */
  const byKey = new Map()
  for (let i = 0; i < mergedWithStamps.length; i++) {
    const entry = mergedWithStamps[i]
    if (entry.kind === 'actionStamp') continue
    const key = mergedListEntryAnchorKey(entry)
    if (!key) continue
    const stamps = []
    let j = i + 1
    while (
      j < mergedWithStamps.length &&
      mergedWithStamps[j].kind === 'actionStamp'
    ) {
      stamps.push(mergedWithStamps[j].stamp)
      j++
    }
    if (stamps.length > 0) {
      const prev = byKey.get(key) ?? []
      byKey.set(key, prev.concat(stamps))
    }
  }
  return byKey
}
