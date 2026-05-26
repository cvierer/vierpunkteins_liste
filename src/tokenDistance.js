/**
 * DSA-Distanzklassen (Schritt). Distanzmessung nutzt Owlbear-Grid via gridDistance.js.
 * H < 0,9 | N 0,9–<1,5 | S 1,5–<3 | P 3–5 Schritt (nur Maßband).
 */
export const DIST_CLASS_H_MAX_EXCLUSIVE_SCHRITT = 0.9

export const DIST_CLASS_BANDS = [
  { code: 'N', min: 0.9, maxExclusive: 1.5 },
  { code: 'S', min: 1.5, maxExclusive: 3 },
  { code: 'P', min: 3, maxInclusive: 5 },
]

/**
 * Kartenring-Radien (äußere Grenze in Schritt).
 */
export const DIST_CLASS_RING_RADIUS = {
  H: 0.9,
  N: 1.5,
  S: 3,
  P: 5,
}

export const DIST_CLASS_RING_CODES = ['H', 'N', 'S', 'P']

/** @deprecated Nur Abwärtskompatibilität in Tests — nutze DIST_CLASS_BANDS. */
export const DIST_CLASS_THRESHOLDS = DIST_CLASS_BANDS.map((b) => ({
  max: b.maxExclusive ?? b.maxInclusive ?? b.min,
  code: b.code,
}))

/**
 * @param {string} code
 * @returns {string}
 */
export function formatDistClassLabel(code) {
  return `(${code})`
}

/**
 * @param {number} schritt
 * @param {number | null | undefined} [classXSchritt]
 * @param {{ isTouching?: boolean }} [options]
 * @returns {'' | 'H' | 'N' | 'S' | 'P' | 'X'}
 */
export function classifyDistance(schritt, classXSchritt = null, options = {}) {
  void options
  if (!Number.isFinite(schritt) || schritt < 0) return ''
  if (schritt < DIST_CLASS_H_MAX_EXCLUSIVE_SCHRITT) return 'H'
  for (const band of DIST_CLASS_BANDS) {
    if (schritt < band.min) continue
    if (band.maxExclusive != null && schritt < band.maxExclusive) return band.code
    if (band.maxInclusive != null && schritt <= band.maxInclusive) return band.code
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
 * Euklidische Distanz in Schritt (Fallback ohne OBR-Grid-API).
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
  if (!Number.isFinite(n) || n < 0) return ''
  if (n > 5) return String(Math.round(n))
  return n.toFixed(1).replace('.', ',')
}

/**
 * Schritt + Distanzklasse in Klammern, z. B. „1,2(N)“.
 * @param {number} n
 * @param {number | null | undefined} [classXSchritt]
 * @param {{ isTouching?: boolean }} [options]
 */
export function formatSchrittWithClass(n, classXSchritt = null, options = {}) {
  const s = formatSchritt(n)
  if (!s) return ''
  const cls = classifyDistance(n, classXSchritt, options)
  return cls ? `${s}${formatDistClassLabel(cls)}` : s
}
