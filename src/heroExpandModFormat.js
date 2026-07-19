// Reine Formatierung fuer Mod-Chips/Tooltips des Heldenblocks (kein DOM, kein
// Closure-State). Blatt-Modul, aus der renderModBadgesAndStrip-Closure in
// iniModMeta.js ausgelagert und dort per Barrel re-exportiert (verhaltensneutral).

/**
 * Delta-Kurzform fuer Mod-Tooltips/-Chips: `↑n` (positiv), `↓n` (negativ), sonst `0`.
 * @param {unknown} n
 * @returns {string}
 */
export function formatDeltaForTooltip(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '0'
  if (x < 0) return `\u2193${Math.abs(x)}`
  if (x > 0) return `\u2191${x}`
  return '0'
}

/**
 * Chip-/Tooltip-Wert: Fixwert als `=N`, sonst Delta-Pfeile wie `formatDeltaForTooltip`.
 * @param {unknown} n
 * @param {boolean} [absolute]
 * @returns {string}
 */
export function formatModChipValue(n, absolute = false) {
  if (absolute === true) {
    const x = Number(n)
    if (!Number.isFinite(x)) return '=0'
    return `=${x}`
  }
  return formatDeltaForTooltip(n)
}
