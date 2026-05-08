/**
 * Automatische Helden-Mods aus Trefferzonen-Wunden und LE-Schwellen.
 * Reine Ableitung — Basiswerte (heroExAt, …) bleiben unverändert.
 */

import OBR from '@owlbear-rodeo/sdk'
import {
  clampWound,
  hzWKey,
  readHitZoneBundle,
} from './hitZoneMeta.js'
import { zoneStageFromWounds } from './heroBlockAutoMod.js'
import { getCombat } from './combatRoom.js'
import {
  effectiveDeltaForField,
  generateModBundleId,
  HERO_EX_MODS,
  readHeroExMods,
} from './heroExMods.js'
import { readOwnerIniReferenceForMods } from './ownerIniReference.js'
import { getRoomSettings } from './roomSettings.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'
import {
  autoModDeltasForWappen,
  cloneDefaultWappenDefs,
  effectiveWappenForHero,
} from './wappenDefs.js'

/** Liefert die Wappen-Liste aus dem Snapshot oder fällt auf die Defaults zurück. */
function wappenDefsFromSnap(snap) {
  const list = snap?.wappenDefs
  if (Array.isArray(list) && list.length > 0) return list
  return cloneDefaultWappenDefs()
}

/** Tracker-Meta: unterdrückte Auto-Bündel bis sich die Quellsignatur ändert. */
export const HERO_EX_AUTO_SUPPRESSED = 'heroExAutoSuppressed'

/** Tracker-Meta: manuelles bun-* → ursprüngliche auto-* bundleId (nach Konvertieren). */
export const HERO_EX_BUNDLE_ORIGIN = 'heroExBundleOrigin'

/** Tracker-Meta: zuletzt LE im „sicheren“ Band (leBand === -1, d. h. ≥ 1/2 LEmax). */
export const HERO_EX_LAST_SAFE_LE = 'heroExLastSafeLe'

const HERO_EX_LE = 'heroExLe'
const HERO_EX_LE_MAX = 'heroExLeMax'
const HERO_EX_KO = 'heroExKo'
const HERO_EX_GS = 'heroExGs'
const HERO_EX_LE_THRESHOLD = 'heroExLeThreshold'
const HERO_EX_SHOW_FK = 'heroExShowFk'
const HERO_EX_UNFAEHIG_THRESHOLD = 'heroExUnfaehigThreshold'
const HERO_EX_UNFAEHIG_FIXED_FIELDS = 'heroExUnfaehigFixedFields'
const HERO_DEATH_AT_MINUS_ONE_POINT_FIVE_KO = 'heroDeathAtMinusOnePointFiveKo'
const HERO_EX_WAPPEN_TEMPLATE = 'heroExWappenTemplate'

export const AUTO_MOD_BUNDLE_PREFIX = 'auto-'
const AUTO_ZONE_PREFIX = `${AUTO_MOD_BUNDLE_PREFIX}zone-`

/**
 * @param {string} zoneId
 * @param {number} wounds
 */
function autoZoneWoundLabel(zoneId, wounds) {
  const w = Math.max(1, Math.floor(Number(wounds)) || 1)
  const zid = String(zoneId ?? '').trim().toLowerCase()
  if (zid === 'kopf') return `Kopf -${2 * w}`
  if (zid === 'schildarm' || zid === 'schwertarm') return `Arm -${2 * w}`
  if (zid === 'lbein' || zid === 'rbein') return `Bein -${2 * w}`
  if (zid === 'brust' || zid === 'ruecken' || zid === 'bauch') {
    return `Rumpf-${w}-${2 * w}`
  }
  return `${w}*W ${String(zoneId || '').trim().toUpperCase()}`
}

/** @param {string} raw */
function parseSignedInt(raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

/** @param {string} raw */
function parseNonNegInt(raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * @param {number} le
 * @param {number} leMax
 */
export function leBand(le, leMax, extraThreshold = null) {
  if (le <= 0) return 4
  if (Number.isFinite(Number(extraThreshold))) {
    const t = Math.max(0, Math.floor(Number(extraThreshold)))
    if (t > 0 && le <= t) return 3
  }
  if (le * 4 < leMax) return 2
  if (le * 3 < leMax) return 1
  if (le * 2 < leMax) return 0
  return -1
}

/**
 * @param {number} band
 */
export function leAtPaMalusForBand(band) {
  if (band >= 2) return 3
  if (band === 1) return 2
  if (band === 0) return 1
  return 0
}

/**
 * @param {number} band
 */
export function leTalentZauberErschwernis(band) {
  if (band >= 2) return 9
  if (band === 1) return 6
  if (band === 0) return 3
  return 0
}

function genModId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `mod-${crypto.randomUUID()}`
    }
  } catch {
    /* ignore */
  }
  return `mod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Bruchteil-Anteil der LE-Schwelle (z. B. "<1/2") für UI wie Mod-Chip.
 *
 * @param {number} band
 */
export function leBandLabelDe(band) {
  if (band >= 2) return '<1/4'
  if (band === 1) return '<1/3'
  if (band === 0) return '<1/2'
  return ''
}

/**
 * Kompakte LE-Labels für Auto-Mod-Chips:
 * kritische Bereiche explizit statt nur Bruchteil-Band.
 *
 * @param {number} band
 */
function leAutoChipLabelDe(band, extraThreshold = null) {
  if (band >= 4) return '<=0'
  if (band === 3) {
    const t = Number(extraThreshold)
    return Number.isFinite(t) && t > 0 ? `<${Math.floor(t)}` : '<S'
  }
  return leBandLabelDe(band)
}

/**
 * @param {Record<string, unknown>} snap
 * @returns {number | null}
 */
function readLeThresholdFromSnapshot(snap) {
  const t = String(snap?.leThreshold ?? '').trim().toLowerCase()
  if (!t || t === 'off' || t === 'none' || t === 'false' || t === '0') return null
  const n = Math.floor(Number(t.replace(',', '.')))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * @param {Record<string, unknown>} snap
 * @returns {boolean}
 */
function showFkFromSnapshot(snap) {
  const t = String(snap?.showFk ?? '').trim().toLowerCase()
  return !['0', 'false', 'off', 'no', 'nein'].includes(t)
}

/**
 * @param {Record<string, unknown>} snap
 * @returns {number}
 */
function readUnfaehigThresholdFromSnapshot(snap) {
  const t = String(snap?.unfaehigThreshold ?? '').trim().toLowerCase()
  const n = Math.floor(Number(t.replace(',', '.')))
  if (t && Number.isFinite(n) && n >= 0) return n
  const tpl = String(snap?.wappenTemplate ?? '').trim().toLowerCase()
  return tpl === 'vierbeiner' ? 0 : 5
}

/**
 * @param {Record<string, unknown>} snap
 * @returns {number | null}
 */
function readUnfaehigFixedLeFromSnapshot(snap) {
  const txt = String(snap?.unfaehigFixedFields ?? '')
  for (const part of txt.split(',')) {
    const [kRaw, vRaw] = String(part ?? '').split('=')
    const k = String(kRaw ?? '').trim().toLowerCase()
    if (k !== 'gs') continue
    const n = Math.floor(Number(String(vRaw ?? '').trim().replace(',', '.')))
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

/**
 * @param {Record<string, unknown>} snap
 * @returns {boolean}
 */
function deathAtMinusOnePointFiveKoFromSnapshot(snap) {
  const t = String(snap?.deathAtMinusOnePointFiveKo ?? '').trim().toLowerCase()
  return ['1', 'true', 'on', 'yes', 'ja'].includes(t)
}

/**
 * Zusätzliche LE/KO-Stufen für Auto-Label im negativen Bereich.
 *
 * @param {number} leNum
 * @param {number | null} koNum
 */
function leKoCriticalLabel(leNum, koNum) {
  if (leNum > 0) return ''
  if (!(koNum != null && koNum > 0)) return '<=0'
  const depth = -leNum
  if (depth > 1.5 * koNum) return '<-1,5KO'
  if (depth > koNum) return '<-KO'
  if (depth > 0.5 * koNum) return '<-KO/2'
  return '<=0'
}

/**
 * @typedef {{
 *   round: number | null | undefined,
 *   navIni: number | null | undefined,
 * }} HeroAutoModCtx
 */

/**
 * @param {Record<string, unknown> | undefined} meta
 * @returns {Record<string, number>}
 */
export function readAutoSuppressed(meta) {
  const raw = /** @type {any} */ (meta)?.[HERO_EX_AUTO_SUPPRESSED]
  if (!raw || typeof raw !== 'object') return {}
  /** @type {Record<string, number>} */
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    const n = Math.floor(Number(v))
    if (!k || typeof k !== 'string' || !k.startsWith(AUTO_MOD_BUNDLE_PREFIX)) continue
    if (!Number.isFinite(n)) continue
    out[k] = n
  }
  return out
}

/**
 * @param {Record<string, unknown> | undefined} meta
 * @returns {Record<string, string>} bun-* → ursprüngliche auto-* bundleId
 */
export function readBundleOriginMap(meta) {
  const raw = /** @type {any} */ (meta)?.[HERO_EX_BUNDLE_ORIGIN]
  if (!raw || typeof raw !== 'object') return {}
  /** @type {Record<string, string>} */
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!k || typeof k !== 'string') continue
    const vs = String(v ?? '').trim()
    if (!vs.startsWith(AUTO_MOD_BUNDLE_PREFIX)) continue
    out[k] = vs
  }
  return out
}

/**
 * @param {Record<string, unknown> | undefined} meta
 * @param {string} bundleId
 * @returns {string | null} auto-* id oder null
 */
export function resolveOriginAutoId(meta, bundleId) {
  const bid = String(bundleId ?? '').trim()
  if (!bid) return null
  if (bid.startsWith(AUTO_MOD_BUNDLE_PREFIX)) return bid
  const o = readBundleOriginMap(meta)[bid]
  return o ?? null
}

/**
 * Speichert letztes LE im Band ohne AT/PA-Malus (leBand === -1).
 *
 * @param {Record<string, unknown>} m — Tracker-Metadaten (mutiert)
 */
export function updateLastSafeLeIfSafe(m) {
  const snap = snapshotFromTrackerMeta(m)
  const leNum = parseSignedInt(snap.le)
  const leMaxNum = parseNonNegInt(snap.leMax)
  if (leNum === null || leMaxNum === null || leMaxNum <= 0) return
  if (leBand(leNum, leMaxNum, readLeThresholdFromSnapshot(snap)) !== -1) return
  m[HERO_EX_LAST_SAFE_LE] = String(leNum)
}

/**
 * Wie `readNavIniForModPatch` in iniModMeta — ohne Zirkelimport.
 * @returns {number}
 */
function readNavIniForModPatchDom() {
  try {
    const host = document.querySelector('#initiative-list-host')
    if (host instanceof HTMLElement) {
      const raw = host.dataset.currentNavIni
      if (raw === '+inf') return Number.POSITIVE_INFINITY
      if (raw === '-inf') return Number.NEGATIVE_INFINITY
      if (raw && raw !== '') {
        const n = Number(raw)
        if (Number.isFinite(n)) return n
      }
    }
  } catch {
    /* ignore */
  }
  return Number.POSITIVE_INFINITY
}

/** @returns {HeroAutoModCtx} */
function defaultHeroAutoModCtx() {
  const comb = getCombat()
  const rRound =
    comb?.started && Number.isFinite(Number(comb.round))
      ? Number(comb.round)
      : null
  return { round: rRound, navIni: readNavIniForModPatchDom() }
}

/**
 * LE fuer LE-Schwellen inkl. aktiver LE-Mods (falls Owner-INI vorliegt).
 *
 * @param {Record<string, unknown>} snap
 * @param {Record<string, unknown> | undefined} meta
 * @param {HeroAutoModCtx | undefined} ctx
 * @returns {number | null}
 */
function effectiveLeForThresholds(snap, meta, ctx) {
  const leBase = parseSignedInt(snap.le)
  if (leBase === null) return null
  if (!meta) return leBase
  const ownerIni = readOwnerIniReferenceForMods(meta)
  if (!(ownerIni != null && Number.isFinite(ownerIni))) return leBase
  const round =
    ctx?.round != null && Number.isFinite(Number(ctx.round))
      ? Number(ctx.round)
      : null
  const navIni =
    ctx?.navIni === Number.POSITIVE_INFINITY || ctx?.navIni === Number.NEGATIVE_INFINITY
      ? ctx.navIni
      : Number.isFinite(Number(ctx?.navIni))
        ? Number(ctx.navIni)
        : null
  const dLe = effectiveDeltaForField(meta, 'le', ownerIni, round, navIni)
  if (!Number.isFinite(dLe) || dLe === 0) return leBase
  return leBase + dLe
}

/** Nicht-Arm-Zonen für „3. Wunde“ → kampfunfähig (Bits 3–8 der Signatur). */
const UNFAEHIG_NON_ARM_ZONE_IDS = Object.freeze([
  'kopf',
  'brust',
  'ruecken',
  'bauch',
  'lbein',
  'rbein',
])

/** Stabile Reihenfolge für LA/RA in `armSet`. */
const UNFAEHIG_ARM_ZONE_ORDER = Object.freeze(['schildarm', 'schwertarm'])

/**
 * Quellen für `auto-le-unfaehig`: LE-Schwelle, dritte Wunde am Arm, dritte Wunde woanders.
 *
 * @param {Record<string, unknown>} snap — wie snapshotFromTrackerMeta / readHeroExpandSnapshot
 * @param {Record<string, unknown> | undefined} meta
 * @param {HeroAutoModCtx | undefined} ctx
 */
export function computeUnfaehigSources(snap, meta, ctx) {
  const leNum = effectiveLeForThresholds(snap, meta, ctx)
  const threshold = readUnfaehigThresholdFromSnapshot(snap)
  const leTriggered = leNum !== null && leNum <= threshold

  /** @type {string[]} */
  const armSet = []
  let nonArm3w = false

  const defs = wappenDefsFromSnap(snap)
  const nonArm = new Set(UNFAEHIG_NON_ARM_ZONE_IDS)

  for (const def of defs) {
    if (!def.active) continue
    const zid = def.id
    const w = clampWound(snap.hitZones?.zones?.[zid]?.w ?? 0)
    if (w < 3) continue
    if (zid === 'schildarm' || zid === 'schwertarm') {
      if (!armSet.includes(zid)) armSet.push(zid)
    } else if (nonArm.has(zid)) {
      nonArm3w = true
    }
  }

  armSet.sort(
    (a, b) =>
      UNFAEHIG_ARM_ZONE_ORDER.indexOf(a) - UNFAEHIG_ARM_ZONE_ORDER.indexOf(b)
  )

  return { leTriggered, armSet, nonArm3w }
}

/**
 * Bitmaske für Suppression / Signatur von `auto-le-unfaehig`.
 * Bit 0 = LE-Schwelle, 1 = Schildarm, 2 = Schwertarm, 3–8 = kopf…rbein (je Zone).
 *
 * @param {Record<string, unknown>} snap
 * @param {Record<string, unknown> | undefined} meta
 * @param {HeroAutoModCtx | undefined} ctx
 * @returns {number | null}
 */
export function computeUnfaehigTriggerMask(snap, meta, ctx) {
  const sources = computeUnfaehigSources(snap, meta, ctx)
  if (!sources.leTriggered && !sources.nonArm3w && sources.armSet.length === 0) {
    return null
  }
  let mask = 0
  if (sources.leTriggered) mask |= 1
  if (sources.armSet.includes('schildarm')) mask |= 2
  if (sources.armSet.includes('schwertarm')) mask |= 4
  for (let i = 0; i < UNFAEHIG_NON_ARM_ZONE_IDS.length; i++) {
    const zid = UNFAEHIG_NON_ARM_ZONE_IDS[i]
    const w = clampWound(snap.hitZones?.zones?.[zid]?.w ?? 0)
    if (w >= 3) mask |= 1 << (3 + i)
  }
  return mask
}

/**
 * Bündel aus Mods entfernen; bei auto-zone-* Wundenmarker löschen; bei LE-Auto-Bundles LE heilen.
 *
 * @param {Record<string, unknown>} m — Tracker-Metadaten (mutiert)
 * @param {string} bundleId
 * @param {HeroAutoModCtx} ctx
 */
export function applyBundleRemovalCleanup(m, bundleId, ctx) {
  const bid = String(bundleId ?? '').trim()
  if (!bid) return

  const modsBefore = readHeroExMods(m)
  const hadBundle = modsBefore.some((x) => x && String(x.bundleId ?? '') === bid)
  const autoId = resolveOriginAutoId(m, bid)

  const nextMods = modsBefore.filter((x) => !x || String(x.bundleId ?? '') !== bid)
  if (nextMods.length === 0) delete m[HERO_EX_MODS]
  else m[HERO_EX_MODS] = nextMods

  const origins = { ...readBundleOriginMap(m) }
  if (origins[bid]) delete origins[bid]
  if (Object.keys(origins).length === 0) delete m[HERO_EX_BUNDLE_ORIGIN]
  else m[HERO_EX_BUNDLE_ORIGIN] = origins

  if (hadBundle && autoId && autoId.startsWith(AUTO_ZONE_PREFIX)) {
    const zoneId = autoId.slice(AUTO_ZONE_PREFIX.length)
    delete m[hzWKey(zoneId)]
    const sup = { ...readAutoSuppressed(m) }
    sup[autoId] = 0
    if (Object.keys(sup).length === 0) delete m[HERO_EX_AUTO_SUPPRESSED]
    else m[HERO_EX_AUTO_SUPPRESSED] = sup
  }

  if (hadBundle && autoId === 'auto-le-band') {
    let safe = parseSignedInt(m[HERO_EX_LAST_SAFE_LE])
    if (safe === null) safe = parseNonNegInt(m[HERO_EX_LE_MAX])
    if (safe !== null) {
      m[HERO_EX_LE] = String(safe)
    }
    const sr = m[HERO_EX_AUTO_SUPPRESSED]
    if (sr && typeof sr === 'object') {
      delete sr['auto-le-band']
      if (Object.keys(sr).length === 0) delete m[HERO_EX_AUTO_SUPPRESSED]
    }
  }

  if (hadBundle && autoId === 'auto-le-unfaehig') {
    const snapPre = snapshotFromTrackerMeta(m)
    const sources = computeUnfaehigSources(snapPre, m, ctx)
    if (sources.leTriggered) {
      let safe = parseSignedInt(m[HERO_EX_LAST_SAFE_LE])
      if (safe === null) safe = parseNonNegInt(m[HERO_EX_LE_MAX])
      if (safe !== null) {
        m[HERO_EX_LE] = String(safe)
      }
    }
    const sr = { ...readAutoSuppressed(m) }
    if (!sources.leTriggered) {
      const sig = computeUnfaehigTriggerMask(snapPre, m, ctx)
      if (sig !== null) sr['auto-le-unfaehig'] = sig
    } else {
      delete sr['auto-le-unfaehig']
    }
    if (Object.keys(sr).length === 0) delete m[HERO_EX_AUTO_SUPPRESSED]
    else m[HERO_EX_AUTO_SUPPRESSED] = sr
  }

  patchHeroExModsWithAutoBundles(m, snapshotFromTrackerMeta(m), ctx)
}

/**
 * @param {string} itemId
 * @param {string} bundleId
 */
export async function removeBundleWithAutoCleanup(itemId, bundleId) {
  const ctx = defaultHeroAutoModCtx()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      applyBundleRemovalCleanup(m, bundleId, ctx)
    }
  })
}

/**
 * Nach manuellem Mod hinzufügen/entfernen: Auto-Bündel neu ableiten
 * (effektiver LE inkl. LE-Mods u.a.).
 *
 * @param {string} itemId
 */
export async function refreshAutoBundlesForItem(itemId) {
  const ctx = defaultHeroAutoModCtx()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      patchHeroExModsWithAutoBundles(m, snapshotFromTrackerMeta(m), ctx)
      updateLastSafeLeIfSafe(m)
    }
  })
}

/**
 * Aktuelle Trigger-Signatur für ein Auto-Bündel (zum Abgleich mit heroExAutoSuppressed).
 *
 * @param {Record<string, unknown>} snap — wie readHeroExpandSnapshot / gather()
 * @param {string} autoBundleId z. B. auto-zone-brust, auto-le-band
 * @returns {number | null} null = Quelle inaktiv / unbekannt
 */
export function computeAutoTriggerSignature(snap, autoBundleId, metaForLe, ctxForLe) {
  const bid = String(autoBundleId ?? '')
  if (bid === 'auto-le-band') {
    const leNum = effectiveLeForThresholds(snap, metaForLe, ctxForLe)
    const leMaxNum = parseNonNegInt(snap.leMax)
    const koNum = parseSignedInt(snap.ko)
    if (leNum === null || leMaxNum === null || leMaxNum <= 0) return null
    const band = leBand(leNum, leMaxNum, readLeThresholdFromSnapshot(snap))
    if (leAtPaMalusForBand(band) <= 0) return null
    if (leNum <= 0) {
      const depth = -leNum
      if (!(koNum != null && koNum > 0)) return 400
      if (depth > 1.5 * koNum) return 403
      if (depth > koNum) return 402
      if (depth > 0.5 * koNum) return 401
      return 400
    }
    return band
  }
  if (bid.startsWith(AUTO_ZONE_PREFIX)) {
    const zoneId = bid.slice(AUTO_ZONE_PREFIX.length)
    const zd = snap.hitZones?.zones?.[zoneId]
    const w = clampWound(zd?.w ?? 0)
    if (w <= 0) return null
    return w
  }
  if (bid === 'auto-le-unfaehig') {
    return computeUnfaehigTriggerMask(snap, metaForLe, ctxForLe)
  }
  return null
}

/**
 * @param {Record<string, unknown>} m — Tracker-Metadaten
 */
export function snapshotFromTrackerMeta(m) {
  const room = getRoomSettings()
  const wappenDefs = effectiveWappenForHero(m, room)
  const templateRaw = String(m?.heroExWappenTemplate ?? '')
    .trim()
    .toLowerCase()
  const showFkRaw = String(m?.[HERO_EX_SHOW_FK] ?? '').trim().toLowerCase()
  const showFkEff =
    showFkRaw === ''
      ? templateRaw !== 'vierbeiner'
      : !['0', 'false', 'off', 'no', 'nein'].includes(showFkRaw)
  return {
    le: String(m?.[HERO_EX_LE] ?? ''),
    leMax: String(m?.[HERO_EX_LE_MAX] ?? ''),
    ko: String(m?.[HERO_EX_KO] ?? ''),
    gs: String(m?.[HERO_EX_GS] ?? ''),
    leThreshold: String(m?.[HERO_EX_LE_THRESHOLD] ?? ''),
    showFk: showFkEff ? '1' : '0',
    unfaehigThreshold: String(m?.[HERO_EX_UNFAEHIG_THRESHOLD] ?? ''),
    unfaehigFixedFields: String(m?.[HERO_EX_UNFAEHIG_FIXED_FIELDS] ?? ''),
    deathAtMinusOnePointFiveKo: String(
      m?.[HERO_DEATH_AT_MINUS_ONE_POINT_FIVE_KO] ?? ''
    ),
    wappenTemplate: String(m?.[HERO_EX_WAPPEN_TEMPLATE] ?? ''),
    hitZones: readHitZoneBundle(m, TRACKER_ITEM_META_KEY, wappenDefs),
    wappenDefs,
  }
}

/**
 * Nur für Tests / reine Logik: bundleId in einem Mod-Array ersetzen.
 *
 * @param {Record<string, unknown>[]} mods
 * @param {string} oldBundleId
 * @param {string} newBundleId
 */
export function relabelAutoBundleInMods(mods, oldBundleId, newBundleId) {
  const o = String(oldBundleId)
  const n = String(newBundleId)
  for (const x of mods) {
    if (x && String(x.bundleId ?? '') === o) x.bundleId = n
  }
}

/**
 * Summiert alle Auto-Malus-Deltas je Feld (negativ = Erschwernis), aus dem
 * gleichen Regelwerk wie die Auto-Bündel — für KR-Marken ohne Basis-Mutation.
 *
 * @param {Record<string, unknown>} snap — wie `readHeroExpandSnapshot` / `gather()`
 * @returns {Record<string, number>}
 */
export function aggregateHeroAutoPenaltyDeltasFromExpandSnapshot(snap) {
  /** @type {Record<string, number>} */
  const sums = {}

  const add = (field, d) => {
    if (!field || !d) return
    sums[field] = (sums[field] ?? 0) + d
  }

  const leNum = parseSignedInt(snap.le)
  const leMaxNum = parseNonNegInt(snap.leMax)
  if (leNum !== null && leMaxNum !== null && leMaxNum > 0) {
    const m = leAtPaMalusForBand(
      leBand(leNum, leMaxNum, readLeThresholdFromSnapshot(snap))
    )
    if (m > 0) {
      const d = -m
      add('at', d)
      add('pa', d)
      add('a', d)
      if (showFkFromSnapshot(snap)) add('fk', d)
    }
  }

  const baseGs = parseSignedInt(snap.gs)
  const wappenDefs = wappenDefsFromSnap(snap)

  for (const def of wappenDefs) {
    if (!def.active) continue
    const zd = snap.hitZones?.zones?.[def.id]
    const w = clampWound(zd?.w ?? 0)
    if (w <= 0) continue
    const stage = zoneStageFromWounds(w)
    if (stage <= 0) continue
    const deltas = autoModDeltasForWappen(def, w)
    for (const [field, delta] of Object.entries(deltas)) {
      let d = delta
      if (field === 'gs' && baseGs !== null && Number.isFinite(baseGs)) {
        const minDelta = -(baseGs - 1)
        d = Math.max(d, minDelta)
      }
      add(field, d)
    }
  }

  return sums
}

/**
 * KR-Hilfsmarken: Felder, deren Auto-Malus sich verschärft (delta negativer).
 *
 * @param {Record<string, unknown>} beforeSnap
 * @param {Record<string, unknown>} afterSnap
 * @param {number} round
 * @returns {Record<string, number>}
 */
export function computeKrAutoPenaltyWorseningMarks(
  beforeSnap,
  afterSnap,
  round
) {
  const before = aggregateHeroAutoPenaltyDeltasFromExpandSnapshot(beforeSnap)
  const after = aggregateHeroAutoPenaltyDeltasFromExpandSnapshot(afterSnap)
  /** @type {Record<string, number>} */
  const marks = {}
  const keys = [
    'at',
    'pa',
    'a',
    'le',
    'fk',
    'gs',
    'ib',
    'ge',
    'mu',
    'kl',
    'inn',
    'ch',
    'ff',
    'kk',
    'ko',
  ]
  for (const k of keys) {
    const b = before[k] ?? 0
    const a = after[k] ?? 0
    if (a < b) marks[k] = round
  }
  return marks
}

/**
 * Flache Mod-Einträge (mit id) für `meta.heroExMods`.
 *
 * @param {Record<string, unknown>} snap
 * @param {HeroAutoModCtx} ctx
 * @returns {Record<string, unknown>[]}
 */
export function buildHeroAutoModRecords(snap, ctx, metaForLe) {
  const round = Math.max(1, Math.floor(Number(ctx.round)) || 1)
  const navN = Number(ctx.navIni)
  const addedNavIni = Number.isFinite(navN)
    ? navN
    : ctx.navIni === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : ctx.navIni === Number.NEGATIVE_INFINITY
        ? Number.NEGATIVE_INFINITY
        : Number.POSITIVE_INFINITY

  /** @type {Record<string, unknown>[]} */
  const out = []

  const pushRows = (bundleId, bundleLabel, rows, opts = {}) => {
    const includeZero = Boolean(opts.includeZero)
    for (const { field, delta } of rows) {
      if (!includeZero && !delta) continue
      out.push({
        id: genModId(),
        field,
        delta,
        duration: 99,
        addedRound: round,
        addedNavIni,
        permanent: true,
        accrual: 'none',
        label: bundleLabel,
        bundleId,
      })
    }
  }

  const leNum = effectiveLeForThresholds(snap, metaForLe, ctx)
  const leMaxNum = parseNonNegInt(snap.leMax)
  const koNum = parseSignedInt(snap.ko)
  if (leNum !== null && leMaxNum !== null && leMaxNum > 0) {
    const leThreshold = readLeThresholdFromSnapshot(snap)
    const band = leBand(leNum, leMaxNum, leThreshold)
    const m = leAtPaMalusForBand(band)
    if (m > 0) {
      const unfaehigFix = readUnfaehigFixedLeFromSnapshot(snap)
      const unfaehigThreshold = readUnfaehigThresholdFromSnapshot(snap)
      const criticalThreshold = unfaehigFix ?? unfaehigThreshold
      const deathAtMinusOnePointFiveKo = deathAtMinusOnePointFiveKoFromSnapshot(snap)
      let label = ''
      if (leNum <= 0) {
        if (koNum != null && koNum > 0) {
          const depth = -leNum
          const deathThreshold = deathAtMinusOnePointFiveKo ? 1.5 * koNum : koNum
          label = depth >= deathThreshold ? 'R.I.P.' : 'sterbend'
        } else {
          label = 'sterbend'
        }
      } else if (
        Number.isFinite(Number(criticalThreshold)) &&
        leNum <= Number(criticalThreshold)
      ) {
        label = `LE ≤ ${Math.floor(Number(criticalThreshold))}`
      } else if (band === 0) {
        label = '<1/2 -1'
      } else if (band === 1) {
        label = '<1/3 -2'
      } else if (band >= 2) {
        label = '<1/4 -3'
      } else {
        const fallback = leKoCriticalLabel(leNum, koNum) || leAutoChipLabelDe(band, leThreshold)
        label = fallback ? `LE${fallback}` : 'LE'
      }
      const leFields = showFkFromSnapshot(snap)
        ? ['at', 'pa', 'a', 'fk']
        : ['at', 'pa', 'a']
      const rows = leFields.map((field) => ({
        field,
        delta: -m,
      }))
      pushRows('auto-le-band', label, rows)
    }
  }

  const ufSources = computeUnfaehigSources(snap, metaForLe, ctx)
  if (
    ufSources.leTriggered ||
    ufSources.nonArm3w ||
    ufSources.armSet.length > 0
  ) {
    pushRows(
      'auto-le-unfaehig',
      'unfähig',
      [{ field: 'le', delta: 0 }],
      { includeZero: true }
    )
  }

  const baseGs = parseSignedInt(snap.gs)
  const wappenDefs = wappenDefsFromSnap(snap)

  for (const def of wappenDefs) {
    if (!def.active) continue
    const zd = snap.hitZones?.zones?.[def.id]
    const w = clampWound(zd?.w ?? 0)
    if (w <= 0) continue
    const stage = zoneStageFromWounds(w)
    if (stage <= 0) continue
    const bundleId = `${AUTO_ZONE_PREFIX}${def.id}`
    const label = autoZoneWoundLabel(def.id, w)
    /** @type {{ field: string, delta: number }[]} */
    const rows = []
    const deltas = autoModDeltasForWappen(def, w)
    for (const [field, delta] of Object.entries(deltas)) {
      let d = delta
      if (field === 'gs' && baseGs !== null && Number.isFinite(baseGs)) {
        const minDelta = -(baseGs - 1)
        d = Math.max(d, minDelta)
      }
      rows.push({ field, delta: d })
    }
    pushRows(bundleId, label, rows)
  }

  return out
}

/**
 * Ersetzt alle `auto-*`-Bündel in den Metadaten, manuelle Mods bleiben.
 * Berücksichtigt `heroExAutoSuppressed`: solange Signatur gleich bleibt, wird
 * das entsprechende Auto-Bündel nicht erzeugt.
 *
 * @param {Record<string, unknown>} m — Tracker-Metadaten (mutiert)
 * @param {Record<string, unknown>} snap — gleicher Stand wie `next` in `applyHeroExpandFields`
 * @param {HeroAutoModCtx} ctx
 */
export function patchHeroExModsWithAutoBundles(m, snap, ctx) {
  const cur = Array.isArray(m[HERO_EX_MODS]) ? m[HERO_EX_MODS] : []
  const manual = cur.filter(
    (x) => x && !String(x.bundleId ?? '').startsWith(AUTO_MOD_BUNDLE_PREFIX)
  )
  const suppressedIn = readAutoSuppressed(m)
  const autoAll = buildHeroAutoModRecords(snap, ctx, m)

  const autoFiltered = autoAll.filter((mod) => {
    const bid = String(mod.bundleId ?? '')
    const curSig = computeAutoTriggerSignature(snap, bid, m, ctx)
    if (curSig === null) return false
    const stored = suppressedIn[bid]
    if (stored !== undefined && stored === curSig) return false
    return true
  })

  /** @type {Record<string, number>} */
  const suppressedOut = {}
  for (const [k, v] of Object.entries(suppressedIn)) {
    const curSig = computeAutoTriggerSignature(snap, k, m, ctx)
    if (curSig !== null && curSig === v) suppressedOut[k] = v
  }

  const merged = [...manual, ...autoFiltered]
  if (merged.length === 0) delete m[HERO_EX_MODS]
  else m[HERO_EX_MODS] = merged

  if (Object.keys(suppressedOut).length === 0) delete m[HERO_EX_AUTO_SUPPRESSED]
  else m[HERO_EX_AUTO_SUPPRESSED] = suppressedOut
}

/**
 * Auto-Bündel in ein manuelles Bündel umwandeln (neue bundleId), Suppression setzen.
 *
 * @param {string} itemId
 * @param {string} autoBundleId z. B. auto-zone-brust
 * @returns {Promise<string | null>} neue manuelle bundleId oder null
 */
export async function convertAutoBundleToManual(itemId, autoBundleId) {
  const bid = String(autoBundleId ?? '')
  if (!bid.startsWith(AUTO_MOD_BUNDLE_PREFIX)) return null
  /** @type {string | null} */
  let outBundleId = null
  const ctx = defaultHeroAutoModCtx()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const mods = Array.isArray(m[HERO_EX_MODS]) ? m[HERO_EX_MODS] : []
      const has = mods.some((x) => x && String(x.bundleId ?? '') === bid)
      if (!has) continue
      const snap = snapshotFromTrackerMeta(m)
      const newBid = generateModBundleId()
      for (const x of mods) {
        if (x && String(x.bundleId ?? '') === bid) x.bundleId = newBid
      }
      const sup = readAutoSuppressed(m)
      const sig = computeAutoTriggerSignature(snap, bid, m, ctx)
      if (sig !== null) sup[bid] = sig
      if (Object.keys(sup).length === 0) delete m[HERO_EX_AUTO_SUPPRESSED]
      else m[HERO_EX_AUTO_SUPPRESSED] = sup
      m[HERO_EX_MODS] = mods
      const origins = { ...readBundleOriginMap(m), [newBid]: bid }
      m[HERO_EX_BUNDLE_ORIGIN] = origins
      outBundleId = newBid
    }
  })
  return outBundleId
}

/**
 * Auto-Bündel entfernen und unter gleicher Quellsignatur nicht wieder anlegen.
 *
 * @param {string} itemId
 * @param {string} autoBundleId
 */
export async function suppressAutoBundleAndRemove(itemId, autoBundleId) {
  const bid = String(autoBundleId ?? '')
  if (!bid.startsWith(AUTO_MOD_BUNDLE_PREFIX)) return
  await removeBundleWithAutoCleanup(itemId, bid)
}
