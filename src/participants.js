import { isImage, isLabel } from '@owlbear-rodeo/sdk'
import { compareInitiativeRowsWithTieOrder } from './initiativeSort.js'

export const TRACKER_ID = 'vierpunkteins_kampf.tracker'
export const TRACKER_ITEM_META_KEY = `${TRACKER_ID}/metadata`
export const INI_TIE_ORDER_KEY = `${TRACKER_ID}/iniTieOrder`
const META_KEY = TRACKER_ITEM_META_KEY

/**
 * Lokaler Spiegel des IB-Helden-Erweiterungs-Schlüssels (siehe
 * `iniModMeta.HERO_EX_IB`). Hier dupliziert, weil iniModMeta.js seinerseits
 * participants.js importiert (Vermeidung eines Zyklus).
 */
const HERO_EX_IB_LOCAL = 'heroExIb'

/**
 * INI-Basis (IB) als Zahl aus dem Token-Meta lesen. Akzeptiert reine Zahlen
 * sowie das Format „a+b“ (z. B. „8+2“ ⇒ 10). Liefert `null` bei leerem oder
 * ungültigem Wert.
 */
function readIbValue(meta) {
  const t = String(meta?.[HERO_EX_IB_LOCAL] ?? '').trim()
  if (t === '') return null
  const mPlus = t.match(/^(-?\d+)\s*\+\s*(-?\d+)\s*$/)
  if (mPlus) {
    const v = Number(mPlus[1]) + Number(mPlus[2])
    return Number.isFinite(v) ? v : null
  }
  const m = t.match(/^-?\d+/)
  if (!m) return null
  const v = Number(m[0])
  return Number.isFinite(v) ? v : null
}

/** Owlbear-Sichtbarkeit: unsichtbare Tokens (`visible: false`) für Spieler ausblenden. */
export function isSceneItemVisibleOnMap(item) {
  return item != null && item.visible !== false
}

/**
 * @param {unknown[]} items
 * @param {boolean} isGm
 */
export function filterItemsForListViewer(items, isGm) {
  if (isGm) return items
  return items.filter((it) => isSceneItemVisibleOnMap(it))
}

/** Wie auf der Karte sichtbar: Token-Text (Beschriftung), sonst Item-Name. */
export function getTokenListDisplayName(item) {
  if (isImage(item) || isLabel(item)) {
    const t = item.text?.plainText?.trim()
    if (t) return t
  }
  return item.name ?? ''
}

/**
 * Sammelt + sortiert die Listenteilnehmer.
 *
 * @param {unknown[]} items Szenen-Items.
 * @param {string[]} [tieOrderIds] Manuelle Reihenfolge-Liste (Token-IDs).
 * @param {Set<string> | null} [overridePairs] Optionaler Set von kanonischen
 *   "idA|idB" Pair-Keys: für gelistete Heldenpaare wird die IB-Sortierung
 *   übersprungen.
 */
export function collectSortedParticipants(
  items,
  tieOrderIds = [],
  overridePairs = null
) {
  const rows = []
  for (const item of items) {
    const metadata = item.metadata[META_KEY]
    if (metadata) {
      rows.push({
        id: item.id,
        initiative:
          metadata.initiative === undefined || metadata.initiative === null
            ? ''
            : String(metadata.initiative),
        name: getTokenListDisplayName(item),
        ibValue: readIbValue(metadata),
      })
    }
  }
  const ids = new Set(rows.map((r) => r.id))
  const tieFiltered = tieOrderIds.filter((id) => ids.has(id))
  const opts = overridePairs ? { overridePairs } : null
  rows.sort((a, b) =>
    compareInitiativeRowsWithTieOrder(a, b, tieFiltered, opts)
  )
  return rows
}
