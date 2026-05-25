export const HERO_CUSTOM_DIST = 'heroCustomDist'

export const CUSTOM_DIST_MAX_PROFILES = 24
export const CUSTOM_DIST_MAX_BANDS = 99
/** Maximaler Schritt-Wert pro Distanzstufe (Reichweiten-Profile, Klasse X). */
export const CUSTOM_DIST_MAX_SCHRITT = 999
export const CUSTOM_DIST_MIN_BANDS = 1

/** @deprecated Nur fuer Alt-Import; neue Helden nutzen variable Profile. */
export const CUSTOM_DIST_PROFILE_COUNT = 3
/** @deprecated Nur fuer Alt-Import. */
export const CUSTOM_DIST_BAND_COUNT = 5

export const DEFAULT_BAND_LABELS = Object.freeze([
  'Sehr nah',
  'Nah',
  'Mittel',
  'Weit',
  'Extrem weit',
])

export const DEFAULT_PROFILE_NAMES = Object.freeze([
  'Fernkampf',
  'Zauberreichweite',
])

/** @typedef {{ label: string, schritt: number | null }} CustomDistBand */
/** @typedef {{ enabled: boolean, name: string, bands: CustomDistBand[] }} CustomDistProfile */
/** @typedef {{ code: string, label: string, schritt: number, color: string }} CustomDistRingSpec */

const PROFILE_HUES = Object.freeze([168, 38, 345, 210, 280, 120, 15, 195])

/** @param {number} profileIndex @param {number} bandIndex @param {number} bandCount */
export function customDistRingColor(profileIndex, bandIndex, bandCount = 5) {
  const hue = PROFILE_HUES[profileIndex % PROFILE_HUES.length] ?? 168
  const maxIdx = Math.max(1, bandCount - 1)
  const t = bandIndex / maxIdx
  const light = 42 + t * 38
  const sat = 58 - t * 12
  return `hsl(${hue} ${sat}% ${light}%)`
}

/** @param {number} profileIndex @param {number} bandIndex */
export function customDistRingCode(profileIndex, bandIndex) {
  return `cd-p${profileIndex}-b${bandIndex}`
}

/**
 * @param {number} [maxProfile]
 * @param {number} [maxBand]
 * @returns {string[]}
 */
export function allCustomDistRingCodes(
  maxProfile = CUSTOM_DIST_MAX_PROFILES,
  maxBand = CUSTOM_DIST_MAX_BANDS
) {
  /** @type {string[]} */
  const codes = []
  for (let p = 0; p < maxProfile; p++) {
    for (let b = 0; b < maxBand; b++) {
      codes.push(customDistRingCode(p, b))
    }
  }
  return codes
}

/** @param {unknown} raw */
function parseSchritt(raw) {
  const t = String(raw ?? '').trim()
  if (!t || !/^\d+$/.test(t)) return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) && n >= 1 && n <= CUSTOM_DIST_MAX_SCHRITT ? n : null
}

/** @param {unknown} raw @param {number} bandIndex */
function normalizeBand(raw, bandIndex) {
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
  const fallbackName =
    DEFAULT_PROFILE_NAMES[profileIndex] ?? `Reichweite ${profileIndex + 1}`
  const src = raw && typeof raw === 'object' ? raw : {}
  const bandsRaw = Array.isArray(/** @type {{ bands?: unknown }} */ (src).bands)
    ? /** @type {{ bands: unknown[] }} */ (src).bands
    : []
  /** @type {CustomDistBand[]} */
  const bands = []
  const limit = Math.min(bandsRaw.length, CUSTOM_DIST_MAX_BANDS)
  for (let b = 0; b < limit; b++) {
    bands.push(normalizeBand(bandsRaw[b], b))
  }
  if (bands.length < CUSTOM_DIST_MIN_BANDS) {
    for (let b = bands.length; b < CUSTOM_DIST_MIN_BANDS; b++) {
      bands.push(normalizeBand(null, b))
    }
  }
  return {
    enabled: /** @type {{ enabled?: unknown }} */ (src).enabled === true,
    name: String(/** @type {{ name?: unknown }} */ (src).name ?? '').trim() || fallbackName,
    bands,
  }
}

/** @returns {CustomDistProfile[]} */
export function defaultCustomDistProfiles() {
  return DEFAULT_PROFILE_NAMES.map((name) => ({
    enabled: false,
    name,
    bands: [{ label: '', schritt: null }],
  }))
}

/**
 * @param {Record<string, unknown> | undefined | null} meta
 * @returns {CustomDistProfile[]}
 */
export function readCustomDistProfiles(meta) {
  const raw = meta?.[HERO_CUSTOM_DIST]
  if (!Array.isArray(raw) || raw.length === 0) return defaultCustomDistProfiles()
  /** @type {CustomDistProfile[]} */
  const out = []
  const limit = Math.min(raw.length, CUSTOM_DIST_MAX_PROFILES)
  for (let p = 0; p < limit; p++) {
    out.push(normalizeProfile(raw[p], p))
  }
  return out.length > 0 ? out : defaultCustomDistProfiles()
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
    const bandCount = profile.bands.length
    for (let b = 0; b < bandCount; b++) {
      const band = profile.bands[b]
      if (band.schritt == null || band.schritt <= 0) continue
      specs.push({
        code: customDistRingCode(p, b),
        label: `${profile.name} · ${band.label || `Stufe ${b + 1}`}`,
        schritt: band.schritt,
        color: customDistRingColor(p, b, bandCount),
      })
    }
  }
  return specs
}
