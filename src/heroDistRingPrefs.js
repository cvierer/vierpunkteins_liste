export const HERO_DIST_RING_VISIBLE = 'heroDistRingVisible'

/** @typedef {{ H: boolean, N: boolean, S: boolean, P: boolean, m1: boolean, m2: boolean, sp: boolean, custom: boolean }} DistRingVisiblePrefs */

const CLASS_CODES = ['H', 'N', 'S', 'P']
const MOVEMENT_CODES = ['m1', 'm2', 'sp']

/** @returns {DistRingVisiblePrefs} */
export function defaultDistRingVisible() {
  return {
    H: false,
    N: true,
    S: false,
    P: false,
    m1: true,
    m2: true,
    sp: true,
    custom: false,
  }
}

/** @param {unknown} raw */
function boolPref(raw, fallback) {
  return typeof raw === 'boolean' ? raw : fallback
}

/**
 * @param {Record<string, unknown> | undefined | null} meta
 * @returns {DistRingVisiblePrefs}
 */
export function readDistRingVisible(meta) {
  const def = defaultDistRingVisible()
  const raw = meta?.[HERO_DIST_RING_VISIBLE]
  if (!raw || typeof raw !== 'object') return { ...def }
  const o = /** @type {Record<string, unknown>} */ (raw)
  return {
    H: boolPref(o.H, def.H),
    N: boolPref(o.N, def.N),
    S: boolPref(o.S, def.S),
    P: boolPref(o.P, def.P),
    m1: boolPref(o.m1, def.m1),
    m2: boolPref(o.m2, def.m2),
    sp: boolPref(o.sp, def.sp),
    custom: boolPref(o.custom, def.custom),
  }
}

/**
 * @param {Record<string, unknown>} meta
 * @param {DistRingVisiblePrefs} prefs
 */
export function writeDistRingVisible(meta, prefs) {
  const n = readDistRingVisible(prefs ? { [HERO_DIST_RING_VISIBLE]: prefs } : undefined)
  meta[HERO_DIST_RING_VISIBLE] = { ...n }
}

/**
 * @param {DistRingVisiblePrefs | undefined | null} prefs
 * @param {string} code
 */
export function isClassRingVisible(prefs, code) {
  const p = prefs ?? defaultDistRingVisible()
  return Boolean(/** @type {Record<string, boolean>} */ (p)[code])
}

/**
 * @param {DistRingVisiblePrefs | undefined | null} prefs
 * @param {string} code
 */
export function isMovementRingVisible(prefs, code) {
  const p = prefs ?? defaultDistRingVisible()
  return Boolean(/** @type {Record<string, boolean>} */ (p)[code])
}

/** @param {DistRingVisiblePrefs | undefined | null} prefs */
export function isCustomRingsEnabled(prefs) {
  const p = prefs ?? defaultDistRingVisible()
  return Boolean(p.custom)
}

export { CLASS_CODES, MOVEMENT_CODES }
