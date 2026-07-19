/**
 * Synchronisiert dynamische Ableitungs-Pakete (signierte Deltas) anhand der
 * aktiven Eigenschafts-Mods. Kein DOM — reine Meta-Mutation.
 */

import OBR from '@owlbear-rodeo/sdk'
import {
  applyAttrDeltasToSnap,
  ATTR_FIELDS_FOR_DERIVED,
  computeDerivedRecalcDeltas,
  DERIVED_RECALC_FIELDS,
} from './heroExpandDerivedRecalc.js'
import {
  HERO_EX_FF,
  HERO_EX_GE,
  HERO_EX_IN,
  HERO_EX_KK,
  HERO_EX_KL,
  HERO_EX_KO,
  HERO_EX_MU,
} from './heroExMetaKeys.js'
import {
  HERO_EX_MODS,
  modEffectiveContribution,
  modRemaining,
  readHeroExMods,
} from './heroExMods.js'
import { readLhMechanics } from './lhMeta.js'
import { readOwnerIniReferenceForMods } from './ownerIniReference.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

const ATTR_META_KEY = Object.freeze({
  mu: HERO_EX_MU,
  kl: HERO_EX_KL,
  inn: HERO_EX_IN,
  ff: HERO_EX_FF,
  ge: HERO_EX_GE,
  kk: HERO_EX_KK,
  ko: HERO_EX_KO,
})

/**
 * @param {Record<string, unknown> | undefined} meta
 * @returns {{
 *   mu?: string,
 *   kl?: string,
 *   inn?: string,
 *   ff?: string,
 *   ge?: string,
 *   kk?: string,
 *   ko?: string,
 * }}
 */
export function readBaseAttrsForDerived(meta) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const field of ATTR_FIELDS_FOR_DERIVED) {
    const key = ATTR_META_KEY[field]
    out[field] = String(meta?.[key] ?? '').trim()
  }
  return out
}

/**
 * @param {import('./heroExMods.js').HeroExMod[]} mods
 * @param {string} field
 * @param {number} ownerIni
 * @param {number | null | undefined} round
 * @param {number | null | undefined} navIni
 * @param {{ actionsPerKr: number, triggerIniStep: number }} mech
 * @param {(m: import('./heroExMods.js').HeroExMod) => boolean} include
 * @returns {number}
 */
function sumAttrContribution(mods, field, ownerIni, round, navIni, mech, include) {
  let sum = 0
  for (const m of mods) {
    if (m.field !== field) continue
    if (m.absolute === true) continue
    if (m.derivedDynamic === true) continue
    if (!include(m)) continue
    if (modRemaining(m, ownerIni, round, navIni, mech) <= 0) continue
    sum += modEffectiveContribution(m, ownerIni, round, navIni, mech)
  }
  return sum
}

/**
 * @param {import('./heroExMods.js').HeroExMod[]} mods
 * @returns {Map<string, import('./heroExMods.js').HeroExMod[]>}
 */
function groupDynamicDerivedByParent(mods) {
  /** @type {Map<string, import('./heroExMods.js').HeroExMod[]>} */
  const byParent = new Map()
  /** @type {Map<string, import('./heroExMods.js').HeroExMod[]>} */
  const byBundle = new Map()
  for (const m of mods) {
    if (m.derivedDynamic !== true) continue
    const bid = String(m.bundleId ?? '').trim()
    if (!bid) continue
    if (!byBundle.has(bid)) byBundle.set(bid, [])
    byBundle.get(bid)?.push(m)
  }
  for (const [bid, group] of byBundle) {
    if (group.length !== DERIVED_RECALC_FIELDS.length) continue
    if (!group.every((x) => x.derivedDynamic === true)) continue
    const fields = new Set(group.map((x) => x.field))
    if (fields.size !== DERIVED_RECALC_FIELDS.length) continue
    const parent = String(group[0]?.parentBundleId ?? '').trim()
    if (!parent) continue
    byParent.set(parent, group)
  }
  return byParent
}

/**
 * Stabile Reihenfolge der Mutter-Buendel: erste Erscheinung in der Mod-Liste.
 *
 * @param {import('./heroExMods.js').HeroExMod[]} mods
 * @param {Iterable<string>} parentIds
 * @returns {string[]}
 */
function orderParentBundleIds(mods, parentIds) {
  const want = new Set(parentIds)
  /** @type {string[]} */
  const ordered = []
  for (const m of mods) {
    const bid = String(m.bundleId ?? '').trim()
    if (!bid || !want.has(bid)) continue
    if (ordered.includes(bid)) continue
    ordered.push(bid)
  }
  for (const pid of want) {
    if (!ordered.includes(pid)) ordered.push(pid)
  }
  return ordered
}

/**
 * Synchronisiert alle dynamischen Ableitungs-Pakete in `meta` (mutiert).
 * Entfernte Pakete werden nicht neu erzeugt.
 *
 * @param {Record<string, unknown>} meta
 * @param {{
 *   ownerIni: number,
 *   currentRound?: number | null,
 *   currentNavIni?: number | null,
 * }} ctx
 * @returns {boolean} true wenn Deltas geändert wurden
 */
export function syncDerivedRecalcDeltasInMeta(meta, ctx) {
  if (!meta || typeof meta !== 'object') return false
  const ownerIni = Number(ctx?.ownerIni)
  if (!Number.isFinite(ownerIni)) return false
  const round = ctx?.currentRound
  const navIni = ctx?.currentNavIni
  const mods = readHeroExMods(meta)
  if (mods.length === 0) return false

  const byParent = groupDynamicDerivedByParent(mods)
  if (byParent.size === 0) return false

  const parentIds = new Set(byParent.keys())
  const mech = readLhMechanics(meta)
  const baseAttrs = readBaseAttrsForDerived(meta)

  /** Kontext: aktive Attribut-Mods, die nicht zu einem gekoppelten Mutter-Paket gehören. */
  /** @type {Partial<Record<string, number>>} */
  const contextDeltas = {}
  for (const field of ATTR_FIELDS_FOR_DERIVED) {
    contextDeltas[field] = sumAttrContribution(
      mods,
      field,
      ownerIni,
      round,
      navIni,
      mech,
      (m) => {
        const bid = String(m.bundleId ?? '').trim()
        if (bid && parentIds.has(bid)) return false
        const parent = String(m.parentBundleId ?? '').trim()
        if (parent && parentIds.has(parent)) return false
        return true
      }
    )
  }

  let cursor = applyAttrDeltasToSnap(baseAttrs, contextDeltas)
  if (!cursor) return false

  /** @type {Map<string, number>} fieldKey → new delta; key = `${bundleId}:${field}` */
  const nextDeltas = new Map()
  const orderedParents = orderParentBundleIds(mods, parentIds)

  for (const parentBid of orderedParents) {
    const childGroup = byParent.get(parentBid)
    if (!childGroup) continue
    /** @type {Partial<Record<string, number>>} */
    const parentAttrDeltas = {}
    for (const field of ATTR_FIELDS_FOR_DERIVED) {
      parentAttrDeltas[field] = sumAttrContribution(
        mods,
        field,
        ownerIni,
        round,
        navIni,
        mech,
        (m) => String(m.bundleId ?? '').trim() === parentBid
      )
    }
    const after = applyAttrDeltasToSnap(cursor, parentAttrDeltas)
    if (!after) return false
    const deltas = computeDerivedRecalcDeltas(cursor, after)
    if (!deltas) return false
    const childBid = String(childGroup[0]?.bundleId ?? '').trim()
    for (const field of DERIVED_RECALC_FIELDS) {
      nextDeltas.set(`${childBid}:${field}`, deltas[field])
    }
    cursor = after
  }

  let changed = false
  const nextMods = mods.map((m) => {
    if (m.derivedDynamic !== true) return m
    const bid = String(m.bundleId ?? '').trim()
    const key = `${bid}:${m.field}`
    if (!nextDeltas.has(key)) return m
    const d = /** @type {number} */ (nextDeltas.get(key))
    if (d === m.delta && m.absolute !== true) return m
    changed = true
    const { absolute: _drop, ...rest } = m
    return { ...rest, delta: d, derivedDynamic: true }
  })

  if (!changed) return false
  meta[HERO_EX_MODS] = nextMods
  return true
}

/**
 * @param {string} itemId
 * @param {{
 *   currentRound?: number | null,
 *   currentNavIni?: number | null,
 * }} [ctx]
 * @returns {Promise<boolean>}
 */
export async function syncDerivedRecalcDeltasForItem(itemId, ctx = {}) {
  if (!itemId) return false
  let mutated = false
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const ownerIni = readOwnerIniReferenceForMods(m)
      if (ownerIni == null || !Number.isFinite(ownerIni)) continue
      if (
        syncDerivedRecalcDeltasInMeta(m, {
          ownerIni,
          currentRound: ctx.currentRound,
          currentNavIni: ctx.currentNavIni,
        })
      ) {
        mutated = true
      }
    }
  })
  return mutated
}

/**
 * Nach Prune: Ableitungs-Deltas für alle Items mit dynamischen Paketen syncen.
 *
 * @param {readonly any[]} items
 * @param {{
 *   currentRound?: number | null,
 *   currentNavIni?: number | null | undefined,
 * }} ctx
 * @returns {Promise<boolean>}
 */
export async function runDerivedRecalcSyncAfterCombatUpdate(items, ctx) {
  if (!Array.isArray(items) || items.length === 0) return false
  let mutated = false
  for (const item of items) {
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!meta) continue
    const mods = readHeroExMods(meta)
    if (!mods.some((m) => m.derivedDynamic === true)) continue
    try {
      if (
        await syncDerivedRecalcDeltasForItem(item.id, {
          currentRound: ctx?.currentRound,
          currentNavIni: ctx?.currentNavIni,
        })
      ) {
        mutated = true
      }
    } catch {
      /* nicht kritisch */
    }
  }
  return mutated
}
