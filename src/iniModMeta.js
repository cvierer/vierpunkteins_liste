import OBR from '@owlbear-rodeo/sdk'
import {
  canRedoCombatCalc,
  canUndoCombatCalc,
  logCombat,
  pushCombatCalcBlock,
  redoCombatCalc,
  subscribeCombatLog,
  undoCombatCalc,
} from './combatLog.js'
import { getCombat, getIniTieOrder } from './combatRoom.js'
import {
  clearKrMarksItem,
  krMarkActive,
  mergeKrMarks,
  purgeKrMarksBeforeRound,
} from './krCombatMarks.js'
import {
  clampWound,
  HIT_ZONE_DEFS,
  HZ_KAMPFNOTIZ,
  hzRsKey,
  hzWKey,
  readHitZoneBundle,
} from './hitZoneMeta.js'
import {
  collectSortedParticipants,
  TRACKER_ITEM_META_KEY,
} from './participants.js'
import { getRoomSettings } from './roomSettings.js'
import {
  cleanupOrphanHitZoneKeys,
  effectiveWappenForHero,
  HERO_EX_WAPPEN_TEMPLATE,
} from './wappenDefs.js'
import {
  AUTO_MOD_BUNDLE_PREFIX,
  computeKrAutoPenaltyWorseningMarks,
  computeUnfaehigSources,
  leAtPaMalusForBand,
  leBand,
  leBandLabelDe,
  patchHeroExModsWithAutoBundles,
  refreshAutoBundlesForItem,
  removeBundleWithAutoCleanup,
  updateLastSafeLeIfSafe,
} from './heroAutoMods.js'
import { applyHitZoneStrikeFromSpTz } from './hitZoneStrike.js'
import { computeIniFromIbBeW6 } from './iniCompute.js'
import { readOwnerIniReferenceForMods } from './ownerIniReference.js'
import { applyIniLockCharges } from './krCounters.js'
import { readLhMechanics } from './lhMeta.js'
import { getManualIniTieOverridePairs } from './manualIniTieOverrides.js'
import {
  buildLePopoverModSummary,
  buildWundenZonesTitle,
  leBarColorBand,
  zoneStageFromWounds,
} from './heroBlockAutoMod.js'
import {
  basisHeroExpandSnapshotFromDisplayed,
  formatTpDisplayIntegrated,
  HIT_ZONE_MOD_FIELD_IDS,
  MAX_MOD_LABEL_LEN,
  MAX_HERO_EX_MOD_UI_SLOTS,
  MOD_CHIP_PALETTE,
  MOD_FIELDS,
  MOD_FIELD_LABEL,
  addHeroExMod,
  countHeroModUiSlots,
  effectiveDeltaForField,
  generateModBundleId,
  listActiveMods,
  modEffectiveContribution,
  modNavCountdownLabelFromNav,
  modNavFractionLabelFromNav,
  normalizeModChipColor,
  normalizeModLabel,
  readHeroExMods,
  readModDisplayMode,
  removeHeroExMod,
  removeHeroExModsByBundleId,
} from './heroExMods.js'

export const TZ_TOOLTIP =
  'Trefferzone TZ: W20 19–20 = Kopf · 15–18 = Brust (Frontal F an) oder Rücken (F aus) · 9–14 = Arme (ungerade Schildarm, gerade Schwertarm) · 7–8 = Bauch · 1–6 = Beine (ungerade links, gerade rechts). ' +
  'Kürzel u. a.: KF, BR, RÜ, LA, RA, BA, LB, RB — oder Zahl 1–20.'

/** Tooltip WS-Feld (Mouseover). */
export const WS_RULES_TOOLTIP =
  'Ohne Modifikationen liegt die WS bei KO/2. Wenn die erlittenen SP höher als die WS ist, bekommt man: eine Wunde, wenn SP > KO: zwei Wunden, wenn SP > 1,5 x KO: drei Wunden.'

/** Tooltip LE-Schwellen-Anzeige (Mouseover auf „S“). */
export const LE_THRESHOLD_TOOLTIP =
  'LE-Schwellenwerte. Weniger als 1/2 LE: alle Eigenschaftsproben, AT, PA und FK je um 1 erschwert, alle Zauber- und Talentproben 3 Punkte. Bei weniger 1/3: +2/+6. Weniger als 1/4: +3/+9. Bei LE 0 bis 5 kampfunfähig. LE 0 oder weniger: Tod in KO KR x 1W6.'

/** Regeltexte für die drei Wundmarken pro Trefferzone (Mouseover). */
const WUNDEN_DOTS_TOOLTIP_BY_ZONE = {
  kopf:
    'Kopf (W20 19 bis 20): 1. und 2. Wunde: je KL, IN, MU, INI-Basis –2, INI –2W6; die 3. Wunde: +2W6 SP, bewusstlos, Blutverlust',
  brust:
    'Brust (W20: 15 bis 18): 1. und 2. Wunde: je AT, PA, KK, KO, AW –1, +1W6 SP; 3. Wunde bewusstlos, Blutverlust',
  ruecken:
    'Rücken (W20: 15 bis 18): 1. und 2. Wunde: je AT, PA, KK, KO, AW –1, +1W6 SP; 3. Wunde bewusstlos, Blutverlust',
  schildarm:
    'Arme (W20: 9, 11, 13 = Schildarm; 10, 12, 14 = Schwertarm): 1. und 2. Wunde: je AT, PA, FF, KK –2 mit getroffenem Arm; 3. Wunde: Arm handlungsunfähig',
  schwertarm:
    'Arme (W20: 9, 11, 13 = Schildarm; 10, 12, 14 = Schwertarm): 1. und 2. Wunde: je AT, PA, FF, KK –2 mit getroffenem Arm; 3. Wunde: Arm handlungsunfähig',
  bauch:
    'Bauch (W20: 7 bis 8): 1. und 2. Wunde: je AT, PA, GS, KK, KO, INI-Basis, AW –1, +1W6 SP; 3. Wunde: bewusstlos, Blutverlust',
  lbein:
    'Beine (W20: 1, 3, 5 = Bein links; 2, 4, 6 = Bein rechts): 1. und 2. Wunde: je AT, PA, AW, GE, INI-Basis –2, GS –1; 3. Wunde: Sturz, kampfunfähig',
  rbein:
    'Beine (W20: 1, 3, 5 = Bein links; 2, 4, 6 = Bein rechts): 1. und 2. Wunde: je AT, PA, AW, GE, INI-Basis –2, GS –1; 3. Wunde: Sturz, kampfunfähig',
}

/** @param {string} raw */
function parseIntAllowSignedLocal(raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  if (!Number.isFinite(n)) return null
  return n
}

/**
 * @param {Record<string, unknown>} before
 * @param {Record<string, unknown>} after
 * @param {number} round
 * @returns {Record<string, number>}
 */
function computeKrFieldMarks(before, after, round) {
  /** @type {Record<string, number>} */
  const marks = {}
  const keys = [
    'at',
    'pa',
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
    const b = parseIntAllowSignedLocal(before[k])
    const a = parseIntAllowSignedLocal(after[k])
    if (b !== null && a !== null && a < b) marks[k] = round
  }
  const bz = before.hitZones?.zones
  const az = after.hitZones?.zones
  if (bz && az) {
    /** @type {Set<string>} */
    const zoneIds = new Set([
      ...HIT_ZONE_DEFS.map((z) => z.id),
      ...Object.keys(bz),
      ...Object.keys(az),
    ])
    for (const id of zoneIds) {
      const bw = clampWound(bz[id]?.w ?? 0)
      const aw = clampWound(az[id]?.w ?? 0)
      if (aw > bw) marks[`hzw_${id}`] = round
    }
  }
  return marks
}

export const HERO_EX_LE = 'heroExLe'
export const HERO_EX_LE_MAX = 'heroExLeMax'
export const HERO_EX_AE = 'heroExAe'
export const HERO_EX_AT = 'heroExAt'
export const HERO_EX_PA = 'heroExPa'
/** Konstitution (Eigenschaft), nur in der Eigenschaftenzeile */
export const HERO_EX_KO = 'heroExKo'
export const HERO_EX_TP = 'heroExTp'
/** Ausweichen (AW), Kampfzeile */
export const HERO_EX_A = 'heroExA'
/** @deprecated Nicht mehr in der UI; wird beim Speichern entfernt */
export const HERO_EX_B = 'heroExB'
/** @deprecated Nicht mehr in der UI; wird beim Speichern entfernt */
export const HERO_EX_C = 'heroExC'
export const HERO_EX_SP = 'heroExSp'
export const HERO_EX_TZ = 'heroExTz'
export const HERO_EX_FRONTAL = 'heroExFrontal'
export const HERO_EX_FK = 'heroExFk'
/** Geschwindigkeit (GS) */
export const HERO_EX_GS = 'heroExGs'
/** Geschosse (Legacy-Metaschlüssel; nicht mehr in der UI) */
export const HERO_EX_G = 'heroExG'
/** Magieresistenz (Legacy-Metaschlüssel; nicht mehr in der UI) */
export const HERO_EX_MR = 'heroExMr'
/** Ini-Basis + Modifikation (IB) */
export const HERO_EX_IB = 'heroExIb'
/** W6-Wurf / Kurznotiz zum Wurf */
export const HERO_EX_W6 = 'heroExW6'
/** Wundschwelle + Modifikation (WS) */
export const HERO_EX_WS = 'heroExWs'
/** @deprecated Ersetzt durch Trefferzonen hz*; wird beim Speichern entfernt */
export const HERO_EX_WAPPEN_RS = 'heroExWappenRs'
/** @deprecated Ersetzt durch Trefferzonen hz*; wird beim Speichern entfernt */
export const HERO_EX_WAPPEN_WUNDEN = 'heroExWappenW'
export const HERO_EX_MU = 'heroExMu'
export const HERO_EX_KL = 'heroExKl'
export const HERO_EX_IN = 'heroExIn'
export const HERO_EX_CH = 'heroExCh'
export const HERO_EX_FF = 'heroExFf'
export const HERO_EX_GE = 'heroExGe'
export const HERO_EX_KK = 'heroExKk'
/** Behinderung (BE) */
export const HERO_EX_BE = 'heroExBe'
/** @deprecated Nur Lesen/Migration, nicht mehr in der UI */
export const HERO_EX_AMOD = 'heroExAMod'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_BMOD = 'heroExBMod'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_CMOD = 'heroExCMod'
/** Ausdauer (AU), Heldenblock Trefferzonen-Zeile */
export const HERO_EX_AU = 'heroExAu'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_KE = 'heroExKe'
export const HERO_EX_ENERGY_MODE = 'heroExEnergyMode'
export const HERO_EX_SHOW_FK = 'heroExShowFk'
export const HERO_EX_LE_THRESHOLD = 'heroExLeThreshold'
export const HERO_EX_UNFAEHIG_THRESHOLD = 'heroExUnfaehigThreshold'
export const HERO_EX_UNFAEHIG_MARK_FIELDS = 'heroExUnfaehigMarkFields'
export const HERO_EX_UNFAEHIG_FIXED_FIELDS = 'heroExUnfaehigFixedFields'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_AEKE_LEGACY = 'heroExAeKe'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_WUNDEN_ANZ = 'heroExWnAnz'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_WUNDEN_ORT = 'heroExWnOrt'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_WUNDEN_LEGACY = 'heroExWunden'
/** @deprecated Zusatzfeld derzeit nicht in der ausklappbaren Zeile */
export const HERO_EX_ZUSATZ = 'heroExZusatz'

function strOrEmpty(v) {
  if (v === undefined || v === null) return ''
  return String(v)
}

const UNFAEHIG_MARK_DEFAULT_FIELDS = ['at', 'pa', 'a', 'tp', 'fk']
const UNFAEHIG_FIXED_DEFAULT_FIELDS = { gs: 1 }

function isVierbeinerTemplateMeta(meta) {
  return String(meta?.[HERO_EX_WAPPEN_TEMPLATE] ?? '').trim().toLowerCase() === 'vierbeiner'
}

export function defaultUnfaehigThresholdForTemplate(isVierbeiner) {
  return isVierbeiner ? 0 : 5
}

function parseUnfaehigThreshold(raw, isVierbeiner) {
  const t = String(raw ?? '').trim().toLowerCase()
  const n = Math.floor(Number(t.replace(',', '.')))
  if (t && Number.isFinite(n) && n >= 0) return n
  return defaultUnfaehigThresholdForTemplate(isVierbeiner)
}

function normalizeUnfaehigMarkFields(raw) {
  const txt = String(raw ?? '')
  const fields = txt
    .split(',')
    .map((x) => {
      const t = x.trim().toLowerCase()
      return t === 'aw' ? 'a' : t
    })
    .filter((x) => ['at', 'pa', 'a', 'tp', 'fk', 'gs'].includes(x))
  return fields.length > 0 ? [...new Set(fields)] : [...UNFAEHIG_MARK_DEFAULT_FIELDS]
}

function normalizeUnfaehigFixedFields(raw) {
  const txt = String(raw ?? '')
  const out = {}
  for (const part of txt.split(',')) {
    const [kRaw, vRaw] = part.split('=')
    const k = String(kRaw ?? '').trim().toLowerCase()
    const n = Math.floor(Number(String(vRaw ?? '').trim().replace(',', '.')))
    if (k === 'gs' && Number.isFinite(n)) out.gs = n
  }
  if (!Object.prototype.hasOwnProperty.call(out, 'gs')) out.gs = UNFAEHIG_FIXED_DEFAULT_FIELDS.gs
  return out
}

/** Zwischen TP und TZ: Tool-Schwert-Icon, Rotation/Skalierung via CSS. */
const TP_TZ_BRIDGE_SVG =
  '<svg class="init-hero-ex__sp-tz-bridge-icon" xmlns="http://www.w3.org/2000/svg" viewBox="-5 0 34 34" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" focusable="false"><g><ellipse cx="12" cy="30.6" rx="2.5" ry="2.3" fill="#5d4037"/><circle cx="12" cy="30.6" r="1.85" fill="#b8860b"/><circle cx="12" cy="30.6" r="0.85" fill="#7e1010"/><path fill="#3e2723" d="M10.4 22.4 H13.6 V29.8 H10.4 Z"/><path fill="#5d4037" d="M10.55 22.6 H13.45 V23.5 H10.55 Z M10.55 24.4 H13.45 V25.3 H10.55 Z M10.55 26.2 H13.45 V27.1 H10.55 Z M10.55 28.0 H13.45 V28.9 H10.55 Z"/><path fill="#4f4643" d="M3.4 18.9 H20.6 L18.6 22.4 H5.4 Z"/><path fill="#6d615d" d="M4.2 19.3 H19.8 L18.0 22.0 H6.0 Z"/><ellipse cx="12" cy="20.7" rx="1.7" ry="1.0" fill="#584e4a"/><path fill="#5d4037" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 Z"/><path fill="#7e1010" d="M10.2 18.5 L11.6 2.5 L12.4 2.5 L13.8 18.5 Z"/><path fill="#c62828" d="M10.65 18.3 L11.7 3.4 L12.3 3.4 L13.35 18.3 Z"/><path fill="#ef9a9a" opacity="0.85" d="M11.85 4 L12.15 4 L12.0 17.6 Z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 H20.6 L18.6 22.4 H13.6 V29.8 A1.6 1.6 0 1 1 10.4 29.8 V22.4 H5.4 L3.4 18.9 Z"/></g></svg>'

/**
 * @param {string} itemId
 * @param {string} iniStr
 */
async function writeItemInitiative(itemId, iniStr) {
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m.initiative = iniStr
      applyIniLockCharges(m)
    }
  })
}

/**
 * @param {Record<string, unknown> | undefined} meta
 */
export function readHeroExpandSnapshot(meta) {
  const frontalRaw = meta?.[HERO_EX_FRONTAL]
  const frontal =
    frontalRaw === undefined || frontalRaw === null
      ? true
      : !['0', 'false', 'nein', 'off'].includes(
          String(frontalRaw).trim().toLowerCase()
        )
  const energyModeRaw = String(meta?.[HERO_EX_ENERGY_MODE] ?? '')
    .trim()
    .toLowerCase()
  const energyMode =
    energyModeRaw === 'ke' || energyModeRaw === 'both' || energyModeRaw === 'none'
      ? energyModeRaw
      : 'ae'
  const aeVal = strOrEmpty(meta?.[HERO_EX_AE])
  const keVal = strOrEmpty(meta?.[HERO_EX_KE])
  const aeKeLegacy = strOrEmpty(meta?.[HERO_EX_AEKE_LEGACY])
  const energyVal =
    energyMode === 'ke'
      ? keVal || aeKeLegacy
      : energyMode === 'both'
        ? aeVal || aeKeLegacy
        : aeVal || aeKeLegacy
  const showFkRaw = String(meta?.[HERO_EX_SHOW_FK] ?? '')
    .trim()
    .toLowerCase()
  const wappenTemplate = String(meta?.[HERO_EX_WAPPEN_TEMPLATE] ?? '')
    .trim()
    .toLowerCase()
  const showFkDefault = wappenTemplate !== 'vierbeiner'
  const showFk =
    showFkRaw === ''
      ? showFkDefault
      : !['0', 'false', 'off', 'no', 'nein'].includes(showFkRaw)
  const leThresholdRaw = String(meta?.[HERO_EX_LE_THRESHOLD] ?? '')
    .trim()
    .toLowerCase()
  const leThresholdNum = Math.floor(Number(leThresholdRaw.replace(',', '.')))
  const leThreshold =
    !leThresholdRaw ||
    ['off', 'none', 'false', '0'].includes(leThresholdRaw) ||
    !Number.isFinite(leThresholdNum) ||
    leThresholdNum <= 0
      ? null
      : leThresholdNum
  const isVierbeiner = isVierbeinerTemplateMeta(meta)
  const unfaehigThreshold = parseUnfaehigThreshold(
    meta?.[HERO_EX_UNFAEHIG_THRESHOLD],
    isVierbeiner
  )
  const unfaehigMarkFields = normalizeUnfaehigMarkFields(
    meta?.[HERO_EX_UNFAEHIG_MARK_FIELDS]
  )
  const unfaehigFixedFields = normalizeUnfaehigFixedFields(
    meta?.[HERO_EX_UNFAEHIG_FIXED_FIELDS]
  )
  const room = getRoomSettings()
  const wappenDefs = effectiveWappenForHero(meta, room)
  return {
    at: strOrEmpty(meta?.[HERO_EX_AT]),
    pa: strOrEmpty(meta?.[HERO_EX_PA]),
    a: strOrEmpty(meta?.[HERO_EX_A]),
    le: strOrEmpty(meta?.[HERO_EX_LE]),
    leMax: strOrEmpty(meta?.[HERO_EX_LE_MAX]),
    ae: energyVal,
    ke: keVal,
    energyMode,
    au: strOrEmpty(meta?.[HERO_EX_AU]),
    ko: strOrEmpty(meta?.[HERO_EX_KO]),
    tp: strOrEmpty(meta?.[HERO_EX_TP]),
    sp: strOrEmpty(meta?.[HERO_EX_SP]),
    tz: strOrEmpty(meta?.[HERO_EX_TZ]),
    frontal,
    fk: strOrEmpty(meta?.[HERO_EX_FK]),
    showFk,
    leThreshold,
    unfaehigThreshold,
    unfaehigMarkFields,
    unfaehigFixedFields,
    gs: strOrEmpty(meta?.[HERO_EX_GS]),
    ib: strOrEmpty(meta?.[HERO_EX_IB]),
    be: strOrEmpty(meta?.[HERO_EX_BE]),
    w6: strOrEmpty(meta?.[HERO_EX_W6]),
    ws: strOrEmpty(meta?.[HERO_EX_WS]),
    mu: strOrEmpty(meta?.[HERO_EX_MU]),
    kl: strOrEmpty(meta?.[HERO_EX_KL]),
    inn: strOrEmpty(meta?.[HERO_EX_IN]),
    ch: strOrEmpty(meta?.[HERO_EX_CH]),
    ff: strOrEmpty(meta?.[HERO_EX_FF]),
    ge: strOrEmpty(meta?.[HERO_EX_GE]),
    kk: strOrEmpty(meta?.[HERO_EX_KK]),
    hitZones: readHitZoneBundle(meta, TRACKER_ITEM_META_KEY, wappenDefs),
    wappenDefs,
  }
}

/** Wie `readCurrentNavIniGlobal` im Heldenblock — für Auto-Mod-Patch bei Meta-Schreibzugriff. */
function readNavIniForModPatch() {
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
    /* fall-through */
  }
  return Number.POSITIVE_INFINITY
}

/**
 * INI aus IB − BE + W6 für alle Teilnehmer der Initiative-Liste setzen;
 * Token ohne gültige, vollständige IB/BE/W6 werden übersprungen.
 * @returns {Promise<number>} Anzahl gesetzter INI-Werte
 */
export async function bulkApplyIniFromIbBeW6ForTrackedParticipants(items) {
  const rows = collectSortedParticipants(
    items,
    getIniTieOrder(),
    getManualIniTieOverridePairs()
  )
  /** @type {{ id: string, iniStr: string }[]} */
  const updates = []
  for (const row of rows) {
    const item = items.find((i) => i.id === row.id)
    const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
    if (!item || !meta) continue
    const snap = readHeroExpandSnapshot(meta)
    const n = computeIniFromIbBeW6(snap.ib, snap.be, snap.w6)
    if (n === null) continue
    updates.push({ id: row.id, iniStr: String(Math.round(n)) })
  }
  if (updates.length === 0) return 0
  const iniById = new Map(updates.map((u) => [u.id, u.iniStr]))
  const ids = updates.map((u) => u.id)
  await OBR.scene.items.updateItems(ids, (drafts) => {
    for (const d of drafts) {
      const iniStr = iniById.get(d.id)
      if (!iniStr) continue
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m.initiative = iniStr
      applyIniLockCharges(m)
    }
  })
  logCombat(`INI: IB − BE + W6 für ${updates.length} Token gesetzt`)
  return updates.length
}

/**
 * @param {string} itemId
 * @param {ReturnType<typeof readHeroExpandSnapshot>} next
 */
export async function applyHeroExpandFields(itemId, next) {
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue

      const setStr = (key, v) => {
        const t = v.trim()
        if (t === '') delete m[key]
        else m[key] = t
      }

      setStr(HERO_EX_AT, next.at)
      setStr(HERO_EX_PA, next.pa)
      setStr(HERO_EX_A, next.a)
      setStr(HERO_EX_LE, next.le)
      setStr(HERO_EX_LE_MAX, next.leMax)
      const energyModeRaw = String(next.energyMode ?? '').trim().toLowerCase()
      const energyMode =
        energyModeRaw === 'ke' || energyModeRaw === 'both' || energyModeRaw === 'none'
          ? energyModeRaw
          : 'ae'
      const aeNext = String(next.ae ?? '').trim()
      const keNext = String(next.ke ?? '').trim()
      if (energyMode === 'ke') {
        setStr(HERO_EX_KE, aeNext)
        delete m[HERO_EX_AE]
        m[HERO_EX_ENERGY_MODE] = 'ke'
      } else if (energyMode === 'both') {
        setStr(HERO_EX_AE, aeNext)
        setStr(HERO_EX_KE, keNext)
        m[HERO_EX_ENERGY_MODE] = 'both'
      } else if (energyMode === 'none') {
        delete m[HERO_EX_AE]
        delete m[HERO_EX_KE]
        m[HERO_EX_ENERGY_MODE] = 'none'
      } else {
        setStr(HERO_EX_AE, aeNext)
        delete m[HERO_EX_KE]
        delete m[HERO_EX_ENERGY_MODE]
      }
      setStr(HERO_EX_AU, next.au)
      setStr(HERO_EX_KO, next.ko)
      setStr(HERO_EX_TP, next.tp)
      setStr(HERO_EX_SP, next.sp)
      setStr(HERO_EX_TZ, String(next.tz ?? ''))
      if (next.frontal === false) m[HERO_EX_FRONTAL] = '0'
      else delete m[HERO_EX_FRONTAL]
      setStr(HERO_EX_FK, next.fk)
      if (next.showFk === false) m[HERO_EX_SHOW_FK] = '0'
      else if (next.showFk === true) m[HERO_EX_SHOW_FK] = '1'
      else delete m[HERO_EX_SHOW_FK]
      if (Number.isFinite(Number(next.leThreshold)) && Number(next.leThreshold) > 0) {
        m[HERO_EX_LE_THRESHOLD] = String(Math.floor(Number(next.leThreshold)))
      } else {
        delete m[HERO_EX_LE_THRESHOLD]
      }
      if (
        Number.isFinite(Number(next.unfaehigThreshold)) &&
        Number(next.unfaehigThreshold) >= 0
      ) {
        m[HERO_EX_UNFAEHIG_THRESHOLD] = String(
          Math.floor(Number(next.unfaehigThreshold))
        )
      } else {
        delete m[HERO_EX_UNFAEHIG_THRESHOLD]
      }
      {
        const markFields = normalizeUnfaehigMarkFields(next.unfaehigMarkFields)
        m[HERO_EX_UNFAEHIG_MARK_FIELDS] = markFields.join(',')
      }
      {
        const fixed = normalizeUnfaehigFixedFields(next.unfaehigFixedFields)
        m[HERO_EX_UNFAEHIG_FIXED_FIELDS] = `gs=${fixed.gs}`
      }
      setStr(HERO_EX_GS, next.gs)
      setStr(HERO_EX_IB, next.ib)
      setStr(HERO_EX_BE, next.be)
      setStr(HERO_EX_W6, next.w6)
      setStr(HERO_EX_WS, next.ws)
      setStr(HERO_EX_MU, next.mu)
      setStr(HERO_EX_KL, next.kl)
      setStr(HERO_EX_IN, next.inn)
      setStr(HERO_EX_CH, next.ch)
      setStr(HERO_EX_FF, next.ff)
      setStr(HERO_EX_GE, next.ge)
      setStr(HERO_EX_KK, next.kk)

      if (next.hitZones) {
        const nT = String(next.hitZones.notiz ?? '').trim()
        if (nT === '') delete m[HZ_KAMPFNOTIZ]
        else m[HZ_KAMPFNOTIZ] = nT
        const room = getRoomSettings()
        const wappenList =
          Array.isArray(next.wappenDefs) && next.wappenDefs.length > 0
            ? next.wappenDefs
            : effectiveWappenForHero(m, room)
        for (const z of wappenList) {
          const zd = next.hitZones.zones?.[z.id]
          const rsT = String(zd?.rs ?? '').trim()
          const w = clampWound(zd?.w ?? 0)
          if (rsT === '') delete m[hzRsKey(z.id)]
          else m[hzRsKey(z.id)] = rsT
          if (w <= 0) delete m[hzWKey(z.id)]
          else m[hzWKey(z.id)] = w
        }
        cleanupOrphanHitZoneKeys(m, room)
      }

      delete m[HERO_EX_WAPPEN_RS]
      delete m[HERO_EX_WAPPEN_WUNDEN]
      delete m[HERO_EX_AEKE_LEGACY]
      delete m[HERO_EX_WUNDEN_LEGACY]
      delete m[HERO_EX_B]
      delete m[HERO_EX_C]

      const comb = getCombat()
      const rRound =
        comb?.started && Number.isFinite(Number(comb.round))
          ? Number(comb.round)
          : null
      patchHeroExModsWithAutoBundles(m, next, {
        round: rRound,
        navIni: readNavIniForModPatch(),
      })
      updateLastSafeLeIfSafe(m)
    }
  })
}

/**
 * @param {HTMLInputElement} el
 * @param {{ compactFromDigits?: number }} [opts] — RS: ab 2 Ziffern kleiner; LE: nie kompakt (compactFromDigits weglassen oder sehr hoch).
 */
function syncWappenRsFontSize(el, opts = {}) {
  const threshold = opts.compactFromDigits ?? 2
  const n = el.value.trim().length
  el.classList.toggle('init-hero-ex__micro--wappen-rs--compact', n >= threshold)
}

/**
 * Formatiert eine Wappen-W20-Spanne als kurzen Anzeigetext (z. B. „19–20", „9, 11, 13").
 * @param {{ from: number, to: number, parity: 'all'|'odd'|'even' } | null | undefined} range
 */
function formatWappenW20(range) {
  if (!range) return ''
  const { from, to, parity } = range
  if (parity === 'odd' || parity === 'even') {
    const nums = []
    for (let n = from; n <= to; n++) {
      if (parity === 'odd' && n % 2 === 0) continue
      if (parity === 'even' && n % 2 === 1) continue
      nums.push(n)
    }
    return nums.join(', ')
  }
  return from === to ? String(from) : `${from}–${to}`
}

const WAPPEN_AUTO_MOD_FIELD_LABELS = {
  at: 'AT',
  pa: 'PA',
  a: 'AW',
  fk: 'FK',
  mu: 'MU',
  kl: 'KL',
  inn: 'IN',
  ib: 'IB',
  ko: 'KO',
  kk: 'KK',
  ff: 'FF',
  ge: 'GE',
  gs: 'GS',
}

/**
 * Erzeugt einen Wundregel-Tooltip aus einem Wappen.
 * Bevorzugt die explizite `woundTooltip`-Beschreibung; fällt sonst auf
 * eine generierte Zusammenfassung der Auto-Mods zurück.
 *
 * @param {{ id: string, label?: string, woundTooltip?: string, autoMods?: Array<{ field: string, delta: number, perStufe: 'perStage'|'perWound'|'once' }> }} def
 */
function buildWappenWoundRuleText(def) {
  const explicit = String(def?.woundTooltip ?? '').trim()
  if (explicit) return explicit
  const mods = Array.isArray(def?.autoMods) ? def.autoMods : []
  if (mods.length === 0) return ''
  const labelName = String(def?.label || def?.id || '').trim()
  const parts = mods.map((m) => {
    const fl = WAPPEN_AUTO_MOD_FIELD_LABELS[m.field] ?? String(m.field).toUpperCase()
    const sign = m.delta < 0 ? '−' : '+'
    const abs = Math.abs(m.delta)
    const mode =
      m.perStufe === 'perWound'
        ? 'je Wunde'
        : m.perStufe === 'once'
          ? 'einmalig'
          : 'je Wundstufe'
    return `${fl} ${sign}${abs} (${mode})`
  })
  return `${labelName ? labelName + ': ' : ''}${parts.join(', ')}`
}

/**
 * Mini-Wappen pro Trefferzone (RS + 3 Wundmarken).
 * @param {string} itemId
 * @param {boolean} canEdit
 * @param {{ id: string, abbr?: string, label?: string, tooltip?: string, woundTooltip?: string, w20Range?: any, autoMods?: any[] }} def
 * @param {{ rs: string, w: number }} zSnap
 */
function mountZoneMiniWappen(itemId, canEdit, def, zSnap) {
  let wundenCount = Math.min(3, Math.max(0, Math.floor(Number(zSnap.w)) || 0))
  const w20Text = formatWappenW20(def?.w20Range)
  const w20Hint = w20Text ? `W20: ${w20Text} (Fußkampf)` : 'Fußkampf'
  const rsHint = 'In den Rüstungskästchen den Rüstungsschutz eintragen'
  const titleBase =
    String(def?.tooltip || def?.label || def?.id || '').trim() ||
    String(def?.id || '')
  const abbrText =
    String(def?.abbr || '').trim() ||
    String(def?.label || def?.id || '').slice(0, 2)
  const cell = document.createElement('div')
  cell.className = 'init-hero-ex__micro-cell init-hero-ex__micro-cell--wappen'
  const ab = document.createElement('span')
  ab.className = 'init-hero-ex__abbr'
  ab.textContent = abbrText
  ab.title = `${titleBase} · ${w20Hint} — ${rsHint}`
  const wappen = document.createElement('div')
  wappen.className = 'init-hero-ex__wappen'
  wappen.setAttribute('role', 'group')
  wappen.setAttribute(
    'aria-label',
    `${titleBase}: Rüstungsschutz und Wundmarken`
  )
  const chief = document.createElement('div')
  chief.className = 'init-hero-ex__wappen-chief'
  /** @type {HTMLButtonElement[]} */
  const dots = []
  const woundRule =
    buildWappenWoundRuleText(def) || WUNDEN_DOTS_TOOLTIP_BY_ZONE[def?.id]
  const tapHint = (idx) =>
    `Wundmarke ${idx + 1}: antippen zum Setzen oder Absenken`
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('button')
    dot.type = 'button'
    dot.className = 'init-hero-ex__wappen-dot'
    dot.title = woundRule
      ? `${woundRule} — ${tapHint(i)}`
      : `${titleBase} · ${w20Hint} — ${rsHint}. ${tapHint(i)}`
    dot.setAttribute('aria-label', `Wundmarke ${i + 1} (${titleBase})`)
    dots.push(dot)
  }
  chief.append(...dots)
  const rsInp = document.createElement('input')
  rsInp.type = 'text'
  rsInp.inputMode = 'numeric'
  rsInp.className = 'init-hero-ex__micro init-hero-ex__micro--wappen-rs'
  rsInp.id = `hero-ex-${itemId}-hz-${def.id}-rs`
  rsInp.autocomplete = 'off'
  rsInp.spellcheck = false
  rsInp.disabled = !canEdit
  rsInp.value = strOrEmpty(zSnap.rs)
  rsInp.maxLength = 2
  rsInp.title = `${titleBase} · ${w20Hint} — RS (bis 2 Ziffern). ${rsHint}.`
  rsInp.setAttribute('aria-label', `${titleBase}, Rüstungsschutz`)
  wappen.append(chief, rsInp)
  cell.append(ab, wappen)

  const syncDots = () => {
    dots.forEach((btn, idx) => {
      const on = idx < wundenCount
      btn.classList.toggle('init-hero-ex__wappen-dot--on', on)
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }
  syncDots()
  for (const dot of dots) dot.disabled = !canEdit
  syncWappenRsFontSize(rsInp)

  return {
    cell,
    rsInp,
    dots,
    zoneId: def.id,
    getWunden: () => wundenCount,
    syncDots,
    bumpWunden(idx) {
      const n = idx + 1
      wundenCount = wundenCount === n ? n - 1 : n
      wundenCount = Math.min(3, Math.max(0, wundenCount))
      syncDots()
    },
  }
}

/** Gestrichelte Mod-Pfeile im MOD+-Button (V652, gleiche Grafik wie Kampfliste). */
const SVG_HERO_MOD_TOGGLE_UP =
  '<svg class="init-hero-ex__mod-toggle-sum-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-dasharray="4.5 4" stroke-linecap="round" d="M12 24V9"/><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" d="M5.5 11L12 4l6.5 7"/></svg>'
const SVG_HERO_MOD_TOGGLE_DOWN =
  '<svg class="init-hero-ex__mod-toggle-sum-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-dasharray="4.5 4" stroke-linecap="round" d="M12 4v15"/><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" d="M5.5 17L12 24l6.5-7"/></svg>'

/** Kleine gestrichelte Summen-Pfeile (Mod-Chips unter MOD+). */
const SVG_MOD_CHIP_SUM_UP =
  '<svg class="init-hero-ex__mod-chip-card__sum-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-dasharray="4.5 4" stroke-linecap="round" d="M12 24V9"/><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" d="M5.5 11L12 4l6.5 7"/></svg>'
const SVG_MOD_CHIP_SUM_DOWN =
  '<svg class="init-hero-ex__mod-chip-card__sum-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-dasharray="4.5 4" stroke-linecap="round" d="M12 4v15"/><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" d="M5.5 17L12 24l6.5-7"/></svg>'
const SVG_MOD_CHIP_UNFAEHIG_MARK =
  '<svg class="init-hero-ex__mod-chip-card__sum-svg init-hero-ex__mod-chip-card__sum-svg--unfaehig" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7 17L17 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'

/**
 * @param {HTMLElement} container
 * @param {{ itemId: string, meta: Record<string, unknown> | undefined, canEdit: boolean, leadButtons?: HTMLElement[], displayName?: string }} opts
 */
export function mountHeroExpandBlock(
  container,
  { itemId, meta, canEdit, leadButtons, displayName }
) {
  const snap = readHeroExpandSnapshot(meta)
  const energyFieldLabel =
    snap.energyMode === 'ke'
      ? 'Karmaenergie (KE)'
      : snap.energyMode === 'both'
        ? 'Astralenergie (AE) und Karmaenergie (KE)'
        : 'Astralenergie (AE)'
  const energyFieldAbbr =
    snap.energyMode === 'ke' ? 'KE' : snap.energyMode === 'both' ? 'AE / KE' : 'AE'
  const showFkField = snap.showFk !== false
  const showEnergyField = snap.energyMode !== 'none'
  const customLeThreshold =
    Number.isFinite(Number(snap.leThreshold)) && Number(snap.leThreshold) > 0
      ? Math.floor(Number(snap.leThreshold))
      : null
  const unfaehigThreshold =
    Number.isFinite(Number(snap.unfaehigThreshold)) && Number(snap.unfaehigThreshold) >= 0
      ? Math.floor(Number(snap.unfaehigThreshold))
      : 5
  const auSnap = snap.au
  const hitZoneNotizFrozen = snap.hitZones.notiz
  const __combatRound = getCombat()
  const __roundNum =
    __combatRound?.started && Number.isFinite(Number(__combatRound.round))
      ? Number(__combatRound.round)
      : null
  if (__roundNum != null) purgeKrMarksBeforeRound(__roundNum)

  /* Nav-INI fuer Mod-Anzeige und Commit (gleiche Logik wie spaeter bei renderModBadges). */
  function readCurrentNavIniGlobal() {
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
      /* fall-through */
    }
    return Number.POSITIVE_INFINITY
  }

  const ownerIniNum = readOwnerIniReferenceForMods(meta)

  const modDisplayIntegrated = readModDisplayMode(meta) === 'integrated'

  const parseWholeIntFieldString = (raw) => {
    const t = String(raw ?? '').trim()
    if (!/^-?\d+$/.test(t)) return null
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : null
  }

  const microDisplayForModField = (field, baseStr) => {
    if (!modDisplayIntegrated || ownerIniNum == null) return baseStr
    const d = effectiveDeltaForField(
      meta,
      field,
      ownerIniNum,
      __roundNum,
      readCurrentNavIniGlobal()
    )
    if (field === 'tp') {
      return formatTpDisplayIntegrated(baseStr, d)
    }
    const b = parseWholeIntFieldString(baseStr)
    if (b === null) return baseStr
    return String(b + d)
  }
  /** @type {HTMLElement & { __v4krLogUnsub?: () => void; __v4MalusPollClear?: () => void }} */
  const contAny = /** @type {any} */ (container)
  if (typeof contAny.__v4krLogUnsub === 'function') contAny.__v4krLogUnsub()
  if (typeof contAny.__v4MalusPollClear === 'function') contAny.__v4MalusPollClear()
  container.replaceChildren()

  const root = document.createElement('div')
  root.className = 'init-hero-ex' + (canEdit ? '' : ' init-hero-ex--view')

  const leadSpacer = document.createElement('div')
  leadSpacer.className = 'init-hero-ex__lead-spacer'
  leadSpacer.setAttribute('aria-hidden', 'true')

  const spacerExp = document.createElement('div')
  spacerExp.className = 'init-hero-ex__lead'
  const leadEls = Array.isArray(leadButtons) ? leadButtons.filter(Boolean) : []
  if (leadEls.length > 0) {
    spacerExp.classList.add('init-hero-ex__lead--tools')
    for (const el of leadEls) spacerExp.appendChild(el)
  } else {
    spacerExp.setAttribute('aria-hidden', 'true')
  }

  const attrBlock = document.createElement('div')
  attrBlock.className = 'init-hero-ex__attr-block'

  const strip = document.createElement('div')
  strip.className = 'init-hero-ex__strip'
  const stripInner = document.createElement('div')
  stripInner.className = 'init-hero-ex__strip-inner'
  strip.appendChild(stripInner)

  const mkMicro = (abbr, fullName, idSuf, value, maxLen, extraClass, numeric) => {
    const cell = document.createElement('div')
    cell.className = 'init-hero-ex__micro-cell'
    const ab = document.createElement('span')
    ab.className = 'init-hero-ex__abbr'
    ab.textContent = abbr
    ab.title = fullName
    const inp = document.createElement('input')
    inp.type = 'text'
    if (numeric) inp.inputMode = 'numeric'
    inp.className =
      'init-hero-ex__micro' + (extraClass ? ` ${extraClass}` : '')
    inp.id = `hero-ex-${itemId}-${idSuf}`
    inp.autocomplete = 'off'
    inp.spellcheck = false
    inp.disabled = !canEdit
    inp.value = value
    inp.maxLength = maxLen
    inp.title = fullName
    inp.setAttribute('aria-label', fullName)
    cell.append(ab, inp)
    return { cell, inp, ab }
  }

  const mu = mkMicro(
    'MU',
    'Mut (MU)',
    'mu',
    microDisplayForModField('mu', snap.mu),
    2,
    '',
    true
  )
  const kl = mkMicro(
    'KL',
    'Klugheit (KL)',
    'kl',
    microDisplayForModField('kl', snap.kl),
    2,
    '',
    true
  )
  const inn = mkMicro(
    'IN',
    'Intuition (IN)',
    'inn',
    microDisplayForModField('inn', snap.inn),
    2,
    '',
    true
  )
  const ch = mkMicro(
    'CH',
    'Charisma (CH)',
    'ch',
    microDisplayForModField('ch', snap.ch),
    2,
    '',
    true
  )
  const ff = mkMicro(
    'FF',
    'Fingerfertigkeit (FF)',
    'ff',
    microDisplayForModField('ff', snap.ff),
    2,
    '',
    true
  )
  const ge = mkMicro(
    'GE',
    'Gewandtheit (GE)',
    'ge',
    microDisplayForModField('ge', snap.ge),
    2,
    '',
    true
  )
  const kk = mkMicro(
    'KK',
    'Körperkraft (KK)',
    'kk',
    microDisplayForModField('kk', snap.kk),
    2,
    '',
    true
  )
  const koAttr = mkMicro(
    'KO',
    'Konstitution (KO)',
    'ko',
    microDisplayForModField('ko', snap.ko),
    2,
    '',
    true
  )

  const attrCols = document.createElement('div')
  attrCols.className = 'init-hero-ex__attr-cols'
  for (const x of [mu, kl, inn, ch, ff, ge, kk]) {
    attrCols.appendChild(x.cell)
  }
  attrBlock.appendChild(attrCols)

  const bottomStrip = document.createElement('div')
  bottomStrip.className = 'init-hero-ex__bottom-strip'

  const spTzUndo = document.createElement('button')
  spTzUndo.type = 'button'
  spTzUndo.className = 'init-hero-ex__sp-tz-label-btn'
  spTzUndo.textContent = '<'
  spTzUndo.title =
    'Zurück: zuerst letzte Trefferberechnung (Protokoll), sonst letzte TP/TZ-Eingabe'
  spTzUndo.setAttribute('aria-label', 'Zurück: Trefferberechnung oder TP/TZ')
  const spTzRedo = document.createElement('button')
  spTzRedo.type = 'button'
  spTzRedo.className = 'init-hero-ex__sp-tz-label-btn'
  spTzRedo.textContent = '>'
  spTzRedo.title =
    'Vor: zuerst rückgängig gemachte Trefferberechnung, sonst TP/TZ-Wiederholen'
  spTzRedo.setAttribute('aria-label', 'Vor: Trefferberechnung oder TP/TZ')
  const spTzLabelTools = document.createElement('div')
  spTzLabelTools.className = 'init-hero-ex__sp-tz-pair__label-tools'
  spTzLabelTools.append(spTzUndo, spTzRedo)

  const spTzPair = document.createElement('div')
  spTzPair.className = 'init-hero-ex__sp-tz-pair'
  const spTzGrid = document.createElement('div')
  spTzGrid.className = 'init-hero-ex__sp-tz-pair__grid'
  const spTzLabelRow = document.createElement('div')
  spTzLabelRow.className =
    'init-hero-ex__sp-tz-pair__grid-row init-hero-ex__sp-tz-pair__grid-row--labels'
  const spAbbr = document.createElement('span')
  spAbbr.className = 'init-hero-ex__abbr'
  spAbbr.textContent = 'TP'
  spAbbr.title = 'Trefferpunkte (TP)'
  const tzAbbr = document.createElement('span')
  tzAbbr.className = 'init-hero-ex__abbr'
  tzAbbr.textContent = 'TZ'
  tzAbbr.title = TZ_TOOLTIP
  spTzLabelRow.append(spAbbr, spTzLabelTools, tzAbbr)

  const spInp = document.createElement('input')
  spInp.type = 'text'
  spInp.inputMode = 'numeric'
  spInp.className = 'init-hero-ex__micro init-hero-ex__micro--sp-tz-inp'
  spInp.id = `hero-ex-${itemId}-sp`
  spInp.autocomplete = 'off'
  spInp.spellcheck = false
  spInp.disabled = !canEdit
  spInp.value = snap.sp
  spInp.maxLength = 4
  spInp.title = 'Trefferpunkte (TP)'
  spInp.setAttribute('aria-label', 'Trefferpunkte (TP)')

  const spTzBridgeBtn = document.createElement('button')
  spTzBridgeBtn.type = 'button'
  spTzBridgeBtn.className =
    'init-hero-ex__micro init-hero-ex__micro--sp-tz-bridge'
  spTzBridgeBtn.innerHTML = TP_TZ_BRIDGE_SVG
  spTzBridgeBtn.title =
    'Treffer auswerten: Schadenspunkte (TP) und Trefferzone (TZ) → LE, Zonenwunden, AT/PA'
  spTzBridgeBtn.setAttribute(
    'aria-label',
    'Treffer auswerten: Schadenspunkte und Trefferzone anwenden'
  )

  const tzInp = document.createElement('input')
  tzInp.type = 'text'
  tzInp.className = 'init-hero-ex__micro init-hero-ex__micro--sp-tz-inp'
  tzInp.id = `hero-ex-${itemId}-tz`
  tzInp.autocomplete = 'off'
  tzInp.spellcheck = false
  tzInp.disabled = !canEdit
  tzInp.value = snap.tz
  tzInp.maxLength = 12
  tzInp.title = TZ_TOOLTIP
  tzInp.setAttribute('aria-label', 'Trefferzone (TZ)')

  const frontalCol = document.createElement('div')
  frontalCol.className = 'init-hero-ex__sp-tz-frontal-col'
  const frontalTitle = document.createElement('span')
  frontalTitle.className = 'init-hero-ex__sp-tz-frontal-title'
  frontalTitle.textContent = 'A'
  frontalTitle.title = 'Ausrichtung'
  const frontalLbl = document.createElement('label')
  frontalLbl.className = 'init-hero-ex__sp-tz-frontal-lbl'
  const frontalChk = document.createElement('input')
  frontalChk.type = 'checkbox'
  frontalChk.className = 'init-hero-ex__sp-tz-frontal-chk'
  frontalChk.checked = snap.frontal !== false
  frontalChk.disabled = !canEdit
  const updateFrontalOrientationHint = () => {
    const modeLabel = frontalChk.checked ? 'Vor dir' : 'Im Rücken'
    frontalLbl.title = `Ausrichtung aktuell: ${modeLabel} (15–18 → ${
      frontalChk.checked ? 'Brust' : 'Rücken'
    })`
    frontalChk.setAttribute('aria-label', `Ausrichtung: ${modeLabel}`)
  }
  updateFrontalOrientationHint()
  const frontalMark = document.createElement('span')
  frontalMark.className = 'init-hero-ex__sp-tz-frontal-mark'
  frontalMark.setAttribute('aria-hidden', 'true')
  frontalLbl.append(frontalChk, frontalMark)
  if (!canEdit) frontalLbl.classList.add('init-hero-ex__sp-tz-frontal-lbl--disabled')
  frontalCol.append(frontalTitle, frontalLbl)

  const spTzInputRow = document.createElement('div')
  spTzInputRow.className =
    'init-hero-ex__sp-tz-pair__grid-row init-hero-ex__sp-tz-pair__grid-row--inputs'
  spTzInputRow.append(spInp, spTzBridgeBtn, tzInp)
  spTzGrid.append(spTzLabelRow, spTzInputRow)
  spTzPair.append(spTzGrid, frontalCol)

  const attrKoTpWrap = document.createElement('div')
  attrKoTpWrap.className = 'init-hero-ex__attr-ko-tp-wrap'
  attrKoTpWrap.append(koAttr.cell)
  attrCols.appendChild(attrKoTpWrap)
  bottomStrip.appendChild(attrBlock)

  const at = mkMicro(
    'AT',
    'Attacke (AT)',
    'at',
    microDisplayForModField('at', snap.at),
    2,
    '',
    true
  )
  const pa = mkMicro(
    'PA',
    'Parade (PA)',
    'pa',
    microDisplayForModField('pa', snap.pa),
    2,
    '',
    true
  )
  const ausw = mkMicro(
    'AW',
    'Ausweichen (AW)',
    'a',
    microDisplayForModField('a', snap.a),
    2,
    '',
    true
  )

  const tpCell = document.createElement('div')
  tpCell.className = 'init-hero-ex__micro-cell'
  const tpAbbr = document.createElement('span')
  tpAbbr.className = 'init-hero-ex__abbr'
  tpAbbr.textContent = 'TP'
  tpAbbr.title = 'Trefferpunkte (TP)'
  const tpInp = document.createElement('input')
  tpInp.type = 'text'
  tpInp.className = 'init-hero-ex__micro init-hero-ex__micro--tp'
  tpInp.id = `hero-ex-${itemId}-tp`
  tpInp.autocomplete = 'off'
  tpInp.spellcheck = false
  tpInp.disabled = !canEdit
  tpInp.value = microDisplayForModField('tp', snap.tp)
  tpInp.maxLength = 7
  tpInp.title = 'Trefferpunkte (TP), bis 7 Zeichen'
  tpInp.setAttribute('aria-label', 'Trefferpunkte (TP)')
  tpCell.append(tpAbbr, tpInp)

  const fk = mkMicro(
    'FK',
    'Fernkampf (FK)',
    'fk',
    microDisplayForModField('fk', snap.fk),
    2,
    '',
    true
  )
  if (!showFkField) {
    fk.cell.style.visibility = 'hidden'
    fk.cell.setAttribute('aria-hidden', 'true')
    fk.inp.disabled = true
    fk.inp.tabIndex = -1
  }
  const gs = mkMicro(
    'GS',
    'Geschwindigkeit (GS)',
    'gs',
    microDisplayForModField('gs', snap.gs),
    3,
    '',
    true
  )
  const ae = mkMicro(
    energyFieldAbbr,
    energyFieldLabel,
    'ae',
    microDisplayForModField('ae', snap.ae),
    3,
    '',
    true
  )
  const keDualInp = document.createElement('input')
  if (snap.energyMode === 'both') {
    ae.ab.textContent = ''
    ae.ab.style.fontSize = '10px'
    ae.ab.style.lineHeight = '1.1'
    ae.ab.style.display = 'grid'
    ae.ab.style.gridTemplateRows = '1fr 1fr'
    const aeLbl = document.createElement('span')
    aeLbl.textContent = 'AE'
    aeLbl.style.fontSize = '10px'
    const keLbl = document.createElement('span')
    keLbl.textContent = 'KE'
    keLbl.style.fontSize = '10px'
    ae.ab.append(aeLbl, keLbl)

    const dualWrap = document.createElement('div')
    dualWrap.style.display = 'grid'
    dualWrap.style.gridTemplateRows = '1fr 1fr'
    dualWrap.style.gap = '1px'
    dualWrap.style.width = '100%'
    dualWrap.style.height = '100%'

    ae.inp.value = microDisplayForModField('ae', snap.ae)
    ae.inp.maxLength = 3
    ae.inp.style.fontSize = '12px'
    ae.inp.style.lineHeight = '1.05'
    ae.inp.style.height = '100%'
    ae.inp.title = 'Astralenergie (AE)'
    ae.inp.setAttribute('aria-label', 'Astralenergie (AE)')

    keDualInp.type = 'text'
    keDualInp.inputMode = 'numeric'
    keDualInp.className = 'init-hero-ex__micro'
    keDualInp.id = `hero-ex-${itemId}-ke`
    keDualInp.autocomplete = 'off'
    keDualInp.spellcheck = false
    keDualInp.disabled = !canEdit
    keDualInp.value = snap.ke
    keDualInp.maxLength = 3
    keDualInp.style.fontSize = '12px'
    keDualInp.style.lineHeight = '1.05'
    keDualInp.style.height = '100%'
    keDualInp.title = 'Karmaenergie (KE)'
    keDualInp.setAttribute('aria-label', 'Karmaenergie (KE)')

    dualWrap.append(ae.inp, keDualInp)
    ae.cell.replaceChildren(ae.ab, dualWrap)
  }
  if (!showEnergyField) {
    ae.cell.style.visibility = 'hidden'
    ae.cell.setAttribute('aria-hidden', 'true')
    ae.inp.disabled = true
    ae.inp.tabIndex = -1
  }
  const ws = mkMicro(
    'WS',
    'Wundschwelle + Modifikation (WS)',
    'ws',
    microDisplayForModField('ws', snap.ws),
    12,
    '',
    false
  )
  ws.cell.classList.add('init-hero-ex__micro-cell--ws-le-match')
  ws.ab.title = WS_RULES_TOOLTIP
  ws.inp.title = WS_RULES_TOOLTIP
  const ibChain = document.createElement('div')
  ibChain.className = 'init-hero-ex__ib-chain'
  /* Immer 5 Spalten: Lesemodus nutzt unsichtbare MOD-Geometrie wie Bearbeitung (Dock). */
  ibChain.classList.add('init-hero-ex__ib-chain--cols-5')
  const mkChainAbbr = (text, title, noUppercase) => {
    const s = document.createElement('span')
    s.className =
      'init-hero-ex__abbr' +
      (noUppercase ? ' init-hero-ex__abbr--no-case' : '')
    s.textContent = text
    s.title = title
    return s
  }
  const ibAbbrLabel = mkChainAbbr(
    'IB',
    'Ini-Basis + Modifikation (IB)'
  )
  const ibBeLbl = mkChainAbbr('-BE', 'Behinderung (BE)')
  const ibW6Lbl = mkChainAbbr('+W6', 'Würfelwurf (W6)')
  const ibIniLblHold = document.createElement('span')
  ibIniLblHold.className = 'init-hero-ex__ib-chain__label-placeholder'
  ibIniLblHold.setAttribute('aria-hidden', 'true')
  const mkChainInp = (idSuf, value, maxLen, numeric, aria) => {
    const inp = document.createElement('input')
    inp.type = 'text'
    if (numeric) inp.inputMode = 'numeric'
    inp.className = 'init-hero-ex__micro init-hero-ex__micro--ib-chain-inp'
    inp.id = `hero-ex-${itemId}-${idSuf}`
    inp.autocomplete = 'off'
    inp.spellcheck = false
    inp.disabled = !canEdit
    inp.value = value
    inp.maxLength = maxLen
    inp.title = aria
    inp.setAttribute('aria-label', aria)
    return inp
  }
  const ibInp = mkChainInp(
    'ib',
    microDisplayForModField('ib', snap.ib),
    10,
    false,
    'Ini-Basis + Modifikation (IB)'
  )
  const beInp = mkChainInp(
    'be',
    microDisplayForModField('be', snap.be),
    3,
    true,
    'Behinderung (BE)'
  )
  const w6Inp = mkChainInp('w6', snap.w6, 14, false, 'Würfelwurf (W6)')
  /**
   * Spalte: nur Eingabe im oberen Kasten (Rahmen), Mod-Band darunter — wie Mikrozelle.
   * @param {string} [extraColClass]
   */
  const mkIbChainCol = (inpEl, extraColClass = '') => {
    const col = document.createElement('div')
    col.className =
      'init-hero-ex__ib-chain__col' +
      (extraColClass ? ` ${extraColClass}` : '')
    const shell = document.createElement('div')
    shell.className = 'init-hero-ex__ib-chain__inp-cell'
    shell.appendChild(inpEl)
    col.appendChild(shell)
    return col
  }
  /**
   * Kürzel + Spalte wie Mikrozelle — Mod-Pick-Rahmen umfasst Beschriftung und Kästchen.
   * @param {HTMLElement | null} abbrEl
   * @param {HTMLDivElement} colEl
   * @param {string} [stackExtraClass]
   */
  const mkIbChainStack = (abbrEl, colEl, stackExtraClass = '') => {
    const stack = document.createElement('div')
    stack.className =
      'init-hero-ex__ib-chain__stack' +
      (stackExtraClass ? ` ${stackExtraClass}` : '')
    if (abbrEl) stack.appendChild(abbrEl)
    stack.appendChild(colEl)
    return stack
  }
  const ibCol = mkIbChainCol(ibInp)
  const beCol = mkIbChainCol(beInp)
  const w6Col = mkIbChainCol(w6Inp)
  const stackIb = mkIbChainStack(ibAbbrLabel, ibCol)
  const stackBe = mkIbChainStack(ibBeLbl, beCol)
  const stackW6 = mkIbChainStack(ibW6Lbl, w6Col)
  const iniUpBtn = document.createElement('button')
  iniUpBtn.type = 'button'
  iniUpBtn.className = 'init-hero-ex__ini-up-btn'
  iniUpBtn.innerHTML =
    '<svg class="init-hero-ex__ini-up-graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 18" width="8" height="15" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M1 15.5H8.5M8.5 15.5V6"/><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M8.5 3.2L6.2 6.2H10.8L8.5 3.2"/></svg>'
  iniUpBtn.title =
    'Initiative (INI): aus IB − BE + W6 berechnen und setzen (falls alle Felder gültig), sonst INI fokussieren'
  iniUpBtn.setAttribute(
    'aria-label',
    'Initiative: aus IB minus BE plus W6 berechnen oder Eingabe fokussieren'
  )

  /** @type {HTMLButtonElement | null} */
  let modToggleBtn = null

  const modStrip = document.createElement('div')
  modStrip.className = 'init-hero-ex__mods-strip'
  modStrip.setAttribute('aria-label', 'Aktive Modifikatoren')
  /** @type {HTMLDivElement | null} */
  let modIbCol = null
  /** @type {HTMLDivElement | null} */
  let stackMod = null

  const iniIbCol = document.createElement('div')
  iniIbCol.className =
    'init-hero-ex__ib-chain__col init-hero-ex__ib-chain__col--ini'
  const iniShell = document.createElement('div')
  iniShell.className = 'init-hero-ex__ib-chain__inp-cell'
  iniShell.appendChild(iniUpBtn)
  iniIbCol.appendChild(iniShell)

  if (canEdit) {
    modToggleBtn = document.createElement('button')
    modToggleBtn.type = 'button'
    modToggleBtn.className =
      'init-hero-ex__mod-toggle init-hero-ex__mod-toggle--hero-block'
    modToggleBtn.innerHTML = `<span class="init-hero-ex__mod-toggle__panel"><span class="init-hero-ex__mod-toggle__idle" aria-hidden="true"><span class="init-hero-ex__mod-toggle__arrows"><span class="init-hero-ex__mod-toggle__arrow init-hero-ex__mod-toggle__arrow--up">${SVG_HERO_MOD_TOGGLE_UP}</span><span class="init-hero-ex__mod-toggle__arrow init-hero-ex__mod-toggle__arrow--down">${SVG_HERO_MOD_TOGGLE_DOWN}</span></span><span class="init-hero-ex__mod-toggle__plus">+</span></span><span class="init-hero-ex__mod-toggle__busy" aria-hidden="true">×</span></span>`
    modToggleBtn.title =
      'Temporaeren Modifikator anlegen (klick auf ein Wert-Kaestchen waehlt das Feld)'
    modToggleBtn.setAttribute(
      'aria-label',
      'Modifikator-Modus umschalten (Werte-Kaestchen werden klickbar)'
    )
    modToggleBtn.setAttribute('aria-pressed', 'false')

    const modAbbrLabel = mkChainAbbr(
      'MOD',
      'Temporaere Modifikatoren: Kaestchen unter Werten waehlen und anlegen'
    )
    modIbCol = document.createElement('div')
    modIbCol.className =
      'init-hero-ex__ib-chain__col init-hero-ex__ib-chain__col--mod-pick'
    const modShell = document.createElement('div')
    modShell.className =
      'init-hero-ex__ib-chain__inp-cell init-hero-ex__ib-chain__inp-cell--mod-pick'
    modShell.appendChild(modToggleBtn)
    modIbCol.appendChild(modShell)
    stackMod = mkIbChainStack(
      modAbbrLabel,
      modIbCol,
      'init-hero-ex__ib-chain__stack--mod-pick'
    )
    modStrip.classList.add('init-hero-ex__mods-strip--under-mod-btn')
  } else {
    const modAbbrLayout = mkChainAbbr(
      'MOD',
      'Temporaere Modifikatoren (Ansicht)'
    )
    modIbCol = document.createElement('div')
    modIbCol.className =
      'init-hero-ex__ib-chain__col init-hero-ex__ib-chain__col--mod-pick'
    const modShellLayout = document.createElement('div')
    modShellLayout.className =
      'init-hero-ex__ib-chain__inp-cell init-hero-ex__ib-chain__inp-cell--mod-pick init-hero-ex__ib-chain__inp-cell--mod-pick--player-layout'
    modShellLayout.setAttribute('aria-hidden', 'true')
    modIbCol.appendChild(modShellLayout)
    stackMod = mkIbChainStack(
      modAbbrLayout,
      modIbCol,
      'init-hero-ex__ib-chain__stack--mod-pick init-hero-ex__ib-chain__stack--player-layout'
    )
    modStrip.classList.add('init-hero-ex__mods-strip--under-mod-btn')
  }

  const stackIni = mkIbChainStack(ibIniLblHold, iniIbCol)
  const ibChainCols = document.createElement('div')
  ibChainCols.className = 'init-hero-ex__ib-chain__cols'
  ibChainCols.append(stackIb, stackBe, stackW6, stackIni)
  if (stackMod) ibChainCols.appendChild(stackMod)
  ibChain.appendChild(ibChainCols)
  const ib = { inp: ibInp }
  const be = { inp: beInp }
  const w6 = { inp: w6Inp }

  const zoneMidRow = document.createElement('div')
  zoneMidRow.className = 'init-hero-ex__zone-mid'
  /** @type {ReturnType<typeof mountZoneMiniWappen>[]} */
  const zoneUiMid = []
  const wappenList = Array.isArray(snap.wappenDefs) ? snap.wappenDefs : []
  const wappenBySlot = new Map()
  for (const def of wappenList) {
    if (def && Number.isFinite(Number(def.slot))) {
      wappenBySlot.set(Number(def.slot), def)
    }
  }
  for (let slot = 1; slot <= 8; slot++) {
    const def = wappenBySlot.get(slot)
    if (!def || def.active === false) {
      const placeholder = document.createElement('div')
      placeholder.className =
        'init-hero-ex__micro-cell init-hero-ex__micro-cell--wappen init-hero-ex__micro-cell--empty'
      placeholder.setAttribute('aria-hidden', 'true')
      zoneMidRow.appendChild(placeholder)
      continue
    }
    const zSnap = snap.hitZones.zones[def.id] ?? { rs: '', w: 0 }
    const rsShown = microDisplayForModField(def.id, strOrEmpty(zSnap.rs))
    const ui = mountZoneMiniWappen(itemId, canEdit, def, {
      ...zSnap,
      rs: rsShown,
    })
    zoneUiMid.push(ui)
    zoneMidRow.appendChild(ui.cell)
  }

  const leChain = document.createElement('div')
  leChain.className = 'init-hero-ex__le-chain'
  const leMaxTitle = 'Lebensenergie Maximum (LE max)'
  const leAbbrLE = mkChainAbbr('LE/', 'Lebensenergie (LE)')
  const leAbbrMax = mkChainAbbr('MAX', leMaxTitle)
  const leInp = mkChainInp(
    'le',
    microDisplayForModField('le', snap.le),
    3,
    true,
    'Lebensenergie (LE)'
  )
  const leMaxInp = mkChainInp(
    'lemax',
    microDisplayForModField('leMax', snap.leMax),
    3,
    true,
    'Lebensenergie Maximum (LE max)'
  )
  /* Manuelles Tippen hier sperren: Bearbeitung nur ueber S-Popover (lePopLeInp /
     lePopLeMaxInp). Mod-Auswahl per Klick auf die Zelle bleibt aktiv (Pick-Modus). */
  if (canEdit) {
    leInp.readOnly = true
    leMaxInp.readOnly = true
    const ROHINT = ' (Bearbeitung im S-Overlay)'
    leInp.title = `${leInp.title}${ROHINT}`
    leMaxInp.title = `${leMaxInp.title}${ROHINT}`
    leInp.setAttribute('aria-readonly', 'true')
    leMaxInp.setAttribute('aria-readonly', 'true')
  }
  const mkLeChainCol = (inpEl) => {
    const col = document.createElement('div')
    col.className = 'init-hero-ex__le-chain__col'
    const shell = document.createElement('div')
    shell.className = 'init-hero-ex__le-chain__inp-cell'
    shell.appendChild(inpEl)
    col.appendChild(shell)
    return col
  }
  /**
   * @param {HTMLElement} abbrEl
   * @param {HTMLDivElement} colEl
   */
  const mkLeChainStack = (abbrEl, colEl) => {
    const stack = document.createElement('div')
    stack.className = 'init-hero-ex__le-chain__stack'
    stack.appendChild(abbrEl)
    stack.appendChild(colEl)
    return stack
  }
  const leCol = mkLeChainCol(leInp)
  const leMaxCol = mkLeChainCol(leMaxInp)
  const stackLe = mkLeChainStack(leAbbrLE, leCol)
  const stackLeMax = mkLeChainStack(leAbbrMax, leMaxCol)
  const leChainCols = document.createElement('div')
  leChainCols.className = 'init-hero-ex__le-chain__cols'
  leChainCols.append(stackLe, stackLeMax)
  leChain.appendChild(leChainCols)
  const le = { inp: leInp }
  const leMax = { inp: leMaxInp }

  const parseSignedIntLoose = (raw) => {
    const t = String(raw ?? '').trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    if (!Number.isFinite(n)) return null
    return n
  }

  const parseNonNegIntLoose = (raw) => {
    const t = String(raw ?? '').trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    if (!Number.isFinite(n) || n < 0) return null
    return n
  }

  const computeLeThresholdMalus = () => {
    const leVal = parseSignedIntLoose(le.inp.value)
    const leMaxVal = parseNonNegIntLoose(leMax.inp.value)
    if (leVal === null || leMaxVal === null || leMaxVal <= 0) return 0
    const band = leBand(leVal, leMaxVal, customLeThreshold)
    return leAtPaMalusForBand(band)
  }

  const leThreshCell = document.createElement('div')
  leThreshCell.className =
    'init-hero-ex__micro-cell init-hero-ex__le-threshold'
  const leThreshAbbr = document.createElement('span')
  leThreshAbbr.className = 'init-hero-ex__abbr'
  leThreshAbbr.textContent = 'S'
  leThreshAbbr.title = LE_THRESHOLD_TOOLTIP
  const leThreshBox = document.createElement('div')
  leThreshBox.className = 'init-hero-ex__le-threshold__box'
  leThreshBox.title = LE_THRESHOLD_TOOLTIP
  leThreshBox.setAttribute('role', 'img')
  leThreshBox.setAttribute('aria-label', 'LE-Schwellenanzeige')
  const leThreshFill = document.createElement('div')
  leThreshFill.className = 'init-hero-ex__le-threshold__fill'
  const leThreshLine50 = document.createElement('div')
  leThreshLine50.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--50'
  leThreshLine50.style.bottom = '50%'
  leThreshLine50.title = 'Schwelle 1/2 LE'
  const leThreshLine33 = document.createElement('div')
  leThreshLine33.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--33'
  leThreshLine33.style.bottom = '33.333%'
  leThreshLine33.title = 'Schwelle 1/3 LE'
  const leThreshLine25 = document.createElement('div')
  leThreshLine25.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--25'
  leThreshLine25.style.bottom = '25%'
  leThreshLine25.title = 'Schwelle 1/4 LE'
  const leThreshLine5 = document.createElement('div')
  leThreshLine5.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--le5'
  leThreshLine5.title = 'Schwelle LE 5 (kampfunfähig bei 0–5)'
  leThreshLine5.style.display = 'none'
  const leThreshLineUnf = document.createElement('div')
  leThreshLineUnf.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--unfaehig'
  leThreshLineUnf.style.display = 'none'
  const leThreshSkull = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  )
  leThreshSkull.setAttribute('viewBox', '0 0 24 24')
  leThreshSkull.setAttribute('aria-hidden', 'true')
  leThreshSkull.setAttribute('focusable', 'false')
  leThreshSkull.classList.add('init-hero-ex__le-threshold__skull')
  leThreshSkull.style.display = 'none'
  leThreshSkull.innerHTML =
    '<path fill="currentColor" d="M12 2C7.58 2 4 5.58 4 10c0 2.49 1.14 4.7 2.92 6.16.36.3.58.74.58 1.2V19a2 2 0 0 0 2 2h1v-2h1v2h2v-2h1v2h1a2 2 0 0 0 2-2v-1.64c0-.46.22-.9.58-1.2C18.86 14.7 20 12.49 20 10c0-4.42-3.58-8-8-8Zm-3 9.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm6 0a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm-4.5 3.25h3l.5 1.25h-4l.5-1.25Z"/>'
  leThreshBox.append(
    leThreshFill,
    leThreshLineUnf,
    leThreshLine5,
    leThreshLine25,
    leThreshLine33,
    leThreshLine50,
    leThreshSkull
  )
  leThreshCell.append(leThreshAbbr, leThreshBox)

  const parseLeIntSafe = (raw) => {
    const t = String(raw ?? '').trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : null
  }
  const parseKoIntSafe = (raw) => {
    const t = String(raw ?? '').trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : null
  }
  /** Minus-Skala 0 … −1,6·KO (ab LE≤0 mit gültigem KO). */
  const NEG_LE_KO_RANGE = 1.6

  const resetLeThreshNegOff = () => {
    leThreshCell.classList.remove('init-hero-ex__le-threshold--neg-le')
    leThreshCell.classList.remove('init-hero-ex__le-threshold--neg-pulse')
    leThreshCell.classList.remove(
      'init-hero-ex__le-threshold--neg-pulse--irregular'
    )
    leThreshFill.classList.remove('init-hero-ex__le-threshold__fill--from-top')
    leThreshSkull.style.removeProperty('bottom')
    leThreshSkull.style.removeProperty('transform')
    leThreshFill.style.removeProperty('top')
    leThreshFill.style.removeProperty('bottom')
    leThreshLine50.style.display = ''
    leThreshLine50.style.bottom = '50%'
    leThreshLine33.style.bottom = '33.333%'
    leThreshLine25.style.bottom = '25%'
    leThreshLine33.classList.remove('init-hero-ex__le-threshold__line--neg-ko')
    leThreshLine25.classList.remove(
      'init-hero-ex__le-threshold__line--neg-le-solid'
    )
    leThreshLine5.classList.remove(
      'init-hero-ex__le-threshold__line--neg-le-solid'
    )
    leThreshLineUnf.style.display = 'none'
  }

  const updateLeThreshold = () => {
    const leV = parseLeIntSafe(leInp.value)
    const maxV = parseLeIntSafe(leMaxInp.value)
    const koV = parseKoIntSafe(koAttr.inp.value)
    /* KO/minus-Skala und Ansicht ab LE≤0 (inkl. LE=0), sobald KO gültig */
    const negLe =
      leV != null && leV <= 0 && koV != null && koV > 0
    const dead = leV != null && leV <= 0 && !negLe

    if (negLe) {
      resetLeThreshNegOff()
      leThreshCell.classList.add('init-hero-ex__le-threshold--neg-le')
      leThreshFill.classList.add('init-hero-ex__le-threshold__fill--from-top')
      leThreshFill.style.bottom = 'auto'
      leThreshFill.style.top = '0'
      const depth = -leV
      const cap = NEG_LE_KO_RANGE * koV
      const hp = Math.min(100, (depth / cap) * 100)
      leThreshFill.style.height = hp.toFixed(3) + '%'
      leThreshCell.dataset.leBand = 'neg-le'
      leThreshSkull.style.display = ''
      leThreshLine50.style.display = 'none'
      const pctBot = (koMult) =>
        100 - (koMult / NEG_LE_KO_RANGE) * 100
      leThreshLine33.style.display = ''
      leThreshLine33.style.bottom = `${pctBot(0.5).toFixed(3)}%`
      leThreshLine33.classList.add('init-hero-ex__le-threshold__line--neg-ko')
      leThreshLine25.style.display = ''
      leThreshLine25.style.bottom = `${pctBot(1).toFixed(3)}%`
      leThreshLine25.classList.add(
        'init-hero-ex__le-threshold__line--neg-le-solid'
      )
      leThreshLine5.style.display = ''
      leThreshLine5.style.bottom = `${pctBot(1.5).toFixed(3)}%`
      leThreshLine5.classList.add(
        'init-hero-ex__le-threshold__line--neg-le-solid'
      )
      leThreshLineUnf.style.display = 'none'
      const b1 = pctBot(1)
      const b15 = pctBot(1.5)
      const skullBot = (b1 + b15) / 2
      leThreshSkull.style.bottom = `${skullBot.toFixed(3)}%`
      leThreshSkull.style.top = 'auto'
      leThreshSkull.style.transform = 'translate(-50%, 50%)'
      /* Blinken oberhalb −1·KO; langsamer/unregelmäßig zwischen −1·KO und −½·KO */
      const negPulseOn = leV > -koV
      const negPulseIrregular =
        negPulseOn && leV <= -0.5 * koV
      leThreshCell.classList.toggle(
        'init-hero-ex__le-threshold--neg-pulse',
        negPulseOn
      )
      leThreshCell.classList.toggle(
        'init-hero-ex__le-threshold--neg-pulse--irregular',
        negPulseIrregular
      )
      return
    }

    resetLeThreshNegOff()

    leThreshSkull.style.display = dead ? '' : 'none'
    if (dead) {
      leThreshFill.style.height = '0%'
      leThreshCell.dataset.leBand = 'crit'
    } else if (leV != null && maxV != null && maxV > 0) {
      const frac = Math.max(0, Math.min(1, leV / maxV))
      leThreshFill.style.height = (frac * 100).toFixed(3) + '%'
      leThreshCell.dataset.leBand = leBarColorBand(leV, maxV)
    } else {
      leThreshFill.style.height = '0%'
      delete leThreshCell.dataset.leBand
    }
    if (customLeThreshold != null && maxV != null && maxV > customLeThreshold) {
      leThreshLine5.style.display = ''
      leThreshLine5.style.bottom = ((customLeThreshold / maxV) * 100).toFixed(3) + '%'
    } else {
      leThreshLine5.style.display = 'none'
    }
    if (maxV != null && maxV > 0 && maxV > unfaehigThreshold) {
      leThreshLineUnf.style.display = ''
      leThreshLineUnf.style.bottom = ((unfaehigThreshold / maxV) * 100).toFixed(3) + '%'
      leThreshLineUnf.title = `Schwelle unfähig (LE ≤ ${unfaehigThreshold})`
    } else {
      leThreshLineUnf.style.display = 'none'
    }
  }
  updateLeThreshold()
  leInp.addEventListener('input', updateLeThreshold)
  leMaxInp.addEventListener('input', updateLeThreshold)
  koAttr.inp.addEventListener('input', updateLeThreshold)

  /* S-Popover (LE-Detailanzeige). Aufbau als DOM-Subtree, wird erst bei
     Klick auf das S-Kästchen in das Heldenblock-Root eingehängt und ist
     damit Bestandteil des ausklappbaren Bereichs (scrollt mit). */
  const lePop = document.createElement('div')
  lePop.className = 'init-hero-ex__le-pop'
  lePop.setAttribute('role', 'dialog')
  lePop.setAttribute('aria-label', 'LE-Schwellen und Wunden')
  lePop.addEventListener('mousedown', (e) => {
    e.stopPropagation()
  })

  const lePopHeader = document.createElement('div')
  lePopHeader.className = 'init-hero-ex__le-pop__header'

  const lePopWunden = document.createElement('div')
  lePopWunden.className = 'init-hero-ex__le-pop__wunden'
  const lePopWundenTxt = document.createElement('span')
  lePopWundenTxt.textContent = 'W: 0'
  lePopWunden.appendChild(lePopWundenTxt)

  const lePopMods = document.createElement('div')
  lePopMods.className = 'init-hero-ex__le-pop__mods'
  lePopMods.setAttribute('role', 'img')
  lePopMods.setAttribute('aria-label', 'Modifikatoren: Summe 0')
  const lePopModsArrow = document.createElement('span')
  lePopModsArrow.className = 'init-hero-ex__le-pop__mods__arrow'
  lePopModsArrow.textContent = '\u2193'
  lePopModsArrow.setAttribute('aria-hidden', 'true')
  const lePopModsVal = document.createElement('span')
  lePopModsVal.className = 'init-hero-ex__le-pop__mods__val'
  lePopModsVal.textContent = '0'
  lePopMods.append(lePopModsArrow, lePopModsVal)

  const lePopClose = document.createElement('button')
  lePopClose.type = 'button'
  lePopClose.className = 'init-hero-ex__le-pop__close'
  lePopClose.textContent = '\u00D7'
  lePopClose.title = 'Schließen'
  lePopClose.setAttribute('aria-label', 'LE-Popover schließen')

  lePopHeader.append(lePopWunden, lePopMods, lePopClose)

  const lePopBody = document.createElement('div')
  lePopBody.className = 'init-hero-ex__le-pop__body'

  const lePopGauge = document.createElement('div')
  lePopGauge.className = 'init-hero-ex__le-pop__gauge'
  const lePopTrack = document.createElement('div')
  lePopTrack.className = 'init-hero-ex__le-pop__gauge-track'
  const lePopFill = document.createElement('div')
  lePopFill.className = 'init-hero-ex__le-pop__gauge-fill'
  const lePopLine50 = document.createElement('div')
  lePopLine50.className =
    'init-hero-ex__le-pop__gauge-line init-hero-ex__le-pop__gauge-line--50'
  lePopLine50.style.bottom = '50%'
  const lePopLine33 = document.createElement('div')
  lePopLine33.className =
    'init-hero-ex__le-pop__gauge-line init-hero-ex__le-pop__gauge-line--33'
  lePopLine33.style.bottom = '33.333%'
  const lePopLine25 = document.createElement('div')
  lePopLine25.className =
    'init-hero-ex__le-pop__gauge-line init-hero-ex__le-pop__gauge-line--25'
  lePopLine25.style.bottom = '25%'
  const lePopLineLe5 = document.createElement('div')
  lePopLineLe5.className =
    'init-hero-ex__le-pop__gauge-line init-hero-ex__le-pop__gauge-line--le5'
  lePopLineLe5.style.display = 'none'
  const lePopLineUnf = document.createElement('div')
  lePopLineUnf.className =
    'init-hero-ex__le-pop__gauge-line init-hero-ex__le-pop__gauge-line--unfaehig'
  lePopLineUnf.style.display = 'none'
  const lePopSkull = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  )
  lePopSkull.setAttribute('viewBox', '0 0 24 24')
  lePopSkull.setAttribute('aria-hidden', 'true')
  lePopSkull.setAttribute('focusable', 'false')
  lePopSkull.classList.add('init-hero-ex__le-pop__gauge-skull')
  lePopSkull.style.display = 'none'
  lePopSkull.innerHTML =
    '<path fill="currentColor" d="M12 2C7.58 2 4 5.58 4 10c0 2.49 1.14 4.7 2.92 6.16.36.3.58.74.58 1.2V19a2 2 0 0 0 2 2h1v-2h1v2h2v-2h1v2h1a2 2 0 0 0 2-2v-1.64c0-.46.22-.9.58-1.2C18.86 14.7 20 12.49 20 10c0-4.42-3.58-8-8-8Zm-3 9.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm6 0a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm-4.5 3.25h3l.5 1.25h-4l.5-1.25Z"/>'
  const lePopPct = document.createElement('div')
  lePopPct.className = 'init-hero-ex__le-pop__gauge-pct'
  lePopPct.setAttribute('aria-hidden', 'true')
  lePopTrack.append(
    lePopFill,
    lePopLineUnf,
    lePopLineLe5,
    lePopLine25,
    lePopLine33,
    lePopLine50,
    lePopSkull,
    lePopPct
  )

  /* LE/MAX im Popover: gleicher Aufbau wie .init-hero-ex__le-chain im
     ausklappbaren Bereich (Beschriftung + Raster-Kästchen). */
  const lePopLeMaxBlock = document.createElement('div')
  lePopLeMaxBlock.className =
    'init-hero-ex__le-pop__le-chain-wrap init-hero-ex__le-chain'
  const mkLeDupInput = (source, aria, idSuf, maxLen) => {
    const inp = document.createElement('input')
    inp.type = 'text'
    inp.inputMode = 'numeric'
    inp.className = 'init-hero-ex__micro init-hero-ex__micro--ib-chain-inp'
    inp.id = `hero-ex-${itemId}-pop-${idSuf}`
    inp.autocomplete = 'off'
    inp.spellcheck = false
    inp.maxLength = maxLen
    inp.disabled = !canEdit
    inp.value = source.value
    inp.setAttribute('aria-label', aria)
    inp.title = aria
    return inp
  }
  const lePopLeInp = mkLeDupInput(leInp, 'Lebensenergie (LE)', 'le', 3)
  const lePopLeMaxInp = mkLeDupInput(
    leMaxInp,
    'Lebensenergie Maximum (LE max)',
    'lemax',
    3
  )
  const lePopKoInp = mkLeDupInput(
    koAttr.inp,
    'Konstitution (KO)',
    'ko',
    2
  )
  const mkLePopInpCell = (inp) => {
    const cell = document.createElement('div')
    cell.className = 'init-hero-ex__le-pop__inp-cell'
    cell.appendChild(inp)
    return cell
  }
  const lePopLeMaxLabels = document.createElement('div')
  lePopLeMaxLabels.className = 'init-hero-ex__le-chain__labels'
  const lePopAbbrMax = mkChainAbbr('MAX', leMaxTitle)
  const lePopAbbrKo = mkChainAbbr('KO', 'Konstitution (KO)')
  const lePopSecondAbbrSlot = document.createElement('div')
  lePopSecondAbbrSlot.className = 'init-hero-ex__le-pop__second-abbr-slot'
  lePopSecondAbbrSlot.append(lePopAbbrMax, lePopAbbrKo)
  lePopAbbrKo.style.display = 'none'
  lePopLeMaxLabels.append(
    mkChainAbbr('LE/', 'Lebensenergie (LE)'),
    lePopSecondAbbrSlot
  )
  const lePopLeMaxInputs = document.createElement('div')
  lePopLeMaxInputs.className = 'init-hero-ex__le-chain__inputs'
  const lePopMaxInpCell = mkLePopInpCell(lePopLeMaxInp)
  const lePopKoInpCell = mkLePopInpCell(lePopKoInp)
  const lePopSecondInpSlot = document.createElement('div')
  lePopSecondInpSlot.className = 'init-hero-ex__le-pop__second-inp-slot'
  lePopSecondInpSlot.append(lePopMaxInpCell, lePopKoInpCell)
  lePopKoInpCell.style.display = 'none'
  lePopLeMaxInputs.append(mkLePopInpCell(lePopLeInp), lePopSecondInpSlot)
  lePopLeMaxBlock.append(lePopLeMaxLabels, lePopLeMaxInputs)

  /* Geknickte Leader-Lines: Labels sitzen auf festen Slots (kollisionsfrei),
     die echte Schwellen-Linie im Gauge-Balken wird per SVG-Polyline zum
     Label geführt. */
  const lePopLabels = document.createElement('div')
  lePopLabels.className = 'init-hero-ex__le-pop__gauge-labels'

  const LE_POP_SVG_NS = 'http://www.w3.org/2000/svg'
  const lePopConnSvg = document.createElementNS(LE_POP_SVG_NS, 'svg')
  lePopConnSvg.classList.add('init-hero-ex__le-pop__conn-svg')
  lePopConnSvg.setAttribute('viewBox', '0 0 100 100')
  lePopConnSvg.setAttribute('preserveAspectRatio', 'none')
  lePopConnSvg.setAttribute('aria-hidden', 'true')
  const mkConnPath = (cls) => {
    const p = document.createElementNS(LE_POP_SVG_NS, 'polyline')
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke', 'currentColor')
    /* ~50 % der vorigen Strichbreite (0,55) */
    p.setAttribute('stroke-width', '0.275')
    p.setAttribute('stroke-linecap', 'round')
    p.setAttribute('stroke-linejoin', 'round')
    p.setAttribute('vector-effect', 'non-scaling-stroke')
    p.classList.add('init-hero-ex__le-pop__conn-line')
    if (cls) p.classList.add(`init-hero-ex__le-pop__conn-line--${cls}`)
    return p
  }
  const lePopConn50 = mkConnPath('50')
  const lePopConn33 = mkConnPath('33')
  const lePopConn25 = mkConnPath('25')
  const lePopConnLe5 = mkConnPath('le5')
  const lePopConnUnf = mkConnPath('unfaehig')
  lePopConnLe5.style.display = 'none'
  lePopConnUnf.style.display = 'none'
  lePopConnSvg.append(
    lePopConn50,
    lePopConn33,
    lePopConn25,
    lePopConnLe5,
    lePopConnUnf
  )

  /* Feste vertikale Slots für die Beschriftungen (y in %-von-unten). Zwischen
     Mathematik-Position der Schwelle im Balken und Slot liegt die Knick-Linie.
     Obere ~40% sind für das LE/MAX-Editfeld reserviert. */
  const SLOT_Y_HALF = 58
  const SLOT_Y_THIRD = 40
  const SLOT_Y_QUARTER = 22
  const SLOT_Y_UNFAEHIG = 12
  const SLOT_Y_LE5 = 4
  const mkGaugeLabel = (slotPct, extra) => {
    const l = document.createElement('span')
    l.className =
      'init-hero-ex__le-pop__gauge-label' +
      (extra ? ` init-hero-ex__le-pop__gauge-label--${extra}` : '')
    l.style.bottom = `${slotPct}%`
    return l
  }
  const lePopLab50 = mkGaugeLabel(SLOT_Y_HALF, '50')
  const lePopLab33 = mkGaugeLabel(SLOT_Y_THIRD, '33')
  const lePopLab25 = mkGaugeLabel(SLOT_Y_QUARTER, '25')
  const lePopLabUnf = mkGaugeLabel(SLOT_Y_UNFAEHIG, 'unfaehig')
  const lePopLabLe5 = mkGaugeLabel(SLOT_Y_LE5, 'le5')
  lePopLabUnf.style.display = 'none'
  lePopLabLe5.style.display = 'none'
  lePopLabels.append(
    lePopLeMaxBlock,
    lePopConnSvg,
    lePopLab50,
    lePopLab33,
    lePopLab25,
    lePopLabUnf,
    lePopLabLe5
  )
  lePopGauge.append(lePopTrack, lePopLabels)
  lePopBody.append(lePopGauge)
  lePop.append(lePopHeader, lePopBody)

  /* Muss zu END_X in updateLePopover passen (Beschriftung direkt nach Linienende). */
  const LE_POP_CONN_END_X = 17
  lePopLabels.style.setProperty('--le-pop-conn-end', String(LE_POP_CONN_END_X))

  /* Zwei-Wege-Sync zwischen Haupt-Eingaben (leInp / leMaxInp) und den
     Popover-Duplikaten. Änderungen im Popover lösen ein 'input'-Event an der
     Hauptquelle aus, damit `updateLeThreshold` + `updateLePopover` laufen. */
  const syncInputPair = (srcInp, dupInp) => {
    const fromSrc = () => {
      if (dupInp.value !== srcInp.value) dupInp.value = srcInp.value
    }
    const fromDup = () => {
      if (srcInp.value !== dupInp.value) {
        srcInp.value = dupInp.value
        srcInp.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    srcInp.addEventListener('input', fromSrc)
    dupInp.addEventListener('input', fromDup)
  }
  syncInputPair(leInp, lePopLeInp)
  syncInputPair(leMaxInp, lePopLeMaxInp)
  syncInputPair(koAttr.inp, lePopKoInp)

  const totalWunden = () =>
    zoneUiMid.reduce((a, u) => a + (u.getWunden() || 0), 0)

  const penaltyHighlightTargets = {
    at: { cell: at.cell, inp: at.inp, ab: at.ab },
    pa: { cell: pa.cell, inp: pa.inp, ab: pa.ab },
    a: { cell: ausw.cell, inp: ausw.inp, ab: ausw.ab },
    fk: { cell: fk.cell, inp: fk.inp, ab: fk.ab },
    mu: { cell: mu.cell, inp: mu.inp, ab: mu.ab },
    kl: { cell: kl.cell, inp: kl.inp, ab: kl.ab },
    inn: { cell: inn.cell, inp: inn.inp, ab: inn.ab },
    ib: { chain: ibChain, inp: ib.inp, ab: ibAbbrLabel },
    ko: { cell: koAttr.cell, inp: koAttr.inp, ab: koAttr.ab },
    kk: { cell: kk.cell, inp: kk.inp, ab: kk.ab },
    ff: { cell: ff.cell, inp: ff.inp, ab: ff.ab },
    gs: { cell: gs.cell, inp: gs.inp, ab: gs.ab },
    ge: { cell: ge.cell, inp: ge.inp, ab: ge.ab },
  }

  const unfaehigVisualTargets = {
    at: at.cell,
    pa: pa.cell,
    a: ausw.cell,
    tp: tpCell,
    fk: fk.cell,
    gs: gs.cell,
  }
  const gsUnfaehigOverlay = document.createElement('span')
  gsUnfaehigOverlay.className = 'init-hero-ex__unfaehig-fixed-overlay'
  gsUnfaehigOverlay.setAttribute('aria-hidden', 'true')
  gs.cell.appendChild(gsUnfaehigOverlay)

  const applyUnfaehigVisualOverlay = (metaForMods = meta) => {
    const s = readHeroExpandSnapshot(metaForMods)
    /* Rein optisch: Effekt nur wenn das Auto-Bündel in den gepatchten Mods
       vorhanden ist (gleiche Quelle wie Mod-Chip). Live-LE steht in gather(),
       nicht always in meta — bundle presence matches threshold rule in heroAutoMods. */
    const active = readHeroExMods(metaForMods).some(
      (m) => String(m?.bundleId ?? '') === 'auto-le-unfaehig'
    )

    for (const cell of Object.values(unfaehigVisualTargets)) {
      if (!(cell instanceof HTMLElement)) continue
      cell.classList.remove('init-hero-ex__micro-cell--unfaehig-mark')
    }
    gsUnfaehigOverlay.textContent = ''
    gsUnfaehigOverlay.classList.remove('init-hero-ex__unfaehig-fixed-overlay--on')

    if (!active) return

    const combUf = getCombat()
    const roundUf =
      combUf?.started && Number.isFinite(Number(combUf.round))
        ? Number(combUf.round)
        : null
    const navIniUf = readCurrentNavIniGlobal()
    const ufSrc = computeUnfaehigSources(s, metaForMods, {
      round: roundUf,
      navIni: navIniUf,
    })
    const armOnly =
      !ufSrc.leTriggered && !ufSrc.nonArm3w && ufSrc.armSet.length > 0

    if (armOnly) {
      for (const key of ['at', 'pa', 'tp', 'fk']) {
        const cell = unfaehigVisualTargets[key]
        if (cell instanceof HTMLElement) {
          cell.classList.add('init-hero-ex__micro-cell--unfaehig-mark')
        }
      }
      return
    }

    const marked = new Set(
      Array.isArray(s.unfaehigMarkFields)
        ? s.unfaehigMarkFields.map((x) => String(x).toLowerCase())
        : []
    )
    if (ufSrc.armSet.length > 0) marked.add('fk')
    for (const key of marked) {
      const cell = unfaehigVisualTargets[key]
      if (cell instanceof HTMLElement) {
        cell.classList.add('init-hero-ex__micro-cell--unfaehig-mark')
      }
    }
    const gsFixed = Number(s.unfaehigFixedFields?.gs)
    if (Number.isFinite(gsFixed)) {
      gs.cell.classList.add('init-hero-ex__micro-cell--unfaehig-mark')
      gsUnfaehigOverlay.textContent = String(gsFixed)
      gsUnfaehigOverlay.classList.add('init-hero-ex__unfaehig-fixed-overlay--on')
    }
  }

  const stripPenaltyHighlightTarget = (t) => {
    t.inp.classList.remove('init-hero-ex__micro--malus-active')
    if (t.ab) t.ab.classList.remove('init-hero-ex__abbr--malus-active')
    if (t.cell)
      t.cell.classList.remove('init-hero-ex__micro-cell--calc-penalty')
    if (t.chain)
      t.chain.classList.remove('init-hero-ex__ib-chain--calc-penalty')
  }

  const applyPenaltyHighlightTarget = (t) => {
    t.inp.classList.add('init-hero-ex__micro--malus-active')
    if (t.ab) t.ab.classList.add('init-hero-ex__abbr--malus-active')
    if (t.cell) t.cell.classList.add('init-hero-ex__micro-cell--calc-penalty')
    if (t.chain) t.chain.classList.add('init-hero-ex__ib-chain--calc-penalty')
  }

  /** Nach `modFieldTargets`; bis dahin leer, falls vorzeitig aufgerufen. */
  let buildMergedStressHighlightTargets = () =>
    /** @type {Record<string, typeof penaltyHighlightTargets[string]>} */ ({})

  /** IB-Kette sowie MU bis KO: Kachelfarben nur ueber Wunden/LE-Schwelle, nicht durch Temp-Mods. */
  const PENALTY_MOD_HIGHLIGHT_SKIP_FIELDS = new Set([
    'ib',
    'mu',
    'kl',
    'inn',
    'ch',
    'ff',
    'ge',
    'kk',
    'ko',
  ])

  /**
   * LE-/Wund-Malus + heroExMods: gleiche Kachel-/Textfarben (`calc-penalty`).
   * @param {Record<string, unknown> | undefined} [metaForMods]
   */
  const refreshComputedPenaltyHighlights = (metaForMods) => {
    const modMeta = metaForMods ?? meta
    const leMalusForPop = computeLeThresholdMalus()
    const modSum = buildLePopoverModSummary(zoneUiMid, leMalusForPop, {
      wappenDefs: snap.wappenDefs,
    })
    const woundActive = new Set(modSum.activeFields || [])
    const merged = buildMergedStressHighlightTargets()
    for (const t of Object.values(merged)) {
      stripPenaltyHighlightTarget(t)
    }
    const navIni = readCurrentNavIniGlobal()
    for (const [field, t] of Object.entries(merged)) {
      const woundStress = woundActive.has(field)
      const modStress =
        !PENALTY_MOD_HIGHLIGHT_SKIP_FIELDS.has(field) &&
        ownerIniNum != null &&
        effectiveDeltaForField(
          modMeta,
          field,
          ownerIniNum,
          __roundNum,
          navIni
        ) !== 0
      if (!woundStress && !modStress) continue
      applyPenaltyHighlightTarget(t)
    }
    return modSum
  }

  /* Polyline für die Leader-Line einer Schwelle: geht von (0, lineY) am
     Labels-Container (Anschluss an die Gauge-Linie) waagerecht bis zu einem
     Knick-Punkt, dann senkrecht auf die Slot-Höhe des Labels, dann waagerecht
     zum Text. Koordinaten in Prozent des SVG-ViewBox (0..100). */
  const setConnPath = (poly, lineY, slotY, kinkX, endX) => {
    const lyV = 100 - lineY
    const syV = 100 - slotY
    const pts = `0,${lyV.toFixed(2)} ${kinkX.toFixed(2)},${lyV.toFixed(2)} ${kinkX.toFixed(2)},${syV.toFixed(2)} ${endX.toFixed(2)},${syV.toFixed(2)}`
    poly.setAttribute('points', pts)
  }

  const updateLePopover = () => {
    const modSum = refreshComputedPenaltyHighlights()
    if (!lePop.isConnected) return
    const w = totalWunden()
    lePopWundenTxt.textContent = `W: ${w}`
    lePopWunden.dataset.zero = w === 0 ? 'true' : 'false'
    lePopWunden.title = buildWundenZonesTitle(zoneUiMid, {
      wappenDefs: snap.wappenDefs,
    })

    lePopModsVal.textContent = String(modSum.total)
    lePopMods.title = modSum.title
    lePopMods.dataset.zero = modSum.total === 0 ? 'true' : 'false'
    lePopMods.setAttribute(
      'aria-label',
      `Modifikatoren: Summe ${modSum.total} (Details im Mouseover)`
    )

    const leV = parseLeIntSafe(leInp.value)
    const maxV = parseLeIntSafe(leMaxInp.value)
    const koV = parseKoIntSafe(koAttr.inp.value)
    const negLe =
      leV != null && leV <= 0 && koV != null && koV > 0
    const dead = leV != null && leV <= 0 && !negLe

    lePop.classList.toggle('init-hero-ex__le-pop--neg-le', negLe)
    lePopAbbrMax.style.display = negLe ? 'none' : ''
    lePopAbbrKo.style.display = negLe ? '' : 'none'
    lePopMaxInpCell.style.display = negLe ? 'none' : ''
    lePopKoInpCell.style.display = negLe ? '' : 'none'

    lePop.dataset.leDead = dead ? 'true' : 'false'

    /* Knick-Positionen (%-SVG): ~50 % der vorigen horizontalen Ausdehnung (END 34→17). */
    const KINK_50 = 11
    const KINK_33 = 8
    const KINK_25 = 4
    const KINK_UNFAEHIG = 14
    const KINK_LE5 = 14
    const END_X = LE_POP_CONN_END_X

    if (negLe) {
      lePopSkull.style.display = ''
      lePopFill.classList.add('init-hero-ex__le-pop__gauge-fill--from-top')
      lePopFill.style.bottom = 'auto'
      lePopFill.style.top = '0'
      const depth = -leV
      const cap = NEG_LE_KO_RANGE * koV
      lePopFill.style.height = Math.min(100, (depth / cap) * 100).toFixed(3) + '%'
      lePop.dataset.leBand = 'neg-le'
      const negPulseOnPop = leV > -koV
      const negPulseIrregularPop =
        negPulseOnPop && leV <= -0.5 * koV
      lePop.classList.toggle('init-hero-ex__le-pop--neg-pulse', negPulseOnPop)
      lePop.classList.toggle(
        'init-hero-ex__le-pop--neg-pulse--irregular',
        negPulseIrregularPop
      )

      const pctBot = (m) => 100 - (m / NEG_LE_KO_RANGE) * 100
      const b05 = pctBot(0.5)
      const b1 = pctBot(1)
      const b15 = pctBot(1.5)
      const skullBot = (b1 + b15) / 2
      lePopSkull.style.bottom = `${skullBot.toFixed(3)}%`
      lePopSkull.style.top = 'auto'
      lePopSkull.style.transform = 'translate(-50%, 50%)'

      lePopLine50.style.display = 'none'
      lePopConn50.style.display = 'none'
      lePopLab50.style.display = 'none'

      lePopLine33.style.display = ''
      lePopLine33.style.bottom = `${b05.toFixed(3)}%`
      lePopLine33.classList.add('init-hero-ex__le-pop__gauge-line--neg-ko')
      lePopLine25.style.display = ''
      lePopLine25.style.bottom = `${b1.toFixed(3)}%`
      lePopLine25.classList.add(
        'init-hero-ex__le-pop__gauge-line--neg-le-solid'
      )
      lePopLineLe5.style.display = ''
      lePopLineLe5.style.bottom = `${b15.toFixed(3)}%`
      lePopLineLe5.classList.add(
        'init-hero-ex__le-pop__gauge-line--neg-le-solid'
      )

      lePopLab33.style.display = ''
      lePopLab33.style.bottom = `${b05.toFixed(3)}%`
      lePopLab25.style.display = ''
      lePopLab25.style.bottom = `${b1.toFixed(3)}%`
      lePopLabUnf.style.display = 'none'
      lePopLabLe5.style.display = ''
      lePopLabLe5.style.bottom = `${b15.toFixed(3)}%`

      const n05 = Math.round(0.5 * koV)
      const n15 = Math.round(1.5 * koV)
      lePopLab33.textContent = `−½·KO (${n05})`
      lePopLab25.textContent = `−1·KO (${koV})`
      lePopLabLe5.textContent = `−1,5·KO (${n15})`

      setConnPath(lePopConn33, b05, b05, KINK_33, END_X)
      setConnPath(lePopConn25, b1, b1, KINK_25, END_X)
      setConnPath(lePopConnLe5, b15, b15, KINK_LE5, END_X)
      lePopConn33.style.display = ''
      lePopConn25.style.display = ''
      lePopConnLe5.style.display = ''
      lePopConnUnf.style.display = 'none'
      lePopLineUnf.style.display = 'none'

      lePopPct.style.display = 'none'
      lePopPct.textContent = ''
      lePopPct.title = `LE: ${leV} (Skala 0 … −${Math.round(
        NEG_LE_KO_RANGE * koV
      )} LE)`
      return
    }

    lePop.classList.remove('init-hero-ex__le-pop--neg-pulse')
    lePop.classList.remove('init-hero-ex__le-pop--neg-pulse--irregular')
    lePopSkull.style.removeProperty('bottom')
    lePopSkull.style.removeProperty('top')
    lePopSkull.style.removeProperty('transform')
    lePopPct.style.display = ''

    lePopFill.classList.remove('init-hero-ex__le-pop__gauge-fill--from-top')
    lePopFill.style.removeProperty('top')
    lePopFill.style.removeProperty('bottom')
    lePopLine33.classList.remove('init-hero-ex__le-pop__gauge-line--neg-ko')
    lePopLine25.classList.remove(
      'init-hero-ex__le-pop__gauge-line--neg-le-solid'
    )
    lePopLineLe5.classList.remove(
      'init-hero-ex__le-pop__gauge-line--neg-le-solid'
    )
    lePopLineUnf.classList.remove(
      'init-hero-ex__le-pop__gauge-line--neg-le-solid'
    )
    lePopLine50.style.display = ''
    lePopConn50.style.display = ''
    lePopLab50.style.display = ''
    lePopLab33.style.bottom = `${SLOT_Y_THIRD}%`
    lePopLab25.style.bottom = `${SLOT_Y_QUARTER}%`
    lePopLabUnf.style.bottom = `${SLOT_Y_UNFAEHIG}%`
    lePopLabLe5.style.bottom = `${SLOT_Y_LE5}%`

    lePopSkull.style.display = dead ? '' : 'none'

    let band = ''
    let frac = null
    if (dead) {
      band = 'crit'
      lePopFill.style.height = '0%'
    } else if (leV != null && maxV != null && maxV > 0) {
      frac = Math.max(0, Math.min(1, leV / maxV))
      lePopFill.style.height = (frac * 100).toFixed(3) + '%'
      band = leBarColorBand(leV, maxV)
    } else {
      lePopFill.style.height = '0%'
    }
    if (band) lePop.dataset.leBand = band
    else delete lePop.dataset.leBand

    if (maxV != null && maxV > 0 && leV != null) {
      const leNonNeg = Math.max(0, leV)
      const pctNum = Math.min(
        100,
        Math.round((leNonNeg / maxV) * 100)
      )
      const malPct = Boolean(dead || (band && band !== 'std'))
      lePopPct.title = `Verbleibende LE: ${pctNum} % von LE max (${leNonNeg} / ${maxV})`
      if (malPct) {
        lePopPct.innerHTML = `<span class="init-hero-ex__le-pop__gauge-pct__num init-hero-ex__le-pop__gauge-pct__num--mal">${pctNum}</span>%`
      } else {
        lePopPct.textContent = `${pctNum}%`
      }
    } else {
      lePopPct.textContent = '—'
      lePopPct.title = 'LE und LE max erforderlich für Prozentangabe'
    }

    setConnPath(lePopConn50, 50, SLOT_Y_HALF, KINK_50, END_X)
    setConnPath(lePopConn33, 33.333, SLOT_Y_THIRD, KINK_33, END_X)
    setConnPath(lePopConn25, 25, SLOT_Y_QUARTER, KINK_25, END_X)

    const maxOk = maxV != null && maxV > 0
    const valSpan = (n, mal) => {
      const cls = mal
        ? 'init-hero-ex__le-pop__gauge-label__val init-hero-ex__le-pop__gauge-label__val--mal'
        : 'init-hero-ex__le-pop__gauge-label__val'
      return `<span class="${cls}">${n}</span>`
    }
    if (maxOk && leV != null) {
      const f = dead ? 0 : Math.max(0, Math.min(1, leV / maxV))
      lePopLab50.innerHTML = `1/2 = ${valSpan(
        Math.round(maxV / 2),
        dead || leV * 2 < maxV
      )}`
      lePopLab33.innerHTML = `1/3 = ${valSpan(
        Math.round(maxV / 3),
        dead || f < 1 / 3
      )}`
      lePopLab25.innerHTML = `1/4 = ${valSpan(
        Math.round(maxV / 4),
        dead || f < 0.25
      )}`
    } else if (maxOk) {
      const n2 = Math.round(maxV / 2)
      const n3 = Math.round(maxV / 3)
      const n4 = Math.round(maxV / 4)
      lePopLab50.textContent = `1/2 = ${n2}`
      lePopLab33.textContent = `1/3 = ${n3}`
      lePopLab25.textContent = `1/4 = ${n4}`
    } else {
      lePopLab50.textContent = '1/2 = —'
      lePopLab33.textContent = '1/3 = —'
      lePopLab25.textContent = '1/4 = —'
    }

    if (customLeThreshold != null && maxV != null && maxV > customLeThreshold) {
      const pct = (customLeThreshold / maxV) * 100
      lePopLineLe5.style.display = ''
      lePopLineLe5.style.bottom = pct.toFixed(3) + '%'
      lePopLabLe5.style.display = ''
      lePopConnLe5.style.display = ''
      setConnPath(lePopConnLe5, pct, SLOT_Y_LE5, KINK_LE5, END_X)
      const malLe5 = leV != null && (dead || leV <= customLeThreshold)
      if (malLe5) {
        lePopLabLe5.innerHTML =
          `<span class="init-hero-ex__le-pop__gauge-label__val init-hero-ex__le-pop__gauge-label__val--mal">${customLeThreshold}</span>`
      } else {
        lePopLabLe5.textContent = String(customLeThreshold)
      }
    } else {
      lePopLineLe5.style.display = 'none'
      lePopLabLe5.style.display = 'none'
      lePopConnLe5.style.display = 'none'
    }
    if (maxV != null && maxV > 0 && maxV > unfaehigThreshold) {
      const pctUnf = (unfaehigThreshold / maxV) * 100
      lePopLineUnf.style.display = ''
      lePopLineUnf.style.bottom = pctUnf.toFixed(3) + '%'
      lePopLabUnf.style.display = ''
      lePopConnUnf.style.display = ''
      setConnPath(lePopConnUnf, pctUnf, SLOT_Y_UNFAEHIG, KINK_UNFAEHIG, END_X)
      const malUnf = leV != null && (dead || leV <= unfaehigThreshold)
      if (malUnf) {
        lePopLabUnf.innerHTML =
          `unfähig ≤ <span class="init-hero-ex__le-pop__gauge-label__val init-hero-ex__le-pop__gauge-label__val--mal">${unfaehigThreshold}</span>`
      } else {
        lePopLabUnf.textContent = `unfähig ≤ ${unfaehigThreshold}`
      }
    } else {
      lePopLineUnf.style.display = 'none'
      lePopLabUnf.style.display = 'none'
      lePopConnUnf.style.display = 'none'
    }
  }

  /** @type {((e: MouseEvent) => void) | null} */
  let lePopOutsideHandler = null
  /** @type {((e: KeyboardEvent) => void) | null} */
  let lePopKeyHandler = null

  const positionLePopover = () => {
    if (!lePop.isConnected) return
    const rootR = root.getBoundingClientRect()
    const ibR = ibChain.getBoundingClientRect()
    /* V359: rechte Kante = rechte Kante des gold umrahmten TP/TZ-Inputs-Blocks
       (untere Heldenblock-Zeile mit Trefferzonen), nicht mehr bis F/Frontal. */
    const spR = spTzInputRow.getBoundingClientRect()
    const frR = frontalLbl.getBoundingClientRect()
    const right = spR.right
    const bottom = Math.max(spR.bottom, frR.bottom)
    const baseLeft = Math.max(0, ibR.left - rootR.left)
    const top = Math.max(0, ibR.top - rootR.top)
    const popWScale = (() => {
      const v = parseFloat(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--init-hero-le-pop-width-scale')
          .trim()
      )
      return Number.isFinite(v) && v > 0 ? v : 1.48
    })()
    const baseW = Math.max(96, (right - ibR.left) * 0.8)
    const width = baseW * popWScale
    const extraW = Math.max(0, width - baseW)
    const leftShift = Math.min(10, extraW * 0.22)
    const left = Math.max(0, baseLeft - leftShift)
    const height = Math.max(80, bottom - ibR.top)
    lePop.style.left = `${Math.round(left * 1000) / 1000}px`
    lePop.style.top = `${Math.round(top * 1000) / 1000}px`
    lePop.style.width = `${Math.round(width * 1000) / 1000}px`
    lePop.style.height = `${Math.round(height * 1000) / 1000}px`
  }

  const closeLePopover = () => {
    if (!lePop.isConnected) return
    /* Wie Blur auf dem Haupt-LE: ausstehende Werte in die Szene schreiben.
       Solange das Overlay offen ist, blockiert liveInputs die 2-Zeichen-Persistenz
       (Remount-Risiko) — beim Schließen explizit committen. */
    runSilentLeOverlaySync({ usePreview: true, commitAfter: true })
    lePop.remove()
    leThreshCell.classList.remove('init-hero-ex__le-threshold--open')
    if (lePopOutsideHandler) {
      document.removeEventListener('mousedown', lePopOutsideHandler, true)
      lePopOutsideHandler = null
    }
    if (lePopKeyHandler) {
      document.removeEventListener('keydown', lePopKeyHandler, true)
      lePopKeyHandler = null
    }
  }

  const openLePopover = () => {
    if (lePop.isConnected) {
      closeLePopover()
      return
    }
    root.appendChild(lePop)
    leThreshCell.classList.add('init-hero-ex__le-threshold--open')
    positionLePopover()
    updateLePopover()
    /* Close on outside click (in der ausklappbaren Fläche) */
    lePopOutsideHandler = (e) => {
      const tgt = e.target
      if (lePop.contains(tgt)) return
      if (leThreshCell.contains(tgt)) return
      closeLePopover()
    }
    document.addEventListener('mousedown', lePopOutsideHandler, true)
    lePopKeyHandler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeLePopover()
      }
    }
    document.addEventListener('keydown', lePopKeyHandler, true)
  }

  lePopClose.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    closeLePopover()
  })

  const toggleLePopoverFromClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (lePop.isConnected) closeLePopover()
    else openLePopover()
  }
  leThreshBox.addEventListener('click', toggleLePopoverFromClick)
  leThreshAbbr.style.cursor = 'pointer'
  leThreshAbbr.addEventListener('click', toggleLePopoverFromClick)

  leInp.addEventListener('input', updateLePopover)
  leMaxInp.addEventListener('input', updateLePopover)
  koAttr.inp.addEventListener('input', updateLePopover)

  zoneMidRow.append(spTzPair)
  attrKoTpWrap.append(ws.cell, leChain, leThreshCell)

  stripInner.append(
    at.cell,
    pa.cell,
    ausw.cell,
    tpCell,
    fk.cell,
    gs.cell,
    ae.cell,
    ibChain
  )
  if (modIbCol) {
    strip.appendChild(modStrip)
  }

  /* Mod-Bar nur Lesemodus (Chip-Streifen); Bearbeitung: Strip unter MOD-Spalte im Strip. */

  /* Mini-Popover: Mod-Buendel (mehrere Zeilen), Kopf MOD + Bezeichnung. */
  const modPop = document.createElement('div')
  modPop.className = 'init-hero-ex__mod-pop'
  modPop.setAttribute('role', 'dialog')
  modPop.setAttribute('aria-label', 'Modifikator anlegen')
  modPop.setAttribute('aria-modal', 'false')
  modPop.style.display = 'none'

  const modDurTooltipPermanentHint =
    ' Leer lassen = dauerhaft (Permanent), bis der Mod im Strip entfernt wird.'

  const modPopCancel = document.createElement('button')
  modPopCancel.type = 'button'
  modPopCancel.className =
    'init-hero-ex__mod-pop__cancel init-hero-ex__mod-pop__cancel--floating'
  modPopCancel.textContent = '\u00D7'
  modPopCancel.title = 'Abbrechen'
  modPopCancel.setAttribute('aria-label', 'Abbrechen')

  const modPopHeadRow = document.createElement('div')
  modPopHeadRow.className = 'init-hero-ex__mod-pop__head'
  const modPopHeadTop = document.createElement('div')
  modPopHeadTop.className = 'init-hero-ex__mod-pop__head-top'
  const modPopHeadMod = document.createElement('span')
  modPopHeadMod.className = 'init-hero-ex__mod-pop__head-mod'
  modPopHeadMod.textContent = 'MOD'
  const modPopLabelWrap = document.createElement('label')
  modPopLabelWrap.className = 'init-hero-ex__mod-pop__head-bez'
  const modPopLabelLbl = document.createElement('span')
  modPopLabelLbl.textContent = 'Name:'
  modPopLabelLbl.title = 'Optionaler Name fuer dieses Mod-Paket'
  const modPopLabel = document.createElement('input')
  modPopLabel.type = 'text'
  modPopLabel.maxLength = MAX_MOD_LABEL_LEN
  modPopLabel.className =
    'init-hero-ex__mod-pop__inp init-hero-ex__mod-pop__inp--text init-hero-ex__mod-pop__inp--bez20'
  modPopLabel.placeholder = 'optional'
  modPopLabel.autocomplete = 'off'
  modPopLabel.spellcheck = false
  modPopLabel.title = `Name (max. ${MAX_MOD_LABEL_LEN} Zeichen)`
  modPopLabel.setAttribute('aria-label', 'Mod-Name')
  modPopLabelWrap.append(modPopLabelLbl, modPopLabel)

  const modPopColorWrap = document.createElement('div')
  modPopColorWrap.className = 'init-hero-ex__mod-pop__chip-colors'
  modPopColorWrap.setAttribute('role', 'group')
  modPopColorWrap.setAttribute('aria-label', 'Kartenfarbe')
  const modPopColorRow = document.createElement('div')
  modPopColorRow.className = 'init-hero-ex__mod-pop__chip-colors-row'
  const modPopColorStd = document.createElement('button')
  modPopColorStd.type = 'button'
  modPopColorStd.className =
    'init-hero-ex__mod-pop__chip-swatch init-hero-ex__mod-pop__chip-swatch--std'
  modPopColorStd.textContent = '\u2014'
  modPopColorStd.title = 'Standard (keine Kartenfarbe)'
  modPopColorStd.setAttribute('aria-label', 'Mod-Karte: Standardfarbe')
  /** @type {{ btn: HTMLButtonElement, id: string }[]} */
  const modPopColorSwatches = []
  for (const ent of MOD_CHIP_PALETTE) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `init-hero-ex__mod-pop__chip-swatch init-hero-ex__mod-pop__chip-swatch--pal-${ent.id}`
    b.title = ent.label
    b.setAttribute('aria-label', `Mod-Karte: ${ent.label}`)
    b.dataset.chipColorId = ent.id
    modPopColorSwatches.push({ btn: b, id: ent.id })
  }
  modPopColorRow.append(modPopColorStd, ...modPopColorSwatches.map((x) => x.btn))
  modPopColorWrap.append(modPopColorRow)

  /** @type {string | null} Auswahl im Overlay; null = keine chipColor in Meta. */
  let modPopChipColorId = null

  const syncModPopChipColorUi = () => {
    modPopColorStd.setAttribute(
      'aria-pressed',
      modPopChipColorId === null ? 'true' : 'false'
    )
    for (const { btn, id } of modPopColorSwatches) {
      btn.setAttribute('aria-pressed', modPopChipColorId === id ? 'true' : 'false')
    }
  }

  modPopColorStd.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    modPopChipColorId = null
    syncModPopChipColorUi()
  })
  for (const { btn, id } of modPopColorSwatches) {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      modPopChipColorId = id
      syncModPopChipColorUi()
    })
  }
  syncModPopChipColorUi()

  const modPopOk = document.createElement('button')
  modPopOk.type = 'button'
  modPopOk.className =
    'init-hero-ex__mod-pop__ok init-hero-ex__mod-pop__ok--head'
  modPopOk.textContent = 'Anlegen'
  modPopOk.title = 'Alle Zeilen als Modifikator(en) anlegen'

  modPopHeadTop.append(modPopHeadMod, modPopLabelWrap, modPopColorWrap, modPopOk)
  modPopHeadRow.append(modPopHeadTop)

  const modPopRowsWrap = document.createElement('div')
  modPopRowsWrap.className = 'init-hero-ex__mod-pop__rows'
  const modPopRowsScroll = document.createElement('div')
  modPopRowsScroll.className = 'init-hero-ex__mod-pop__scroll'
  modPopRowsScroll.appendChild(modPopRowsWrap)

  modPop.append(modPopCancel, modPopHeadRow, modPopRowsScroll)

  /* Mod-Popover: Felddropdown nach Kategorien (Werte / Eigenschaften / Rüstung). */
  const modPopAttrIds = new Set([
    'mu',
    'kl',
    'inn',
    'ch',
    'ff',
    'ge',
    'kk',
    'ko',
  ])
  const modPopZoneIds = new Set(HIT_ZONE_MOD_FIELD_IDS)
  const modFieldsWerte = MOD_FIELDS.filter(
    (f) => !modPopAttrIds.has(f) && !modPopZoneIds.has(f)
  )
  const modFieldsEigenschaften = [
    'mu',
    'kl',
    'inn',
    'ch',
    'ff',
    'ge',
    'kk',
    'ko',
  ].filter((f) => MOD_FIELDS.includes(f))

  root.append(leadSpacer, strip, zoneMidRow, bottomStrip, spacerExp)
  /*
   * modPop nicht unter .init-hero-ex haengen: als Geschwister von root
   * unter container (position: relative), sonst stoeren sie das CSS-Grid und
   * koennen das Aufklappen der Zeile blockieren.
   */
  container.appendChild(root)
  container.appendChild(modPop)

  /* Mod-Mapping (Feld -> { cell, inp, ab }) fuer Highlight + Sub-Badge. */
  /** @type {Record<string, { cell: HTMLElement, inp: HTMLInputElement | null, ab: HTMLElement | null }>} */
  const modFieldTargets = {
    mu: { cell: mu.cell, inp: mu.inp, ab: mu.ab },
    kl: { cell: kl.cell, inp: kl.inp, ab: kl.ab },
    inn: { cell: inn.cell, inp: inn.inp, ab: inn.ab },
    ch: { cell: ch.cell, inp: ch.inp, ab: ch.ab },
    ff: { cell: ff.cell, inp: ff.inp, ab: ff.ab },
    ge: { cell: ge.cell, inp: ge.inp, ab: ge.ab },
    ko: { cell: koAttr.cell, inp: koAttr.inp, ab: koAttr.ab },
    kk: { cell: kk.cell, inp: kk.inp, ab: kk.ab },
    at: { cell: at.cell, inp: at.inp, ab: at.ab },
    pa: { cell: pa.cell, inp: pa.inp, ab: pa.ab },
    a: { cell: ausw.cell, inp: ausw.inp, ab: ausw.ab },
    fk: { cell: fk.cell, inp: fk.inp, ab: fk.ab },
    gs: { cell: gs.cell, inp: gs.inp, ab: gs.ab },
    ae: { cell: ae.cell, inp: ae.inp, ab: ae.ab },
    le: { cell: stackLe, inp: leInp, ab: leAbbrLE },
    leMax: { cell: stackLeMax, inp: leMaxInp, ab: leAbbrMax },
    tp: { cell: tpCell, inp: tpInp, ab: tpAbbr },
    ws: { cell: ws.cell, inp: ws.inp, ab: ws.ab },
    ib: { cell: stackIb, inp: ibInp, ab: ibAbbrLabel },
    be: { cell: stackBe, inp: beInp, ab: ibBeLbl },
  }
  for (const ui of zoneUiMid) {
    const abEl = ui.cell.querySelector(':scope > .init-hero-ex__abbr')
    modFieldTargets[ui.zoneId] = {
      cell: ui.cell,
      inp: ui.rsInp,
      ab: abEl instanceof HTMLElement ? abEl : null,
    }
  }

  /* Cells / Buttons als Klick-Anker im Mod-Pick-Modus markieren. */
  for (const [field, t] of Object.entries(modFieldTargets)) {
    const anchor = t.cell
    if (!anchor) continue
    anchor.classList.add('init-hero-ex__mod-anchor')
    anchor.dataset.modField = field
  }

  /** Fester Mindestplatz unter Wertkästchen: Mod-Badge oder leer, damit Zeilen nicht springen. */
  for (const t of Object.values(modFieldTargets)) {
    const c = t.cell
    if (!c) continue
    if (c.querySelector(':scope > .init-hero-ex__mod-sub-slot')) continue
    const sub = document.createElement('span')
    sub.className = 'init-hero-ex__mod-sub-slot'
    sub.setAttribute('aria-hidden', 'true')
    c.appendChild(sub)
  }
  if (!w6Col.querySelector(':scope > .init-hero-ex__mod-sub-slot')) {
    const w6sub = document.createElement('span')
    w6sub.className = 'init-hero-ex__mod-sub-slot'
    w6sub.setAttribute('aria-hidden', 'true')
    w6Col.appendChild(w6sub)
  }
  if (!iniIbCol.querySelector(':scope > .init-hero-ex__mod-sub-slot')) {
    const iniSub = document.createElement('span')
    iniSub.className = 'init-hero-ex__mod-sub-slot'
    iniSub.setAttribute('aria-hidden', 'true')
    iniIbCol.appendChild(iniSub)
  }
  if (
    modIbCol &&
    !modIbCol.querySelector(':scope > .init-hero-ex__mod-sub-slot')
  ) {
    const modSub = document.createElement('span')
    modSub.className = 'init-hero-ex__mod-sub-slot'
    modSub.setAttribute('aria-hidden', 'true')
    modIbCol.appendChild(modSub)
  }
  buildMergedStressHighlightTargets = () => {
    const merged = { ...penaltyHighlightTargets }
    for (const [field, t] of Object.entries(modFieldTargets)) {
      if (merged[field] === undefined) merged[field] = t
    }
    return merged
  }

  /* Hero-Block + INI-Anker bekommen im Pick-Modus pointer-events neu verteilt
     (CSS); dazu ist nur ein Klick-Listener am Root noetig (Delegation). */

  /* Mod-Pick-Modus ueberlebt re-mounts via container.dataset (das Container-
     Element bleibt zwischen Renders bestehen, das Innen-DOM wird ausgetauscht). */
  let modPickActive = (() => {
    try {
      return contAny?.dataset?.modPickActive === '1'
    } catch {
      return false
    }
  })()
  let modPopAnchorEl = null
  let modPopOutsideHandler = null
  let modPopKeyHandler = null
  /** @type {null | { kind: 'single', modId: string } | { kind: 'bundle', bundleId: string } | { kind: 'multi', modIds: string[] }} */
  let modPopEditPlan = null

  const closeModPopover = () => {
    if (modPop.style.display === 'none') return
    modPop.style.display = 'none'
    modPop.style.width = ''
    modPopEditPlan = null
    modPopAnchorEl = null
    if (modPopOutsideHandler) {
      document.removeEventListener('mousedown', modPopOutsideHandler, true)
      modPopOutsideHandler = null
    }
    if (modPopKeyHandler) {
      document.removeEventListener('keydown', modPopKeyHandler, true)
      modPopKeyHandler = null
    }
  }

  let modPopRowSeq = 0

  const syncDurUiRow = (durInp, accA, accR) => {
    const acc = accR.checked ? 'round' : accA.checked ? 'action' : 'none'
    const base =
      acc === 'round'
        ? 'Dauer in Kampfrunden (1\u201399).'
        : 'Dauer in Aktionen (1\u201399; Helden-Turn und Phasen-Offset wie L.H.).'
    durInp.title = base + modDurTooltipPermanentHint
  }

  /**
   * @param {string | null} initialField — Startfeld (Anker) oder leer
   * @param {Record<string, unknown> | null} [prefillMod] — gespeicherter Mod (Feld, Delta, Dauer …)
   */
  const createModValueRow = (initialField, prefillMod = null) => {
    modPopRowSeq += 1

    const row = document.createElement('div')
    row.className =
      'init-hero-ex__mod-pop__field-row init-hero-ex__mod-pop__field-row--value'

    const inner = document.createElement('div')
    inner.className = 'init-hero-ex__mod-pop__field-row-inner'

    const pillSlot = document.createElement('div')
    pillSlot.className =
      'init-hero-ex__mod-pop__pill-slot init-hero-ex__mod-pop__pill-slot--half'

    const sel = document.createElement('select')
    sel.className =
      'init-hero-ex__mod-pop__sel init-hero-ex__mod-pop__sel--uniform'
    sel.setAttribute('aria-label', 'Mod-Ziel-Feld')
    const opt0 = document.createElement('option')
    opt0.value = ''
    opt0.textContent = 'Feld\u2026'
    sel.appendChild(opt0)
    const mkOptGroup = (label, fieldIds) => {
      const og = document.createElement('optgroup')
      og.label = label
      for (const f of fieldIds) {
        const o = document.createElement('option')
        o.value = f
        o.textContent = MOD_FIELD_LABEL[f] || f
        og.appendChild(o)
      }
      if (og.childElementCount > 0) sel.appendChild(og)
    }
    mkOptGroup('Werte', modFieldsWerte)
    mkOptGroup('Eigenschaften', modFieldsEigenschaften)
    mkOptGroup('R\u00FCstung', [...HIT_ZONE_MOD_FIELD_IDS])
    const preField =
      prefillMod &&
      typeof prefillMod.field === 'string' &&
      MOD_FIELDS.includes(/** @type {any} */ (prefillMod.field))
        ? prefillMod.field
        : null
    const pickField =
      preField ||
      (initialField && MOD_FIELDS.includes(/** @type {any} */ (initialField))
        ? initialField
        : null)
    if (pickField) {
      sel.value = pickField
      row.dataset.modField = pickField
    } else {
      row.dataset.modField = ''
    }
    sel.addEventListener('change', () => {
      row.dataset.modField = sel.value
    })
    pillSlot.appendChild(sel)

    const modPopDeltaWrap = document.createElement('label')
    modPopDeltaWrap.className =
      'init-hero-ex__mod-pop__field init-hero-ex__mod-pop__field--inrow'
    const modPopDeltaLbl = document.createElement('span')
    modPopDeltaLbl.textContent = '\u00B1'
    modPopDeltaLbl.title = 'Delta (z. B. +2 oder -3)'
    const modPopDelta = document.createElement('input')
    modPopDelta.type = 'text'
    modPopDelta.inputMode = 'numeric'
    modPopDelta.maxLength = 4
    modPopDelta.className =
      'init-hero-ex__mod-pop__inp init-hero-ex__mod-pop__inp--num init-hero-ex__mod-pop__inp--num-delta'
    modPopDelta.placeholder = '\u00B1x'
    modPopDelta.title = 'Delta (signiert), -99 bis +99'
    modPopDelta.setAttribute('aria-label', 'Delta')
    modPopDeltaWrap.append(modPopDeltaLbl, modPopDelta)

    const modPopDurWrap = document.createElement('label')
    modPopDurWrap.className =
      'init-hero-ex__mod-pop__field init-hero-ex__mod-pop__field--inrow init-hero-ex__mod-pop__field--dur'
    const labFuer = document.createElement('span')
    labFuer.className = 'init-hero-ex__mod-pop__dur-fuer'
    labFuer.textContent = 'für'
    const modPopDur = document.createElement('input')
    modPopDur.type = 'text'
    modPopDur.inputMode = 'numeric'
    modPopDur.maxLength = 2
    modPopDur.className =
      'init-hero-ex__mod-pop__inp init-hero-ex__mod-pop__inp--num init-hero-ex__mod-pop__inp--num-dur'
    modPopDur.placeholder = 'N'
    modPopDur.title =
      'Dauer in Aktionen (1\u201399). Helden-Turn und Phasen-Offset wie L.H.' +
      modDurTooltipPermanentHint
    modPopDur.setAttribute(
      'aria-label',
      'Dauer in Aktionen; leer für dauerhaften Mod bis zur manuellen Entfernung'
    )
    const labAktionen = document.createElement('span')
    labAktionen.className = 'init-hero-ex__mod-pop__dur-akt'
    labAktionen.textContent = 'Aktion(en)'
    modPopDurWrap.append(labFuer, modPopDur, labAktionen)

    const modPopAccField = document.createElement('div')
    modPopAccField.className = 'init-hero-ex__mod-pop__acc-inline'
    modPopAccField.setAttribute('role', 'group')
    modPopAccField.setAttribute('aria-label', 'Akkumulation')
    const accHint = document.createElement('span')
    accHint.className = 'init-hero-ex__mod-pop__acc-hint'
    accHint.textContent = 'immer jede'
    accHint.title =
      'Ohne Haken: fester Mod-Wert über die gewählte Dauer (nicht pro Aktion/KR aufsummiert).'
    const modPopAccAction = document.createElement('input')
    modPopAccAction.type = 'checkbox'
    modPopAccAction.className =
      'init-hero-ex__mod-pop__acc-chk init-hero-ex__mod-pop__acc-action'
    modPopAccAction.value = 'action'
    const labAct = document.createElement('label')
    labAct.className =
      'init-hero-ex__mod-pop__radio-lab init-hero-ex__mod-pop__radio-lab--inline init-hero-ex__mod-pop__acc-chk-lab'
    labAct.title = 'Pro Helden-Aktion (INI-Schritt): Wert addiert pro Tick'
    labAct.append(modPopAccAction, document.createTextNode(' Aktion'))
    const modPopAccRound = document.createElement('input')
    modPopAccRound.type = 'checkbox'
    modPopAccRound.className =
      'init-hero-ex__mod-pop__acc-chk init-hero-ex__mod-pop__acc-round'
    modPopAccRound.value = 'round'
    const labKr = document.createElement('label')
    labKr.className =
      'init-hero-ex__mod-pop__radio-lab init-hero-ex__mod-pop__radio-lab--inline init-hero-ex__mod-pop__acc-chk-lab'
    labKr.title = 'Pro Kampfrunde: Wert addiert je KR'
    labKr.append(modPopAccRound, document.createTextNode(' KR'))
    modPopAccField.append(accHint, labAct, labKr)

    const syncThisRowDur = () =>
      syncDurUiRow(modPopDur, modPopAccAction, modPopAccRound)
    const onAccToggle = () => {
      syncThisRowDur()
    }
    modPopAccAction.addEventListener('change', () => {
      if (modPopAccAction.checked) modPopAccRound.checked = false
      onAccToggle()
    })
    modPopAccRound.addEventListener('change', () => {
      if (modPopAccRound.checked) modPopAccAction.checked = false
      onAccToggle()
    })
    syncThisRowDur()

    if (prefillMod) {
      const dRaw = Number(prefillMod.delta)
      if (Number.isFinite(dRaw) && dRaw !== 0) {
        modPopDelta.value = dRaw > 0 ? `+${dRaw}` : String(dRaw)
      }
      const perm = prefillMod.permanent === true
      if (perm) {
        modPopDur.value = ''
      } else {
        const durN = Math.max(1, Math.floor(Number(prefillMod.duration)) || 1)
        modPopDur.value = String(durN)
      }
      const accRaw = String(prefillMod.accrual ?? 'none').toLowerCase()
      modPopAccAction.checked = accRaw === 'action'
      modPopAccRound.checked = accRaw === 'round'
      if (modPopAccRound.checked) modPopAccAction.checked = false
      if (modPopAccAction.checked) modPopAccRound.checked = false
      syncThisRowDur()
    }

    const rowX = document.createElement('button')
    rowX.type = 'button'
    rowX.className = 'init-hero-ex__mod-pop__row-x'
    rowX.textContent = '\u00D7'
    rowX.title = 'Zeile entfernen'
    rowX.setAttribute('aria-label', 'Zeile entfernen')
    rowX.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const n = modPopRowsWrap.querySelectorAll(
        ':scope > .init-hero-ex__mod-pop__field-row--value'
      ).length
      if (n <= 1) {
        closeModPopover()
        return
      }
      row.remove()
    })

    inner.append(
      pillSlot,
      modPopDeltaWrap,
      modPopDurWrap,
      modPopAccField,
      rowX
    )
    row.appendChild(inner)

    return {
      row,
      focusDelta: () => {
        modPopDelta.focus({ preventScroll: true })
        modPopDelta.select()
      },
      focusSelect: () => {
        sel.focus({ preventScroll: true })
      },
    }
  }

  const createAddRow = () => {
    const row = document.createElement('div')
    row.className = 'init-hero-ex__mod-pop__add-row'
    const inner = document.createElement('div')
    inner.className = 'init-hero-ex__mod-pop__add-row-inner'
    const pad = document.createElement('div')
    pad.className =
      'init-hero-ex__mod-pop__pill-slot init-hero-ex__mod-pop__pill-slot--add init-hero-ex__mod-pop__pill-slot--half'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'init-hero-ex__mod-pop__add-btn'
    btn.title = 'Weiteres Feld hinzufuegen'
    btn.setAttribute('aria-label', 'Weiteres Feld hinzufuegen')
    btn.textContent = '+'
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const nr = createModValueRow(null)
      modPopRowsWrap.insertBefore(nr.row, row)
      nr.focusSelect()
    })
    pad.appendChild(btn)
    inner.appendChild(pad)
    row.appendChild(inner)
    return row
  }

  /** Horizontale Ausrichtung wie AT-Spalte; vertikal oben am Heldenblock (bezogen auf container). */
  const positionModPopover = (layoutAnchorCell) => {
    modPop.style.display = ''
    modPop.style.width = ''
    const cRect = container.getBoundingClientRect()
    const rRect = root.getBoundingClientRect()
    const aRect = layoutAnchorCell.getBoundingClientRect()
    const pad = 4
    modPop.style.top = `${rRect.top - cRect.top + pad}px`
    let offsetLeft = Math.max(pad, aRect.left - cRect.left - pad)
    modPop.style.left = `${offsetLeft}px`
    requestAnimationFrame(() => {
      const popRect = modPop.getBoundingClientRect()
      const overflowR = popRect.right - rRect.right
      if (overflowR > 0) {
        offsetLeft = Math.max(2, offsetLeft - overflowR - 4)
        modPop.style.left = `${offsetLeft}px`
      }
    })
  }

  const attachModPopoverDismissHandlers = () => {
    modPopOutsideHandler = (e) => {
      const tgt = e.target
      if (modPop.contains(tgt)) return
      if (modPopAnchorEl && modPopAnchorEl.contains(tgt)) return
      closeModPopover()
    }
    document.addEventListener('mousedown', modPopOutsideHandler, true)
    modPopKeyHandler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeModPopover()
      }
    }
    document.addEventListener('keydown', modPopKeyHandler, true)
  }

  const openModPopoverFor = (field) => {
    const t = modFieldTargets[field]
    if (!t || !t.cell) return
    closeModPopover()
    modPopEditPlan = null
    modPopAnchorEl = t.cell
    modPopLabel.value = ''
    modPopChipColorId = null
    syncModPopChipColorUi()
    modPopRowSeq = 0
    modPopRowsWrap.replaceChildren()
    const first = createModValueRow(field)
    modPopRowsWrap.append(first.row, createAddRow())
    const atT = modFieldTargets.at
    const layoutCell = atT?.cell ?? t.cell
    positionModPopover(layoutCell)
    first.focusDelta()
    attachModPopoverDismissHandlers()
  }

  /**
   * Bearbeiten: Zeilen aus gespeicherten Mods; beim Submit erst entfernen, dann neu anlegen.
   * @param {unknown[]} mods — HeroExMod-Objekte (Reihenfolge wie Anzeige)
   * @param {{ kind: 'single', modId: string } | { kind: 'bundle', bundleId: string } | { kind: 'multi', modIds: string[] }} editPlan
   */
  const openModPopoverForEdit = (mods, editPlan) => {
    if (!mods?.length) return
    if (
      mods.some((m) =>
        String(m.bundleId ?? '').startsWith(AUTO_MOD_BUNDLE_PREFIX)
      )
    ) {
      return
    }
    setModPickMode(false)
    closeModPopover()
    const firstField = String(mods[0]?.field ?? '').trim()
    const t0 = modFieldTargets[firstField]
    const anchorCell = t0?.cell ?? modFieldTargets.at?.cell
    if (!anchorCell) return
    modPopEditPlan = editPlan
    modPopAnchorEl = anchorCell
    const labelFromMod = mods.find((x) => x?.label)?.label
    modPopLabel.value = typeof labelFromMod === 'string' ? labelFromMod : ''
    const chipFromMod = mods
      .map((m) => normalizeModChipColor(m?.chipColor))
      .find((c) => c != null)
    modPopChipColorId = chipFromMod ?? null
    syncModPopChipColorUi()
    modPopRowSeq = 0
    modPopRowsWrap.replaceChildren()
    /** @type {{ focusDelta: () => void }[]} */
    const rows = []
    for (const bm of mods) {
      const nr = createModValueRow(null, bm)
      rows.push(nr)
      modPopRowsWrap.appendChild(nr.row)
    }
    modPopRowsWrap.appendChild(createAddRow())
    const atT = modFieldTargets.at
    const layoutCell = atT?.cell ?? anchorCell
    positionModPopover(layoutCell)
    if (rows[0]) rows[0].focusDelta()
    attachModPopoverDismissHandlers()
  }

  const setModPickMode = (on) => {
    modPickActive = !!on
    root.classList.toggle('init-hero-ex--mod-pick', modPickActive)
    if (modToggleBtn) {
      modToggleBtn.classList.toggle('init-hero-ex__mod-toggle--on', modPickActive)
      modToggleBtn.setAttribute('aria-pressed', modPickActive ? 'true' : 'false')
    }
    try {
      contAny.dataset.modPickActive = modPickActive ? '1' : '0'
    } catch {
      /* ignore */
    }
    if (!modPickActive) closeModPopover()
  }
  /* Restore-After-Mount: wenn der Modus vor dem letzten Render aktiv war,
     visuelle Klassen + Toggle-Beschriftung wiederherstellen. */
  if (modPickActive && modToggleBtn) {
    root.classList.add('init-hero-ex--mod-pick')
    modToggleBtn.classList.add('init-hero-ex__mod-toggle--on')
    modToggleBtn.setAttribute('aria-pressed', 'true')
  }

  if (modToggleBtn) {
    modToggleBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setModPickMode(!modPickActive)
    })
  }

  /* Esc beendet Mod-Pick-Modus (auch wenn das Popover gerade nicht offen ist). */
  const modPickEscHandler = (e) => {
    if (e.key !== 'Escape') return
    if (!modPickActive) return
    if (modPop.style.display !== 'none') return
    e.stopPropagation()
    setModPickMode(false)
  }
  document.addEventListener('keydown', modPickEscHandler, true)
  /* Aufraeumen beim Re-Mount: vorherige Listener loesen sich beim Container-
     replaceChildren in der naechsten mountHeroExpandBlock-Run; document-Listener
     muessen wir trotzdem manuell entfernen, damit sie nicht akkumulieren. */
  if (typeof contAny.__v4ModPickEscClear === 'function') {
    contAny.__v4ModPickEscClear()
  }
  contAny.__v4ModPickEscClear = () => {
    document.removeEventListener('keydown', modPickEscHandler, true)
  }

  modPopCancel.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    closeModPopover()
  })

  /* Click-Delegation auf Mod-Anker. Nur aktiv im Pick-Modus. */
  root.addEventListener(
    'click',
    (e) => {
      if (!modPickActive) return
      const tgt = /** @type {HTMLElement} */ (e.target)
      if (!tgt) return
      if (modPop.contains(tgt)) return
      if (modToggleBtn?.contains(tgt)) return
      if (tgt.closest('.init-hero-ex__mod-badge')) return
      const anchor = tgt.closest('.init-hero-ex__mod-anchor')
      if (!anchor || !root.contains(anchor)) return
      const field = anchor instanceof HTMLElement ? anchor.dataset.modField : null
      if (!field || !modFieldTargets[field]) return
      e.preventDefault()
      e.stopPropagation()
      openModPopoverFor(field)
    },
    true
  )

  const parseSignedDeltaSafe = (raw) => {
    const t = String(raw ?? '')
      .trim()
      .replace(/^\+/, '')
    if (t === '' || t === '-' || t === '+') return null
    const n = parseInt(t, 10)
    if (!Number.isFinite(n)) return null
    return Math.min(99, Math.max(-99, n))
  }
  const parseDurationSafe = (raw) => {
    const t = String(raw ?? '').trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    if (!Number.isFinite(n) || n < 1) return null
    return Math.min(99, Math.max(1, n))
  }

  const submitMod = async () => {
    if (!modPopAnchorEl) return
    const valueRows = modPopRowsWrap.querySelectorAll(
      ':scope > .init-hero-ex__mod-pop__field-row--value'
    )
    if (valueRows.length === 0) return

    /** @type {{ field: string, delta: number, duration: number, permanent: boolean, accrual: 'none' | 'action' | 'round' }[]} */
    const specs = []
    for (const row of valueRows) {
      const rowEl = /** @type {HTMLElement} */ (row)
      let field = String(rowEl.dataset.modField || '').trim()
      if (!field) {
        const s = rowEl.querySelector('select.init-hero-ex__mod-pop__sel')
        if (s instanceof HTMLSelectElement) field = String(s.value || '').trim()
      }
      const dInp = rowEl.querySelector(
        'input.init-hero-ex__mod-pop__inp--num-delta'
      )
      const durInp = rowEl.querySelector('input.init-hero-ex__mod-pop__inp--num-dur')
      const accR = rowEl.querySelector('input.init-hero-ex__mod-pop__acc-round')
      const accA = rowEl.querySelector('input.init-hero-ex__mod-pop__acc-action')
      if (!(dInp instanceof HTMLInputElement) || !(durInp instanceof HTMLInputElement)) {
        continue
      }
      if (
        !(accR instanceof HTMLInputElement) ||
        !(accA instanceof HTMLInputElement)
      ) {
        continue
      }
      const accrual = accR.checked ? 'round' : accA.checked ? 'action' : 'none'
      const delta = parseSignedDeltaSafe(dInp.value)
      const durTrim = String(durInp.value ?? '').trim()
      const permanent = durTrim === ''
      const duration = permanent ? 1 : parseDurationSafe(durInp.value)
      if (!field) {
        const sel = rowEl.querySelector('select.init-hero-ex__mod-pop__sel')
        if (sel instanceof HTMLSelectElement) sel.focus({ preventScroll: true })
        return
      }
      if (delta === null) {
        dInp.focus({ preventScroll: true })
        dInp.select()
        return
      }
      if (!permanent && duration === null) {
        durInp.focus({ preventScroll: true })
        durInp.select()
        return
      }
      specs.push({
        field,
        delta,
        duration: /** @type {number} */ (duration),
        permanent,
        accrual,
      })
    }
    if (specs.length === 0) return

    const c = getCombat()
    const round =
      c?.started && Number.isFinite(Number(c.round)) ? Number(c.round) : 1
    const navIni = readCurrentNavIniGlobal()
    const labelNorm = normalizeModLabel(modPopLabel.value)
    /* Mehrere Zeilen = ein Buendel (gemeinsame bundleId); eine Zeile wie bisher ohne bundleId. */
    const bundleId = specs.length >= 2 ? generateModBundleId() : undefined
    const editPlanSnapshot = modPopEditPlan
    if (editPlanSnapshot?.kind === 'single') {
      await removeHeroExMod(itemId, editPlanSnapshot.modId)
    } else if (editPlanSnapshot?.kind === 'bundle') {
      await removeHeroExModsByBundleId(itemId, editPlanSnapshot.bundleId)
    } else if (editPlanSnapshot?.kind === 'multi') {
      for (const mid of editPlanSnapshot.modIds) {
        await removeHeroExMod(itemId, mid)
      }
    }

    const sceneItems = await OBR.scene.items.getItems([itemId])
    const fm = sceneItems?.[0]?.metadata?.[TRACKER_ITEM_META_KEY]
    const ownerIniFresh = fm ? readOwnerIniReferenceForMods(fm) : null
    let curSlots = 0
    if (fm && ownerIniFresh != null && Number.isFinite(ownerIniFresh)) {
      curSlots = countHeroModUiSlots(
        listActiveMods(fm, ownerIniFresh, round, navIni)
      )
    } else if (fm) {
      curSlots = countHeroModUiSlots(readHeroExMods(fm))
    }
    const addingSlots = bundleId ? 1 : specs.length
    if (curSlots + addingSlots > MAX_HERO_EX_MOD_UI_SLOTS) {
      window.alert(
        `Maximal ${MAX_HERO_EX_MOD_UI_SLOTS} Modifikationen gleichzeitig. Bitte erst eine entfernen oder ablaufen lassen.`
      )
      return
    }

    const submitChipColor = modPopChipColorId
    closeModPopover()
    for (const spec of specs) {
      await addHeroExMod(itemId, {
        field: spec.field,
        delta: spec.delta,
        duration: spec.duration,
        permanent: spec.permanent,
        accrual: spec.accrual,
        label: labelNorm,
        bundleId,
        currentRound: round,
        currentNavIni: navIni,
        ...(submitChipColor ? { chipColor: submitChipColor } : {}),
      })
    }
    await refreshAutoBundlesForItem(itemId)
    await refreshModStripFromScene()
  }

  modPopOk.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void submitMod()
  })
  modPop.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    if (e.target instanceof HTMLSelectElement) return
    if (e.target instanceof HTMLElement && e.target.closest('textarea')) return
    e.preventDefault()
    e.stopPropagation()
    void submitMod()
  })

  /** Dock unter MOD-Spalte: absolut im Strip (V652). */
  const syncModStripDockAndPad = () => {
    if (!modStrip.classList.contains('init-hero-ex__mods-strip--under-mod-btn')) {
      modStrip.style.removeProperty('left')
      modStrip.style.removeProperty('width')
      modStrip.style.removeProperty('top')
      modStrip.style.removeProperty('padding-left')
      modStrip.style.removeProperty('--init-hero-mod-strip-chip-h')
      root.style.removeProperty('--init-hero-mod-strip-chip-h')
      return
    }
    if (!modIbCol) {
      return
    }
    const sr = strip.getBoundingClientRect()
    const mr = modIbCol.getBoundingClientRect()
    const modShell = modIbCol.querySelector(
      ':scope > .init-hero-ex__ib-chain__inp-cell--mod-pick'
    )
    const anchor =
      modShell instanceof HTMLElement ? modShell.getBoundingClientRect() : mr
    if (modStrip.classList.contains('init-hero-ex__mods-strip--has')) {
      const colW = Math.max(1, Math.round(mr.width))
      modStrip.style.removeProperty('padding-left')
      modStrip.style.left = `${mr.left - sr.left}px`
      modStrip.style.width = `${colW}px`
      modStrip.style.top = `${anchor.bottom - sr.top}px`
      /* Unterkante Mod 4 = Unterkante F-Spalte: vier gleich hohe Karten im Abstand Mod-Zelle → F */
      const shellBottom = anchor.bottom
      const fRect = frontalCol.getBoundingClientRect()
      const fBottom = fRect.bottom
      const span = fBottom - shellBottom
      if (Number.isFinite(span) && span > 2) {
        const chipH = Math.max(8, Math.round(span / 4))
        modStrip.style.setProperty('--init-hero-mod-strip-chip-h', `${chipH}px`)
        root.style.setProperty('--init-hero-mod-strip-chip-h', `${chipH}px`)
      } else {
        modStrip.style.removeProperty('--init-hero-mod-strip-chip-h')
        root.style.removeProperty('--init-hero-mod-strip-chip-h')
      }
    } else {
      modStrip.style.removeProperty('left')
      modStrip.style.removeProperty('width')
      modStrip.style.removeProperty('top')
      modStrip.style.removeProperty('padding-left')
      modStrip.style.removeProperty('--init-hero-mod-strip-chip-h')
      root.style.removeProperty('--init-hero-mod-strip-chip-h')
    }
  }

  /** Unterrand-Reserve für absoluten Mod-Strip (ohne Layout-Klassenwechsel bei 7+). */
  const syncHeroModStripExpansion = (chipCount) => {
    root.style.removeProperty('--init-hero-ex-mod-strip-reserve')
    if (chipCount <= 4) return
    const v = 'var(--init-hero-mod-strip-chip-h, var(--init-hero-cell))'
    if (chipCount >= 7) {
      root.style.setProperty(
        '--init-hero-ex-mod-strip-reserve',
        `calc(2.5 * ${v})`
      )
    } else if (chipCount >= 6) {
      root.style.setProperty('--init-hero-ex-mod-strip-reserve', `calc(2 * ${v})`)
    } else {
      root.style.setProperty('--init-hero-ex-mod-strip-reserve', `calc(1 * ${v})`)
    }
  }

  stripInner.addEventListener(
    'scroll',
    () => {
      syncModStripDockAndPad()
    },
    { passive: true }
  )

  const MOD_VAL_TONE_SEP = 'init-hero-ex__micro--mod-val-separate'
  const MOD_VAL_TONE_POS = 'init-hero-ex__micro--mod-val-pos'
  const MOD_VAL_TONE_NEG = 'init-hero-ex__micro--mod-val-neg'
  const MOD_VAL_TONE_ZERO = 'init-hero-ex__micro--mod-val-zero'

  const stripMicroModTone = (inp) => {
    inp.classList.remove(
      MOD_VAL_TONE_SEP,
      MOD_VAL_TONE_POS,
      MOD_VAL_TONE_NEG,
      MOD_VAL_TONE_ZERO
    )
  }

  /** Durchgängig neutrale Klasse — Ziffernfarbe kommt aus CSS (schwarz). */
  const syncHeroMicroModDisplayTones = () => {
    for (const el of root.querySelectorAll('input.init-hero-ex__micro')) {
      if (!(el instanceof HTMLInputElement)) continue
      stripMicroModTone(el)
      el.classList.add(MOD_VAL_TONE_SEP)
    }
  }

  const syncModToggleUiFromMeta = (m) => {
    if (modToggleBtn) {
      modToggleBtn.classList.toggle(
        'init-hero-ex__mod-toggle--mod-display-integrated',
        readModDisplayMode(m) === 'integrated'
      )
    }
  }

  /* Render von Sub-Badges + Mod-Strip: beim Mount und nach Szene-Persistenz,
     damit neue Auto-Bündel (z. B. LE-Schwelle) ohne volllständigen Listen-Remount sichtbar sind. */
  const renderModBadgesAndStrip = (metaForMods = meta) => {
    const modMeta = metaForMods ?? meta
    syncModToggleUiFromMeta(modMeta)
    const c = getCombat()
    const round =
      c?.started && Number.isFinite(Number(c.round)) ? Number(c.round) : null
    const navIni = readCurrentNavIniGlobal()
    const lhMech = readLhMechanics(modMeta)
    const activeModsFull =
      ownerIniNum == null
        ? []
        : listActiveMods(modMeta, ownerIniNum, round, navIni)
    const openEditFromFieldMods = (fm, activeList) => {
      if (!canEdit || fm.length === 0) return
      const fmEditable = fm.filter(
        (m) => !String(m.bundleId ?? '').startsWith(AUTO_MOD_BUNDLE_PREFIX)
      )
      if (fmEditable.length === 0) return
      const bid = fmEditable[0].bundleId
      const allSameBundle =
        !!bid && fmEditable.every((m) => m.bundleId === bid)
      if (allSameBundle) {
        const bundleMods = activeList.filter((x) => x.bundleId === bid)
        openModPopoverForEdit(bundleMods, {
          kind: 'bundle',
          bundleId: String(bid),
        })
        return
      }
      if (fmEditable.length === 1) {
        openModPopoverForEdit(fmEditable, {
          kind: 'single',
          modId: fmEditable[0].id,
        })
        return
      }
      openModPopoverForEdit(fmEditable, {
        kind: 'multi',
        modIds: fmEditable.map((m) => m.id),
      })
    }

    const AUTO_LE_BAND_BUNDLE_ID = 'auto-le-band'
    const AUTO_LE_UNFAEHIG_BUNDLE_ID = 'auto-le-unfaehig'
    const AUTO_ZONE_BUNDLE_PREFIX = 'auto-zone-'
    const CHIP_NEG_LE_KO_RANGE = 1.6

    const parseMetaLeIntChip = (raw) => {
      const t = String(raw ?? '').trim()
      if (t === '') return null
      const n = parseInt(t, 10)
      return Number.isFinite(n) ? n : null
    }

    /** Mini-S-Kästchen (2:1) für LE-Automod: Anteil + Bandfarbe wie S-Feld. */
    const buildModChipLeRing = () => {
      const wrap = document.createElement('div')
      wrap.className = 'init-hero-ex__mod-chip-le-ring'
      wrap.title = LE_THRESHOLD_TOOLTIP
      const track = document.createElement('div')
      track.className = 'init-hero-ex__mod-chip-le-ring__track'
      track.setAttribute('aria-hidden', 'true')
      const slice = document.createElement('div')
      slice.className = 'init-hero-ex__mod-chip-le-ring__slice'
      slice.setAttribute('aria-hidden', 'true')
      wrap.append(track, slice)
      return wrap
    }

    const syncModChipLeRingTitle = (
      /** @type {HTMLElement} */ wrap,
      leV,
      maxV,
      negLe,
      dead
    ) => {
      let extra = ''
      if (negLe) extra = ' · aktuell LE<0'
      else if (dead) extra = ' · aktuell LE≤0'
      else if (leV != null && maxV != null && maxV > 0) {
        const band = leBand(leV, maxV, customLeThreshold)
        const frag = leBandLabelDe(band)
        if (frag) extra = ` · aktuell LE${frag}`
      }
      wrap.title = LE_THRESHOLD_TOOLTIP + extra
    }

    const syncModChipLeRing = (wrap, m) => {
      const snap = readHeroExpandSnapshot(m)
      const leV = parseMetaLeIntChip(snap.le)
      const maxV = parseMetaLeIntChip(snap.leMax)
      const koV = parseMetaLeIntChip(snap.ko)
      const slice = wrap.querySelector('.init-hero-ex__mod-chip-le-ring__slice')
      if (!(slice instanceof HTMLElement)) return

      const negLe =
        leV != null && leV <= 0 && koV != null && koV > 0
      const dead = leV != null && leV <= 0 && !negLe

      wrap.classList.toggle('init-hero-ex__mod-chip-le-ring--neg', negLe)

      wrap.style.removeProperty('--le-frac')
      wrap.style.removeProperty('--le-neg-frac')

      if (negLe) {
        const depth = /** @type {number} */ (-leV)
        const cap = CHIP_NEG_LE_KO_RANGE * /** @type {number} */ (koV)
        const hp = Math.min(1, depth / cap)
        wrap.style.setProperty('--le-neg-frac', String(hp))
        wrap.dataset.leBand = 'neg-le'
        syncModChipLeRingTitle(wrap, leV, maxV, true, false)
        return
      }

      if (dead) {
        wrap.style.setProperty('--le-frac', '0')
        wrap.dataset.leBand = 'crit'
        syncModChipLeRingTitle(wrap, leV, maxV, false, true)
        return
      }

      if (leV != null && maxV != null && maxV > 0) {
        const frac = Math.max(0, Math.min(1, leV / maxV))
        wrap.style.setProperty('--le-frac', String(frac))
        wrap.dataset.leBand = leBarColorBand(leV, maxV)
      } else {
        wrap.style.setProperty('--le-frac', '0')
        delete wrap.dataset.leBand
      }
      syncModChipLeRingTitle(wrap, leV, maxV, false, false)
    }

    /**
     * Kopf: Summen-Pfeil (+/−) links neben ×; eine Zeile: Bezeichnung oder Kurztext AT+1, …
     * @param {HTMLElement} strip
     * @param {{
     *   bundleId?: string,
     *   modField?: string,
     *   label: string | null | undefined,
     *   shortSummary: string,
     *   netSum: number,
     *   cardTitle: string,
     *   removeTitle: string,
     *   removeAria: string,
     *   isBundle?: boolean,
     *   isAutoBundle?: boolean,
     *   onRemove: () => void,
     *   onEditClick: () => void,
     *   onReadonlyClick?: () => void,
     *   chipColor?: string | null,
     * }} o
     */
    const mountModListChip = (stripEl, o) => {
      const chip = document.createElement('div')
      const bidStr = o.bundleId ? String(o.bundleId) : ''
      const autoCompactLabel =
        bidStr === AUTO_LE_BAND_BUNDLE_ID ||
        bidStr.startsWith(AUTO_ZONE_BUNDLE_PREFIX)
      const chipEditable = canEdit && !o.isAutoBundle

      chip.className = `init-hero-ex__mod-chip-card ${o.isBundle ? 'init-hero-ex__mod-chip-card--bundle' : ''} ${
        o.isAutoBundle ? 'init-hero-ex__mod-chip-card--auto ' : ''
      }${autoCompactLabel ? 'init-hero-ex__mod-chip-card--auto-compact-label ' : ''}${
        chipEditable
          ? 'init-hero-ex__mod-chip-card--editable'
          : 'init-hero-ex__mod-chip-card--readonly'
      }`
      if (bidStr === AUTO_LE_UNFAEHIG_BUNDLE_ID) {
        chip.classList.add('init-hero-ex__mod-chip-card--auto-unfaehig')
      }
      const palRaw = normalizeModChipColor(o.chipColor)
      const palId = o.isAutoBundle ? 'neutral' : palRaw
      if (palId) chip.classList.add(`init-hero-ex__mod-chip-card--pal-${palId}`)
      if (o.bundleId) chip.dataset.modBundleId = String(o.bundleId)
      if (o.modField) chip.dataset.modField = o.modField
      const labelTrim = String(o.label ?? '').trim()
      const sublineText = labelTrim || o.shortSummary
      const autoLongLabel =
        !!o.isAutoBundle &&
        (sublineText.includes('KO') || sublineText.length >= 9)
      if (autoLongLabel) chip.classList.add('init-hero-ex__mod-chip-card--long-label')

      const head = document.createElement('div')
      head.className = 'init-hero-ex__mod-chip-card__head'
      const headActions = document.createElement('div')
      headActions.className = 'init-hero-ex__mod-chip-card__head-actions'
      const useAutoZoneDots =
        o.isAutoBundle && bidStr.startsWith(AUTO_ZONE_BUNDLE_PREFIX)
      const useAutoLeRing =
        o.isAutoBundle && bidStr === AUTO_LE_BAND_BUNDLE_ID

      /** @type {HTMLElement} */
      let arrowWrap
      if (useAutoZoneDots) {
        const zoneId = bidStr.slice(AUTO_ZONE_BUNDLE_PREFIX.length)
        const hz = readHeroExpandSnapshot(modMeta).hitZones
        const w = clampWound(hz?.zones?.[zoneId]?.w ?? 0)
        arrowWrap = document.createElement('span')
        arrowWrap.className =
          'init-hero-ex__mod-chip-card__marks-slot init-hero-ex__mod-chip-card__wound-dots'
        arrowWrap.title = `${w} Wunde(n)`
        arrowWrap.setAttribute('aria-hidden', 'true')
        for (let i = 0; i < 3; i++) {
          const d = document.createElement('span')
          d.className = 'init-hero-ex__mod-chip-card__wound-dot'
          d.style.setProperty('--wound-dot-i', String(i))
          if (i >= w)
            d.classList.add('init-hero-ex__mod-chip-card__wound-dot--inactive')
          arrowWrap.appendChild(d)
        }
      } else if (useAutoLeRing) {
        arrowWrap = document.createElement('span')
        arrowWrap.className =
          'init-hero-ex__mod-chip-card__marks-slot init-hero-ex__mod-chip-card__marks-slot--le'
        arrowWrap.setAttribute('aria-hidden', 'true')
        const leInner = buildModChipLeRing()
        arrowWrap.appendChild(leInner)
        syncModChipLeRing(leInner, modMeta)
      } else {
        arrowWrap = document.createElement('span')
        const ns = o.netSum
        if (bidStr === AUTO_LE_UNFAEHIG_BUNDLE_ID) {
          const snapChip = readHeroExpandSnapshot(modMeta)
          const ufSrc = computeUnfaehigSources(snapChip, modMeta, {
            round,
            navIni,
          })
          const armOnly =
            !ufSrc.leTriggered &&
            !ufSrc.nonArm3w &&
            ufSrc.armSet.length > 0
          if (armOnly) {
            arrowWrap.className =
              'init-hero-ex__mod-chip-card__sum-arrow init-hero-ex__mod-chip-card__sum-arrow--unfaehig-arm'
            if (ufSrc.armSet.length >= 2) {
              arrowWrap.textContent = 'Arme'
              arrowWrap.title = 'Arme handlungsunfähig'
            } else if (ufSrc.armSet[0] === 'schildarm') {
              arrowWrap.textContent = 'LA'
              arrowWrap.title = 'Arm handlungsunfähig'
            } else {
              arrowWrap.textContent = 'RA'
              arrowWrap.title = 'Arm handlungsunfähig'
            }
          } else {
            arrowWrap.className =
              'init-hero-ex__mod-chip-card__sum-arrow init-hero-ex__mod-chip-card__sum-arrow--unfaehig'
            arrowWrap.innerHTML = SVG_MOD_CHIP_UNFAEHIG_MARK
            arrowWrap.title = 'kampfunfähig'
          }
        } else if (ns > 0) {
          arrowWrap.className =
            'init-hero-ex__mod-chip-card__sum-arrow init-hero-ex__mod-chip-card__sum-arrow--up'
          arrowWrap.innerHTML = SVG_MOD_CHIP_SUM_UP
          arrowWrap.title = 'Summe positiv'
        } else if (ns < 0) {
          arrowWrap.className =
            'init-hero-ex__mod-chip-card__sum-arrow init-hero-ex__mod-chip-card__sum-arrow--down'
          arrowWrap.innerHTML = SVG_MOD_CHIP_SUM_DOWN
          arrowWrap.title = 'Summe negativ'
        } else {
          arrowWrap.className =
            'init-hero-ex__mod-chip-card__sum-arrow init-hero-ex__mod-chip-card__sum-arrow--zero'
          arrowWrap.innerHTML = SVG_MOD_CHIP_SUM_UP
          arrowWrap.title = 'Summe ausgeglichen'
        }
        arrowWrap.setAttribute('aria-hidden', 'true')
      }

      const xBtn = document.createElement('button')
      xBtn.type = 'button'
      xBtn.className = 'init-hero-ex__mod-chip-card__x'
      xBtn.textContent = '\u00D7'
      xBtn.title = o.removeTitle
      xBtn.setAttribute('aria-label', o.removeAria)
      xBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!canEdit) return
        o.onRemove()
      })
      if (!canEdit) xBtn.style.display = 'none'
      headActions.append(arrowWrap, xBtn)
      head.appendChild(headActions)

      const labelLine = document.createElement('div')
      labelLine.className = 'init-hero-ex__mod-chip-card__label-line'
      labelLine.textContent = sublineText
      labelLine.title = o.cardTitle

      chip.appendChild(head)
      chip.appendChild(labelLine)

      chip.title = o.cardTitle
      chip.addEventListener('click', (e) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.closest('.init-hero-ex__mod-chip-card__x')
        ) {
          return
        }
        if (chipEditable) o.onEditClick()
        else o.onReadonlyClick?.()
      })

      stripEl.appendChild(chip)
    }
    /* Pro Feld: Sub-Badge entfernen + ggf. neu erstellen. */
    for (const [field, t] of Object.entries(modFieldTargets)) {
      const cell = t.cell
      if (!cell) continue
      const sub = cell.querySelector(':scope > .init-hero-ex__mod-sub-slot')
      if (sub) {
        sub.replaceChildren()
      } else {
        const old = cell.querySelector(':scope > .init-hero-ex__mod-badge')
        if (old) old.remove()
      }
      cell.classList.remove('init-hero-ex__mod-anchor--active')
      if (ownerIniNum == null) continue
      const sum = effectiveDeltaForField(
        modMeta,
        field,
        ownerIniNum,
        round,
        navIni
      )
      if (sum === 0) {
        continue
      }
      cell.classList.add('init-hero-ex__mod-anchor--active')
      const badge = document.createElement('span')
      badge.className = 'init-hero-ex__mod-badge'
      if (sum > 0) {
        badge.classList.add('init-hero-ex__mod-badge--pos')
      } else if (sum < 0) {
        badge.classList.add('init-hero-ex__mod-badge--neg')
      }
      const absSum = Math.abs(sum)
      const fieldMods = activeModsFull.filter((m) => m.field === field)
      const tightest =
        fieldMods.length > 0
          ? fieldMods.reduce((acc, m) => (m.remaining < acc.remaining ? m : acc))
          : null
      const tightFracRaw = tightest
        ? modNavCountdownLabelFromNav(
            tightest,
            ownerIniNum,
            lhMech,
            round,
            navIni
          )
        : ''
      const tightFrac = tightest?.permanent ? '' : tightFracRaw
      /* Hauptwert größer als Restlaufzeit; schmale Abstände um den Mittelpunkt. */
      const arrowSpan = document.createElement('span')
      arrowSpan.className = 'init-hero-ex__mod-badge__arrow'
      arrowSpan.setAttribute('aria-hidden', 'true')
      arrowSpan.innerHTML = sum > 0 ? SVG_HERO_MOD_TOGGLE_UP : SVG_HERO_MOD_TOGGLE_DOWN
      badge.appendChild(arrowSpan)
      const valSpan = document.createElement('span')
      valSpan.className = 'init-hero-ex__mod-badge__val'
      valSpan.textContent = String(absSum)
      badge.appendChild(valSpan)
      if (tightFrac) {
        const tailSpan = document.createElement('span')
        tailSpan.className = 'init-hero-ex__mod-badge__tail'
        tailSpan.textContent = `\u2009\u00B7\u2009${tightFrac}`
        badge.appendChild(tailSpan)
      }
      const nameOnce = fieldMods.find((m) => m.label)?.label
      const namePrefix = nameOnce ? `"${nameOnce}" — ` : ''
      const detail = fieldMods
        .map((m) => {
          const eff = modEffectiveContribution(
            m,
            ownerIniNum,
            round,
            navIni,
            lhMech
          )
          const frac = modNavFractionLabelFromNav(m, ownerIniNum, lhMech, round, navIni)
          return `${eff > 0 ? '+' : ''}${eff} (${frac})`
        })
        .join(' \u00B7 ')
      badge.title = `${namePrefix}Modifikator ${sum > 0 ? '+' : ''}${sum} auf ${MOD_FIELD_LABEL[field] || field.toUpperCase()}${detail ? `: ${detail}` : ''}`
      const fieldModsAutoOnly =
        fieldMods.length > 0 &&
        fieldMods.every((m) =>
          String(m.bundleId ?? '').startsWith(AUTO_MOD_BUNDLE_PREFIX)
        )
      const fieldModsHasManual = fieldMods.some(
        (m) => !String(m.bundleId ?? '').startsWith(AUTO_MOD_BUNDLE_PREFIX)
      )
      if (canEdit && fieldModsHasManual) {
        badge.classList.add('init-hero-ex__mod-badge--editable')
        badge.title += ' \u00B7 Zum Bearbeiten anklicken'
        badge.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          openEditFromFieldMods(fieldMods, activeModsFull)
        })
      } else if (canEdit && fieldModsAutoOnly) {
        badge.title +=
          ' \u00B7 Automatisches Paket nur per X im Mod-Streifen entfernen'
      }
      const holder = cell.querySelector(':scope > .init-hero-ex__mod-sub-slot')
      if (holder) holder.appendChild(badge)
      else cell.appendChild(badge)
    }
    /* Mod-Strip: Chips. */
    modStrip.replaceChildren()
    modStrip.classList.remove('init-hero-ex__mods-strip--scroll')
    syncHeroModStripExpansion(0)
    if (ownerIniNum == null) {
      modStrip.classList.remove('init-hero-ex__mods-strip--has')
      requestAnimationFrame(() => {
        syncModStripDockAndPad()
      })
      refreshComputedPenaltyHighlights(modMeta)
      syncHeroMicroModDisplayTones()
      applyUnfaehigVisualOverlay(modMeta)
      return
    }
    const active = activeModsFull
    if (active.length === 0) {
      modStrip.classList.remove('init-hero-ex__mods-strip--has')
      requestAnimationFrame(() => {
        syncModStripDockAndPad()
      })
      refreshComputedPenaltyHighlights(modMeta)
      syncHeroMicroModDisplayTones()
      applyUnfaehigVisualOverlay(modMeta)
      return
    }
    modStrip.classList.add('init-hero-ex__mods-strip--has')

    const primaryStack = document.createElement('div')
    primaryStack.className = 'init-hero-ex__mods-stack'

    const seenBundle = new Set()
    for (const modRec of active) {
      if (modRec.bundleId) {
        if (seenBundle.has(modRec.bundleId)) continue
        seenBundle.add(modRec.bundleId)
        const bundleMods = active.filter((x) => x.bundleId === modRec.bundleId)
        const packLabel = bundleMods.find((x) => x.label)?.label
        const shortParts = bundleMods.map((bm) => {
          const eff = modEffectiveContribution(
            bm,
            ownerIniNum,
            round,
            navIni,
            lhMech
          )
          const sign = eff > 0 ? '+' : ''
          const abbr = MOD_FIELD_LABEL[bm.field] || bm.field.toUpperCase()
          return `${abbr}${sign}${eff}`
        })
        const shortSummary =
          String(modRec.bundleId ?? '') === AUTO_LE_UNFAEHIG_BUNDLE_ID
            ? 'rein optische Überlagerung'
            : shortParts.join(', ')
        const detailLines =
          String(modRec.bundleId ?? '') === AUTO_LE_UNFAEHIG_BUNDLE_ID
            ? ['rein optische Überlagerung (keine Zahlenänderung)']
            : bundleMods.map((bm) => {
                const eff = modEffectiveContribution(
                  bm,
                  ownerIniNum,
                  round,
                  navIni,
                  lhMech
                )
                const sign = eff > 0 ? '+' : ''
                return `${MOD_FIELD_LABEL[bm.field]} ${sign}${eff} (${modNavFractionLabelFromNav(bm, ownerIniNum, lhMech, round, navIni)})`
              })
        const longSummary = detailLines.join(' \u00B7 ')
        const bundleTitlePfx = packLabel ? `"${packLabel}" — ` : ''
        const isAutoBundle = String(modRec.bundleId ?? '').startsWith(
          AUTO_MOD_BUNDLE_PREFIX
        )
        const cardTitle = `${bundleTitlePfx}${longSummary}${
          !isAutoBundle && canEdit ? ' \u00B7 Zum Bearbeiten anklicken' : ''
        }${
          isAutoBundle && canEdit
            ? ' \u00B7 Nur per X entfernen, nicht bearbeitbar'
            : ''
        }`
        let netSum = 0
        if (String(modRec.bundleId ?? '') !== AUTO_LE_UNFAEHIG_BUNDLE_ID) {
          for (const bm of bundleMods) {
            netSum += modEffectiveContribution(
              bm,
              ownerIniNum,
              round,
              navIni,
              lhMech
            )
          }
        }
        mountModListChip(primaryStack, {
          isBundle: true,
          isAutoBundle,
          bundleId: String(modRec.bundleId),
          label: packLabel,
          chipColor: bundleMods.find((x) => x.chipColor)?.chipColor,
          shortSummary,
          netSum,
          cardTitle,
          removeTitle: isAutoBundle
            ? 'Automatik-Modifikator entfernen'
            : 'Mod-Paket entfernen',
          removeAria: `${packLabel ? `${packLabel} \u00B7 ` : ''}${isAutoBundle ? 'Automatik-Paket entfernen' : 'Paket entfernen'}`,
          onRemove: () => {
            void removeBundleWithAutoCleanup(itemId, String(modRec.bundleId))
          },
          onEditClick: () => {
            openModPopoverForEdit(bundleMods, {
              kind: 'bundle',
              bundleId: String(modRec.bundleId),
            })
          },
          onReadonlyClick: () => {
            for (const bm of bundleMods) {
              const t = modFieldTargets[bm.field]
              if (!t || !t.cell) continue
              t.cell.classList.add('init-hero-ex__mod-anchor--flash')
              window.setTimeout(() => {
                t.cell.classList.remove('init-hero-ex__mod-anchor--flash')
              }, 900)
            }
          },
        })
        continue
      }

      const eff = modEffectiveContribution(
        modRec,
        ownerIniNum,
        round,
        navIni,
        lhMech
      )
      const sign = eff > 0 ? '+' : ''
      const abbr = MOD_FIELD_LABEL[modRec.field] || modRec.field.toUpperCase()
      const shortSummary = `${abbr}${sign}${eff}`
      const longSummary = `${MOD_FIELD_LABEL[modRec.field]} ${sign}${eff} (${modNavFractionLabelFromNav(modRec, ownerIniNum, lhMech, round, navIni)})`
      const labOnce = modRec.label ? `"${modRec.label}" — ` : ''
      const cardTitle = `${labOnce}${longSummary}${
        canEdit ? ' \u00B7 Zum Bearbeiten anklicken' : ''
      }`
      mountModListChip(primaryStack, {
        modField: modRec.field,
        label: modRec.label,
        chipColor: modRec.chipColor,
        shortSummary,
        netSum: eff,
        cardTitle,
        removeTitle: 'Modifikator entfernen',
        removeAria: `${modRec.label ? `${modRec.label} \u00B7 ` : ''}${MOD_FIELD_LABEL[modRec.field]} ${sign}${eff} entfernen`,
        onRemove: () => {
          void (async () => {
            await removeHeroExMod(itemId, modRec.id)
            await refreshAutoBundlesForItem(itemId)
            await refreshModStripFromScene()
          })()
        },
        onEditClick: () => {
          openModPopoverForEdit([modRec], { kind: 'single', modId: modRec.id })
        },
        onReadonlyClick: () => {
          const t = modFieldTargets[modRec.field]
          if (!t || !t.cell) return
          t.cell.classList.add('init-hero-ex__mod-anchor--flash')
          window.setTimeout(() => {
            t.cell.classList.remove('init-hero-ex__mod-anchor--flash')
          }, 900)
        },
      })
    }

    modStrip.replaceChildren()
    modStrip.appendChild(primaryStack)
    const chipCount = modStrip.querySelectorAll('.init-hero-ex__mod-chip-card')
      .length
    modStrip.classList.toggle(
      'init-hero-ex__mods-strip--scroll',
      chipCount > 3
    )
    syncHeroModStripExpansion(chipCount)
    refreshComputedPenaltyHighlights(modMeta)
    syncHeroMicroModDisplayTones()
    applyUnfaehigVisualOverlay(modMeta)
    requestAnimationFrame(() => {
      syncModStripDockAndPad()
    })
  }

  const waitMs = (ms) =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms)
    })

  const refreshModStripFromScene = async (opts = {}) => {
    const settle = opts?.settle === true
    try {
      const items = await OBR.scene.items.getItems([itemId])
      const freshMeta = items?.[0]?.metadata?.[TRACKER_ITEM_META_KEY]
      if (freshMeta) renderModBadgesAndStrip(freshMeta)
      if (settle) {
        await waitMs(80)
        const items2 = await OBR.scene.items.getItems([itemId])
        const freshMeta2 = items2?.[0]?.metadata?.[TRACKER_ITEM_META_KEY]
        if (freshMeta2) renderModBadgesAndStrip(freshMeta2)
      }
    } catch (_) {}
  }

  renderModBadgesAndStrip()

  root.addEventListener(
    'input',
    (e) => {
      if (
        e.target instanceof HTMLInputElement &&
        e.target.classList.contains('init-hero-ex__micro')
      ) {
        syncHeroMicroModDisplayTones()
      }
    },
    { passive: true }
  )

  /** TZ-Breite an LE/max; untere und mittlere Heldenblock-Zeile gleiche Scroll-Breite (Padding-Ausgleich). */
  const syncHeroRowLayout = () => {
    zoneMidRow.style.paddingRight = ''
    bottomStrip.style.paddingRight = ''
    leThreshBox.style.width = ''
    leThreshBox.style.minWidth = ''
    iniUpBtn.style.width = ''
    iniUpBtn.style.minWidth = ''
    ibChain.style.removeProperty('--init-hero-ib-ini-col-w')
    const leRight = leMaxInp.getBoundingClientRect().right
    const gLeft = spTzGrid.getBoundingClientRect().left
    const w = leRight - gLeft
    if (Number.isFinite(w) && w > 24) {
      spTzGrid.style.width = `${Math.round(w * 1000) / 1000}px`
    } else {
      spTzGrid.style.width = ''
    }

    /* S-Kästchen: rechte Kante = rechte Kante Frontal (F) in Zeile 3; linke Kante fix. */
    const frontalR = frontalLbl.getBoundingClientRect()
    const sL = leThreshBox.getBoundingClientRect().left
    const sW = frontalR.right - sL
    if (Number.isFinite(sW) && sW > 2) {
      const rsW = Math.round(sW * 1000) / 1000
      leThreshBox.style.width = `${rsW}px`
      leThreshBox.style.minWidth = `${rsW}px`
    }

    /* INI-Spalte: rechte Kante = S-Kaestchen; Breite als CSS-Variable (MOD: 2x + Abstand in CSS). */
    const sRight = leThreshBox.getBoundingClientRect().right
    const iniColL = iniIbCol.getBoundingClientRect().left
    const wIniCol = sRight - iniColL
    if (Number.isFinite(wIniCol) && wIniCol >= 12) {
      const rw = Math.round(wIniCol * 1000) / 1000
      ibChain.style.setProperty('--init-hero-ib-ini-col-w', `${rw}px`)
    }

    /* Scroll-Ausgleich: nach S-Kästchen-Breite messen, damit beide Zeilen gleich breit sind. */
    const zw = zoneMidRow.scrollWidth
    const bw = bottomStrip.scrollWidth
    if (zw > bw) {
      bottomStrip.style.paddingRight = `${zw - bw}px`
    } else if (bw > zw) {
      zoneMidRow.style.paddingRight = `${bw - zw}px`
    }

    updateLeThreshold()
    positionLePopover()
    syncModStripDockAndPad()
  }
  const spTzAlignRo = new ResizeObserver(() => {
    syncHeroRowLayout()
  })
  const __spTzAlignEls = [
    root,
    zoneMidRow,
    bottomStrip,
    leChainCols,
    leMaxInp,
    attrCols,
    attrKoTpWrap,
    frontalLbl,
    ibChain,
    iniIbCol,
    stripInner,
    modStrip,
    leThreshBox,
    ...(modIbCol ? [modIbCol] : []),
  ]
  for (const el of __spTzAlignEls) {
    spTzAlignRo.observe(el)
  }
  requestAnimationFrame(() => {
    syncHeroRowLayout()
    requestAnimationFrame(() => {
      syncHeroRowLayout()
    })
  })

  const FLASH_HERO_KEY = 'vierpunkteins_kampf_flash_neg'

  const applyKrFieldRed = () => {
    const clearOne = (inp, ab) => {
      inp?.classList?.remove('init-hero-ex__micro--kr-reduced')
      ab?.classList?.remove('init-hero-ex__abbr--kr-reduced')
    }
    for (const x of [
      at,
      pa,
      fk,
      gs,
      ib,
      ge,
      mu,
      kl,
      inn,
      ch,
      ff,
      kk,
      koAttr,
      ws,
      ae,
      ausw,
    ]) {
      clearOne(x.inp, x.ab)
    }
    clearOne(le.inp)
    clearOne(leMax.inp)
    clearOne(tpInp, tpAbbr)
    clearOne(spInp, spAbbr)
    clearOne(tzInp, tzAbbr)
    for (const u of zoneUiMid) {
      u.cell.classList.remove('init-hero-ex__micro-cell--kr-reduced')
    }
    const cr = getCombat()
    const r =
      cr?.started && Number.isFinite(Number(cr.round)) ? Number(cr.round) : null
    if (r == null) return
    const markPair = (inp, ab, field) => {
      if (!krMarkActive(itemId, field, r)) return
      inp.classList.add('init-hero-ex__micro--kr-reduced')
      if (ab) ab.classList.add('init-hero-ex__abbr--kr-reduced')
    }
    markPair(at.inp, at.ab, 'at')
    markPair(pa.inp, pa.ab, 'pa')
    markPair(fk.inp, fk.ab, 'fk')
    markPair(gs.inp, gs.ab, 'gs')
    markPair(ib.inp, ib.ab, 'ib')
    markPair(ge.inp, ge.ab, 'ge')
    markPair(mu.inp, mu.ab, 'mu')
    markPair(kl.inp, kl.ab, 'kl')
    markPair(inn.inp, inn.ab, 'inn')
    markPair(ch.inp, ch.ab, 'ch')
    markPair(ff.inp, ff.ab, 'ff')
    markPair(kk.inp, kk.ab, 'kk')
    markPair(koAttr.inp, koAttr.ab, 'ko')
    markPair(le.inp, null, 'le')
    for (const u of zoneUiMid) {
      if (krMarkActive(itemId, `hzw_${u.zoneId}`, r)) {
        u.cell.classList.add('init-hero-ex__micro-cell--kr-reduced')
        u.rsInp.classList.add('init-hero-ex__micro--kr-reduced')
      }
    }
  }

  const applyFlashFromStorage = () => {
    try {
      const raw = sessionStorage.getItem(FLASH_HERO_KEY)
      if (!raw) return
      const o = JSON.parse(raw)
      if (o.itemId !== itemId || (typeof o.exp === 'number' && o.exp < Date.now())) {
        sessionStorage.removeItem(FLASH_HERO_KEY)
        return
      }
      const keys = Array.isArray(o.keys) ? o.keys : []
      const clearFlash = () => {
        for (const k of keys) {
          if (typeof k === 'string' && k.startsWith('hzw:')) {
            const id = k.slice(4)
            const ui = zoneUiMid.find((u) => u.zoneId === id)
            ui?.cell.classList.remove('init-hero-ex__micro--flash-neg')
          } else if (k === 'le') {
            le.inp.classList.remove('init-hero-ex__micro--flash-neg')
          } else if (k === 'at') {
            at.inp.classList.remove('init-hero-ex__micro--flash-neg')
          } else if (k === 'pa') {
            pa.inp.classList.remove('init-hero-ex__micro--flash-neg')
          }
        }
        try {
          sessionStorage.removeItem(FLASH_HERO_KEY)
        } catch (_) {}
      }
      for (const k of keys) {
        if (typeof k === 'string' && k.startsWith('hzw:')) {
          const id = k.slice(4)
          const ui = zoneUiMid.find((u) => u.zoneId === id)
          ui?.cell.classList.add('init-hero-ex__micro--flash-neg')
        } else if (k === 'le') {
          le.inp.classList.add('init-hero-ex__micro--flash-neg')
        } else if (k === 'at') {
          at.inp.classList.add('init-hero-ex__micro--flash-neg')
        } else if (k === 'pa') {
          pa.inp.classList.add('init-hero-ex__micro--flash-neg')
        }
      }
      window.setTimeout(clearFlash, 2600)
    } catch {
      try {
        sessionStorage.removeItem(FLASH_HERO_KEY)
      } catch (_) {}
    }
  }
  applyFlashFromStorage()
  applyKrFieldRed()
  syncHeroMicroModDisplayTones()
  applyUnfaehigVisualOverlay()

  if (!canEdit) {
    spTzUndo.disabled = true
    spTzRedo.disabled = true
    spTzBridgeBtn.disabled = true
    iniUpBtn.disabled = true
    /** Nur Anzeige: Wunden/LE-Schwelle periodisch neu bewerten (kein AT/PA-Sync). */
    const MALUS_VIEW_POLL_MS = 1000
    const onVisView = () => {
      if (document.visibilityState !== 'visible' || !root.isConnected) return
      refreshComputedPenaltyHighlights()
      updateLeThreshold()
      updateLePopover()
      applyUnfaehigVisualOverlay()
    }
    document.addEventListener('visibilitychange', onVisView)
    const clearMalusPollView = () => {
      document.removeEventListener('visibilitychange', onVisView)
      if (contAny.__v4MalusPollTimer != null) {
        clearInterval(contAny.__v4MalusPollTimer)
        contAny.__v4MalusPollTimer = null
      }
    }
    contAny.__v4MalusPollClear = clearMalusPollView
    contAny.__v4MalusPollTimer = setInterval(() => {
      if (!root.isConnected) {
        clearMalusPollView()
        return
      }
      refreshComputedPenaltyHighlights()
      updateLeThreshold()
      updateLePopover()
      applyUnfaehigVisualOverlay()
    }, MALUS_VIEW_POLL_MS)
    return
  }

  /** @type {{ sp: string, tz: string }} */
  let spTzCheckpoint = { sp: snap.sp, tz: snap.tz }
  /** @type {{ sp: string, tz: string }[]} */
  const spTzUndoStack = []
  /** @type {{ sp: string, tz: string }[]} */
  const spTzRedoStack = []

  const syncSpTzHistoryButtons = () => {
    const canU = canUndoCombatCalc(itemId) || spTzUndoStack.length > 0
    const canR = canRedoCombatCalc(itemId) || spTzRedoStack.length > 0
    spTzUndo.disabled = !canU
    spTzRedo.disabled = !canR
  }

  const buildHitZonesPayload = () => {
    const zones = {}
    for (const def of wappenList) {
      const ui = zoneUiMid.find((u) => u.zoneId === def.id)
      if (ui) {
        zones[def.id] = { rs: ui.rsInp.value, w: ui.getWunden() }
      } else {
        zones[def.id] = snap.hitZones.zones[def.id] ?? { rs: '', w: 0 }
      }
    }
    return { notiz: hitZoneNotizFrozen, zones }
  }

  const gather = () => ({
    at: at.inp.value,
    pa: pa.inp.value,
    a: ausw.inp.value,
    le: le.inp.value,
    leMax: leMax.inp.value,
    ae: showEnergyField ? ae.inp.value : '',
    ke:
      snap.energyMode === 'both'
        ? keDualInp.value
        : snap.energyMode === 'ke'
          ? ae.inp.value
          : snap.ke,
    energyMode: snap.energyMode,
    au: auSnap,
    ko: koAttr.inp.value,
    tp: tpInp.value,
    sp: spInp.value,
    tz: tzInp.value,
    frontal: frontalChk.checked,
    wappenDefs: snap.wappenDefs,
    fk: fk.inp.value,
    showFk: showFkField,
    gs: gs.inp.value,
    ib: ib.inp.value,
    be: be.inp.value,
    w6: w6.inp.value,
    ws: ws.inp.value,
    leThreshold: customLeThreshold,
    unfaehigThreshold: snap.unfaehigThreshold,
    unfaehigMarkFields: snap.unfaehigMarkFields,
    unfaehigFixedFields: snap.unfaehigFixedFields,
    mu: mu.inp.value,
    kl: kl.inp.value,
    inn: inn.inp.value,
    ch: ch.inp.value,
    ff: ff.inp.value,
    ge: ge.inp.value,
    kk: kk.inp.value,
    hitZones: buildHitZonesPayload(),
  })

  const persistBasisFromGathered = (snapLike) => {
    const c = getCombat()
    const round =
      c?.started && Number.isFinite(Number(c.round)) ? Number(c.round) : null
    return basisHeroExpandSnapshotFromDisplayed(
      meta,
      snapLike,
      ownerIniNum,
      round,
      readCurrentNavIniGlobal()
    )
  }

  // Verhindert, dass der erste Klick nur Blur auf IB/BE/W6 auslöst: dadurch
  // lief `commit` → async `applyHeroExpandFields` und die Liste renderte neu,
  // bevor der `click` auf diesem Button lief (Werte wirkten „weg“).
  iniUpBtn.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return
    e.preventDefault()
  })

  iniUpBtn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const iniInp = document.querySelector(
      `li[data-item-id="${CSS.escape(itemId)}"] .init-row-init`
    )
    const g = gather()
    await applyHeroExpandFields(itemId, persistBasisFromGathered(g))
    await refreshModStripFromScene()
    const n = computeIniFromIbBeW6(g.ib, g.be, g.w6)
    if (n !== null) {
      const iniStr = String(Math.round(n))
      logCombat(`INI: IB − BE + W6 → ${iniStr}`)
      await writeItemInitiative(itemId, iniStr)
      if (iniInp instanceof HTMLInputElement) {
        const comb = getCombat()
        const rRound =
          comb?.started && Number.isFinite(Number(comb.round))
            ? Number(comb.round)
            : null
        const navIni = readCurrentNavIniGlobal()
        const ownerN = Number(iniStr)
        let displayVal = iniStr
        if (
          readModDisplayMode(meta) === 'integrated' &&
          Number.isFinite(ownerN)
        ) {
          const patched = { ...meta, initiative: iniStr }
          const d = effectiveDeltaForField(
            patched,
            'ib',
            ownerN,
            rRound,
            navIni
          )
          displayVal = String(ownerN + d)
        }
        iniInp.value = displayVal
        iniInp.focus({ preventScroll: true })
        iniInp.select()
      }
      return
    }
    logCombat('INI: IB/BE/W6 unvollständig oder ungültig — INI-Feld fokussiert')
    if (iniInp instanceof HTMLInputElement) {
      iniInp.focus({ preventScroll: true })
      iniInp.select()
    }
  })

  const refreshDerivedUiFromInputs = (metaForVisuals) => {
    updateLeThreshold()
    updateLePopover()
    applyUnfaehigVisualOverlay(metaForVisuals)
  }

  const isLeRelatedLiveInput = (inp) =>
    inp === le.inp ||
    inp === leMax.inp ||
    inp === koAttr.inp ||
    inp === lePopLeInp ||
    inp === lePopLeMaxInp ||
    inp === lePopKoInp

  const buildLiveLePreviewMeta = () => {
    const cNow = getCombat()
    const roundNow =
      cNow?.started && Number.isFinite(Number(cNow.round))
        ? Number(cNow.round)
        : null
    const previewMeta = { ...(meta ?? {}) }
    const snapPreview = persistBasisFromGathered(gather())
    patchHeroExModsWithAutoBundles(previewMeta, snapPreview, {
      round: roundNow,
      navIni: readCurrentNavIniGlobal(),
    })
    return previewMeta
  }

  /**
   * Führt denselben LE-Visual-Sync wie der Overlay-Zyklus aus, optional mit
   * Preview-Meta und optionalem Commit (wie beim Overlay-Schließen), ohne
   * sichtbares Öffnen/Schließen des Overlays.
   *
   * @param {{ usePreview?: boolean, commitAfter?: boolean }} [opts]
   */
  function runSilentLeOverlaySync(opts = {}) {
    const previewMeta = opts.usePreview ? buildLiveLePreviewMeta() : undefined
    if (previewMeta) {
      refreshComputedPenaltyHighlights(previewMeta)
      refreshDerivedUiFromInputs(previewMeta)
      renderModBadgesAndStrip(previewMeta)
    } else {
      refreshComputedPenaltyHighlights()
      refreshDerivedUiFromInputs()
    }
    if (opts.commitAfter) {
      commit()
    }
  }

  /** @type {ReturnType<typeof setTimeout> | null} */
  let liveRefreshTimer = null
  /** Debounce für abgeleitete UI (LE-Schwelle, S-Popover, …) bei kurzer Eingabe. */
  const LIVE_INPUT_DEBOUNCE_MS = 4000

  const scheduleLiveDerivedRefresh = (inp, metaForVisuals) => {
    if (liveRefreshTimer != null) clearTimeout(liveRefreshTimer)
    liveRefreshTimer = setTimeout(() => {
      liveRefreshTimer = null
      if (isLeRelatedLiveInput(inp)) {
        runSilentLeOverlaySync({ usePreview: true })
      } else {
        refreshDerivedUiFromInputs(metaForVisuals)
      }
    }, LIVE_INPUT_DEBOUNCE_MS)
  }

  /** @type {ReturnType<typeof setTimeout> | null} */
  let persistTimer = null
  let persistQueued = false
  /** @type {ReturnType<typeof gather> | null} */
  let persistNextSnapshot = null
  const PERSIST_DEBOUNCE_MS = 320

  const flushPersistHeroExpand = () => {
    persistTimer = null
    if (!persistQueued || !persistNextSnapshot) return
    const c = getCombat()
    const round =
      c?.started && Number.isFinite(Number(c.round)) ? Number(c.round) : null
    const navIni = readCurrentNavIniGlobal()
    const snap = basisHeroExpandSnapshotFromDisplayed(
      meta,
      persistNextSnapshot,
      ownerIniNum,
      round,
      navIni
    )
    persistQueued = false
    persistNextSnapshot = null
    void (async () => {
      await applyHeroExpandFields(itemId, snap)
      await refreshModStripFromScene()
    })()
  }

  const schedulePersistHeroExpand = (snapshot) => {
    persistNextSnapshot = snapshot
    persistQueued = true
    if (persistTimer != null) clearTimeout(persistTimer)
    persistTimer = setTimeout(flushPersistHeroExpand, PERSIST_DEBOUNCE_MS)
  }
  const cancelPendingPersistHeroExpand = () => {
    if (persistTimer != null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    persistQueued = false
    persistNextSnapshot = null
  }

  const clearTpTypingPersistTimer = () => {}

  spTzBridgeBtn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Offene Debounce-Persistenz kann ansonsten kurz danach alte Werte zurückschreiben
    // und frisch entstandene Auto-Mods (Wunden/LE-Band) wieder entfernen.
    cancelPendingPersistHeroExpand()
    clearTpTypingPersistTimer()
    const g0 = structuredClone(gather())
    const res = applyHitZoneStrikeFromSpTz(g0)
    if (!res) {
      logCombat(
        'Treffer: SP (nicht-negative ganze Zahl) und gültige TZ (z. B. KF, BR, LA) nötig.'
      )
      tzInp.focus({ preventScroll: true })
      tzInp.select()
      return
    }
    const ts = new Date().toLocaleTimeString()
    const combat = getCombat()
    const roundNum =
      combat?.started && Number.isFinite(Number(combat.round))
        ? Number(combat.round)
        : null
    const tokenLabel = String(displayName || meta?.name || itemId || 'Unbekannt').trim()
    const next = { ...res.next, sp: '' }
    const nextClone = structuredClone(next)
    /** @type {Record<string, number>} */
    const baseMarks =
      roundNum != null ? computeKrFieldMarks(g0, nextClone, roundNum) : {}
    const penMarks =
      roundNum != null
        ? computeKrAutoPenaltyWorseningMarks(g0, nextClone, roundNum)
        : {}
    const marks = { ...baseMarks, ...penMarks }
    if (roundNum != null && Object.keys(marks).length > 0) {
      mergeKrMarks(itemId, marks)
    }
    pushCombatCalcBlock(
      itemId,
      tokenLabel,
      ts,
      res.logLines,
      g0,
      nextClone,
      Object.keys(marks).length > 0 ? marks : null
    )
    if (g0.sp !== spTzCheckpoint.sp || g0.tz !== spTzCheckpoint.tz) {
      spTzUndoStack.push({ ...spTzCheckpoint })
      spTzRedoStack.length = 0
    }
    try {
      sessionStorage.setItem(
        FLASH_HERO_KEY,
        JSON.stringify({
          itemId,
          keys: res.flashKeys,
          exp: Date.now() + 4500,
        })
      )
    } catch (_) {}
    spTzCheckpoint = { sp: next.sp ?? '', tz: String(next.tz ?? '') }
    syncSpTzHistoryButtons()
    await applyHeroExpandFields(itemId, persistBasisFromGathered(next))
    await refreshModStripFromScene({ settle: true })
    if (liveRefreshTimer != null) {
      clearTimeout(liveRefreshTimer)
      liveRefreshTimer = null
    }
    refreshDerivedUiFromInputs()
  })

  const allZoneUis = [...zoneUiMid]
  for (const ui of allZoneUis) {
    ui.dots.forEach((dot, idx) => {
      dot.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const beforeSnap = structuredClone(gather())
        const beforeW = ui.getWunden()
        ui.bumpWunden(idx)
        const afterW = ui.getWunden()
        refreshComputedPenaltyHighlights()
        const afterSnap = structuredClone(gather())
        const combatW = getCombat()
        const roundNumW =
          combatW?.started && Number.isFinite(Number(combatW.round))
            ? Number(combatW.round)
            : null
        const baseMarksW =
          roundNumW != null
            ? computeKrFieldMarks(beforeSnap, afterSnap, roundNumW)
            : {}
        const penMarksW =
          roundNumW != null
            ? computeKrAutoPenaltyWorseningMarks(
                beforeSnap,
                afterSnap,
                roundNumW
              )
            : {}
        const krMarksW = { ...baseMarksW, ...penMarksW }
        if (beforeW !== afterW) {
          logCombat(`${ui.zoneId}: Wunden ${beforeW}→${afterW}`)
        }
        const lines =
          beforeW !== afterW
            ? [`${ui.zoneId}: Wunden ${beforeW}→${afterW} (Auto-Mods)`]
            : []
        if (lines.length > 0) {
          const ts = new Date().toLocaleTimeString()
          const tokenLabel = String(displayName || meta?.name || itemId || 'Unbekannt').trim()
          if (roundNumW != null && Object.keys(krMarksW).length > 0) {
            mergeKrMarks(itemId, krMarksW)
          }
          pushCombatCalcBlock(
            itemId,
            tokenLabel,
            ts,
            lines,
            beforeSnap,
            afterSnap,
            roundNumW != null && Object.keys(krMarksW).length > 0 ? krMarksW : null
          )
        }
        void (async () => {
          await applyHeroExpandFields(itemId, persistBasisFromGathered(afterSnap))
          await refreshModStripFromScene()
          if (liveRefreshTimer != null) {
            clearTimeout(liveRefreshTimer)
            liveRefreshTimer = null
          }
          refreshDerivedUiFromInputs()
        })()
      })
    })
  }

  const commit = () => {
    if (liveRefreshTimer != null) {
      clearTimeout(liveRefreshTimer)
      liveRefreshTimer = null
    }
    clearTpTypingPersistTimer()
    refreshDerivedUiFromInputs()
    const gSynced = gather()
    if (gSynced.sp !== spTzCheckpoint.sp || gSynced.tz !== spTzCheckpoint.tz) {
      spTzUndoStack.push({ ...spTzCheckpoint })
      spTzRedoStack.length = 0
      spTzCheckpoint = { sp: gSynced.sp, tz: gSynced.tz }
    }
    syncSpTzHistoryButtons()
    schedulePersistHeroExpand(gSynced)
  }

  const applySpTzPairToScene = async (pair) => {
    spInp.value = pair.sp
    tzInp.value = pair.tz
    await applyHeroExpandFields(itemId, persistBasisFromGathered(gather()))
    await refreshModStripFromScene()
    if (liveRefreshTimer != null) {
      clearTimeout(liveRefreshTimer)
      liveRefreshTimer = null
    }
    refreshDerivedUiFromInputs()
  }

  spTzUndo.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void (async () => {
      if (canUndoCombatCalc(itemId)) {
        const before = undoCombatCalc(itemId)
        if (before != null) {
          await applyHeroExpandFields(itemId, /** @type {any} */ (before))
          await refreshModStripFromScene()
          if (liveRefreshTimer != null) {
            clearTimeout(liveRefreshTimer)
            liveRefreshTimer = null
          }
          refreshDerivedUiFromInputs()
          syncSpTzHistoryButtons()
          return
        }
      }
      if (spTzUndoStack.length === 0) return
      const prev = spTzUndoStack.pop()
      spTzRedoStack.push({ ...spTzCheckpoint })
      spTzCheckpoint = { ...prev }
      await applySpTzPairToScene(prev)
      syncSpTzHistoryButtons()
    })()
  })

  spTzRedo.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void (async () => {
      if (canRedoCombatCalc(itemId)) {
        const after = redoCombatCalc(itemId)
        if (after != null) {
          await applyHeroExpandFields(itemId, /** @type {any} */ (after))
          await refreshModStripFromScene()
          if (liveRefreshTimer != null) {
            clearTimeout(liveRefreshTimer)
            liveRefreshTimer = null
          }
          refreshDerivedUiFromInputs()
          syncSpTzHistoryButtons()
          return
        }
      }
      if (spTzRedoStack.length === 0) return
      const next = spTzRedoStack.pop()
      spTzUndoStack.push({ ...spTzCheckpoint })
      spTzCheckpoint = { ...next }
      await applySpTzPairToScene(next)
      syncSpTzHistoryButtons()
    })()
  })

  syncSpTzHistoryButtons()
  contAny.__v4krLogUnsub = subscribeCombatLog(() => {
    syncSpTzHistoryButtons()
  })

  for (const ui of allZoneUis) {
    ui.rsInp.addEventListener('input', () => syncWappenRsFontSize(ui.rsInp))
  }
  const liveInputs = [
    at.inp,
    pa.inp,
    ausw.inp,
    le.inp,
    leMax.inp,
    ...(showEnergyField ? [ae.inp] : []),
    ...(snap.energyMode === 'both' ? [keDualInp] : []),
    tpInp,
    ...(showFkField ? [fk.inp] : []),
    gs.inp,
    ib.inp,
    be.inp,
    w6.inp,
    ws.inp,
    spInp,
    tzInp,
    mu.inp,
    kl.inp,
    inn.inp,
    ch.inp,
    ff.inp,
    ge.inp,
    kk.inp,
    koAttr.inp,
    ...allZoneUis.map((u) => u.rsInp),
    /* S-Overlay LE/max: gleiche Blur/Enter/Persist/Fokus wie die Hauptfelder */
    lePopLeInp,
    lePopLeMaxInp,
    lePopKoInp,
  ]
  let lastPointerDownInsideAt = 0
  root.addEventListener(
    'pointerdown',
    () => {
      lastPointerDownInsideAt = Date.now()
    },
    { capture: true, passive: true }
  )
  for (const inp of liveInputs) {
    inp.addEventListener('input', () => {
      // Sofort: Malus-Hervorhebung an aktuellen LE/Wunden-Werten (ohne auf
      // die 4s-Debounce von syncLeThreshold / Popover zu warten).
      refreshComputedPenaltyHighlights()
      const len = inp.value.trim().length
      const immediateDerivedForLe = isLeRelatedLiveInput(inp)
      const previewMeta = immediateDerivedForLe ? buildLiveLePreviewMeta() : null
      if (inp === tpInp) {
        if (len >= 2) {
          if (liveRefreshTimer != null) {
            clearTimeout(liveRefreshTimer)
            liveRefreshTimer = null
          }
          refreshDerivedUiFromInputs()
        } else {
          scheduleLiveDerivedRefresh(inp)
        }
        return
      }
      // Wie LE/MAX: bei mindestens zwei Zeichen sofort ableitende UI; bei
      // einstelliger Eingabe 4 s warten, damit weitere Ziffern folgen können.
      if (immediateDerivedForLe || len >= 2) {
        if (liveRefreshTimer != null) {
          clearTimeout(liveRefreshTimer)
          liveRefreshTimer = null
        }
        if (immediateDerivedForLe) {
          runSilentLeOverlaySync({ usePreview: true })
        } else {
          refreshDerivedUiFromInputs(previewMeta ?? undefined)
        }
      } else {
        scheduleLiveDerivedRefresh(inp, previewMeta ?? undefined)
      }
    })
    inp.addEventListener('blur', (e) => {
      const relatedNext =
        e instanceof FocusEvent && e.relatedTarget instanceof HTMLElement
          ? e.relatedTarget
          : null
      // Beim Wechsel zwischen Hero-Feldern nicht sofort committen:
      // ein unmittelbarer Remount kann den ersten Klick/Tastendruck "fressen".
      if (relatedNext && root.contains(relatedNext)) return
      window.setTimeout(() => {
        const active = document.activeElement
        if (active instanceof HTMLElement && root.contains(active)) return
        if (Date.now() - lastPointerDownInsideAt < 180) return
        commit()
      }, 45)
    })
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      commit()
    })
    inp.addEventListener('focus', (e) => {
      const el = e.currentTarget
      if (!(el instanceof HTMLInputElement) || el.disabled) return
      requestAnimationFrame(() => {
        if (
          el.classList.contains('init-hero-ex__micro--wappen-rs') &&
          el.value.trim() === ''
        ) {
          return
        }
        el.select()
      })
    })
  }
  refreshDerivedUiFromInputs()
  frontalChk.addEventListener('change', () => {
    updateFrontalOrientationHint()
    commit()
  })

  /** Wunden + LE-Schwelle im Hintergrund neu ableiten (Szene-Sync, Remount-Rennen). */
  const MALUS_STATE_POLL_MS = 1000
  const onVisEdit = () => {
    if (document.visibilityState !== 'visible' || !root.isConnected) return
    if (liveRefreshTimer != null) {
      clearTimeout(liveRefreshTimer)
      liveRefreshTimer = null
    }
    refreshDerivedUiFromInputs()
    applyKrFieldRed()
  }
  document.addEventListener('visibilitychange', onVisEdit)
  const clearMalusStatePoll = () => {
    document.removeEventListener('visibilitychange', onVisEdit)
    if (contAny.__v4MalusPollTimer != null) {
      clearInterval(contAny.__v4MalusPollTimer)
      contAny.__v4MalusPollTimer = null
    }
  }
  contAny.__v4MalusPollClear = clearMalusStatePoll
  contAny.__v4MalusPollTimer = setInterval(() => {
    if (!root.isConnected) {
      clearMalusStatePoll()
      return
    }
    if (liveRefreshTimer != null) {
      clearTimeout(liveRefreshTimer)
      liveRefreshTimer = null
    }
    refreshDerivedUiFromInputs()
    applyKrFieldRed()
  }, MALUS_STATE_POLL_MS)
}
