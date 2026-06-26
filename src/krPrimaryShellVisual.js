/**
 * Sichtbarkeits-Prädikate für das Primär-Aktionskästchen (ohne DOM).
 */

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo'} kind
 * @param {{ isRegularZaoSlot?: boolean, hasPrimaryCharge?: boolean, lhVoided?: boolean }} opts
 */
export function shouldKrPrimaryShellNoCharge(kind, opts = {}) {
  const isRegularZaoSlot = opts.isRegularZaoSlot ?? false
  const hasPrimaryCharge = opts.hasPrimaryCharge ?? false
  const lhVoided = opts.lhVoided ?? false
  return (
    !isRegularZaoSlot &&
    kind !== 'uo' &&
    kind !== 'lh' &&
    !hasPrimaryCharge &&
    !lhVoided
  )
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo'} kind
 * @param {boolean} [lhVoided]
 */
export function shouldKrPrimaryLhEmptyVisual(kind, lhVoided = false) {
  return kind === 'lh' && lhVoided
}

/**
 * Das n.A.-Objekt (lhEnd) ist in der End-KR (L.H. laeuft, sperrt aber keine
 * Aktionen mehr) wieder ein regulaeres, voll umwandelbares 2.AO. Solange die
 * L.H. Aktionen sperrt, bleibt es der gesperrte L.H.-Pie-Stempel-Anker.
 *
 * @param {boolean} isLhEndSlot
 * @param {boolean} lhLockingActions
 * @returns {boolean} true = Umwandelpfeile frei, als regulaeres 2.AO behandeln
 */
export function isLhEndSlotConvertible(isLhEndSlot, lhLockingActions) {
  return Boolean(isLhEndSlot) && !lhLockingActions
}
