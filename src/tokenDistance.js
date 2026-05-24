/** DSA-Distanzklassen-Schwellen (Schritt, Mittelpunkt-Euklidisch). */
export const DIST_CLASS_THRESHOLDS = [
  { max: 0.8, code: 'H' },
  { max: 1.5, code: 'N' },
  { max: 3, code: 'S' },
  { max: 4.5, code: 'P' },
]

/** @returns {'' | 'H' | 'N' | 'S' | 'P'} */
export function classifyDistance(schritt) {
  if (!Number.isFinite(schritt) || schritt < 0) return ''
  for (const { max, code } of DIST_CLASS_THRESHOLDS) {
    if (schritt <= max) return code
  }
  return ''
}

/** @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item */
export function tokenCenter(item) {
  const w = Number(item?.width) || 0
  const h = Number(item?.height) || 0
  return {
    x: (item?.position?.x ?? 0) + w / 2,
    y: (item?.position?.y ?? 0) + h / 2,
  }
}

/**
 * Distanz in Schritt (1 OBR-Grid-Feld = dpi px).
 * @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} itemA
 * @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} itemB
 */
export function computeSchritt(itemA, itemB, dpi) {
  const d = Number(dpi)
  if (!d || d <= 0) return NaN
  const a = tokenCenter(itemA)
  const b = tokenCenter(itemB)
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy) / d
}

/** @param {number} n */
export function formatSchritt(n) {
  if (!Number.isFinite(n)) return ''
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')
}

/** Schritt + Distanzklasse ohne Leerzeichen, z. B. „1,2N“. */
export function formatSchrittWithClass(n) {
  const s = formatSchritt(n)
  if (!s) return ''
  const cls = classifyDistance(n)
  return cls ? `${s}${cls}` : s
}
