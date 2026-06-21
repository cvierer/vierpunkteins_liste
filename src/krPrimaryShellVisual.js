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
