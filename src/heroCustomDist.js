export const HERO_CUSTOM_DIST = 'heroCustomDist'

export const DEFAULT_BAND_LABELS = Object.freeze([
  'Sehr nah',
  'Nah',
  'Mittel',
  'Weit',
  'Extrem weit',
])

export const DEFAULT_PROFILE_NAMES = Object.freeze([
  'Fernkampfwaffe 1',
  'Fernkampfwaffe 2',
  'Fernkampfwaffe 3',
])

export const CUSTOM_DIST_PROFILE_COUNT = 3
export const CUSTOM_DIST_BAND_COUNT = 5

/** @typedef {{ label: string, schritt: number | null }} CustomDistBand */
/** @typedef {{ enabled: boolean, name: string, bands: CustomDistBand[] }} CustomDistProfile */
/** @typedef {{ code: string, label: string, schritt: number, color: string }} CustomDistRingSpec */

/** Profil-Basis × Band-Abstufung (Teal / Amber / Rose). */
const PROFILE_BAND_COLORS = Object.freeze([
  ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'],
  ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
  ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3'],
])

/** @param {number} profileIndex @param {number} bandIndex */
export function customDistRingCode(profileIndex, bandIndex) {
  return `cd-p${profileIndex}-b${bandIndex}`
}

/** @returns {string[]} */
export function allCustomDistRingCodes() {
  /** @type {string[]} */
  const codes = []
  for (let p = 0; p < CUSTOM_DIST_PROFILE_COUNT; p++) {
    for (let b = 0; b < CUSTOM_DIST_BAND_COUNT; b++) {
      codes.push(customDistRingCode(p, b))
    }
  }
  return codes
}

/** @param {number} profileIndex @param {number} bandIndex */
export function customDistRingColor(profileIndex, bandIndex) {
  const row = PROFILE_BAND_COLORS[profileIndex] ?? PROFILE_BAND_COLORS[0]
  return row[bandIndex] ?? row[0]
}

/** @param {unknown} raw */
function parseSchritt(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  if (!/^\d+$/.test(t)) return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** @param {unknown} raw @param {number} profileIndex @param {number} bandIndex */
function normalizeBand(raw, profileIndex, bandIndex) {
  const fallbackLabel = DEFAULT_BAND_LABELS[bandIndex] ?? ''
  if (!raw || typeof raw !== 'object') {
    return { label: fallbackLabel, schritt: null }
  }
  const labelRaw = String(/** @type {{ label?: unknown }} */ (raw).label ?? '').trim()
  return {
    label: labelRaw || fallbackLabel,
    schritt: parseSchritt(/** @type {{ schritt?: unknown }} */ (raw).schritt),
  }
}

/** @param {number} profileIndex @param {unknown} [raw] */
function normalizeProfile(raw, profileIndex) {
  const fallbackName = DEFAULT_PROFILE_NAMES[profileIndex] ?? ''
  const src = raw && typeof raw === 'object' ? raw : {}
  const bandsRaw = Array.isArray(/** @type {{ bands?: unknown }} */ (src).bands)
    ? /** @type {{ bands: unknown[] }} */ (src).bands
    : []
  /** @type {CustomDistBand[]} */
  const bands = []
  for (let b = 0; b < CUSTOM_DIST_BAND_COUNT; b++) {
    bands.push(normalizeBand(bandsRaw[b], profileIndex, b))
  }
  return {
    enabled: /** @type {{ enabled?: unknown }} */ (src).enabled === true,
    name: String(/** @type {{ name?: unknown }} */ (src).name ?? '').trim() || fallbackName,
    bands,
  }
}

/** @returns {CustomDistProfile[]} */
export function defaultCustomDistProfiles() {
  /** @type {CustomDistProfile[]} */
  const out = []
  for (let p = 0; p < CUSTOM_DIST_PROFILE_COUNT; p++) {
    /** @type {CustomDistBand[]} */
    const bands = []
    for (let b = 0; b < CUSTOM_DIST_BAND_COUNT; b++) {
      bands.push({ label: DEFAULT_BAND_LABELS[b], schritt: null })
    }
    out.push({
      enabled: false,
      name: DEFAULT_PROFILE_NAMES[p],
      bands,
    })
  }
  return out
}

/**
 * @param {Record<string, unknown> | undefined | null} meta
 * @returns {CustomDistProfile[]}
 */
export function readCustomDistProfiles(meta) {
  const raw = meta?.[HERO_CUSTOM_DIST]
  if (!Array.isArray(raw)) return defaultCustomDistProfiles()
  /** @type {CustomDistProfile[]} */
  const out = []
  for (let p = 0; p < CUSTOM_DIST_PROFILE_COUNT; p++) {
    out.push(normalizeProfile(raw[p], p))
  }
  return out
}

/**
 * @param {Record<string, unknown>} meta
 * @param {CustomDistProfile[]} profiles
 */
export function writeCustomDistProfiles(meta, profiles) {
  const normalized = readCustomDistProfiles({ [HERO_CUSTOM_DIST]: profiles })
  meta[HERO_CUSTOM_DIST] = normalized.map((profile) => ({
    enabled: profile.enabled,
    name: profile.name,
    bands: profile.bands.map((band) => ({
      label: band.label,
      schritt: band.schritt,
    })),
  }))
}

/**
 * @param {CustomDistProfile[] | undefined | null} profiles
 * @returns {CustomDistRingSpec[]}
 */
export function buildCustomDistRingSpecs(profiles) {
  const list = readCustomDistProfiles(
    profiles ? { [HERO_CUSTOM_DIST]: profiles } : undefined
  )
  /** @type {CustomDistRingSpec[]} */
  const specs = []
  for (let p = 0; p < list.length; p++) {
    const profile = list[p]
    if (!profile.enabled) continue
    for (let b = 0; b < profile.bands.length; b++) {
      const band = profile.bands[b]
      if (band.schritt == null || band.schritt <= 0) continue
      specs.push({
        code: customDistRingCode(p, b),
        label: `${profile.name} · ${band.label}`,
        schritt: band.schritt,
        color: customDistRingColor(p, b),
      })
    }
  }
  return specs
}
