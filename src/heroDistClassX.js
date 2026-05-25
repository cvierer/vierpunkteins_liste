export const HERO_DIST_CLASS_X_SCHRITT = 'heroDistClassXSchritt'

/** @param {unknown} raw */
function parseXSchritt(raw) {
  const t = String(raw ?? '').trim()
  if (!t || !/^\d+$/.test(t)) return null
  const n = parseInt(t, 10)
  if (!Number.isFinite(n) || n < 1 || n > 99) return null
  return n
}

/**
 * Frei wählbare Zusatz-Distanzklasse X (Schritt-Grenze am Token).
 * @param {Record<string, unknown> | undefined | null} meta
 * @returns {number | null}
 */
export function readHeroDistClassXSchritt(meta) {
  return parseXSchritt(meta?.[HERO_DIST_CLASS_X_SCHRITT])
}

/**
 * @param {Record<string, unknown>} meta
 * @param {number | string | null | undefined} value
 */
export function writeHeroDistClassXSchritt(meta, value) {
  const n = parseXSchritt(value)
  if (n == null) delete meta[HERO_DIST_CLASS_X_SCHRITT]
  else meta[HERO_DIST_CLASS_X_SCHRITT] = String(n)
}
