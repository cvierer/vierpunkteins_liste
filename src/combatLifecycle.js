/**
 * Registry für Kampf-Navigations-Hooks — Features registrieren sich hier,
 * ohne `initiativeList.js` direkt zu importieren.
 */

/** @typedef {(items: import('@owlbear-rodeo/sdk').Item[], tieOrderIds: string[], ctx: { combatRound: number | null }) => Promise<boolean>} AfterCombatHandler */

/** @type {{ id: string, when: (items: import('@owlbear-rodeo/sdk').Item[]) => boolean, run: AfterCombatHandler }[]} */
const afterCombatHandlers = []

/**
 * @param {string} id
 * @param {AfterCombatHandler} fn
 * @param {{ when?: (items: import('@owlbear-rodeo/sdk').Item[]) => boolean }} [opts]
 */
export function registerAfterCombatUpdate(id, fn, opts = {}) {
  const when = opts.when ?? (() => true)
  const ix = afterCombatHandlers.findIndex((h) => h.id === id)
  const entry = { id, when, run: fn }
  if (ix >= 0) afterCombatHandlers[ix] = entry
  else afterCombatHandlers.push(entry)
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {string[]} tieOrderIds
 * @param {{ combatRound?: number | null }} [ctx]
 * @returns {Promise<boolean>} true wenn mindestens ein Handler mutierte
 */
export async function runAfterCombatUpdates(items, tieOrderIds, ctx = {}) {
  const combatRound =
    ctx.combatRound != null && Number.isFinite(Number(ctx.combatRound))
      ? Number(ctx.combatRound)
      : null
  let mutated = false
  for (const h of afterCombatHandlers) {
    if (!h.when(items)) continue
    try {
      if (await h.run(items, tieOrderIds, { combatRound })) mutated = true
    } catch {
      /* Feature-Hook darf Nav nicht blockieren */
    }
  }
  return mutated
}

/** Nur für Tests. */
export function clearAfterCombatHandlersForTests() {
  afterCombatHandlers.length = 0
}
