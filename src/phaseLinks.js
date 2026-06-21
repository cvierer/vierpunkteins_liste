import OBR from '@owlbear-rodeo/sdk'
import { isGmSync } from './editAccess.js'
import {
  compareInitiativeRows,
  compareInitiativeRowsWithTieOrder,
  initiativeCompareOnlyIni,
} from './initiativeSort.js'
import {
  collectSortedParticipants,
  INI_TIE_ORDER_KEY,
  TRACKER_ID,
  TRACKER_ITEM_META_KEY,
} from './participants.js'
import {
  LH_DONE_INI,
  LH_DONE_ROUND,
  phaseOffsetFromHeroSecondAoMeta,
  phaseOffsetFromLhMeta,
} from './lhMeta.js'
import {
  addManualIniTieOverridePair,
  getManualIniTieOverridePairs,
} from './manualIniTieOverrides.js'
import { shouldHideEmptySecondActionRow } from './convertLockViewer.js'

const ZAO_ROOT_TIE_ORDER_KEY = `${TRACKER_ID}/zaoRootTieOrder`
const FULL_INI_TIE_ORDER_KEY = `${TRACKER_ID}/fullIniTieOrder`

import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'

export { ROUND_END_STEP_ID, ROUND_START_STEP_ID }
export const LH_DONE_STEP_ID = `${TRACKER_ID}/lhDoneStep`

/** @type {Record<string, string[]>} INI-Schlüssel (formatIniForSort) → Reihenfolge der 2.A.-Wurzeln ownerId:linkId */
let zaoRootTieOrderByIniCache = {}

/** @type {Record<string, string[]>} INI-Schlüssel → Reihenfolge aller Listeneinträge (token|…, zroot|…, lhdone|…, pchild|…) */
let fullIniTieOrderByIniCache = {}

const zaoOrderListeners = new Set()
const fullIniTieListeners = new Set()

function notifyZaoRootTieOrder() {
  for (const fn of zaoOrderListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function onZaoRootTieOrderChange(fn) {
  zaoOrderListeners.add(fn)
  return () => zaoOrderListeners.delete(fn)
}

function notifyFullIniTieOrder() {
  for (const fn of fullIniTieListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function onFullIniTieOrderChange(fn) {
  fullIniTieListeners.add(fn)
  return () => fullIniTieListeners.delete(fn)
}

function normalizeZaoOrderRoom(raw) {
  /** @type {Record<string, string[]>} */
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [iniK, arr] of Object.entries(raw)) {
    if (typeof iniK !== 'string') continue
    if (!Array.isArray(arr)) continue
    out[iniK] = arr.filter((k) => typeof k === 'string')
  }
  return out
}

export async function pullZaoRootTieOrderFromRoom() {
  const meta = await OBR.room.getMetadata()
  const next = normalizeZaoOrderRoom(meta[ZAO_ROOT_TIE_ORDER_KEY])
  const prevKeys = JSON.stringify(zaoRootTieOrderByIniCache)
  const nextKeys = JSON.stringify(next)
  if (prevKeys === nextKeys) return
  zaoRootTieOrderByIniCache = next
  notifyZaoRootTieOrder()
}

function normalizeFullIniTieOrderRoom(raw) {
  /** @type {Record<string, string[]>} */
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [iniK, arr] of Object.entries(raw)) {
    if (typeof iniK !== 'string') continue
    if (!Array.isArray(arr)) continue
    out[iniK] = arr.filter((k) => typeof k === 'string')
  }
  return out
}

export async function pullFullIniTieOrderFromRoom() {
  const meta = await OBR.room.getMetadata()
  const next = normalizeFullIniTieOrderRoom(meta[FULL_INI_TIE_ORDER_KEY])
  const prevKeys = JSON.stringify(fullIniTieOrderByIniCache)
  const nextKeys = JSON.stringify(next)
  if (prevKeys === nextKeys) return
  fullIniTieOrderByIniCache = next
  notifyFullIniTieOrder()
}

export function zaoRootKey(ownerId, linkId) {
  return `${ownerId}:${linkId}`
}

/** Stabiler Listen-Schlüssel für volle INI-Tausch-Reihenfolge (Raum-Metadaten). */
export function mergedEntryDiscriminator(e) {
  if (!e || typeof e !== 'object') return ''
  if (e.kind === 'token') return `token|${e.row.id}`
  if (e.kind === 'lhDone') return `lhdone|${e.ownerId}`
  if (e.kind === 'phase') {
    if (e.link?.parentId === null) return `zroot|${e.ownerId}|${e.link.id}`
    return `pchild|${e.ownerId}|${e.link.id}`
  }
  return ''
}

function zaoRootKeyToDiscriminator(key) {
  const c = key.indexOf(':')
  if (c < 0) return null
  const owner = key.slice(0, c)
  const link = key.slice(c + 1)
  return link === LH_DONE_STEP_ID
    ? `lhdone|${owner}`
    : `zroot|${owner}|${link}`
}

function ensureFullTieOrderLocal(existing, sortedIds) {
  const allowed = new Set(sortedIds)
  const out = existing.filter((id) => allowed.has(id))
  const seen = new Set(out)
  for (const id of sortedIds) {
    if (!seen.has(id)) {
      out.push(id)
      seen.add(id)
    }
  }
  return out
}

function reorderTieIdsForIniSubset(tieOrderIds, subsetOrdered) {
  const set = new Set(subsetOrdered)
  const idxs = subsetOrdered.map((id) => tieOrderIds.indexOf(id)).filter((i) => i >= 0)
  if (idxs.length === 0) return tieOrderIds
  const minI = Math.min(...idxs)
  const tail = tieOrderIds.filter((id, i) => i > minI && !set.has(id))
  const head = tieOrderIds.filter((id, i) => i < minI && !set.has(id))
  const mid = subsetOrdered.filter((id) => tieOrderIds.includes(id))
  return [...head, ...mid, ...tail]
}

function orderRunByDiscriminatorList(run, list) {
  const pos = new Map(list.map((d, idx) => [d, idx]))
  return [...run].sort((a, b) => {
    const da = mergedEntryDiscriminator(a)
    const db = mergedEntryDiscriminator(b)
    const pa = pos.has(da) ? pos.get(da) : 1e9
    const pb = pos.has(db) ? pos.get(db) : 1e9
    if (pa !== pb) return pa - pb
    return run.indexOf(a) - run.indexOf(b)
  })
}

function reorderSameIniRunsByFullOrder(entries) {
  let i = 0
  while (i < entries.length) {
    const e = entries[i]
    if (e.kind === 'roundEnd' || e.kind === 'roundStart') {
      i++
      continue
    }
    const ka = mergedEntryIniSortKey(e)
    if (ka == null || ka === '') {
      i++
      continue
    }
    const iniK = formatIniForSort(ka)
    let j = i + 1
    while (j < entries.length) {
      const e2 = entries[j]
      if (e2.kind === 'roundEnd' || e2.kind === 'roundStart') break
      const kb = mergedEntryIniSortKey(e2)
      if (
        initiativeCompareOnlyIni(
          { initiative: ka, name: '' },
          { initiative: kb, name: '' }
        ) !== 0
      ) {
        break
      }
      j++
    }
    const run = entries.slice(i, j)
    const list = fullIniTieOrderByIniCache[iniK]
    if (list?.length && run.length > 1) {
      const ordered = orderRunByDiscriminatorList(run, list)
      entries.splice(i, j - i, ...ordered)
    }
    i = j
  }
}

/**
 * Zwei in der Kampfliste direkt benachbarte Einträge mit gleicher INI tauschen
 * (Token, 2.A.-Wurzel, L.H.-Zeile, Phasen-Kind).
 * @param [combatRound] wie in `buildMergedDisplayRows` (lhDone-Sichtbarkeit).
 */
export async function swapAdjacentMergedIniDiscriminators(
  upperDisc,
  lowerDisc,
  items,
  tieOrderIds,
  combatRound = null
) {
  if (!isGmSync()) return
  if (!upperDisc || !lowerDisc || upperDisc === lowerDisc) return
  const tokenRows = collectSortedParticipants(
    items,
    tieOrderIds,
    getManualIniTieOverridePairs()
  )
  const merged = buildMergedDisplayRows(
    tokenRows,
    items,
    tieOrderIds,
    combatRound
  )
  let found = -1
  for (let i = 0; i < merged.length - 1; i++) {
    if (merged[i].kind === 'roundEnd' || merged[i].kind === 'roundStart') continue
    const d0 = mergedEntryDiscriminator(merged[i])
    const d1 = mergedEntryDiscriminator(merged[i + 1])
    if (d0 === upperDisc && d1 === lowerDisc) {
      found = i
      break
    }
  }
  if (found < 0) return
  const ka = mergedEntryIniSortKey(merged[found])
  const kb = mergedEntryIniSortKey(merged[found + 1])
  if (
    initiativeCompareOnlyIni(
      { initiative: ka, name: '' },
      { initiative: kb, name: '' }
    ) !== 0
  ) {
    return
  }
  let runStart = found
  while (
    runStart > 0 &&
    merged[runStart - 1].kind !== 'roundEnd' &&
    merged[runStart - 1].kind !== 'roundStart' &&
    initiativeCompareOnlyIni(
      {
        initiative: mergedEntryIniSortKey(merged[runStart - 1]),
        name: '',
      },
      { initiative: ka, name: '' }
    ) === 0
  ) {
    runStart--
  }
  let runEnd = found + 2
  while (
    runEnd < merged.length &&
    merged[runEnd].kind !== 'roundEnd' &&
    merged[runEnd].kind !== 'roundStart' &&
    initiativeCompareOnlyIni(
      { initiative: mergedEntryIniSortKey(merged[runEnd]), name: '' },
      { initiative: ka, name: '' }
    ) === 0
  ) {
    runEnd++
  }
  const runSlice = merged.slice(runStart, runEnd)
  const discs = runSlice.map((e) => mergedEntryDiscriminator(e))
  const a = found - runStart
  if (a < 0 || a >= discs.length - 1) return
  if (discs[a] !== upperDisc || discs[a + 1] !== lowerDisc) return
  const nextDiscs = [...discs]
  ;[nextDiscs[a], nextDiscs[a + 1]] = [nextDiscs[a + 1], nextDiscs[a]]
  const iniK = formatIniForSort(ka)
  const nextFull = { ...fullIniTieOrderByIniCache, [iniK]: nextDiscs }

  /** @type {Record<string, unknown>} */
  const metaPatch = { [FULL_INI_TIE_ORDER_KEY]: nextFull }

  const tokensOrdered = nextDiscs
    .filter((d) => d.startsWith('token|'))
    .map((d) => d.slice('token|'.length))

  if (tokensOrdered.length > 0) {
    const meta = await OBR.room.getMetadata()
    const rawTie = meta[INI_TIE_ORDER_KEY]
    const curTie = Array.isArray(rawTie)
      ? rawTie.filter((x) => typeof x === 'string')
      : []
    const sortedRows = collectSortedParticipants(
      items,
      curTie,
      getManualIniTieOverridePairs()
    )
    const sortedIds = sortedRows.map((r) => r.id)
    const newTie = reorderTieIdsForIniSubset(curTie, tokensOrdered)
    metaPatch[INI_TIE_ORDER_KEY] = ensureFullTieOrderLocal(newTie, sortedIds)
  }

  await OBR.room.setMetadata(metaPatch)
  await pullFullIniTieOrderFromRoom()

  // Bei einem direkten Swap zweier Token-Einträge wird zusätzlich die manuelle
  // Reihenfolge-Override für genau dieses Heldenpaar gesetzt: Ab dann gilt die
  // hier festgelegte Reihenfolge bevorzugt vor der IB-Standardregel —
  // Kampfrunden-übergreifend.
  if (
    upperDisc.startsWith('token|') &&
    lowerDisc.startsWith('token|')
  ) {
    const idA = upperDisc.slice('token|'.length)
    const idB = lowerDisc.slice('token|'.length)
    if (idA && idB) {
      await addManualIniTieOverridePair(idA, idB)
    }
  }
}


export const DEFAULT_PHASE_OFFSET = 8

export function defaultPhases() {
  return { links: [], rowPanelOpen: false }
}

function clampStoredOffset(o) {
  const n = Number(String(o ?? '').replace(',', '.'))
  if (!Number.isFinite(n)) return DEFAULT_PHASE_OFFSET
  return Math.max(0, Math.min(99, Math.round(n)))
}

function normalizeKrDigitLocal(v) {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.max(0, Math.min(9, n)) : 0
}

function hasMotherSwordOrShield(meta) {
  const firstKind =
    typeof meta?.krFirstSlotKind === 'string' ? meta.krFirstSlotKind : 'ang'
  const hasSword = firstKind === 'ang'
  // KR_ABW: Wert 1 entspricht „leer“, alle anderen Werte tragen mind. eine Markierung.
  const hasShield = normalizeKrDigitLocal(meta?.krAbw) !== 1
  return hasSword || hasShield
}

/**
 * Prueft, ob in einer regulaeren 2.A.-Wurzel ein Schwert (kind === 'ang')
 * eingestellt ist. Analog zu `hasMotherSwordOrShield` zaehlt das Setup,
 * unabhaengig vom marks-Stand (Ladung verbraucht oder nicht).
 *
 * Ausgeschlossen werden:
 *  - `heroExtra`-Wurzeln (das z.AT selbst — soll sich nicht selbst rechtfertigen)
 *  - `lhEnd`-Wurzeln (n.A.-Objekt der L.H. — kein 2.A.-Aktionsplatz)
 */
function hasSecondActionSword(meta) {
  const slotsRaw = meta?.krZaoSlots
  if (!slotsRaw || typeof slotsRaw !== 'object') return false
  const links = Array.isArray(meta?.phases?.links) ? meta.phases.links : []
  for (const l of links) {
    if (!l || typeof l !== 'object') continue
    if (l.parentId !== null) continue
    if (l.heroExtra) continue
    if (l.lhEnd === true) continue
    const slot = slotsRaw[l.id]
    if (slot && slot.kind === 'ang') return true
  }
  return false
}

export function shouldShowHeroExtraLink(meta, link) {
  if (!link?.heroExtra) return true
  // Sichtbarkeit/Existenz an den Spieler-Haken „Zusätzliche Angriffsaktion“ koppeln.
  const angCount = Number.isFinite(Number(meta?.heroExtraAngCount))
    ? Math.max(0, Math.min(10, Math.floor(Number(meta.heroExtraAngCount))))
    : meta?.heroExtraAng
      ? 1
      : 0
  if (angCount <= 0) return false
  // Mutex z.AT vs schwarzes Schild: Wenn das schwarze Schild dieser KR
  // bereits gestempelt wurde, ist der z.AT in dieser KR endgueltig vergeben.
  // Die Wurzel wird beim Stempel ohnehin entfernt — der Guard ist redundanter
  // Schutz fuer transient inkonsistente Zustaende.
  if (meta?.krExtraChoiceUsed === 'par') return false
  // Aktionsquelle: Mutter-Schwert/-Schild ODER ein regulaeres 2.A. mit
  // Schwert-Setup. So bleibt die z.AT erhalten, wenn der Held seine
  // Aktion in eine 2.A. verschoben hat (Schwert dort eingestellt).
  return hasMotherSwordOrShield(meta) || hasSecondActionSword(meta)
}

function findZaoRootLink(link, links) {
  if (!link) return null
  const map = new Map(
    (Array.isArray(links) ? links : [])
      .filter((l) => l && typeof l.id === 'string')
      .map((l) => [l.id, l])
  )
  let cur = link
  while (cur?.parentId) {
    cur = map.get(cur.parentId)
    if (!cur) break
  }
  return cur
}

/** Regulaere 2.AO nach Schloss; z.AT nur via {@link shouldShowHeroExtraLink}. */
export function shouldShowPhaseLinkInList(
  meta,
  link,
  visibilityCtx = null,
  ownerId = null
) {
  if (link?.heroExtra) return shouldShowHeroExtraLink(meta, link)
  if (visibilityCtx) {
    const phases = normalizePhases(meta?.phases)
    const root =
      link.parentId === null ? link : findZaoRootLink(link, phases.links)
    if (root && shouldHideEmptySecondActionRow(meta, root, visibilityCtx, ownerId)) {
      return false
    }
  }
  return true
}

export function normalizePhases(raw) {
  const d = defaultPhases()
  if (!raw || typeof raw !== 'object') return d
  const linksIn = Array.isArray(raw.links) ? raw.links : []
  const ids = new Set()
  const links = []
  for (const l of linksIn) {
    if (!l || typeof l !== 'object' || typeof l.id !== 'string') continue
    ids.add(l.id)
    const parentId = typeof l.parentId === 'string' ? l.parentId : null
    const entry = {
      id: l.id,
      parentId,
      offset: clampStoredOffset(l.offset),
    }
    if (parentId === null) {
      if (l.heroExtra === 'ang' || l.heroExtra === 'par') {
        entry.heroExtra = l.heroExtra
        // Aus den Helden-Einstellungen stammende Zusatz-Objekte sind
        // Charakter-Config, kein flüchtiger Rundeninhalt – sie dürfen nicht
        // über `clearEphemeralExtraIniRows` verschwinden.
        entry.expiresNextRound = false
      } else if (l.lhEnd === true) {
        // L.H.-End-Markierung (n.A.-Objekt): bleibt nur in dieser KR
        // sichtbar und verschwindet beim nächsten KR-Wechsel.
        entry.lhEnd = true
        entry.expiresNextRound = true
      } else {
        entry.expiresNextRound = l.expiresNextRound === false ? false : true
      }
    }
    links.push(entry)
  }
  const valid = new Set(
    links.filter((l) => l.parentId === null || ids.has(l.parentId)).map((l) => l.id)
  )
  const pruned = links.filter(
    (l) => valid.has(l.id) && (l.parentId === null || valid.has(l.parentId))
  )
  return {
    links: pruned,
    // nAO/2.AO: Panel immer offen, sobald mindestens ein Phasen-Link existiert.
    rowPanelOpen: pruned.length > 0,
  }
}

export function iniNumeric(s) {
  const n = Number(String(s ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function buildLinkMap(links) {
  return new Map(links.map((l) => [l.id, l]))
}

/** Basis-INI für das Offset-Feld dieser Verknüpfung (Helden-INI oder Ziel-INI der Eltern-Verknüpfung). */
export function baseIniBeforeLink(linkId, ownerIniStr, links) {
  const map = buildLinkMap(links)
  const link = map.get(linkId)
  if (!link) return null
  if (link.parentId === null) return iniNumeric(ownerIniStr)
  return hookIniForLink(link.parentId, ownerIniStr, links)
}

/** Ziel-INI: Basis minus Offset. */
export function hookIniForLink(linkId, ownerIniStr, links) {
  const map = buildLinkMap(links)
  function hookFor(id) {
    const link = map.get(id)
    if (!link) return null
    const base =
      link.parentId === null
        ? iniNumeric(ownerIniStr)
        : hookFor(link.parentId)
    if (base === null) return null
    const off = Number(link.offset)
    const o = Number.isFinite(off) ? off : DEFAULT_PHASE_OFFSET
    return base - o
  }
  return hookFor(linkId)
}

function linkDepth(linkId, map) {
  let d = 0
  let cur = map.get(linkId)
  while (cur?.parentId) {
    d += 1
    cur = map.get(cur.parentId)
  }
  return d
}

export function sortedLinksForLayout(links) {
  const map = buildLinkMap(links)
  const indexById = new Map(links.map((l, i) => [l.id, i]))
  return [...links].sort(
    (a, b) =>
      linkDepth(a.id, map) - linkDepth(b.id, map) ||
      (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0)
  )
}

function collectSubtreeIds(links, rootId) {
  const out = new Set([rootId])
  let added = true
  while (added) {
    added = false
    for (const l of links) {
      if (l.parentId && out.has(l.parentId) && !out.has(l.id)) {
        out.add(l.id)
        added = true
      }
    }
  }
  return out
}

function uuid() {
  return crypto.randomUUID()
}

function safeDefaultOffset(_ownerIniStr) {
  return DEFAULT_PHASE_OFFSET
}

/** Aktuell globaler Standard (8); später pro Held erweiterbar. */
export function secondActionStepForOwnerIni(_ownerIniStr) {
  return DEFAULT_PHASE_OFFSET
}

/**
 * Darf eine 2.A.-Wurzel erzeugt werden? (Ziel-INI der 2.A. muss >= 0 sein)
 * @param {string|undefined} ownerIniStr
 * @param {number} [storedPhaseOffset] — aus L.H.-Trigger; sonst globaler Standard (8)
 */
export function canCreateSecondActionRoot(ownerIniStr, storedPhaseOffset) {
  const base = iniNumeric(ownerIniStr)
  if (!Number.isFinite(base)) return false
  const step =
    storedPhaseOffset != null && Number.isFinite(Number(storedPhaseOffset))
      ? clampStoredOffset(storedPhaseOffset)
      : secondActionStepForOwnerIni(ownerIniStr)
  return base - step >= 0
}

/**
 * Reguläre Phasen-Links (ohne z.AT / L.H.-End-Marker): tiefste Ziel-INI
 * (kleinster Wert = am spätesten in der Runde). Bei gleicher INI gewinnt
 * die größere Ketten-Tiefe, sonst die kleinere Link-ID.
 */
export function deepestRegularZaoPhaseLinkId(ownerIniStr, phasesNormalized) {
  const links = phasesNormalized?.links
  if (!Array.isArray(links) || links.length === 0) return null
  const map = buildLinkMap(links)
  let bestId = null
  let bestHook = Infinity
  let bestDepth = -1
  for (const l of links) {
    if (l.heroExtra || l.lhEnd === true) continue
    const h = hookIniForLink(l.id, ownerIniStr, links)
    if (h === null || !Number.isFinite(h)) continue
    const d = linkDepth(l.id, map)
    if (bestId === null) {
      bestId = l.id
      bestHook = h
      bestDepth = d
      continue
    }
    if (
      h < bestHook ||
      (h === bestHook && d > bestDepth) ||
      (h === bestHook && d === bestDepth && l.id < bestId)
    ) {
      bestId = l.id
      bestHook = h
      bestDepth = d
    }
  }
  return bestId
}

/**
 * Nächste 2.A.-Wurzel als **flache Wurzel** (`parentId: null`) mit einem
 * kumulativen Offset aus der Helden-INI. Jede weitere Wurzel liegt genau
 * `off` tiefer als die vorherige, sodass die Ziel-INI-Reihe identisch zur
 * früheren Kettenlogik bleibt (H−off, H−2·off, …). Reguläre Wurzeln sind
 * `parentId === null` ohne `heroExtra` und ohne `lhEnd`.
 * Gibt `null` zurück, wenn die entstehende Ziel-INI negativ wäre.
 */
export function nextChainedZaoParentForTransfer(
  ownerIniStr,
  phasesNormalized,
  phaseOffset
) {
  const baseIni = iniNumeric(ownerIniStr)
  if (!Number.isFinite(baseIni)) return null
  const off =
    phaseOffset != null && Number.isFinite(Number(phaseOffset))
      ? clampStoredOffset(phaseOffset)
      : secondActionStepForOwnerIni(ownerIniStr)
  const links = phasesNormalized?.links
  if (!Array.isArray(links)) return null
  const existingRootCount = links.filter(
    (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
  ).length
  const n = existingRootCount + 1
  if (baseIni - n * off < 0) return null
  return { parentId: null, offset: n * off }
}

export function patchItemPhases(itemId, updater) {
  return OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const meta = d.metadata[TRACKER_ITEM_META_KEY]
      if (!meta) continue
      const prev = normalizePhases(meta.phases)
      meta.phases = finalizePhasesWithOrderedRoots(meta, updater(prev, meta))
    }
  })
}

/**
 * Beim Setzen der L.H.-Gesamtaktionen (n≥1): 2.A.-Wurzel mit Offset aus L.H.-Trigger anlegen/aktualisieren.
 * n>2: geschlossenes Schloss (überdauert die KR); n≤2: offenes Schloss (ephemeral, Standard).
 */
export function upsertLhLinkedZaoRoot(itemId, lhMaxCommitted, ownerIniStr) {
  return patchItemPhases(itemId, (p, meta) => {
    const off = phaseOffsetFromLhMeta(meta)
    if (!canCreateSecondActionRoot(ownerIniStr, off)) return p
    const openPadlockEphemeral = lhMaxCommitted <= 2
    const roots = sortedLinksForLayout(p.links).filter((l) => l.parentId === null)
    const firstRootId = roots[0]?.id
    if (!firstRootId) {
      return {
        ...p,
        rowPanelOpen: true,
        links: [
          ...p.links,
          {
            id: uuid(),
            parentId: null,
            offset: off,
            expiresNextRound: openPadlockEphemeral,
          },
        ],
      }
    }
    return {
      ...p,
      rowPanelOpen: true,
      links: p.links.map((l) => {
        if (l.parentId !== null) return l
        return {
          ...l,
          offset: l.id === firstRootId ? off : l.offset,
          expiresNextRound: openPadlockEphemeral,
        }
      }),
    }
  })
}

/**
 * Erzeugt (idempotent) ein temporaeres n.A.-Objekt am L.H.-End-INI-Schritt.
 * Tragt den Marker `lhEnd: true` und `expiresNextRound: true` — verschwindet
 * dadurch automatisch beim naechsten KR-Wechsel ueber
 * `clearEphemeralExtraIniRows`.
 *
 * @param {string} itemId
 * @param {number} offset positiver Offset Helden-INI - End-INI (>= 1)
 */
export function ensureLhEndPhaseLink(itemId, offset) {
  const off = clampStoredOffset(offset)
  if (!(off > 0)) return Promise.resolve()
  return patchItemPhases(itemId, (p) => {
    const existing = p.links.find(
      (l) => l.parentId === null && l.lhEnd === true && l.offset === off
    )
    if (existing) {
      // Sicherstellen, dass das Panel offen ist, sonst rendert
      // buildMergedDisplayRows die Phase-Zeile nicht.
      if (p.rowPanelOpen) return p
      return { ...p, rowPanelOpen: true }
    }
    return {
      ...p,
      rowPanelOpen: true,
      links: [
        ...p.links,
        {
          id: uuid(),
          parentId: null,
          offset: off,
          lhEnd: true,
          expiresNextRound: true,
        },
      ],
    }
  })
}

/**
 * Erste 2.A.-Wurzel: Schloss öffnen (ephemeral) / schließen (bleibt über KR).
 * @param {boolean} openPadlock — true = offenes Schloss (expiresNextRound), false = geschlossen
 */
export function setFirstZaoRootExpiresNextRound(itemId, openPadlock) {
  return patchItemPhases(itemId, (p) => {
    const roots = sortedLinksForLayout(p.links).filter((l) => l.parentId === null)
    const targetId = roots[0]?.id
    if (!targetId) return p
    const expiresNextRound = Boolean(openPadlock)
    return {
      ...p,
      links: p.links.map((l) =>
        l.id === targetId ? { ...l, expiresNextRound } : l
      ),
    }
  })
}

/**
 * Klick: Panel öffnen (erster Link) bzw. weitere Wurzel.
 * Shift+Klick: Panel schließen.
 */
/**
 * Legt die erste 2.A.-Wurzel an, falls noch keine existiert (z. B. bei mehreren Angriffen).
 * Ziel-INI: Helden-INI minus 2.A.-Offset (Standard 8), siehe `phaseOffsetFromHeroSecondAoMeta`.
 */
export function ensureExtraAttackPhaseRoot(itemId, ownerIniStr) {
  return patchItemPhases(itemId, (p, meta) => {
    const roots = sortedLinksForLayout(p.links).filter((l) => l.parentId === null)
    if (roots.length > 0) return p
    const off = phaseOffsetFromHeroSecondAoMeta(meta)
    if (!canCreateSecondActionRoot(ownerIniStr, off)) return p
    return {
      ...p,
      rowPanelOpen: true,
      links: [
        ...p.links,
        {
          id: uuid(),
          parentId: null,
          offset: off,
        },
      ],
    }
  })
}

export function onNamePhasePlusClick(itemId, _evt, ownerIniStr) {
  return patchItemPhases(itemId, (p, meta) => {
    const norm = normalizePhases(p)
    const off = phaseOffsetFromHeroSecondAoMeta(meta)
    const next = nextChainedZaoParentForTransfer(ownerIniStr, norm, off)
    if (!next) {
      return p
    }
    if (p.links.length === 0) {
      return {
        ...p,
        rowPanelOpen: true,
        links: [
          {
            id: uuid(),
            parentId: next.parentId,
            offset: next.offset,
          },
        ],
      }
    }
    return {
      ...p,
      rowPanelOpen: true,
      links: [
        ...p.links,
        {
          id: uuid(),
          parentId: next.parentId,
          offset: next.offset,
        },
      ],
    }
  })
}

/**
 * Wie erster Klick auf „+“ (2.A.): L.H.-gebundene Wurzel wie bei Eingabe „1“.
 */
export function openSecondActionPhaseForLhSingle(itemId, ownerIniStr) {
  return upsertLhLinkedZaoRoot(itemId, 1, ownerIniStr)
}

export function addPhaseChildLink(itemId, parentLinkId, ownerIniStr) {
  return patchItemPhases(itemId, (p) => {
    const parentHook = hookIniForLink(parentLinkId, ownerIniStr, p.links)
    const baseStr =
      parentHook === null ? ownerIniStr : formatIniForSort(parentHook)
    return {
      ...p,
      links: [
        ...p.links,
        {
          id: uuid(),
          parentId: parentLinkId,
          offset: safeDefaultOffset(baseStr),
        },
      ],
    }
  })
}

export function removePhaseLink(itemId, linkId) {
  return patchItemPhases(itemId, (p) => {
    const cut = collectSubtreeIds(p.links, linkId)
    const nextLinks = p.links.filter((l) => !cut.has(l.id))
    return {
      ...p,
      links: nextLinks,
      rowPanelOpen: nextLinks.length > 0,
    }
  })
}

/**
 * Entfernt die zuletzt angelegte 2.-A.-Wurzel (letzte Wurzel in der Link-Liste)
 * inkl. angehängter Phasen – entspricht Umkehrung von wiederholtem „+“.
 */
export function removeLastZaoRoot(itemId) {
  return patchItemPhases(itemId, (p) => {
    let lastRootId = null
    let bestIdx = -1
    for (let i = 0; i < p.links.length; i++) {
      const l = p.links[i]
      if (l.parentId === null && i > bestIdx) {
        bestIdx = i
        lastRootId = l.id
      }
    }
    if (!lastRootId) return p
    const cut = collectSubtreeIds(p.links, lastRootId)
    const nextLinks = p.links.filter((l) => !cut.has(l.id))
    return {
      ...p,
      links: nextLinks,
      rowPanelOpen: nextLinks.length > 0,
    }
  })
}

export function togglePhaseLinkExpiresNextRound(itemId, linkId) {
  return patchItemPhases(itemId, (p) => {
    const link = p.links.find((l) => l.id === linkId)
    if (!link || link.parentId !== null) return p
    return {
      ...p,
      links: p.links.map((l) =>
        l.id === linkId
          ? { ...l, expiresNextRound: !l.expiresNextRound }
          : l
      ),
    }
  })
}

function linksWithoutEphemeralRoots(links) {
  const roots = links.filter(
    (l) => l.parentId === null && l.expiresNextRound
  )
  if (roots.length === 0) return links
  const cut = new Set()
  for (const r of roots) {
    for (const id of collectSubtreeIds(links, r.id)) {
      cut.add(id)
    }
  }
  return links.filter((l) => !cut.has(l.id))
}

/**
 * Entfernt Wurzel-Links mit expiresNextRound (offenes Schloss), z. B. nach Kampfrundenwechsel.
 */
export async function clearEphemeralExtraIniRows() {
  const items = await OBR.scene.items.getItems((item) =>
    Boolean(item.metadata?.[TRACKER_ITEM_META_KEY])
  )
  const updates = []
  for (const item of items) {
    const meta = item.metadata[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    const p = normalizePhases(meta.phases)
    if (p.links.length === 0) continue
    const nextLinks = linksWithoutEphemeralRoots(p.links)
    if (nextLinks.length === p.links.length) continue
    updates.push({
      id: item.id,
      phases: {
        ...p,
        links: nextLinks,
        rowPanelOpen: nextLinks.length > 0,
      },
    })
  }
  if (updates.length === 0) return
  const byId = new Map(updates.map((u) => [u.id, u]))
  await OBR.scene.items.updateItems(updates.map((u) => u.id), (drafts) => {
    for (const d of drafts) {
      const u = byId.get(d.id)
      if (!u) continue
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (m) m.phases = normalizePhases(u.phases)
    }
  })
}

/**
 * Kampfende: alle 2.A.-Wurzeln (und ihre Kinder) aller Tracker-Tokens
 * restlos entfernen. Wird beim Beenden eines Kampfes aufgerufen, damit der
 * nächste Kampf wieder mit sauberen Standard-Positionen startet.
 */
export async function clearAllRootPhaseLinksInScene() {
  const items = await OBR.scene.items.getItems((item) =>
    Boolean(item.metadata?.[TRACKER_ITEM_META_KEY])
  )
  const updates = []
  for (const item of items) {
    const meta = item.metadata[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    const p = normalizePhases(meta.phases)
    if (p.links.length === 0 && p.rowPanelOpen !== true) continue
    updates.push({ id: item.id })
  }
  if (updates.length === 0) return
  await OBR.scene.items.updateItems(
    updates.map((u) => u.id),
    (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        const p = normalizePhases(m.phases)
        // Helden-Einstellungs-Objekte (Zusatz-Angriffsaktion / Zusatz-Parade)
        // sind Charakter-Config und müssen Kampf-Start/-Ende überleben.
        const keepIds = new Set(
          p.links
            .filter(
              (l) =>
                l.parentId === null &&
                (l.heroExtra === 'ang' || l.heroExtra === 'par')
            )
            .map((l) => l.id)
        )
        const nextLinks = p.links.filter((l) => keepIds.has(l.id))
        m.phases = normalizePhases({
          ...p,
          links: nextLinks,
          rowPanelOpen: nextLinks.length > 0,
        })
      }
    }
  )
}

/** Entfernt die zuletzt angelegte Wurzel-Verknüpfung (inkl. Kinder). */
export function removeLastRootPhase(itemId) {
  return patchItemPhases(itemId, (p) => {
    const roots = p.links.filter((l) => l.parentId === null)
    if (roots.length === 0) return p
    const victim = roots[roots.length - 1]
    const cut = collectSubtreeIds(p.links, victim.id)
    return {
      ...p,
      links: p.links.filter((l) => !cut.has(l.id)),
    }
  })
}

function parseOffsetCommit(s) {
  const n = Number(String(s ?? '').trim().replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

/**
 * Offset setzen. hookIni muss ≥ 0 sein, sonst { ok:false }.
 */
export function tryCommitPhaseOffset(itemId, linkId, offsetStr, ownerIniStr, links) {
  const link = links.find((l) => l.id === linkId)
  if (!link) return Promise.resolve({ ok: false })

  const base = baseIniBeforeLink(linkId, ownerIniStr, links)
  if (base === null) return Promise.resolve({ ok: false })

  let off = parseOffsetCommit(offsetStr)
  if (off === null) off = clampStoredOffset(link.offset)
  off = Math.max(0, off)

  const hook = base - off
  if (hook < 0) return Promise.resolve({ ok: false, reason: 'NEG_INI' })
  const stored = Math.min(99, off)
  return patchItemPhases(itemId, (p) => ({
    ...p,
    links: p.links.map((l) => (l.id === linkId ? { ...l, offset: stored } : l)),
  })).then(() => ({ ok: true }))
}

/**
 * Ziel-INI aus dem großen INI-Feld; setzt Offset = Basis − Ziel.
 */
export function tryCommitPhaseTargetIni(itemId, linkId, iniStr, ownerIniStr, links) {
  const link = links.find((l) => l.id === linkId)
  if (!link) return Promise.resolve({ ok: false })

  const base = baseIniBeforeLink(linkId, ownerIniStr, links)
  if (base === null) return Promise.resolve({ ok: false })

  const target = iniNumeric(iniStr)
  if (target === null) return Promise.resolve({ ok: false })
  if (target < 0) return Promise.resolve({ ok: false, reason: 'NEG_INI' })

  const off = Math.round(base - target)
  if (off < 0) return Promise.resolve({ ok: false, reason: 'NEG_INI' })

  const stored = Math.min(99, Math.max(0, off))
  return patchItemPhases(itemId, (p) => ({
    ...p,
    links: p.links.map((l) => (l.id === linkId ? { ...l, offset: stored } : l)),
  })).then(() => ({ ok: true }))
}

export function formatIniForSort(n) {
  if (n === null) return ''
  if (Number.isInteger(n)) return String(n)
  return String(n)
}

/**
 * @param {Record<string, unknown> | null | undefined} meta
 */
function ownerIniStrFromMeta(meta) {
  const v = meta?.initiative
  return v === undefined || v === null ? '' : String(v)
}

/**
 * Phasen-`links`: Wurzel-Bäume nach Ziel-INI absteigend (höhere INI zuerst,
 * entspricht Kampfliste von oben nach unten). Badge 2, 3, … bleibt damit
 * konsistent mit der Darstellung.
 *
 * @param {ReturnType<typeof normalizePhases>} phasesNormalized
 */
export function reorderPhaseLinkGroupsByHookIniDesc(
  phasesNormalized,
  meta,
  ownerIniStr
) {
  const links = phasesNormalized.links
  if (!links || links.length === 0) return phasesNormalized
  const linkMap = buildLinkMap(links)
  /** @param {string} linkId */
  function rootIdOf(linkId) {
    let id = linkId
    for (let s = 0; s < links.length + 2; s++) {
      const l = linkMap.get(id)
      if (!l) return null
      if (l.parentId === null) return l.id
      id = l.parentId
    }
    return null
  }
  const rootOrderFirst = []
  const seenRoot = new Set()
  for (const l of links) {
    if (l.parentId === null && !seenRoot.has(l.id)) {
      seenRoot.add(l.id)
      rootOrderFirst.push(l.id)
    }
  }
  /** @type {Map<string, typeof links>} */
  const groups = new Map()
  for (const rid of rootOrderFirst) {
    groups.set(rid, [])
  }
  for (const l of links) {
    const rid = rootIdOf(l.id)
    if (rid && groups.has(rid)) groups.get(rid).push(l)
  }
  const rootIdx = new Map(rootOrderFirst.map((id, i) => [id, i]))
  const sortedRoots = [...rootOrderFirst].sort((a, b) => {
    const ha = hookIniForLink(a, ownerIniStr, links)
    const hb = hookIniForLink(b, ownerIniStr, links)
    const va =
      ha !== null &&
      ha !== undefined &&
      Number.isFinite(/** @type {number} */ (ha)) &&
      ha >= 0
    const vb =
      hb !== null &&
      hb !== undefined &&
      Number.isFinite(/** @type {number} */ (hb)) &&
      hb >= 0
    if (va !== vb) return vb ? 1 : -1
    if (!va) return (rootIdx.get(a) ?? 0) - (rootIdx.get(b) ?? 0)
    const cmp = initiativeCompareOnlyIni(
      { initiative: formatIniForSort(ha), name: '' },
      { initiative: formatIniForSort(hb), name: '' }
    )
    if (cmp !== 0) return cmp
    return (rootIdx.get(a) ?? 0) - (rootIdx.get(b) ?? 0)
  })
  const next = []
  for (const rid of sortedRoots) {
    const g = groups.get(rid)
    if (g?.length) next.push(...g)
  }
  if (next.length !== links.length) return phasesNormalized
  return { ...phasesNormalized, links: next }
}

/**
 * Nach Meta-Mutation: Phasen normalisieren und 2.A.-Wurzelgruppen nach INI ordnen.
 * @param {Record<string, unknown> | null | undefined} meta
 */
export function finalizePhasesWithOrderedRoots(meta, rawPhases) {
  const n = normalizePhases(rawPhases)
  return reorderPhaseLinkGroupsByHookIniDesc(
    n,
    meta,
    ownerIniStrFromMeta(meta)
  )
}

/**
 * Alle sichtbaren regulären ZAO-Links in Anzeigereihenfolge (höchste Ziel-INI
 * zuerst) — für Badge am Schwert (2, 3, …). Erfasst auch verkettete
 * Kinder-Links, nicht nur Wurzeln mit `parentId === null`.
 *
 * @param {ReturnType<typeof normalizePhases>} phasesNormalized
 */
export function orderedZaoRootIdsForBadge(
  meta,
  phasesNormalized,
  ownerIniStr,
  visibilityCtx = null,
  ownerId = null
) {
  const visibleLinks = sortedLinksForLayout(phasesNormalized.links).filter((l) =>
    shouldShowPhaseLinkInList(meta, l, visibilityCtx, ownerId)
  )
  // Alle regulären ZAO-Links (Mutter-Kette 2, 3, …) — z.AT und L.H.-Ende
  // ausblenden, damit die Badge-Nummern mit der Aktionskette übereinstimmen.
  // Im Gegensatz zur alten Logik werden auch verkettete Kinder einbezogen.
  const regularLinks = visibleLinks.filter(
    (l) => !l.heroExtra && l.lhEnd !== true
  )
  const linkOrderIdx = new Map(regularLinks.map((l, i) => [l.id, i]))
  const items = regularLinks.map((l) => {
    const h = hookIniForLink(l.id, ownerIniStr, phasesNormalized.links)
    return { id: l.id, hook: h, order: linkOrderIdx.get(l.id) ?? 0 }
  })
  items.sort((a, b) => {
    const ha = a.hook
    const hb = b.hook
    const va =
      ha !== null &&
      ha !== undefined &&
      Number.isFinite(/** @type {number} */ (ha)) &&
      ha >= 0
    const vb =
      hb !== null &&
      hb !== undefined &&
      Number.isFinite(/** @type {number} */ (hb)) &&
      hb >= 0
    if (va !== vb) return vb ? 1 : -1
    if (!va) return a.order - b.order
    const cmp = initiativeCompareOnlyIni(
      { initiative: formatIniForSort(ha), name: '' },
      { initiative: formatIniForSort(hb), name: '' }
    )
    if (cmp !== 0) return cmp
    return a.order - b.order
  })
  return items.map((x) => x.id)
}

/**
 * Wie `orderedZaoRootIdsForBadge`, aber schließt **alle** sichtbaren Wurzeln
 * ein — reguläre 2.A. **und** heroExtra='ang' (z.AT). lhEnd-Links bleiben
 * ausgeschlossen. Sortierung: hookIni absteigend (höhere INI → kleinere Nummer).
 */
export function orderedAllZaoRootIdsForBadge(
  meta,
  phasesNormalized,
  ownerIniStr,
  visibilityCtx = null,
  ownerId = null
) {
  const visibleLinks = sortedLinksForLayout(phasesNormalized.links).filter((l) =>
    shouldShowPhaseLinkInList(meta, l, visibilityCtx, ownerId)
  )
  const allRoots = visibleLinks.filter(
    (l) => l.parentId === null && l.lhEnd !== true
  )
  const linkOrderIdx = new Map(allRoots.map((l, i) => [l.id, i]))
  const items = allRoots.map((l) => {
    const h = hookIniForLink(l.id, ownerIniStr, phasesNormalized.links)
    return { id: l.id, hook: h, order: linkOrderIdx.get(l.id) ?? 0 }
  })
  items.sort((a, b) => {
    const ha = a.hook
    const hb = b.hook
    const va =
      ha !== null &&
      ha !== undefined &&
      Number.isFinite(/** @type {number} */ (ha)) &&
      ha >= 0
    const vb =
      hb !== null &&
      hb !== undefined &&
      Number.isFinite(/** @type {number} */ (hb)) &&
      hb >= 0
    if (va !== vb) return vb ? 1 : -1
    if (!va) return a.order - b.order
    const cmp = initiativeCompareOnlyIni(
      { initiative: formatIniForSort(ha), name: '' },
      { initiative: formatIniForSort(hb), name: '' }
    )
    if (cmp !== 0) return cmp
    return a.order - b.order
  })
  return items.map((x) => x.id)
}

export function mergedEntryIniSortKey(e) {
  if (e.kind === 'token') return e.row.initiative
  if (e.kind === 'phase' || e.kind === 'lhDone') return formatIniForSort(e.hookIni)
  return ''
}

/** Bei gleicher INI: L.H.-Zusatzzeile, dann 2.A.-Wurzel, dann übrige Einträge. */
function mergedEntryIniSectionRank(e) {
  if (e.kind === 'lhDone') return 0
  if (e.kind === 'phase' && e.link.parentId === null) return 1
  return 2
}

/**
 * Token-Zeilen + Phasen-Zeilen, nach INI sortiert (wie Kampfliste).
 * @param {string[]} tieOrderIds manuelle Reihenfolge bei gleicher INI (Token-Zeilen)
 */
export function buildMergedDisplayRows(
  tokenRows,
  items,
  tieOrderIds = [],
  combatRound = null,
  visibilityCtx = null
) {
  const metaOf = (id) => {
    const it = items.find((i) => i.id === id)
    return it?.metadata?.[TRACKER_ITEM_META_KEY]
  }
  const rootOrderByOwner = new Map()

  const tokenIds = new Set(tokenRows.map((r) => r.id))
  const tieFiltered = tieOrderIds.filter((id) => tokenIds.has(id))

  const entries = []

  for (const row of tokenRows) {
    entries.push({ kind: 'token', row })
    const meta = metaOf(row.id)
    const phases = normalizePhases(meta?.phases)

    const visibleLinks = sortedLinksForLayout(phases.links).filter((l) =>
      shouldShowPhaseLinkInList(meta, l, visibilityCtx, row.id)
    )
    const roots = visibleLinks.filter((l) => l.parentId === null)
    rootOrderByOwner.set(
      row.id,
      new Map(roots.map((l, i) => [l.id, i]))
    )

    if (phases.links.length > 0) {
      const ownerIniN = iniNumeric(row.initiative)
      const angModeOwner = meta?.['heroIniNegAngMode']
      for (const link of visibleLinks) {
        const hook = hookIniForLink(link.id, row.initiative, phases.links)
        if (hook === null) continue
        // Negative Ziel-INI: nur zulassen, wenn heroExtra z.AT + zatOnly-Modus
        // und die Mutter-INI noch >= 0 ist.
        if (hook < 0) {
          const allowZatNeg =
            link.heroExtra === 'ang' &&
            angModeOwner === 'zatOnly' &&
            Number.isFinite(ownerIniN) &&
            ownerIniN >= 0
          if (!allowZatNeg) continue
        }
        entries.push({
          kind: 'phase',
          ownerId: row.id,
          ownerName: row.name,
          ownerIniStr: row.initiative,
          link,
          hookIni: hook,
        })
      }
    }
  }

  entries.sort((a, b) => {
    const ka = mergedEntryIniSortKey(a)
    const kb = mergedEntryIniSortKey(b)
    const iniCmp = initiativeCompareOnlyIni(
      { initiative: ka, name: '' },
      { initiative: kb, name: '' }
    )
    if (iniCmp !== 0) return iniCmp

    const ra = mergedEntryIniSectionRank(a)
    const rb = mergedEntryIniSectionRank(b)
    if (ra !== rb) return ra - rb

    if (a.kind === 'token' && b.kind === 'token') {
      const overridePairs = getManualIniTieOverridePairs()
      const cmpOpts =
        overridePairs && overridePairs.size > 0 ? { overridePairs } : null
      return compareInitiativeRowsWithTieOrder(
        {
          id: a.row.id,
          initiative: a.row.initiative,
          name: a.row.name,
          ibValue: a.row.ibValue,
        },
        {
          id: b.row.id,
          initiative: b.row.initiative,
          name: b.row.name,
          ibValue: b.row.ibValue,
        },
        tieFiltered,
        cmpOpts
      )
    }
    if (a.kind === 'phase' && b.kind === 'phase') {
      const ha = formatIniForSort(a.hookIni)
      const hb = formatIniForSort(b.hookIni)
      if (ha === hb) {
        if (a.ownerId === b.ownerId) {
          const ord = rootOrderByOwner.get(a.ownerId)
          const oa = ord?.get(a.link.id)
          const ob = ord?.get(b.link.id)
          if (
            typeof oa === 'number' &&
            typeof ob === 'number' &&
            oa !== ob
          ) {
            return oa - ob
          }
        }
        const bucket = zaoRootTieOrderByIniCache[ha]
        const kza = zaoRootKey(a.ownerId, a.link.id)
        const kzb = zaoRootKey(b.ownerId, b.link.id)
        if (bucket?.length) {
          const ia = bucket.indexOf(kza)
          const ib = bucket.indexOf(kzb)
          const ma = ia === -1 ? 1e9 : ia
          const mb = ib === -1 ? 1e9 : ib
          if (ma !== mb) return ma - mb
        }
      }
    }
    const sa =
      a.kind === 'token'
        ? { initiative: a.row.initiative, name: a.row.name }
        : a.kind === 'lhDone'
          ? {
              initiative: formatIniForSort(a.hookIni),
              name: `${a.ownerName}\u0000~lhdone`,
            }
          : {
              initiative: formatIniForSort(a.hookIni),
              name: `${a.ownerName}\u0000${a.link.id}`,
            }
    const sb =
      b.kind === 'token'
        ? { initiative: b.row.initiative, name: b.row.name }
        : b.kind === 'lhDone'
          ? {
              initiative: formatIniForSort(b.hookIni),
              name: `${b.ownerName}\u0000~lhdone`,
            }
          : {
              initiative: formatIniForSort(b.hookIni),
              name: `${b.ownerName}\u0000${b.link.id}`,
            }
    return compareInitiativeRows(sa, sb)
  })

  reorderSameIniRunsByFullOrder(entries)

  if (tokenRows.length > 0) {
    entries.push({ kind: 'roundEnd' })
    entries.unshift({ kind: 'roundStart' })
  }

  return entries
}

/**
 * @param {{ kind: string, row?: { id: string }, ownerId?: string, link?: { id: string, lhEnd?: boolean }, hookIni?: unknown }} e
 * @returns {Array<{ kind: string, id?: string, ownerId?: string, linkId?: string, sub?: 'action' | 'reaction' }>}
 */
function mergedEntryToCombatSteps(e) {
  if (e.kind === 'roundStart') {
    return [{ kind: 'roundStart', id: ROUND_START_STEP_ID }]
  }
  if (e.kind === 'roundEnd') {
    return [{ kind: 'roundEnd', id: ROUND_END_STEP_ID }]
  }
  if (e.kind === 'token') {
    return [{ kind: 'token', id: e.row.id, sub: 'action' }]
  }
  if (e.kind === 'phase') {
    if (e.link.lhEnd === true) {
      return [{ kind: 'phase', ownerId: e.ownerId, linkId: e.link.id }]
    }
    return [
      { kind: 'phase', ownerId: e.ownerId, linkId: e.link.id, sub: 'action' },
      {
        kind: 'phase',
        ownerId: e.ownerId,
        linkId: e.link.id,
        sub: 'reaction',
      },
    ]
  }
  if (e.kind === 'lhDone') {
    return [{ kind: 'phase', ownerId: e.ownerId, linkId: LH_DONE_STEP_ID }]
  }
  return []
}

/**
 * Zug-Reihenfolge für Kampf-Navigation (wie die Liste: Beginn … Teilnehmer … Ende).
 */
export function buildCombatTurnSteps(
  tokenRows,
  items,
  tieOrderIds = [],
  combatRound = null,
  visibilityCtx = null
) {
  const merged = buildMergedDisplayRows(
    tokenRows,
    items,
    tieOrderIds,
    combatRound,
    visibilityCtx
  )
  const steps = []
  for (const e of merged) {
    steps.push(...mergedEntryToCombatSteps(e))
  }
  return steps
}

/** @param {{ sub?: 'action' | 'reaction' | null | undefined }} step */
function subStepForCombatPatch(step) {
  if (step.sub === 'action') return 'action'
  if (step.sub === 'reaction') return 'reaction'
  return null
}

/** @param {{ kind?: string, sub?: string } | null | undefined} step */
export function isStampableCombatStep(step) {
  if (!step) return false
  if (step.kind === 'token') return step.sub === 'action'
  if (step.kind === 'phase') return step.sub === 'action'
  return false
}

export function combatPatchForStep(step) {
  const currentTurnSubStep = subStepForCombatPatch(step)
  if (step.kind === 'token') {
    return {
      currentItemId: step.id,
      currentPhaseLinkId: null,
      currentTurnSubStep,
    }
  }
  if (step.kind === 'roundStart') {
    return {
      currentItemId: step.id,
      currentPhaseLinkId: null,
      currentTurnSubStep: null,
    }
  }
  if (step.kind === 'roundEnd') {
    return {
      currentItemId: step.id,
      currentPhaseLinkId: null,
      currentTurnSubStep: null,
    }
  }
  return {
    currentItemId: step.ownerId,
    currentPhaseLinkId: step.linkId,
    currentTurnSubStep,
  }
}

/**
 * Navigations-INI aus Kampf-Schritt (unabhängig von gefilterter Listen-Merge).
 */
export function resolveCurrentNavIniForCombat(
  tokenRows,
  items,
  tieOrderIds,
  combatRound,
  combat
) {
  if (!combat?.started || combat.roundIntroPending) return null
  const steps = buildCombatTurnSteps(
    tokenRows,
    items,
    tieOrderIds,
    combatRound,
    null
  )
  const idx = findCombatStepIndex(steps, combat)
  if (idx < 0) return null
  const step = steps[idx]
  if (step.kind === 'roundEnd') return Number.NEGATIVE_INFINITY
  if (step.kind === 'roundStart') return Number.POSITIVE_INFINITY
  if (step.kind === 'token') {
    const row = tokenRows.find((r) => r.id === step.id)
    const n = Number(String(row?.initiative ?? '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  if (step.kind === 'phase') {
    const row = tokenRows.find((r) => r.id === step.ownerId)
    const it = items.find((i) => i.id === step.ownerId)
    const meta = it?.metadata?.[TRACKER_ITEM_META_KEY]
    const links = normalizePhases(meta?.phases).links
    const hook = hookIniForLink(step.linkId, row?.initiative ?? '', links)
    return Number.isFinite(hook) ? hook : null
  }
  return null
}

export function findCombatStepIndex(steps, combat) {
  const phaseId = combat.currentPhaseLinkId
  const wantSub =
    combat.currentTurnSubStep === 'reaction'
      ? 'reaction'
      : combat.currentTurnSubStep === 'action' || combat.currentTurnSubStep == null
        ? 'action'
        : null
  return steps.findIndex((s) => {
    let positionMatch = false
    if (s.kind === 'roundStart') {
      positionMatch = s.id === combat.currentItemId && !phaseId
    } else if (s.kind === 'roundEnd') {
      positionMatch = s.id === combat.currentItemId && !phaseId
    } else if (s.kind === 'token') {
      positionMatch = s.id === combat.currentItemId && !phaseId
    } else if (s.kind === 'phase') {
      positionMatch =
        s.ownerId === combat.currentItemId && s.linkId === phaseId
    }
    if (!positionMatch) return false
    if (s.kind === 'token') {
      return true
    }
    if (s.kind === 'phase') {
      if (!s.sub) return wantSub === null
      return s.sub === wantSub
    }
    return true
  })
}

