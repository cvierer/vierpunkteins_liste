/**
 * Schreib-Choke-Point für Tracker-Meta: Heldenblock-Felder isoliert patchen.
 */
import OBR from '@owlbear-rodeo/sdk'
import { TRACKER_ITEM_META_KEY } from './participants.js'

/** @type {readonly string[]} */
const HERO_EXPAND_KEY_PREFIXES = [
  'heroEx',
  'heroIni',
  'heroBg',
  'heroSecondAo',
  'heroExtra',
  'hitZone',
  'hz',
  'wappen',
]

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isHeroExpandWritableKey(key) {
  if (typeof key !== 'string' || !key) return false
  const lower = key.toLowerCase()
  return HERO_EXPAND_KEY_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()))
}

/**
 * @param {Record<string, unknown>} patch
 */
export function assertHeroExpandOnlyKeys(patch) {
  if (!patch || typeof patch !== 'object') return
  for (const key of Object.keys(patch)) {
    if (key === 'initiative') continue
    if (!isHeroExpandWritableKey(key)) {
      throw new Error(
        `patchHeroExpandMeta: verbotener Key "${key}" (nur Heldenblock-Felder)`
      )
    }
  }
}

/**
 * @param {string} itemId
 * @param {(m: Record<string, unknown>) => void} mutator
 */
export async function patchHeroExpandMeta(itemId, mutator) {
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata?.[TRACKER_ITEM_META_KEY]
      if (!m || typeof m !== 'object') continue
      mutator(m)
    }
  })
}
