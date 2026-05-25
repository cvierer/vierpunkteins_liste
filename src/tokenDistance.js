/** DSA-Distanzklassen-Schwellen (Schritt, Mittelpunkt-Euklidisch). */
export const DIST_CLASS_THRESHOLDS = [
  { max: 0.8, code: 'H' },
  { max: 1.5, code: 'N' },
  { max: 3, code: 'S' },
  { max: 4.5, code: 'P' },
]

/** @returns {'' | 'H' | 'N' | 'S' | 'P' | 'X'} */
export function classifyDistance(schritt, classXSchritt = null) {
  if (!Number.isFinite(schritt) || schritt < 0) return ''
  for (const { max, code } of DIST_CLASS_THRESHOLDS) {
    if (schritt <= max) return code
  }
  const xMax =
    classXSchritt != null && Number.isFinite(classXSchritt) && classXSchritt > 0
      ? classXSchritt
      : null
  if (xMax != null && schritt <= xMax) return 'X'
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
 * Distanz in Schritt: Mittelpunkt-zu-Mittelpunkt (1 OBR-Grid-Feld = dpi px).
 * @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} itemA
 * @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} itemB
 */
export function computeSchritt(itemA, itemB, dpi) {
  const a = tokenCenter(itemA)
  const b = tokenCenter(itemB)
  return computeSchrittFromCenters(a, b, dpi)
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {number} dpi
 */
export function computeSchrittFromCenters(a, b, dpi) {
  const d = Number(dpi)
  if (!d || d <= 0) return NaN
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy) / d
}

/** @param {number} n */
export function formatSchritt(n) {
  if (!Number.isFinite(n)) return ''
  if (n >= 100) return String(Math.round(n))
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')
}

/** Schritt + Distanzklasse ohne Leerzeichen, z. B. „1,2N“. */
export function formatSchrittWithClass(n, classXSchritt = null) {
  const s = formatSchritt(n)
  if (!s) return ''
  const cls = classifyDistance(n, classXSchritt)
  return cls ? `${s}${cls}` : s
}
