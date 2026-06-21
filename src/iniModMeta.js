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
  buildTrefferzoneInputTooltip,
  cleanupOrphanHitZoneKeys,
  effectiveWappenForHero,
  HERO_EX_WAPPEN_SLOT9,
  HERO_EX_WAPPEN_TEMPLATE,
  TZ_ZONE_INPUT_TOOLTIP_FOOTER,
} from './wappenDefs.js'
import {
  AUTO_MOD_BUNDLE_PREFIX,
  computeKrAutoPenaltyWorseningMarks,
  effectiveLeForThresholds,
  hasGsZeroPriorityFromSnapshot,
  armThirdWoundSidesFromSnapshot,
  computeUnfaehigSources,
  leAtPaMalusForBand,
  leBand,
  leBandLabelDe,
  patchHeroExModsWithAutoBundles,
  refreshAutoBundlesForItem,
  removeBundleWithAutoCleanup,
  resolveUnfaehigOverlayState,
  UNFAEHIG_FIXED_ZERO_FIELDS,
  updateLastSafeLeIfSafe,
} from './heroAutoMods.js'
import { applyHitZoneStrikeFromSpTz } from './hitZoneStrike.js'
import { computeIniFromIbBeW6 } from './iniCompute.js'
import { readOwnerIniReferenceForMods } from './ownerIniReference.js'
import {
  applyIniLockCharges,
  applyIniNegativePoolShiftForMetaMutation,
  isHeroIniBelowZero,
} from './krCounters.js'
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
  integratesHeroModsIntoDisplayedValue,
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

/** Statischer Referenztext (Mensch-Standard); UI nutzt `buildTrefferzoneInputTooltip`. */
export const TZ_TOOLTIP =
  'Trefferzone TZ: W20 19–20 = Kopf · 15–18 = Brust (Frontal F an) oder Rücken (F aus) · 9–14 = Arme (ungerade Schildarm, gerade Schwertarm) · 7–8 = Bauch · 1–6 = Beine (ungerade links, gerade rechts). ' +
  TZ_ZONE_INPUT_TOOLTIP_FOOTER

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
export const HERO_EX_AU_MAX = 'heroExAuMax'
export const HERO_EX_AE_MAX = 'heroExAeMax'
export const HERO_EX_KE_MAX = 'heroExKeMax'
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
/** Magieresistenz (MR) */
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
/** @deprecated Nur Lesen/Migration — ersetzt durch heroExExtraField */
export const HERO_EX_KE = 'heroExKe'
/** @deprecated Nur Lesen/Migration — ersetzt durch heroExExtraField */
export const HERO_EX_ENERGY_MODE = 'heroExEnergyMode'
/** Zusatzfeld zwischen AE und MR: none | ke | gw | lo */
export const HERO_EX_EXTRA_FIELD = 'heroExExtraField'
/** Gefahrenwert (GW) */
export const HERO_EX_GW = 'heroExGw'
/** Loyalität (LO) */
export const HERO_EX_LO = 'heroExLo'
export const HERO_EX_SHOW_FK = 'heroExShowFk'
/** AU-Feld im Heldenblock (Standard aus) */
export const HERO_EX_SHOW_AU = 'heroExShowAu'
export const HERO_EX_LE_THRESHOLD = 'heroExLeThreshold'
export const HERO_EX_UNFAEHIG_THRESHOLD = 'heroExUnfaehigThreshold'
export const HERO_EX_UNFAEHIG_MARK_FIELDS = 'heroExUnfaehigMarkFields'
export const HERO_EX_UNFAEHIG_FIXED_FIELDS = 'heroExUnfaehigFixedFields'
const HERO_DEATH_MODE = 'heroDeathMode'
const HERO_DEATH_AT_MINUS_ONE_POINT_FIVE_KO = 'heroDeathAtMinusOnePointFiveKo'
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

/** Auf dem Container von `mountHeroExpandBlock`: vor Listen-Remount flushen. */
export const HERO_EXPAND_BODY_FLUSH = Symbol('vierpunkteinsHeroExpandFlush')
/** Gesetzt solange uncommittete Heldenblock-Eingaben (persistTimer) pending sind. */
export const HERO_EXPAND_HAS_PENDING_INPUT = Symbol(
  'vierpunkteinsHeroExpandPendingInput'
)

function strOrEmpty(v) {
  if (v === undefined || v === null) return ''
  return String(v)
}

const UNFAEHIG_MARK_DEFAULT_FIELDS = ['at', 'pa', 'a', 'tp', 'fk', 'gs']
const UNFAEHIG_FIXED_ALLOWED_FIELDS = ['at', 'pa', 'a', 'tp', 'fk', 'gs']

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
  const unique = fields.length > 0 ? [...new Set(fields)] : [...UNFAEHIG_MARK_DEFAULT_FIELDS]
  if (!unique.includes('gs')) unique.push('gs')
  return unique
}

function normalizeUnfaehigFixedFields(raw) {
  const txt = String(raw ?? '')
  const out = {}
  for (const part of txt.split(',')) {
    const [kRaw, vRaw] = part.split('=')
    const k = String(kRaw ?? '').trim().toLowerCase()
    const n = Math.floor(Number(String(vRaw ?? '').trim().replace(',', '.')))
    if (UNFAEHIG_FIXED_ALLOWED_FIELDS.includes(k) && Number.isFinite(n)) out[k] = n
  }
  if (!Number.isFinite(Number(out.gs))) out.gs = 1
  return out
}

/** Zwischen TP und TZ: Tool-Schwert-Icon, Rotation/Skalierung via CSS. */
const TP_TZ_BRIDGE_SVG =
  '<svg class="init-hero-ex__sp-tz-bridge-icon" xmlns="http://www.w3.org/2000/svg" viewBox="-5 0 34 34" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" focusable="false"><g><ellipse cx="12" cy="30.6" rx="2.5" ry="2.3" fill="#5d4037"/><circle cx="12" cy="30.6" r="1.85" fill="#b8860b"/><circle cx="12" cy="30.6" r="0.85" fill="#7e1010"/><path fill="#3e2723" d="M10.4 22.4 H13.6 V29.8 H10.4 Z"/><path fill="#5d4037" d="M10.55 22.6 H13.45 V23.5 H10.55 Z M10.55 24.4 H13.45 V25.3 H10.55 Z M10.55 26.2 H13.45 V27.1 H10.55 Z M10.55 28.0 H13.45 V28.9 H10.55 Z"/><path fill="#4f4643" d="M3.4 18.9 H20.6 L18.6 22.4 H5.4 Z"/><path fill="#6d615d" d="M4.2 19.3 H19.8 L18.0 22.0 H6.0 Z"/><ellipse cx="12" cy="20.7" rx="1.7" ry="1.0" fill="#584e4a"/><path fill="#5d4037" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 Z"/><path fill="#7e1010" d="M10.2 18.5 L11.6 2.5 L12.4 2.5 L13.8 18.5 Z"/><path fill="#c62828" d="M10.65 18.3 L11.7 3.4 L12.3 3.4 L13.35 18.3 Z"/><path fill="#ef9a9a" opacity="0.85" d="M11.85 4 L12.15 4 L12.0 17.6 Z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 H20.6 L18.6 22.4 H13.6 V29.8 A1.6 1.6 0 1 1 10.4 29.8 V22.4 H5.4 L3.4 18.9 Z"/></g></svg>'

/** TP/TZ-Beschriftungszeile: RS ignorieren — Miniatur wie blaues Abwehr-Schild (KR-Zeile). */
const RS_BYPASS_TOGGLE_SVG =
  '<svg class="init-hero-ex__rs-bypass-btn-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true" focusable="false"><path fill="#5d4037" d="M12 2l8 3v8.4c0 6.9-3.2 13-8 15.8-4.8-2.8-8-8.9-8-15.8V5l8-3z"/><path fill="#1a237e" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/><path fill="#3949ab" d="M12 5.55 7.15 7.25v6.45c0 4.2 1.85 8.1 4.85 10.2 3-2.1 4.85-6 4.85-10.2V7.25L12 5.55z"/><path fill="#b8860b" d="M12 2.75 19.05 4.85 18.85 5.45 12 3.75 5.15 5.45 4.95 4.85 12 2.75z"/><path fill="#90caf9" opacity="0.4" d="M8.65 9.1c1.05 2.5 1.55 5.15 1.55 7.95 0 3.45-.75 6.75-2.1 9.75 1.85-1.7 3.05-4.55 3.05-7.75 0-3.25-.85-6.3-2.5-8.95z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/></svg>'

/**
 * @param {string} itemId
 * @param {string} iniStr
 */
async function writeItemInitiative(itemId, iniStr) {
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const wasBelow = isHeroIniBelowZero(m)
      m.initiative = iniStr
      applyIniLockCharges(m)
      if (getCombat().started) {
        applyIniNegativePoolShiftForMetaMutation(
          m,
          wasBelow,
          isHeroIniBelowZero(m)
        )
      }
    }
  })
}

export function readHeroExtraField(meta) {
  const raw = String(meta?.[HERO_EX_EXTRA_FIELD] ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'ke' || raw === 'gw' || raw === 'lo') return raw
  const energyModeRaw = String(meta?.[HERO_EX_ENERGY_MODE] ?? '')
    .trim()
    .toLowerCase()
  if (energyModeRaw === 'ke') return 'ke'
  return 'none'
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
  const extraField = readHeroExtraField(meta)
  const aeVal = strOrEmpty(meta?.[HERO_EX_AE])
  const keVal = strOrEmpty(meta?.[HERO_EX_KE])
  const gwVal = strOrEmpty(meta?.[HERO_EX_GW])
  const loVal = strOrEmpty(meta?.[HERO_EX_LO])
  const aeKeLegacy = strOrEmpty(meta?.[HERO_EX_AEKE_LEGACY])
  const energyModeRaw = String(meta?.[HERO_EX_ENERGY_MODE] ?? '')
    .trim()
    .toLowerCase()
  const aeResolved = aeVal || (extraField !== 'ke' ? aeKeLegacy : '')
  const keResolved =
    keVal || (extraField === 'ke' && energyModeRaw === 'ke' ? aeKeLegacy : keVal)
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
  const showAuRaw = String(meta?.[HERO_EX_SHOW_AU] ?? '').trim().toLowerCase()
  const showAu =
    showAuRaw === '1' || ['true', 'on', 'yes', 'ja'].includes(showAuRaw)
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
    auMax: strOrEmpty(meta?.[HERO_EX_AU_MAX]),
    aeMax: strOrEmpty(meta?.[HERO_EX_AE_MAX]),
    keMax: strOrEmpty(meta?.[HERO_EX_KE_MAX]),
    ae: aeResolved || aeKeLegacy,
    ke: keResolved,
    gw: gwVal,
    lo: loVal,
    extraField,
    au: strOrEmpty(meta?.[HERO_EX_AU]),
    ko: strOrEmpty(meta?.[HERO_EX_KO]),
    tp: strOrEmpty(meta?.[HERO_EX_TP]),
    sp: strOrEmpty(meta?.[HERO_EX_SP]),
    tz: strOrEmpty(meta?.[HERO_EX_TZ]),
    frontal,
    fk: strOrEmpty(meta?.[HERO_EX_FK]),
    showFk,
    showAu,
    leThreshold,
    unfaehigThreshold,
    unfaehigMarkFields,
    unfaehigFixedFields,
    deathMode: strOrEmpty(meta?.[HERO_DEATH_MODE]),
    deathAtMinusOnePointFiveKo: strOrEmpty(
      meta?.[HERO_DEATH_AT_MINUS_ONE_POINT_FIVE_KO]
    ),
    gs: strOrEmpty(meta?.[HERO_EX_GS]),
    mr: strOrEmpty(meta?.[HERO_EX_MR]),
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
      const wasBelow = isHeroIniBelowZero(m)
      m.initiative = iniStr
      applyIniLockCharges(m)
      if (getCombat().started) {
        applyIniNegativePoolShiftForMetaMutation(
          m,
          wasBelow,
          isHeroIniBelowZero(m)
        )
      }
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
      setStr(HERO_EX_AU_MAX, next.auMax)
      setStr(HERO_EX_AE_MAX, next.aeMax)
      setStr(HERO_EX_KE_MAX, next.keMax)
      setStr(HERO_EX_AE, next.ae)
      const extraFieldRaw = String(next.extraField ?? '').trim().toLowerCase()
      const extraField =
        extraFieldRaw === 'ke' || extraFieldRaw === 'gw' || extraFieldRaw === 'lo'
          ? extraFieldRaw
          : 'none'
      if (extraField === 'ke') {
        setStr(HERO_EX_KE, next.ke)
        delete m[HERO_EX_GW]
        delete m[HERO_EX_LO]
        m[HERO_EX_EXTRA_FIELD] = 'ke'
      } else if (extraField === 'gw') {
        setStr(HERO_EX_GW, next.gw)
        delete m[HERO_EX_KE]
        delete m[HERO_EX_LO]
        m[HERO_EX_EXTRA_FIELD] = 'gw'
      } else if (extraField === 'lo') {
        setStr(HERO_EX_LO, next.lo)
        delete m[HERO_EX_KE]
        delete m[HERO_EX_GW]
        m[HERO_EX_EXTRA_FIELD] = 'lo'
      } else {
        delete m[HERO_EX_KE]
        delete m[HERO_EX_GW]
        delete m[HERO_EX_LO]
        delete m[HERO_EX_EXTRA_FIELD]
      }
      delete m[HERO_EX_ENERGY_MODE]
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
      if (next.showAu === true) m[HERO_EX_SHOW_AU] = '1'
      else if (next.showAu === false) m[HERO_EX_SHOW_AU] = '0'
      else delete m[HERO_EX_SHOW_AU]
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
      setStr(HERO_EX_MR, next.mr)
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
    setWunden(count) {
      wundenCount = Math.min(3, Math.max(0, Math.floor(Number(count)) || 0))
      syncDots()
    },
  }
}

/**
 * LE-Schwellen-Balken (Fill + Marker-Linien) für LE-Rail und Energy-Rails.
 * @param {string} [boxExtraClass]
 */
function createLeThresholdGaugeBox(boxExtraClass = '') {
  const box = document.createElement('div')
  box.className =
    'init-hero-ex__le-threshold__box' +
    (boxExtraClass ? ` ${boxExtraClass}` : '')
  box.title = LE_THRESHOLD_TOOLTIP
  box.setAttribute('role', 'img')
  box.setAttribute('aria-label', 'LE-Schwellenanzeige')
  const fill = document.createElement('div')
  fill.className = 'init-hero-ex__le-threshold__fill'
  const line50 = document.createElement('div')
  line50.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--50'
  line50.style.bottom = '50%'
  line50.title = 'Schwelle 1/2 LE'
  const line33 = document.createElement('div')
  line33.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--33'
  line33.style.bottom = '33.333%'
  line33.title = 'Schwelle 1/3 LE'
  const line25 = document.createElement('div')
  line25.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--25'
  line25.style.bottom = '25%'
  line25.title = 'Schwelle 1/4 LE'
  const line5 = document.createElement('div')
  line5.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--le5'
  line5.title = 'Schwelle LE 5 (kampfunfähig bei 0–5)'
  line5.style.display = 'none'
  const lineUnf = document.createElement('div')
  lineUnf.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--unfaehig'
  lineUnf.style.display = 'none'
  const skull = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  skull.setAttribute('viewBox', '0 0 24 24')
  skull.setAttribute('aria-hidden', 'true')
  skull.setAttribute('focusable', 'false')
  skull.classList.add('init-hero-ex__le-threshold__skull')
  skull.style.display = 'none'
  skull.innerHTML =
    '<path fill="currentColor" d="M12 2C7.58 2 4 5.58 4 10c0 2.49 1.14 4.7 2.92 6.16.36.3.58.74.58 1.2V19a2 2 0 0 0 2 2h1v-2h1v2h2v-2h1v2h1a2 2 0 0 0 2-2v-1.64c0-.46.22-.9.58-1.2C18.86 14.7 20 12.49 20 10c0-4.42-3.58-8-8-8Zm-3 9.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm6 0a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm-4.5 3.25h3l.5 1.25h-4l.5-1.25Z"/>'
  box.append(fill, lineUnf, line5, line25, line33, line50, skull)
  return { box, fill, line50, line33, line25, line5, lineUnf, skull }
}

/** Sichtbarer Platzhalter für inaktiven Slot 9 (Kürzel SW, nicht editierbar). */
function mountSlot9Placeholder(itemId, canEdit, def) {
  const abbrText = String(def?.abbr || 'SW').trim() || 'SW'
  const titleBase =
    String(def?.tooltip || def?.label || '9. Trefferzone').trim() ||
    '9. Trefferzone'
  const cell = document.createElement('div')
  cell.className =
    'init-hero-ex__micro-cell init-hero-ex__micro-cell--wappen init-hero-ex__micro-cell--slot9-placeholder'
  const ab = document.createElement('span')
  ab.className = 'init-hero-ex__abbr'
  ab.textContent = abbrText
  ab.title = `${titleBase} — in Helden-Einstellungen konfigurierbar`
  const wappen = document.createElement('div')
  wappen.className = 'init-hero-ex__wappen init-hero-ex__wappen--slot9-placeholder'
  wappen.setAttribute('role', 'group')
  wappen.setAttribute('aria-label', `${titleBase} (Platzhalter)`)
  const chief = document.createElement('div')
  chief.className = 'init-hero-ex__wappen-chief'
  /** @type {HTMLButtonElement[]} */
  const dots = []
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('button')
    dot.type = 'button'
    dot.className = 'init-hero-ex__wappen-dot'
    dot.disabled = true
    dot.tabIndex = -1
    dot.setAttribute('aria-hidden', 'true')
    dots.push(dot)
  }
  chief.append(...dots)
  const rsInp = document.createElement('input')
  rsInp.type = 'text'
  rsInp.className = 'init-hero-ex__micro init-hero-ex__micro--wappen-rs'
  rsInp.id = `hero-ex-${itemId}-hz-slot9-rs`
  rsInp.disabled = true
  rsInp.tabIndex = -1
  rsInp.setAttribute('aria-hidden', 'true')
  wappen.append(chief, rsInp)
  const modSub = document.createElement('span')
  modSub.className = 'init-hero-ex__mod-sub-slot'
  modSub.setAttribute('aria-hidden', 'true')
  cell.append(ab, wappen, modSub)
  return {
    cell,
    rsInp,
    dots,
    zoneId: def?.id || 'slot9',
    getWunden: () => 0,
    syncDots: () => {},
    bumpWunden: () => {},
    isPlaceholder: true,
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
const SVG_MOD_CHIP_MAGIC_STAR =
  '<svg class="init-hero-ex__mod-chip-card__magic-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.8 14.7 8l5.8.8-4.2 4.1 1 5.8L12 16l-5.3 2.7 1-5.8L3.5 8.8 9.3 8z" fill="currentColor"/></svg>'

/**
 * @param {HTMLElement} container
 * @param {{ itemId: string, meta: Record<string, unknown> | undefined, canEdit: boolean, leadButtons?: HTMLElement[], displayName?: string }} opts
 */
export function mountHeroExpandBlock(
  container,
  { itemId, meta, canEdit, leadButtons, displayName }
) {
  const snap = readHeroExpandSnapshot(meta)
  const tzFieldTooltip = buildTrefferzoneInputTooltip(meta, getRoomSettings())
  const extraField = snap.extraField ?? 'none'
  const extraFieldLabels = {
    ke: ['KE', 'Karmaenergie (KE)'],
    gw: ['GW', 'Gefahrenwert (GW)'],
    lo: ['LO', 'Loyalität (LO)'],
  }
  const extraFieldAbbr = extraFieldLabels[extraField]?.[0] ?? ''
  const extraFieldFullName = extraFieldLabels[extraField]?.[1] ?? ''
  const showExtraField = extraField !== 'none'
  const showFkField = snap.showFk !== false
  const showAuField = snap.showAu === true
  const customLeThreshold =
    Number.isFinite(Number(snap.leThreshold)) && Number(snap.leThreshold) > 0
      ? Math.floor(Number(snap.leThreshold))
      : null
  const unfaehigThreshold =
    Number.isFinite(Number(snap.unfaehigThreshold)) && Number(snap.unfaehigThreshold) >= 0
      ? Math.floor(Number(snap.unfaehigThreshold))
      : 5
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

  /** Nach `gather` / `persistBasisFromGathered` gesetzt (Mount-Reihenfolge). */
  const heroSnapAccess = {
    /** @type {null | (() => Record<string, unknown>)} */
    gather: null,
    /** @type {null | ((snapLike: Record<string, unknown>) => Record<string, unknown>)} */
    persistBasis: null,
  }

  const buildUnfaehigEvalCtx = () => {
    const combUf = getCombat()
    const roundUf =
      combUf?.started && Number.isFinite(Number(combUf.round))
        ? Number(combUf.round)
        : null
    return { round: roundUf, navIni: readCurrentNavIniGlobal() }
  }

  /** Live-Inputs (Edit) oder Meta-Snapshot (Viewer / vor gather-Hook). */
  const resolveGatheredSnapForUnfaehig = (configSnap) => {
    if (
      canEdit &&
      root.isConnected &&
      heroSnapAccess.gather &&
      heroSnapAccess.persistBasis
    ) {
      return heroSnapAccess.persistBasis(heroSnapAccess.gather())
    }
    return configSnap
  }

  const ownerIniNum = readOwnerIniReferenceForMods(meta)

  const parseWholeIntFieldString = (raw) => {
    const t = String(raw ?? '').trim()
    if (!/^-?\d+$/.test(t)) return null
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : null
  }

  const microDisplayForModField = (field, baseStr) => {
    if (!integratesHeroModsIntoDisplayedValue(meta, field) || ownerIniNum == null)
      return baseStr
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
  root.className =
    'init-hero-ex' +
    (canEdit ? '' : ' init-hero-ex--view') +
    (isVierbeinerTemplateMeta(meta) ? ' init-hero-ex--vierbeiner' : '')
  /* Remount: Fill startet bei 0% — ohne Transition kein Flackern aller Rails. */
  root.classList.add('init-hero-ex--no-gauge-anim')

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
  const mrAttr = mkMicro(
    'MR',
    'Magieresistenz (MR)',
    'mr',
    microDisplayForModField('mr', snap.mr),
    3,
    '',
    true
  )

  const attrCols = document.createElement('div')
  attrCols.className = 'init-hero-ex__attr-cols'
  for (const x of [mu, kl, inn, ch, ff, ge, koAttr]) {
    attrCols.appendChild(x.cell)
  }
  attrBlock.appendChild(attrCols)

  const bottomStrip = document.createElement('div')
  bottomStrip.className = 'init-hero-ex__bottom-strip'

  let rsBypassActive = false

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
  const rsBypassBtn = document.createElement('button')
  rsBypassBtn.type = 'button'
  rsBypassBtn.className =
    'init-hero-ex__sp-tz-label-btn init-hero-ex__rs-bypass-btn'
  rsBypassBtn.innerHTML = RS_BYPASS_TOGGLE_SVG
  rsBypassBtn.title = 'Rüstungsschutz bei Treffer auswerten ignorieren'
  rsBypassBtn.setAttribute(
    'aria-label',
    'Rüstungsschutz bei Trefferauswertung ignorieren'
  )
  rsBypassBtn.setAttribute('aria-pressed', 'false')

  const spTzLabelTools = document.createElement('div')
  spTzLabelTools.className = 'init-hero-ex__sp-tz-pair__label-tools'
  spTzLabelTools.append(spTzUndo, rsBypassBtn, spTzRedo)

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
  tzAbbr.className = 'init-hero-ex__abbr init-hero-ex__abbr--sp-tz-tz'
  tzAbbr.textContent = 'TZ'
  tzAbbr.title = tzFieldTooltip
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
  tzInp.className =
    'init-hero-ex__micro init-hero-ex__micro--sp-tz-inp init-hero-ex__micro--sp-tz-tz-inp'
  tzInp.id = `hero-ex-${itemId}-tz`
  tzInp.autocomplete = 'off'
  tzInp.spellcheck = false
  tzInp.disabled = !canEdit
  tzInp.value = snap.tz
  tzInp.maxLength = 12
  tzInp.title = tzFieldTooltip
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
  attrKoTpWrap.append(kk.cell)
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
  const au = mkMicro(
    'AU',
    'Ausdauer (AU)',
    'au',
    microDisplayForModField('au', snap.au),
    3,
    '',
    true
  )
  const ae = mkMicro(
    'AE',
    'Astralenergie (AE)',
    'ae',
    microDisplayForModField('ae', snap.ae),
    3,
    '',
    true
  )
  const extraFieldValue =
    extraField === 'ke'
      ? microDisplayForModField('ke', snap.ke)
      : extraField === 'gw'
        ? microDisplayForModField('gw', snap.gw)
        : extraField === 'lo'
          ? microDisplayForModField('lo', snap.lo)
          : ''
  const extra = mkMicro(
    extraFieldAbbr || '—',
    extraFieldFullName || 'Zusatzfeld',
    'extra',
    extraFieldValue,
    3,
    '',
    true
  )
  extra.cell.classList.add('init-hero-ex__micro-cell--after-fk')
  const ibChain = document.createElement('div')
  ibChain.className = 'init-hero-ex__ib-chain'
  /* Nur MOD (+ MOD+); GS/IB/BE/W6 stehen davor in .init-hero-ex__strip-inner. */
  const mkChainAbbr = (text, title, noUppercase) => {
    const s = document.createElement('span')
    s.className =
      'init-hero-ex__abbr' +
      (noUppercase ? ' init-hero-ex__abbr--no-case' : '')
    s.textContent = text
    s.title = title
    return s
  }
  const gsAbbrLabel = mkChainAbbr('GS', 'Geschwindigkeit (GS)')
  const HERO_FIELD_MOD_INTEGRATED_HINT =
    ' Modifikatoren sind in der angezeigten Zahl bereits eingerechnet und erscheinen im Mod-Band darunter zusätzlich in Klammern.'
  const ibAbbrLabel = mkChainAbbr(
    'IB',
    'Ini-Basis + Modifikation (IB).' + HERO_FIELD_MOD_INTEGRATED_HINT.trim()
  )
  const ibBeLbl = mkChainAbbr(
    'BE',
    'Behinderung (BE).' + HERO_FIELD_MOD_INTEGRATED_HINT.trim(),
    true
  )
  const ibW6Lbl = mkChainAbbr('W6', 'Würfelwurf (W6)', true)
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
  const gsInp = document.createElement('input')
  gsInp.type = 'text'
  gsInp.inputMode = 'numeric'
  gsInp.className = 'init-hero-ex__micro init-hero-ex__micro--gs-chain'
  gsInp.id = `hero-ex-${itemId}-gs`
  gsInp.autocomplete = 'off'
  gsInp.spellcheck = false
  gsInp.disabled = !canEdit
  gsInp.value = microDisplayForModField('gs', snap.gs)
  gsInp.maxLength = 3
  gsInp.title = 'Geschwindigkeit (GS)'
  gsInp.setAttribute('aria-label', 'Geschwindigkeit (GS)')
  const ibInp = mkChainInp(
    'ib',
    microDisplayForModField('ib', snap.ib),
    10,
    false,
    'Ini-Basis + Modifikation (IB).' + HERO_FIELD_MOD_INTEGRATED_HINT.trim()
  )
  const beInp = mkChainInp(
    'be',
    microDisplayForModField('be', snap.be),
    3,
    true,
    'Behinderung (BE).' + HERO_FIELD_MOD_INTEGRATED_HINT.trim()
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
  /** GS wie KO: Mikrozelle (Kuerzel + eigenes Kaestchen), nicht Ketten-/Segment-Rahmen. */
  const gsCell = document.createElement('div')
  gsCell.className =
    'init-hero-ex__micro-cell init-hero-ex__micro-cell--gs-chain'
  gsCell.append(gsAbbrLabel, gsInp)
  const stackGs = document.createElement('div')
  stackGs.className =
    'init-hero-ex__ib-chain__stack init-hero-ex__ib-chain__stack--gs-r-gap'
  stackGs.appendChild(gsCell)
  const ibCol = mkIbChainCol(ibInp)
  const beCol = mkIbChainCol(beInp)
  const stackIb = mkIbChainStack(ibAbbrLabel, ibCol)
  const stackBe = mkIbChainStack(ibBeLbl, beCol)
  const w6Col = mkIbChainCol(w6Inp)
  const stackW6 = mkIbChainStack(ibW6Lbl, w6Col)

  /** @type {HTMLButtonElement | null} */
  let modToggleBtn = null

  const modStrip = document.createElement('div')
  modStrip.className = 'init-hero-ex__mods-strip'
  modStrip.setAttribute('aria-label', 'Aktive Modifikatoren')
  /** @type {HTMLDivElement | null} */
  let modIbCol = null
  /** @type {HTMLDivElement | null} */
  let stackMod = null

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
      'init-hero-ex__ib-chain__inp-cell init-hero-ex__ib-chain__inp-cell--mod-pick init-hero-ex__ib-chain__inp-cell--mod-solo-btn'
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

  const ibChainCols = document.createElement('div')
  ibChainCols.className = 'init-hero-ex__ib-chain__cols'
  if (stackMod) ibChainCols.appendChild(stackMod)
  ibChain.appendChild(ibChainCols)
  const gs = { inp: gsInp, ab: gsAbbrLabel }
  const ib = { inp: ibInp }
  const be = { inp: beInp }
  const w6 = { inp: w6Inp }

  /** @type {HTMLElement | null} */
  let auEnergyRailRoot = null
  /** @type {HTMLElement | null} */
  let aeEnergyRailRoot = null
  /** @type {HTMLElement | null} */
  let keEnergyRailRoot = null
  /** @type {HTMLElement | null} */
  let clusterSRailRoot = null

  /** @param {{ showAu?: boolean, showFk?: boolean, extraField?: string }} vis */
  const applyConfigurableFieldVisibility = (vis) => {
    const showAu = vis.showAu === true
    const showFk = vis.showFk !== false
    const ef = String(vis.extraField ?? 'none').trim().toLowerCase()
    const showExtra = ef === 'ke' || ef === 'gw' || ef === 'lo'
    /** @param {HTMLElement} cell @param {HTMLInputElement} inp @param {boolean} show */
    const setFieldVisible = (cell, inp, show) => {
      if (show) {
        cell.style.visibility = 'visible'
        cell.style.pointerEvents = ''
        cell.classList.remove('init-hero-ex__micro-cell--layout-reserve-hidden')
        cell.removeAttribute('aria-hidden')
        inp.disabled = !canEdit
        inp.tabIndex = 0
      } else {
        cell.style.visibility = 'hidden'
        cell.style.pointerEvents = 'none'
        cell.classList.add('init-hero-ex__micro-cell--layout-reserve-hidden')
        cell.setAttribute('aria-hidden', 'true')
        inp.disabled = true
        inp.tabIndex = -1
      }
    }
    setFieldVisible(au.cell, au.inp, showAu)
    setFieldVisible(fk.cell, fk.inp, showFk)
    setFieldVisible(extra.cell, extra.inp, showExtra)
    const setRailVisible = (railRoot, show) => {
      if (!railRoot) return
      railRoot.style.visibility = show ? 'visible' : 'hidden'
      if (show) railRoot.removeAttribute('aria-hidden')
      else railRoot.setAttribute('aria-hidden', 'true')
    }
    setRailVisible(auEnergyRailRoot, showAu)
    setRailVisible(aeEnergyRailRoot, true)
    setRailVisible(keEnergyRailRoot, showExtra && ef === 'ke')
    setRailVisible(clusterSRailRoot, true)
  }
  applyConfigurableFieldVisibility(snap)

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
  for (let slot = 1; slot <= 9; slot++) {
    const def = wappenBySlot.get(slot)
    if (slot === 9 && (!def || def.active === false)) {
      const ui = mountSlot9Placeholder(itemId, canEdit, def ?? { abbr: 'SW' })
      ui.cell.style.visibility = 'hidden'
      ui.cell.setAttribute('aria-hidden', 'true')
      zoneMidRow.appendChild(ui.cell)
      continue
    }
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

  const applyRsBypassUi = (active) => {
    rsBypassActive = active
    rsBypassBtn.classList.toggle('init-hero-ex__rs-bypass-btn--active', active)
    rsBypassBtn.setAttribute('aria-pressed', active ? 'true' : 'false')
    rsBypassBtn.title = active
      ? 'Rüstungsschutz wieder berücksichtigen'
      : 'Rüstungsschutz bei Treffer auswerten ignorieren'
    rsBypassBtn.setAttribute(
      'aria-label',
      active
        ? 'Rüstungsschutz wieder berücksichtigen'
        : 'Rüstungsschutz bei Trefferauswertung ignorieren'
    )
    for (const ui of zoneUiMid) {
      ui.rsInp.classList.toggle('init-hero-ex__micro--rs-bypassed', active)
      ui.rsInp.disabled = active || !canEdit
    }
  }
  rsBypassBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    applyRsBypassUi(!rsBypassActive)
  })
  applyRsBypassUi(false)

  const leChain = document.createElement('div')
  leChain.className = 'init-hero-ex__le-chain'
  const leMaxTitle = 'Lebensenergie Maximum (LE max)'
  /** @param {string} idSuf @param {string} value @param {number} maxLen @param {string} title */
  const mkMaxSubInp = (idSuf, value, maxLen, title) => {
    const inp = mkChainInp(idSuf, value, maxLen, true, title)
    inp.className = 'init-hero-ex__micro init-hero-ex__micro--max-sub'
    inp.placeholder = 'MAX'
    return inp
  }
  /**
   * MAX direkt unter Hauptwert in derselben Mikrozelle.
   * @param {HTMLElement} cell
   * @param {HTMLInputElement} maxInp
   * @returns {HTMLDivElement}
   */
  const attachValueMaxStack = (cell, maxInp) => {
    const mainInp = cell.querySelector(
      ':scope > .init-hero-ex__micro:not(.init-hero-ex__micro--max-sub)'
    )
    const stack = document.createElement('div')
    stack.className = 'init-hero-ex__value-max-stack'
    if (mainInp instanceof HTMLInputElement) {
      mainInp.replaceWith(stack)
      stack.append(mainInp, maxInp)
    } else {
      stack.append(maxInp)
      cell.appendChild(stack)
    }
    return stack
  }
  const leInp = mkChainInp(
    'le',
    microDisplayForModField('le', snap.le),
    3,
    true,
    'Lebensenergie (LE).' + HERO_FIELD_MOD_INTEGRATED_HINT.trim()
  )
  leInp.className = 'init-hero-ex__micro'
  const leMaxInp = mkMaxSubInp(
    'lemax',
    microDisplayForModField('leMax', snap.leMax),
    3,
    `${leMaxTitle}.${HERO_FIELD_MOD_INTEGRATED_HINT.trim()}`
  )
  if (canEdit) {
    leInp.removeAttribute('readonly')
    leInp.removeAttribute('aria-readonly')
    leMaxInp.removeAttribute('readonly')
    leMaxInp.removeAttribute('aria-readonly')
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
  const leValueMaxStack = document.createElement('div')
  leValueMaxStack.className =
    'init-hero-ex__value-max-stack init-hero-ex__s-rail-inset-stack'
  leValueMaxStack.append(leInp, leMaxInp)
  const auMaxTitle = 'Ausdauermaximum (AU-Max)'
  const aeMaxTitle = 'Astralenergiemaximum (AE-Max)'
  const keMaxTitle = 'Karmaenergiemaximum (KE-Max)'
  const auMaxInp = mkMaxSubInp('aumax', snap.auMax, 3, auMaxTitle)
  const aeMaxInp = mkMaxSubInp('aemax', snap.aeMax, 3, aeMaxTitle)
  const keMaxInp = mkMaxSubInp('kemax', snap.keMax, 3, keMaxTitle)

  /**
   * KE/AE/AU-Schwellenbalken (Wert+MAX im Balken); Kürzel auf dem Rail wie bei LE.
   * @param {HTMLElement} anchorCell
   * @param {HTMLElement} abbrEl
   * @param {HTMLInputElement} mainInp
   * @param {HTMLInputElement} maxInp
   */
  const mountEnergyThresholdRail = (anchorCell, abbrEl, mainInp, maxInp) => {
    anchorCell.classList.add('init-hero-ex__micro-cell--energy-rail-anchor')
    const stack = document.createElement('div')
    stack.className =
      'init-hero-ex__value-max-stack init-hero-ex__energy-rail-inset-stack'
    if (mainInp.parentNode === anchorCell) mainInp.remove()
    stack.append(mainInp, maxInp)
    const gauge = createLeThresholdGaugeBox(
      'init-hero-ex__le-threshold__box--energy'
    )
    gauge.box.prepend(stack)
    const railRoot = document.createElement('div')
    railRoot.className =
      'init-hero-ex__energy-rail-root init-hero-ex__le-threshold init-hero-ex__le-threshold--rail'
    if (abbrEl.parentNode === anchorCell) abbrEl.remove()
    railRoot.append(abbrEl, gauge.box)
    return { root: railRoot, host: railRoot, stack, ...gauge }
  }

  const aeEnergyRail = mountEnergyThresholdRail(
    ae.cell,
    ae.ab,
    ae.inp,
    aeMaxInp
  )
  const auEnergyRail = mountEnergyThresholdRail(
    au.cell,
    au.ab,
    au.inp,
    auMaxInp
  )
  /** @type {ReturnType<typeof mountEnergyThresholdRail> | null} */
  let keEnergyRail = null
  if (showExtraField && extraField === 'ke') {
    keEnergyRail = mountEnergyThresholdRail(
      extra.cell,
      extra.ab,
      extra.inp,
      keMaxInp
    )
  }
  aeEnergyRailRoot = aeEnergyRail.root
  auEnergyRailRoot = auEnergyRail.root
  keEnergyRailRoot = keEnergyRail?.root ?? null

  /** @type {{ host: HTMLElement, box: HTMLDivElement, fill: HTMLDivElement, line50: HTMLDivElement, line33: HTMLDivElement, line25: HTMLDivElement, line5: HTMLDivElement, lineUnf: HTMLDivElement, skull: SVGSVGElement, anchorCell: HTMLElement, abbrEl: HTMLElement, mainInp: HTMLInputElement, maxInp: HTMLInputElement }[]} */
  const energyGaugeSets = []
  if (keEnergyRail) {
    energyGaugeSets.push({
      ...keEnergyRail,
      anchorCell: extra.cell,
      abbrEl: extra.ab,
      mainInp: extra.inp,
      maxInp: keMaxInp,
    })
  }
  energyGaugeSets.push(
    {
      ...aeEnergyRail,
      anchorCell: ae.cell,
      abbrEl: ae.ab,
      mainInp: ae.inp,
      maxInp: aeMaxInp,
    },
    {
      ...auEnergyRail,
      anchorCell: au.cell,
      abbrEl: au.ab,
      mainInp: au.inp,
      maxInp: auMaxInp,
    }
  )
  applyConfigurableFieldVisibility(snap)

  const wsAbbrLbl = mkChainAbbr('WS', WS_RULES_TOOLTIP)
  const wsInp = mkChainInp(
    'ws',
    microDisplayForModField('ws', snap.ws),
    12,
    false,
    'Wundschwelle + Modifikation (WS)'
  )
  wsInp.title = WS_RULES_TOOLTIP
  const wsCol = mkLeChainCol(wsInp)
  const stackWs = mkLeChainStack(wsAbbrLbl, wsCol)
  stackWs.classList.add('init-hero-ex__micro-cell--ws-le-match')
  const ws = { inp: wsInp, ab: wsAbbrLbl }
  const leChainCols = document.createElement('div')
  leChainCols.className = 'init-hero-ex__le-chain__cols'
  leChainCols.append(stackWs)
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

  const leThreshRailAbbr = mkChainAbbr('LE', LE_THRESHOLD_TOOLTIP)
  const leThreshRail = createLeThresholdGaugeBox(
    'init-hero-ex__le-threshold__box--tall'
  )
  leThreshRail.box.prepend(leValueMaxStack)
  const sRailRoot = document.createElement('div')
  sRailRoot.className =
    'init-hero-ex__s-rail-root init-hero-ex__le-threshold init-hero-ex__le-threshold--rail'
  sRailRoot.append(leThreshRailAbbr, leThreshRail.box)
  clusterSRailRoot = sRailRoot

  /** @type {{ host: HTMLElement, box: HTMLDivElement, fill: HTMLDivElement, line50: HTMLDivElement, line33: HTMLDivElement, line25: HTMLDivElement, line5: HTMLDivElement, lineUnf: HTMLDivElement, skull: SVGSVGElement }[]} */
  const leThreshGaugeSets = [{ host: sRailRoot, ...leThreshRail }]

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
  const parseWsIntSafe = (raw) => {
    const t = String(raw ?? '').trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : null
  }
  /**
   * @param {ReturnType<typeof readHeroExpandSnapshot>} curSnap
   * @returns {'lt0'|'minusKo'|'minusOnePointFiveKo'}
   */
  const resolveDeathModeForLeUi = (curSnap) => {
    const v = String(curSnap?.deathMode ?? '')
      .trim()
      .toLowerCase()
    if (v === 'lt0' || v === 'minusko' || v === 'minusonepointfiveko') {
      return v === 'minusko'
        ? 'minusKo'
        : v === 'minusonepointfiveko'
          ? 'minusOnePointFiveKo'
          : 'lt0'
    }
    const legacy = String(curSnap?.deathAtMinusOnePointFiveKo ?? '')
      .trim()
      .toLowerCase()
    if (['1', 'true', 'on', 'yes', 'ja'].includes(legacy)) {
      return 'minusOnePointFiveKo'
    }
    return 'minusKo'
  }
  /**
   * @param {number | null} leNum
   * @param {number | null} koNum
   * @param {'lt0'|'minusKo'|'minusOnePointFiveKo'} deathMode
   * @returns {boolean}
   */
  const isDeathTriggeredForLeUi = (leNum, koNum, deathMode) => {
    if (leNum === null) return false
    if (deathMode === 'lt0') return leNum <= 0
    if (!(koNum != null && koNum > 0)) return false
    const depth = -leNum
    const threshold = deathMode === 'minusOnePointFiveKo' ? 1.5 * koNum : koNum
    return depth >= threshold
  }
  /**
   * Blinkgrenze in LE (nicht in Tiefe), ab der der Negativ-Puls endet.
   * @param {number | null} koNum
   * @param {'lt0'|'minusKo'|'minusOnePointFiveKo'} deathMode
   * @returns {number}
   */
  const blinkStopLeBoundaryForMode = (koNum, deathMode) => {
    if (deathMode === 'lt0') return 0
    if (!(koNum != null && koNum > 0)) return Number.NEGATIVE_INFINITY
    return deathMode === 'minusOnePointFiveKo' ? -1.5 * koNum : -koNum
  }
  /** Minus-Skala 0 … −1,6·KO (ab LE≤0 mit gültigem KO). */
  const NEG_LE_KO_RANGE = 1.6

  /** LE-Zahl am Balken (`data-le-val` → CSS `::after`); ohne Attribut keine Beschriftung. */
  const setGaugeLineLeVal = (lineEl, n) => {
    if (typeof n !== 'number' || !Number.isFinite(n))
      lineEl.removeAttribute('data-le-val')
    else lineEl.dataset.leVal = String(Math.round(n))
  }

  /** Schwellen-Zahlen an Gauge-Linien (S-Rail). */
  const syncGaugeLineLeVals = (
    g,
    { negLe, maxV, koV, wsRaw, customLeThreshold, unfaehigThreshold }
  ) => {
    if (negLe && koV != null && koV > 0) {
      const pctBot = (m) => 100 - (m / NEG_LE_KO_RANGE) * 100
      const wsThreshold =
        wsRaw != null && wsRaw > 0 ? wsRaw : Math.round(0.5 * koV)
      const wsMult = Math.max(0, Math.min(NEG_LE_KO_RANGE, wsThreshold / koV))
      const bWs = pctBot(wsMult)
      const b1 = pctBot(1)
      const b15 = pctBot(1.5)
      const n15 = Math.round(1.5 * koV)
      g.line50.removeAttribute('data-le-val')
      g.lineUnf.removeAttribute('data-le-val')
      setGaugeLineLeVal(g.line33, -Math.round(wsThreshold))
      setGaugeLineLeVal(g.line25, -koV)
      setGaugeLineLeVal(g.line5, -n15)
      const minBotNeg = Math.min(bWs, b1, b15)
      const eps = 1e-9
      for (const [lineEl, bot] of [
        [g.line33, bWs],
        [g.line25, b1],
        [g.line5, b15],
      ]) {
        if (Math.abs(bot - minBotNeg) < eps)
          lineEl.removeAttribute('data-le-val')
      }
      return
    }

    const maxOk = maxV != null && maxV > 0
    if (maxOk) {
      setGaugeLineLeVal(g.line50, Math.round(maxV / 2))
      setGaugeLineLeVal(g.line33, Math.round(maxV / 3))
      setGaugeLineLeVal(g.line25, Math.round(maxV / 4))
    } else {
      g.line50.removeAttribute('data-le-val')
      g.line33.removeAttribute('data-le-val')
      g.line25.removeAttribute('data-le-val')
    }

    if (customLeThreshold != null && maxV != null && maxV > customLeThreshold) {
      setGaugeLineLeVal(g.line5, customLeThreshold)
    } else {
      g.line5.removeAttribute('data-le-val')
    }

    if (maxV != null && maxV > 0 && maxV > unfaehigThreshold) {
      setGaugeLineLeVal(g.lineUnf, unfaehigThreshold)
    } else {
      g.lineUnf.removeAttribute('data-le-val')
    }
  }

  /** Nur bei geänderter Höhe schreiben (vermeidet CSS-transition-Neustart). */
  const setGaugeFillHeight = (fill, heightStr) => {
    if (fill.style.height !== heightStr) fill.style.height = heightStr
  }

  let gaugeLiveClearRaf = 0
  const syncGaugeLiveEditClass = () => {
    const active = document.activeElement
    root.classList.toggle(
      'init-hero-ex--gauge-live',
      active === leInp || active === leMaxInp
    )
  }
  const armGaugeLiveEdit = () => {
    root.classList.add('init-hero-ex--gauge-live')
    if (gaugeLiveClearRaf) cancelAnimationFrame(gaugeLiveClearRaf)
    gaugeLiveClearRaf = requestAnimationFrame(() => {
      gaugeLiveClearRaf = 0
      syncGaugeLiveEditClass()
    })
  }
  for (const inp of [leInp, leMaxInp]) {
    inp.addEventListener('focus', () => root.classList.add('init-hero-ex--gauge-live'))
    inp.addEventListener('blur', () => syncGaugeLiveEditClass())
    inp.addEventListener('input', armGaugeLiveEdit)
  }

  const resetLeThreshNegOff = () => {
    for (const g of leThreshGaugeSets) {
      g.host.classList.remove('init-hero-ex__le-threshold--neg-le')
      g.host.classList.remove('init-hero-ex__le-threshold--neg-pulse')
      g.host.classList.remove(
        'init-hero-ex__le-threshold--neg-pulse--irregular'
      )
      g.fill.classList.remove('init-hero-ex__le-threshold__fill--from-top')
      g.skull.style.removeProperty('bottom')
      g.skull.style.removeProperty('transform')
      g.fill.style.removeProperty('top')
      g.fill.style.removeProperty('bottom')
      g.line50.style.display = ''
      g.line50.style.bottom = '50%'
      g.line33.style.bottom = '33.333%'
      g.line25.style.bottom = '25%'
      g.line33.classList.remove('init-hero-ex__le-threshold__line--neg-ko')
      g.line25.classList.remove(
        'init-hero-ex__le-threshold__line--neg-le-solid'
      )
      g.line5.classList.remove(
        'init-hero-ex__le-threshold__line--neg-le-solid'
      )
      g.lineUnf.style.display = 'none'
      for (const lineEl of [g.line50, g.line33, g.line25, g.line5, g.lineUnf]) {
        lineEl.removeAttribute('data-le-val')
      }
    }
  }

  const updateLeThreshold = () => {
    const leV = parseLeIntSafe(leInp.value)
    const maxV = parseLeIntSafe(leMaxInp.value)
    const koV = parseKoIntSafe(koAttr.inp.value)
    const wsRaw = parseWsIntSafe(ws.inp.value)
    const deathMode = resolveDeathModeForLeUi(snap)
    const deathTriggered = isDeathTriggeredForLeUi(leV, koV, deathMode)
    const blinkStopBoundary = blinkStopLeBoundaryForMode(koV, deathMode)
    /* KO/minus-Skala und Ansicht ab LE≤0 (inkl. LE=0), sobald KO gültig */
    const negLe =
      leV != null && leV <= 0 && koV != null && koV > 0
    const dead = leV != null && leV <= 0 && !negLe
    const gaugeValCtx = {
      negLe,
      maxV,
      koV,
      wsRaw,
      customLeThreshold,
      unfaehigThreshold,
    }

    if (negLe) {
      resetLeThreshNegOff()
      const depth = -leV
      const cap = NEG_LE_KO_RANGE * koV
      const hp = Math.min(100, (depth / cap) * 100)
      const pctBot = (koMult) =>
        100 - (koMult / NEG_LE_KO_RANGE) * 100
      const wsThreshold = wsRaw != null && wsRaw > 0 ? wsRaw : Math.round(0.5 * koV)
      const wsMult = Math.max(0, Math.min(NEG_LE_KO_RANGE, wsThreshold / koV))
      const b1 = pctBot(1)
      const b15 = pctBot(1.5)
      const skullBot = (b1 + b15) / 2
      const negPulseOn = !deathTriggered && leV > blinkStopBoundary
      const negPulseIrregular =
        negPulseOn && leV <= -wsThreshold
      for (const g of leThreshGaugeSets) {
        g.host.classList.add('init-hero-ex__le-threshold--neg-le')
        g.fill.classList.add('init-hero-ex__le-threshold__fill--from-top')
        g.fill.style.bottom = 'auto'
        g.fill.style.top = '0'
        setGaugeFillHeight(g.fill, hp.toFixed(3) + '%')
        g.host.dataset.leBand = 'neg-le'
        g.skull.style.display = ''
        g.line50.style.display = 'none'
        g.line33.style.display = ''
        g.line33.style.bottom = `${pctBot(wsMult).toFixed(3)}%`
        g.line33.classList.add('init-hero-ex__le-threshold__line--neg-ko')
        g.line25.style.display = ''
        g.line25.style.bottom = `${pctBot(1).toFixed(3)}%`
        g.line25.classList.add(
          'init-hero-ex__le-threshold__line--neg-le-solid'
        )
        g.line5.style.display = ''
        g.line5.style.bottom = `${pctBot(1.5).toFixed(3)}%`
        g.line5.classList.add(
          'init-hero-ex__le-threshold__line--neg-le-solid'
        )
        g.lineUnf.style.display = 'none'
        g.skull.style.bottom = `${skullBot.toFixed(3)}%`
        g.skull.style.top = 'auto'
        g.skull.style.transform = 'translate(-50%, 50%)'
        g.host.classList.toggle(
          'init-hero-ex__le-threshold--neg-pulse',
          negPulseOn
        )
        g.host.classList.toggle(
          'init-hero-ex__le-threshold--neg-pulse--irregular',
          negPulseIrregular
        )
        syncGaugeLineLeVals(g, gaugeValCtx)
      }
      return
    }

    resetLeThreshNegOff()

    for (const g of leThreshGaugeSets) {
      g.skull.style.display = dead ? '' : 'none'
      if (dead) {
        setGaugeFillHeight(g.fill, '0%')
        g.host.dataset.leBand = 'crit'
      } else if (leV != null && maxV != null && maxV > 0) {
        const frac = Math.max(0, Math.min(1, leV / maxV))
        setGaugeFillHeight(g.fill, (frac * 100).toFixed(3) + '%')
        g.host.dataset.leBand = leBarColorBand(leV, maxV)
      } else {
        setGaugeFillHeight(g.fill, '0%')
        delete g.host.dataset.leBand
      }
      if (customLeThreshold != null && maxV != null && maxV > customLeThreshold) {
        g.line5.style.display = ''
        g.line5.style.bottom =
          ((customLeThreshold / maxV) * 100).toFixed(3) + '%'
      } else {
        g.line5.style.display = 'none'
      }
      if (maxV != null && maxV > 0 && maxV > unfaehigThreshold) {
        g.lineUnf.style.display = ''
        g.lineUnf.style.bottom =
          ((unfaehigThreshold / maxV) * 100).toFixed(3) + '%'
        g.lineUnf.title = `Schwelle unfähig (LE ≤ ${unfaehigThreshold})`
      } else {
        g.lineUnf.style.display = 'none'
      }
      syncGaugeLineLeVals(g, gaugeValCtx)
    }
  }
  const updateEnergyThreshold = () => {
    for (const g of energyGaugeSets) {
      g.host.classList.remove(
        'init-hero-ex__le-threshold--neg-le',
        'init-hero-ex__le-threshold--neg-pulse',
        'init-hero-ex__le-threshold--neg-pulse--irregular'
      )
      g.fill.classList.remove('init-hero-ex__le-threshold__fill--from-top')
      g.fill.style.bottom = '0'
      g.fill.style.top = 'auto'
      g.line5.style.display = 'none'
      g.lineUnf.style.display = 'none'
      g.skull.style.display = 'none'
      g.line50.style.display = ''
      g.line33.style.display = ''
      g.line25.style.display = ''
      const val = parseNonNegIntLoose(g.mainInp.value)
      const maxV = parseNonNegIntLoose(g.maxInp.value)
      if (val != null && maxV != null && maxV > 0) {
        const frac = Math.max(0, Math.min(1, val / maxV))
        setGaugeFillHeight(g.fill, (frac * 100).toFixed(3) + '%')
        g.host.dataset.leBand = leBarColorBand(val, maxV)
      } else {
        setGaugeFillHeight(g.fill, '0%')
        delete g.host.dataset.leBand
      }
    }
  }
  let gaugeRefreshRaf = 0
  const scheduleGaugeRefresh = () => {
    if (gaugeRefreshRaf) return
    gaugeRefreshRaf = requestAnimationFrame(() => {
      gaugeRefreshRaf = 0
      updateLeThreshold()
      updateEnergyThreshold()
    })
  }

  updateLeThreshold()
  updateEnergyThreshold()
  for (const g of energyGaugeSets) {
    g.mainInp.addEventListener('input', scheduleGaugeRefresh)
    g.maxInp.addEventListener('input', scheduleGaugeRefresh)
  }

  leInp.addEventListener('input', scheduleGaugeRefresh)
  leMaxInp.addEventListener('input', scheduleGaugeRefresh)
  koAttr.inp.addEventListener('input', scheduleGaugeRefresh)

  const totalWunden = () =>
    zoneUiMid.reduce((a, u) => a + (u.getWunden() || 0), 0)

  const hasZoneThirdWound = () =>
    zoneUiMid.some((u) => (u.getWunden?.() ?? 0) >= 3)

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
    gs: { cell: gsCell, inp: gsInp, ab: gsAbbrLabel },
    ge: { cell: ge.cell, inp: ge.inp, ab: ge.ab },
  }

  const unfaehigVisualTargets = {
    at: at.cell,
    pa: pa.cell,
    a: ausw.cell,
    tp: tpCell,
    fk: fk.cell,
    gs: gsCell,
  }
  const applyUnfaehigVisualOverlay = (metaForMods = meta) => {
    for (const cell of Object.values(unfaehigVisualTargets)) {
      if (!(cell instanceof HTMLElement)) continue
      cell.classList.remove('init-hero-ex__micro-cell--unfaehig-mark')
    }

    const metaBase = metaForMods ?? meta
    const configSnap = readHeroExpandSnapshot(metaBase)
    const ufState = resolveUnfaehigOverlayState(
      metaBase,
      resolveGatheredSnapForUnfaehig(configSnap),
      buildUnfaehigEvalCtx(),
      {
        mode: 'overlay',
        markFields: configSnap.unfaehigMarkFields,
      }
    )

    if (!ufState.active) return

    if (ufState.armOnly) {
      const fkCell = unfaehigVisualTargets.fk
      if (fkCell instanceof HTMLElement) {
        fkCell.classList.add('init-hero-ex__micro-cell--unfaehig-mark')
      }
      return
    }

    for (const key of ufState.marked) {
      const cell = unfaehigVisualTargets[key]
      if (cell instanceof HTMLElement) {
        cell.classList.add('init-hero-ex__micro-cell--unfaehig-mark')
      }
    }
    const hasAnyFixed = Object.values(configSnap.unfaehigFixedFields || {}).some((v) =>
      Number.isFinite(Number(v))
    )
    if (hasAnyFixed) gsCell.classList.add('init-hero-ex__micro-cell--unfaehig-mark')
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

  const syncLeMaxInputVisibility = () => {
    const leNow = parseLeIntSafe(leInp.value)
    const koV = parseKoIntSafe(koAttr.inp.value)
    const negLe =
      leNow != null && leNow <= 0 && koV != null && koV > 0
    leMaxInp.hidden = negLe
    leMaxInp.style.display = negLe ? 'none' : ''
    leValueMaxStack.classList.toggle(
      'init-hero-ex__value-max-stack--neg-le',
      negLe
    )
  }
  leInp.addEventListener('input', syncLeMaxInputVisibility)
  leMaxInp.addEventListener('input', syncLeMaxInputVisibility)
  syncLeMaxInputVisibility()

    zoneMidRow.append(spTzPair)
  attrKoTpWrap.append(mrAttr.cell, leChain)

  const leRailSlot = document.createElement('div')
  leRailSlot.className =
    'init-hero-ex__micro-cell init-hero-ex__micro-cell--le-rail-slot'
  leRailSlot.setAttribute('aria-hidden', 'true')

  stripInner.append(
    at.cell,
    pa.cell,
    ausw.cell,
    tpCell,
    stackGs,
    stackIb,
    stackBe,
    stackW6,
    fk.cell,
    extra.cell,
    ae.cell,
    au.cell,
    leRailSlot,
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
  ).filter((f) => {
    if (f === 'ae') return true
    if (f === 'ke') return showExtraField && extraField === 'ke'
    if (f === 'gw') return showExtraField && extraField === 'gw'
    if (f === 'lo') return showExtraField && extraField === 'lo'
    return true
  })
  const modFieldsEigenschaften = [
    'mu',
    'kl',
    'inn',
    'ch',
    'ff',
    'ge',
    'kk',
    'ko',
    ...(showAuField ? ['au'] : []),
  ].filter((f) => MOD_FIELDS.includes(f))

  const energyRailRoots = [aeEnergyRail.root, auEnergyRail.root]
  if (keEnergyRail) energyRailRoots.push(keEnergyRail.root)
  root.append(
    leadSpacer,
    strip,
    zoneMidRow,
    bottomStrip,
    spacerExp,
    sRailRoot,
    ...energyRailRoots
  )
  /* Bis erster Layout-Sync: Rails unsichtbar, aber layoutbar (kein visibility-Flash). */
  root.classList.add('init-hero-ex--rails-pending')
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
    gs: { cell: gsCell, inp: gsInp, ab: gsAbbrLabel },
    ae: { cell: ae.cell, inp: ae.inp, ab: ae.ab },
    au: { cell: au.cell, inp: au.inp, ab: au.ab },
    ...(showExtraField && extraField === 'ke'
      ? { ke: { cell: extra.cell, inp: extra.inp, ab: extra.ab } }
      : showExtraField && extraField === 'gw'
        ? { gw: { cell: extra.cell, inp: extra.inp, ab: extra.ab } }
        : showExtraField && extraField === 'lo'
          ? { lo: { cell: extra.cell, inp: extra.inp, ab: extra.ab } }
          : {}),
    le: { cell: sRailRoot, inp: leInp, ab: leThreshRailAbbr },
    leMax: { cell: leValueMaxStack, inp: leMaxInp, ab: null },
    tp: { cell: tpCell, inp: tpInp, ab: tpAbbr },
    ws: { cell: stackWs, inp: ws.inp, ab: ws.ab },
    mr: { cell: mrAttr.cell, inp: mrAttr.inp, ab: mrAttr.ab },
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
  stackBe
    .querySelector(':scope > .init-hero-ex__mod-sub-slot')
    ?.classList?.remove('init-hero-ex__mod-sub-slot--be-compact')
  if (!stackW6.querySelector(':scope > .init-hero-ex__mod-sub-slot')) {
    const w6Sub = document.createElement('span')
    w6Sub.className = 'init-hero-ex__mod-sub-slot'
    w6Sub.setAttribute('aria-hidden', 'true')
    stackW6.appendChild(w6Sub)
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

  let lastModStripChipCount = -1
  /** Blockiert ResizeObserver während Mod-DOM-Update (nicht runSync). */
  let heroLayoutRoLock = false
  /** Reentrancy-Guard für laufenden Layout-Sync. */
  let heroLayoutSyncing = false
  let lastFkKeLayoutSig = ''
  let lastClusterRailLayoutSig = ''
  let heroClusterRailsAwaitFirstLayout = true
  let lastSpAbbrTranslateY = Number.NaN
  let lastTzAbbrTranslateY = Number.NaN
  let lastModShellTranslateY = Number.NaN
  /** Letzte Interaktion im Heldenblock (Fokus/Klick/Eingabe). */
  let lastHeroInteractionAt = 0
  /** @type {ReturnType<typeof setTimeout> | null} */
  let deferredHeroLayoutTimer = null

  const markHeroInteraction = () => {
    lastHeroInteractionAt = Date.now()
  }

  /** Während Fokus/Eingabe kein periodischer Malus-Poll / kein sofortiger Rail-Layout-Sync. */
  const isHeroInteractionActive = () => {
    const active = document.activeElement
    if (active instanceof HTMLElement && root.contains(active)) return true
    return Date.now() - lastHeroInteractionAt < 2200
  }

  /** Unterrand-Reserve für absoluten Mod-Strip (ohne Layout-Klassenwechsel bei 7+). */
  const syncHeroModStripExpansion = (chipCount) => {
    if (chipCount === lastModStripChipCount) return
    lastModStripChipCount = chipCount
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
    heroLayoutRoLock = true
    try {
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
    const AUTO_LE_TAW_ZFW_BUNDLE_ID = 'auto-le-tawzfw'
    const AUTO_LE_UNFAEHIG_BUNDLE_ID = 'auto-le-unfaehig'
    const AUTO_LE_MAXLOSS_BUNDLE_ID = 'auto-le-maxloss'
    const AUTO_BLUTEND_BUNDLE_ID = 'auto-blutend'
    const AUTO_ZONE_BUNDLE_PREFIX = 'auto-zone-'
    const CHIP_NEG_LE_KO_RANGE = 1.6
    const THREE_WOUND_CHIP_RULE = {
      kopf: 'Kopf: +2W6 SP, bewusstlos & Blutverlust (\u22121 LeP/KR). Kampfunf\u00e4hig.',
      brust: 'Brust: Bewusstlos & Blutverlust (\u22121 LeP/KR). Kampfunf\u00e4hig.',
      ruecken: 'R\u00fccken: Bewusstlos & Blutverlust (\u22121 LeP/KR). Kampfunf\u00e4hig.',
      bauch: 'Bauch: Bewusstlos & Blutverlust (\u22121 LeP/KR). Kampfunf\u00e4hig.',
      schildarm: 'Linker Arm: Arm unbrauchbar, Waffe/Schild f\u00e4llt. Held bleibt handlungsf\u00e4hig.',
      schwertarm: 'Rechter Arm: Arm unbrauchbar, Waffe/Schild f\u00e4llt. Held bleibt handlungsf\u00e4hig.',
      lbein: 'Linkes Bein: Verlust der Standfestigkeit, keine aktive Teilnahme am Kampf m\u00f6glich.',
      rbein: 'Rechtes Bein: Verlust der Standfestigkeit, keine aktive Teilnahme am Kampf m\u00f6glich.',
    }

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
      const isAutoLeTawZfw = bidStr === AUTO_LE_TAW_ZFW_BUNDLE_ID
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
      if (isAutoLeTawZfw) {
        chip.classList.add('init-hero-ex__mod-chip-card--auto-le-magic')
      }
      const palRaw = normalizeModChipColor(o.chipColor)
      const palId = o.isAutoBundle ? 'neutral' : palRaw
      if (palId) chip.classList.add(`init-hero-ex__mod-chip-card--pal-${palId}`)
      if (o.bundleId) chip.dataset.modBundleId = String(o.bundleId)
      if (o.modField) chip.dataset.modField = o.modField
      if (o.modField === 'be') {
        chip.classList.add('init-hero-ex__mod-chip-card--field-be')
      }
      const labelTrim = String(o.label ?? '').trim()
      const sublineText = labelTrim || o.shortSummary
      const hasRumpfLabel = sublineText.toUpperCase().includes('RUMPF')
      const autoLongLabel =
        !!o.isAutoBundle &&
        (sublineText.includes('KO') || sublineText.length >= 9)
      if (autoLongLabel) chip.classList.add('init-hero-ex__mod-chip-card--long-label')
      if (hasRumpfLabel) chip.classList.add('init-hero-ex__mod-chip-card--rumpf-label')

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
      } else if (isAutoLeTawZfw) {
        arrowWrap = document.createElement('span')
        arrowWrap.className =
          'init-hero-ex__mod-chip-card__sum-arrow init-hero-ex__mod-chip-card__sum-arrow--magic'
        arrowWrap.innerHTML = SVG_MOD_CHIP_MAGIC_STAR
        arrowWrap.title = 'Zauber & Talente'
        arrowWrap.setAttribute('aria-hidden', 'true')
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
              arrowWrap.title = `${THREE_WOUND_CHIP_RULE.schildarm}\n${THREE_WOUND_CHIP_RULE.schwertarm}`
            } else if (ufSrc.armSet[0] === 'schildarm') {
              arrowWrap.textContent = 'LA'
              arrowWrap.title = THREE_WOUND_CHIP_RULE.schildarm
            } else {
              arrowWrap.textContent = 'RA'
              arrowWrap.title = THREE_WOUND_CHIP_RULE.schwertarm
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
      if (!canEdit || isAutoLeTawZfw) xBtn.style.display = 'none'
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
    const snapForFieldBadges = readHeroExpandSnapshot(modMeta)
    const effectiveLeUf = effectiveLeForThresholds(snapForFieldBadges, modMeta, {
      round,
      navIni,
    })
    const armThirdWoundSides = armThirdWoundSidesFromSnapshot(snapForFieldBadges)
    const modBandIntegrated = readModDisplayMode(modMeta) === 'integrated'
    const fixedFieldValues = Object.fromEntries(
      UNFAEHIG_FIXED_ALLOWED_FIELDS.map((k) => {
        const raw = Number(snapForFieldBadges.unfaehigFixedFields?.[k])
        const value = Number.isFinite(raw) ? Math.max(0, Math.floor(Math.abs(raw))) : 0
        return [k, value]
      })
    )
    const unfaehigDisplay = (() => {
      const ufState = resolveUnfaehigOverlayState(
        modMeta,
        resolveGatheredSnapForUnfaehig(snapForFieldBadges),
        { round, navIni },
        {
          mode: 'display',
          markFields: snapForFieldBadges.unfaehigMarkFields,
        }
      )
      if (!ufState.active) {
        return {
          active: false,
          marked: ufState.marked,
          leg3w: false,
          armOnly: false,
          armSide: '',
          armSetSides: [],
          leTriggered: false,
        }
      }
      if (ufState.armOnly) {
        const armSetSides = []
        if (ufState.ufSrc.armSet.includes('schildarm')) armSetSides.push('LA')
        if (ufState.ufSrc.armSet.includes('schwertarm')) armSetSides.push('RA')
        const armSide = armSetSides.length === 1 ? armSetSides[0] : 'AR'
        return {
          active: true,
          marked: ufState.marked,
          leg3w: false,
          armOnly: true,
          armSide,
          armSetSides,
          leTriggered: Boolean(ufState.ufSrc.leTriggered),
        }
      }
      return {
        active: true,
        marked: ufState.marked,
        leg3w: Boolean(ufState.ufSrc.leg3w),
        armOnly: false,
        armSide: '',
        armSetSides: [],
        leTriggered: Boolean(ufState.ufSrc.leTriggered),
      }
    })()

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
      const integratedModBandForField =
        modBandIntegrated ||
        integratesHeroModsIntoDisplayedValue(modMeta, field)
      const isUnfaehigFixedField =
        unfaehigDisplay.active && unfaehigDisplay.marked.has(field)
      const armSource = (() => {
        const armMods = activeModsFull.filter(
          (m) =>
            String(m.bundleId ?? '') === `${AUTO_MOD_BUNDLE_PREFIX}zone-schildarm` ||
            String(m.bundleId ?? '') === `${AUTO_MOD_BUNDLE_PREFIX}zone-schwertarm`
        )
        if (!armMods.length) return { la: 0, ra: 0, hasLa: false, hasRa: false }
        let la = 0
        let ra = 0
        for (const m of armMods) {
          if (String(m.field ?? '') !== field) continue
          const v = modEffectiveContribution(m, ownerIniNum, round, navIni, lhMech)
          const bid = String(m.bundleId ?? '')
          if (bid === `${AUTO_MOD_BUNDLE_PREFIX}zone-schildarm`) la += v
          if (bid === `${AUTO_MOD_BUNDLE_PREFIX}zone-schwertarm`) ra += v
        }
        return { la, ra, hasLa: la < 0, hasRa: ra < 0 }
      })()
      const hasArmWoundNote =
        ['at', 'pa', 'ff', 'kk'].includes(field) &&
        (armSource.hasLa ||
          armSource.hasRa ||
          armThirdWoundSides.has('LA') ||
          armThirdWoundSides.has('RA'))
      const unfaehigLeFixedField =
        isUnfaehigFixedField &&
        unfaehigDisplay.leTriggered &&
        ['at', 'pa', 'ff', 'kk'].includes(field)
      const useArmWoundCompactBadge =
        ['at', 'pa', 'ff', 'kk'].includes(field) &&
        (armSource.hasLa || armSource.hasRa) &&
        !unfaehigLeFixedField
      const armDelta = armSource.la + armSource.ra
      const nonArmDelta = sum - armDelta
      const hasNonArmExtra =
        hasArmWoundNote && !unfaehigLeFixedField && nonArmDelta !== 0
      const fixedValueForField = (() => {
        if (field !== 'gs') return fixedFieldValues[field] ?? 0
        const hasAnyRelevant3w = hasGsZeroPriorityFromSnapshot(snapForFieldBadges)
        if (hasAnyRelevant3w) return 0
        const fixedGsRaw = Number(snapForFieldBadges.unfaehigFixedFields?.gs)
        const fixedGs = Number.isFinite(fixedGsRaw)
          ? Math.max(0, Math.floor(Math.abs(fixedGsRaw)))
          : null
        if (unfaehigDisplay.leTriggered) {
          return effectiveLeUf !== null && effectiveLeUf <= 0 ? 0 : 1
        }
        if (!unfaehigDisplay.leg3w) return fixedFieldValues[field] ?? 0
        return fixedGs == null ? 0 : Math.min(fixedGs, 0)
      })()
      if (sum === 0 && !isUnfaehigFixedField) {
        continue
      }
      cell.classList.add('init-hero-ex__mod-anchor--active')
      const badge = document.createElement('span')
      badge.className = 'init-hero-ex__mod-badge'
      const useFixedValueView = isUnfaehigFixedField
      if (!useFixedValueView && sum > 0) {
        badge.classList.add('init-hero-ex__mod-badge--pos')
      } else if (!useFixedValueView && sum < 0) {
        badge.classList.add('init-hero-ex__mod-badge--neg')
      }
      if (useFixedValueView) {
        badge.classList.add('init-hero-ex__mod-badge--fixed')
        badge.classList.add('init-hero-ex__mod-badge--unfaehig-fixed')
      } else if (integratedModBandForField) {
        badge.classList.add('init-hero-ex__mod-badge--integrated')
      }
      if (useArmWoundCompactBadge) {
        badge.classList.add('init-hero-ex__mod-badge--arm-wound')
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
      const valSpan = document.createElement('span')
      valSpan.className = 'init-hero-ex__mod-badge__val'
      if (useArmWoundCompactBadge) {
        valSpan.textContent = ''
      } else {
        valSpan.textContent = String(useFixedValueView ? fixedValueForField : absSum)
      }
      if (!useFixedValueView && !hasArmWoundNote && field !== 'be') {
        const arrowSpan = document.createElement('span')
        arrowSpan.className = 'init-hero-ex__mod-badge__arrow'
        arrowSpan.setAttribute('aria-hidden', 'true')
        arrowSpan.innerHTML = sum > 0 ? SVG_HERO_MOD_TOGGLE_UP : SVG_HERO_MOD_TOGGLE_DOWN
        badge.appendChild(arrowSpan)
      }
      if (valSpan.textContent) badge.appendChild(valSpan)
      if (hasArmWoundNote && !unfaehigLeFixedField) {
        /** @type {string[]} */
        const armNotes = []
        const armZeroSides = armThirdWoundSides
        if (armSource.hasLa || armThirdWoundSides.has('LA')) {
          armNotes.push(
            armZeroSides.has('LA')
              ? 'LA:0'
              : `LA↓${Math.max(1, Math.abs(armSource.la) || 0)}`
          )
        }
        if (armSource.hasRa || armThirdWoundSides.has('RA')) {
          armNotes.push(
            armZeroSides.has('RA')
              ? 'RA:0'
              : `RA↓${Math.max(1, Math.abs(armSource.ra) || 0)}`
          )
        }
        if (armNotes.length >= 2 || hasNonArmExtra) {
          badge.classList.add('init-hero-ex__mod-badge--arm-wound-stack')
        }
        for (const note of armNotes) {
          const srcSpan = document.createElement('span')
          srcSpan.className =
            'init-hero-ex__mod-badge__tail init-hero-ex__mod-badge__tail--arm-note'
          srcSpan.textContent = integratedModBandForField ? `(${note})` : note
          badge.appendChild(srcSpan)
        }
        if (hasNonArmExtra) {
          const extraSpan = document.createElement('span')
          extraSpan.className =
            'init-hero-ex__mod-badge__tail init-hero-ex__mod-badge__tail--arm-extra'
          extraSpan.classList.add(
            nonArmDelta > 0
              ? 'init-hero-ex__mod-badge__tail--pos'
              : 'init-hero-ex__mod-badge__tail--neg'
          )
          const sign = nonArmDelta > 0 ? '+' : '\u2212'
          const text = `${sign}${Math.abs(nonArmDelta)}`
          extraSpan.textContent = integratedModBandForField ? `(${text})` : text
          badge.appendChild(extraSpan)
        }
      }
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
      badge.title = useFixedValueView
        ? `${namePrefix}Fixwert ${fixedValueForField} auf ${MOD_FIELD_LABEL[field] || field.toUpperCase()}${detail ? `: ${detail}` : ''}`
        : `${namePrefix}Modifikator ${sum > 0 ? '+' : ''}${sum} auf ${MOD_FIELD_LABEL[field] || field.toUpperCase()}${detail ? `: ${detail}` : ''}`
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
    /* Mod-Strip: Chips (ein DOM-Update am Ende — kein vorzeitiges Leeren). */
    if (ownerIniNum == null) {
      modStrip.replaceChildren()
      modStrip.classList.remove('init-hero-ex__mods-strip--scroll')
      modStrip.classList.remove('init-hero-ex__mods-strip--has')
      syncHeroModStripExpansion(0)
      refreshComputedPenaltyHighlights(modMeta)
      syncHeroMicroModDisplayTones()
      applyUnfaehigVisualOverlay(modMeta)
      requestAnimationFrame(() => {
        try {
          runSyncModStripLayoutOnly()
        } finally {
          heroLayoutRoLock = false
        }
      })
      return
    }
    const active = activeModsFull
    if (active.length === 0) {
      modStrip.replaceChildren()
      modStrip.classList.remove('init-hero-ex__mods-strip--scroll')
      modStrip.classList.remove('init-hero-ex__mods-strip--has')
      syncHeroModStripExpansion(0)
      refreshComputedPenaltyHighlights(modMeta)
      syncHeroMicroModDisplayTones()
      applyUnfaehigVisualOverlay(modMeta)
      requestAnimationFrame(() => {
        try {
          runSyncModStripLayoutOnly()
        } finally {
          heroLayoutRoLock = false
        }
      })
      return
    }
    modStrip.classList.add('init-hero-ex__mods-strip--has')

    const primaryStack = document.createElement('div')
    primaryStack.className = 'init-hero-ex__mods-stack'

    const seenBundle = new Set()
    const formatDeltaForTooltip = (n) => {
      const x = Number(n)
      if (!Number.isFinite(x)) return '0'
      if (x < 0) return `↓${Math.abs(x)}`
      if (x > 0) return `↑${x}`
      return '0'
    }
    const hasActiveSterbendOrRip = active.some((x) => {
      const bid = String(x?.bundleId ?? '')
      if (!bid.startsWith(AUTO_MOD_BUNDLE_PREFIX)) return false
      const lab = String(x?.label ?? '').trim()
      return lab === 'sterbend' || lab === 'R.I.P.'
    })
    const unfaehigIgnoreTooltip =
      'Unfähigkeit ignorieren: durch Vorteil oder Selbstbeherrschung +12, dann Zauber- und Talentproben ↓9 und Eigenschaftsproben und Kampfwerte zusätzlich ↓3'
    const woundEffectsIgnoreSelbstbehTooltip =
      'Auswirkungen von Wunde(n) (für Standard = 5 KR) ignorieren: mit Probe auf Selbstbeherrschung um 4 Punkte erschwert pro Wunde.'
    const sterbendTooltipExtra =
      'Erste Hilfe und Rettung mit Frist von W6×Konstitution (KO) Kampfrunden (KR) notwendig'
    const permanentLossTooltip =
      'LE<-Wundschwelle. Das bedeutet: permanenter Verlust von einem Punkt der Basis-Lebensenergie (LEmax ↓1). Dieser kann nicht durch gewöhnliche Heilung wieder ausgeglichen werden. (LEmax muss nach der Heilung neu mit einem Punkt weniger in das Wertefeld eingetragen werden).'
    const hasActiveLeMaxLossBand = active.some(
      (x) => String(x?.bundleId ?? '') === AUTO_LE_MAXLOSS_BUNDLE_ID
    )
    const hasThirdWoundAutoZoneChip = active.some((x) => {
      const bid = String(x?.bundleId ?? '')
      if (!bid.startsWith(AUTO_ZONE_BUNDLE_PREFIX)) return false
      const zoneId = bid.slice(AUTO_ZONE_BUNDLE_PREFIX.length)
      const w = clampWound(readHeroExpandSnapshot(modMeta)?.hitZones?.zones?.[zoneId]?.w ?? 0)
      return w >= 3
    })
    /** Nur LA/RA-3W: LE-unfähig- und Ta&Za-Chips weiter zeigen; 3.W. außerhalb der Arme blendet sie aus wie zuvor */
    const hasNonArmThirdWoundAutoZoneChip = active.some((x) => {
      const bid = String(x?.bundleId ?? '')
      if (!bid.startsWith(AUTO_ZONE_BUNDLE_PREFIX)) return false
      const zoneId = bid.slice(AUTO_ZONE_BUNDLE_PREFIX.length)
      if (zoneId === 'schildarm' || zoneId === 'schwertarm') return false
      const w = clampWound(readHeroExpandSnapshot(modMeta)?.hitZones?.zones?.[zoneId]?.w ?? 0)
      return w >= 3
    })
    const gsZeroPriorityActive = hasGsZeroPriorityFromSnapshot(
      readHeroExpandSnapshot(modMeta)
    )
    for (const modRec of active) {
      if (modRec.bundleId) {
        if (
          hasThirdWoundAutoZoneChip &&
          String(modRec.bundleId ?? '') === AUTO_LE_BAND_BUNDLE_ID
        ) {
          continue
        }
        if (
          hasNonArmThirdWoundAutoZoneChip &&
          String(modRec.bundleId ?? '') === AUTO_LE_UNFAEHIG_BUNDLE_ID
        ) {
          continue
        }
        if (
          hasNonArmThirdWoundAutoZoneChip &&
          String(modRec.bundleId ?? '') === AUTO_LE_TAW_ZFW_BUNDLE_ID
        ) {
          continue
        }
        if (String(modRec.bundleId) === AUTO_LE_MAXLOSS_BUNDLE_ID) continue
        if (seenBundle.has(modRec.bundleId)) continue
        seenBundle.add(modRec.bundleId)
        const bundleMods = active.filter((x) => x.bundleId === modRec.bundleId)
        const bidStr = String(modRec.bundleId ?? '')
        const isAutoBundle = bidStr.startsWith(AUTO_MOD_BUNDLE_PREFIX)
        const visibleBundleMods =
          isAutoBundle && gsZeroPriorityActive
            ? bundleMods.filter((bm) => String(bm.field ?? '') !== 'gs')
            : bundleMods
        /* LA/RA unfähig nicht ausblenden: Zonenpakete bleiben sichtbar, wenn auto-le-unfaehig bei anderer Zone 3W verborgen ist */
        const packLabel = bundleMods.find((x) => x.label)?.label
        const shortParts = visibleBundleMods.map((bm) => {
          const eff = modEffectiveContribution(
            bm,
            ownerIniNum,
            round,
            navIni,
            lhMech
          )
          const abbr = MOD_FIELD_LABEL[bm.field] || bm.field.toUpperCase()
          return `${abbr}${formatDeltaForTooltip(eff)}`
        })
        const shortSummary =
          String(modRec.bundleId ?? '') === AUTO_LE_UNFAEHIG_BUNDLE_ID
            ? 'rein optische Überlagerung'
            : shortParts.join(', ')
        const detailLines =
          String(modRec.bundleId ?? '') === AUTO_LE_UNFAEHIG_BUNDLE_ID
            ? ['rein optische Überlagerung (keine Zahlenänderung)']
            : visibleBundleMods.map((bm) => {
                const eff = modEffectiveContribution(
                  bm,
                  ownerIniNum,
                  round,
                  navIni,
                  lhMech
                )
                return `${MOD_FIELD_LABEL[bm.field]} ${formatDeltaForTooltip(eff)} (${modNavFractionLabelFromNav(bm, ownerIniNum, lhMech, round, navIni)})`
              })
        const isLeBandBundle = bidStr === AUTO_LE_BAND_BUNDLE_ID
        const isMagicLeBundle = bidStr === AUTO_LE_TAW_ZFW_BUNDLE_ID
        const isUnfaehigBundle = bidStr === AUTO_LE_UNFAEHIG_BUNDLE_ID
        const isBlutendBundle = bidStr === AUTO_BLUTEND_BUNDLE_ID
        const zoneIdFromBid = bidStr.startsWith(AUTO_ZONE_BUNDLE_PREFIX)
          ? bidStr.slice(AUTO_ZONE_BUNDLE_PREFIX.length)
          : ''
        const wZoneForChip = zoneIdFromBid
          ? clampWound(
              readHeroExpandSnapshot(modMeta)?.hitZones?.zones?.[zoneIdFromBid]
                ?.w ?? 0
            )
          : 0
        const zoneRuleText =
          wZoneForChip >= 3 ? THREE_WOUND_CHIP_RULE[zoneIdFromBid] : ''
        if (String(packLabel ?? '') === 'R.I.P.') {
          detailLines.length = 0
          detailLines.push('gestorben')
        } else if (isMagicLeBundle) {
          const nMatch = String(packLabel ?? '').match(/↓\s*(\d+)/u)
          const nTxt = nMatch?.[1] ?? '0'
          detailLines.length = 0
          if (String(packLabel ?? '') === 'sterbend') {
            detailLines.push('sterbend')
            detailLines.push(sterbendTooltipExtra)
            if (hasActiveLeMaxLossBand) detailLines.push(permanentLossTooltip)
          } else if (String(packLabel ?? '').startsWith('LE ≤')) {
            detailLines.push(unfaehigIgnoreTooltip)
          } else {
            detailLines.push(`Zauber und Talentproben um ↓${nTxt} erschwert`)
          }
        } else if (isLeBandBundle && String(packLabel ?? '') === 'sterbend') {
          detailLines.length = 0
          detailLines.push('sterbend')
          detailLines.push(sterbendTooltipExtra)
          if (hasActiveLeMaxLossBand) detailLines.push(permanentLossTooltip)
        } else if (
          isUnfaehigBundle &&
          String(packLabel ?? '') === 'unfähig' &&
          !hasActiveSterbendOrRip
        ) {
          detailLines.length = 0
          detailLines.push(unfaehigIgnoreTooltip)
        } else if (
          isUnfaehigBundle &&
          String(packLabel ?? '') === 'unfähig' &&
          hasActiveSterbendOrRip
        ) {
          detailLines.length = 0
          detailLines.push(sterbendTooltipExtra)
        } else if (isBlutendBundle) {
          detailLines.length = 0
          detailLines.push(
            'Blutverlust durch 3. Wunde an Torso oder Kopf: jede KR \u22121 LE'
          )
        } else if (zoneRuleText) {
          detailLines.length = 0
          detailLines.push(zoneRuleText)
        }
        const longSummary = detailLines.join(' \u00B7 ')
        const bundleTitlePfx = packLabel ? `"${packLabel}" — ` : ''
        const cardTitleBase = zoneRuleText
          ? zoneRuleText
          : `${bundleTitlePfx}${longSummary}`
        const keepTitleClean =
          String(packLabel ?? '') === 'R.I.P.' ||
          isMagicLeBundle ||
          (isLeBandBundle && String(packLabel ?? '') === 'sterbend') ||
          (isUnfaehigBundle &&
            String(packLabel ?? '') === 'unfähig') ||
          isBlutendBundle ||
          Boolean(zoneRuleText)
        const cardTitle = keepTitleClean
          ? cardTitleBase
          : `${cardTitleBase}${!isAutoBundle && canEdit ? ' \u00B7 Zum Bearbeiten anklicken' : ''}`
        const cardTitleFinal =
          bidStr.startsWith(AUTO_ZONE_BUNDLE_PREFIX) &&
          (wZoneForChip === 1 || wZoneForChip === 2)
            ? `${cardTitle} \u00B7 ${woundEffectsIgnoreSelbstbehTooltip}`
            : cardTitle
        let netSum = 0
        if (String(modRec.bundleId ?? '') !== AUTO_LE_UNFAEHIG_BUNDLE_ID) {
          for (const bm of visibleBundleMods) {
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
          modField:
            visibleBundleMods.length === 1
              ? String(visibleBundleMods[0]?.field ?? '')
              : '',
          shortSummary,
          netSum,
          cardTitle: cardTitleFinal,
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
      if (
        gsZeroPriorityActive &&
        String(modRec.field ?? '') === 'gs' &&
        String(modRec.bundleId ?? '').startsWith(AUTO_MOD_BUNDLE_PREFIX)
      ) {
        continue
      }
      const abbr = MOD_FIELD_LABEL[modRec.field] || modRec.field.toUpperCase()
      const shortSummary = `${abbr}${formatDeltaForTooltip(eff)}`
      const longSummary = `${MOD_FIELD_LABEL[modRec.field]} ${formatDeltaForTooltip(eff)} (${modNavFractionLabelFromNav(modRec, ownerIniNum, lhMech, round, navIni)})`
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
        removeAria: `${modRec.label ? `${modRec.label} \u00B7 ` : ''}${MOD_FIELD_LABEL[modRec.field]} ${formatDeltaForTooltip(eff)} entfernen`,
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

    const chipCount = primaryStack.querySelectorAll(
      '.init-hero-ex__mod-chip-card'
    ).length
    modStrip.replaceChildren(primaryStack)
    modStrip.classList.toggle(
      'init-hero-ex__mods-strip--scroll',
      chipCount > 3
    )
    syncHeroModStripExpansion(chipCount)
    refreshComputedPenaltyHighlights(modMeta)
    syncHeroMicroModDisplayTones()
    applyUnfaehigVisualOverlay(modMeta)
    requestAnimationFrame(() => {
      try {
        runSyncModStripLayoutOnly()
      } finally {
        heroLayoutRoLock = false
      }
    })
    } catch (_) {
      heroLayoutRoLock = false
    }
  }

  const waitMs = (ms) =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms)
    })

  let modStripRefreshRaf = 0
  let modStripRefreshGen = 0

  const refreshModStripFromScene = (opts = {}) => {
    const settle = opts?.settle === true
    const gen = ++modStripRefreshGen
    return new Promise((resolve) => {
      if (modStripRefreshRaf) {
        cancelAnimationFrame(modStripRefreshRaf)
      }
      modStripRefreshRaf = requestAnimationFrame(() => {
        modStripRefreshRaf = 0
        void (async () => {
          try {
            const items = await OBR.scene.items.getItems([itemId])
            if (gen !== modStripRefreshGen) {
              resolve()
              return
            }
            const freshMeta = items?.[0]?.metadata?.[TRACKER_ITEM_META_KEY]
            if (freshMeta) renderModBadgesAndStrip(freshMeta)
            if (settle && gen === modStripRefreshGen) {
              await waitMs(80)
              if (gen !== modStripRefreshGen) {
                resolve()
                return
              }
              const items2 = await OBR.scene.items.getItems([itemId])
              const freshMeta2 = items2?.[0]?.metadata?.[TRACKER_ITEM_META_KEY]
              if (freshMeta2 && gen === modStripRefreshGen) {
                renderModBadgesAndStrip(freshMeta2)
              }
            }
          } catch (_) {
            /* ignore */
          } finally {
            resolve()
          }
        })()
      })
    })
  }

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

  /** Liest eine CSS-Laengenangabe (z. B. calc/rem) als Pixelbreite. */
  const readHeroCssLenPx = (el, prop) => {
    const v = getComputedStyle(el).getPropertyValue(prop).trim()
    if (!v) return 0
    const probe = document.createElement('div')
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${v};height:0;padding:0;margin:0;border:0;`
    el.appendChild(probe)
    const w = probe.getBoundingClientRect().width
    probe.remove()
    return Number.isFinite(w) ? w : 0
  }

  let heroRowLayoutRaf = 0
  let lastPanelScrollH = -1

  /** Mod-Strip: Dock, MOD+-Ausrichtung, Panel-Höhe — ohne Cluster-Rails / Gauges. */
  const runSyncModStripLayoutOnly = () => {
    if (heroLayoutSyncing) return
    heroLayoutSyncing = true
    try {
      modIbCol.style.marginTop = ''
      if (modIbCol && leThreshRail?.box) {
        const modShell = modIbCol.querySelector(
          ':scope > .init-hero-ex__ib-chain__inp-cell--mod-solo-btn'
        )
        if (modShell instanceof HTMLElement) {
          const barTop = leThreshRail.box.getBoundingClientRect().top
          const shellTop = modShell.getBoundingClientRect().top
          const delta = barTop - shellTop
          if (Number.isFinite(delta) && Math.abs(delta) > 0.5) {
            const y = Math.round(delta * 1000) / 1000
            if (lastModShellTranslateY !== y) {
              lastModShellTranslateY = y
              modShell.style.transform = `translateY(${y}px)`
            }
          } else if (!Number.isNaN(lastModShellTranslateY)) {
            lastModShellTranslateY = Number.NaN
            modShell.style.transform = ''
          }
        }
      }
      syncModStripDockAndPad()
      const panelBody = root.closest('.init-row-extra-panel__body')
      if (panelBody instanceof HTMLElement && !isHeroInteractionActive()) {
        const h = Math.ceil(root.getBoundingClientRect().height)
        if (
          Number.isFinite(h) &&
          h > 0 &&
          (lastPanelScrollH < 0 || Math.abs(h - lastPanelScrollH) > 1)
        ) {
          lastPanelScrollH = h
          const px = `${h}px`
          panelBody.style.setProperty('--init-row-extra-panel-body-max-h', px)
          panelBody.style.maxHeight = px
        }
      }
    } finally {
      heroLayoutSyncing = false
    }
  }

  /** LE-Rail + Energy-Rails nach Layout sichtbar (V1201-Recovery). */
  const revealClusterRailsAfterLayout = () => {
    applyConfigurableFieldVisibility(snap)
    if (root.classList.contains('init-hero-ex--rails-pending')) {
      root.classList.remove('init-hero-ex--rails-pending')
    }
    if (
      clusterSRailRoot &&
      clusterSRailRoot.style.visibility === 'hidden' &&
      !clusterSRailRoot.hasAttribute('aria-hidden')
    ) {
      clusterSRailRoot.style.visibility = 'visible'
      clusterSRailRoot.removeAttribute('aria-hidden')
    }
  }

  /** Scroll-Ausgleich: untere und mittlere Heldenblock-Zeile gleiche Scroll-Breite. */
  const runSyncHeroRowLayout = () => {
    if (heroLayoutSyncing) return
    heroLayoutSyncing = true
    try {
    zoneMidRow.style.paddingRight = ''
    bottomStrip.style.paddingRight = ''
    spTzGrid.style.width = ''

    /* Scroll-Ausgleich: beide Zeilen gleich breit halten. */
    const zw = zoneMidRow.scrollWidth
    const bw = bottomStrip.scrollWidth
    if (zw > bw) {
      bottomStrip.style.paddingRight = `${zw - bw}px`
    } else if (bw > zw) {
      zoneMidRow.style.paddingRight = `${bw - zw}px`
    }

    /* KE | AE | AU | LE: nebeneinander, Lücke wie W6–FK (--init-hero-strip-gap). */
    {
      const rootR = root.getBoundingClientRect()
      const railW = readHeroCssLenPx(root, '--init-hero-ex-s-rail-w')
      const railGap = readHeroCssLenPx(root, '--init-hero-strip-gap')
      const labelGapPx =
        readHeroCssLenPx(root, '--init-hero-label-input-gap') || 0
      const gapRaw =
        getComputedStyle(sRailRoot).rowGap || getComputedStyle(sRailRoot).gap
      const sRailLabelGap =
        parseFloat(gapRaw) || labelGapPx

      /** @type {{ root: HTMLElement, abbrEl: HTMLElement, mainInp: HTMLInputElement, bottom: 'ws' | 'tz' }[]} */
      const clusterRails = []
      if (
        keEnergyRailRoot &&
        keEnergyRailRoot.style.visibility !== 'hidden' &&
        !keEnergyRailRoot.hasAttribute('aria-hidden')
      ) {
        clusterRails.push({
          root: keEnergyRailRoot,
          abbrEl: extra.ab,
          mainInp: extra.inp,
          bottom: 'ws',
        })
      }
      if (
        aeEnergyRailRoot &&
        aeEnergyRailRoot.style.visibility !== 'hidden'
      ) {
        clusterRails.push({
          root: aeEnergyRailRoot,
          abbrEl: ae.ab,
          mainInp: ae.inp,
          bottom: 'ws',
        })
      }
      if (
        auEnergyRailRoot &&
        auEnergyRailRoot.style.visibility !== 'hidden' &&
        !auEnergyRailRoot.hasAttribute('aria-hidden')
      ) {
        clusterRails.push({
          root: auEnergyRailRoot,
          abbrEl: au.ab,
          mainInp: au.inp,
          bottom: 'ws',
        })
      }
      clusterRails.push({
        root: sRailRoot,
        abbrEl: leThreshRailAbbr,
        mainInp: leInp,
        bottom: 'tz',
      })

      const fkHidden =
        fk.cell.getAttribute('aria-hidden') === 'true' ||
        fk.cell.style.visibility === 'hidden'
      /** @type {HTMLElement} */
      let clusterAnchorCell = ae.cell
      if (
        keEnergyRailRoot &&
        keEnergyRailRoot.style.visibility !== 'hidden' &&
        !keEnergyRailRoot.hasAttribute('aria-hidden')
      ) {
        clusterAnchorCell = extra.cell
      }
      const keRailShown =
        keEnergyRailRoot &&
        keEnergyRailRoot.style.visibility !== 'hidden' &&
        !keEnergyRailRoot.hasAttribute('aria-hidden')
      const anchorLeft =
        clusterAnchorCell.getBoundingClientRect().left - rootR.left
      let cursorLeft = anchorLeft
      const refAbbr = fkHidden
        ? stackW6.querySelector(':scope > .init-hero-ex__abbr')
        : fk.ab
      const refInpEl = fkHidden ? w6.inp : fk.inp
      let railTop = clusterAnchorCell.getBoundingClientRect().top - rootR.top
      if (
        refInpEl instanceof HTMLInputElement &&
        refAbbr instanceof HTMLElement
      ) {
        const refInpTop = refInpEl.getBoundingClientRect().top - rootR.top
        const refAbbrH = refAbbr.getBoundingClientRect().height
        railTop = refInpTop - refAbbrH - labelGapPx
      }

      if (
        Number.isFinite(railW) &&
        railW > 0 &&
        Number.isFinite(railGap) &&
        railGap >= 0
      ) {
        const wsBottom = wsInp
          ? wsInp.getBoundingClientRect().bottom - rootR.top
          : null
        const tzBottom = tzInp
          ? tzInp.getBoundingClientRect().bottom - rootR.top
          : null

        const leSlotLeft =
          leRailSlot.getBoundingClientRect().left - rootR.left

        const refInpTopForSig =
          refInpEl instanceof HTMLInputElement
            ? refInpEl.getBoundingClientRect().top - rootR.top
            : -1
        const clusterSig = [
          Math.round(anchorLeft),
          Math.round(railTop),
          Math.round(leSlotLeft),
          Math.round(railW),
          Math.round(railGap),
          wsBottom != null ? Math.round(wsBottom) : '',
          tzBottom != null ? Math.round(tzBottom) : '',
          fkHidden ? 1 : 0,
          keRailShown ? 1 : 0,
          Math.round(refInpTopForSig),
          clusterRails.length,
        ].join('|')

        const clusterLayoutUnchanged =
          !heroClusterRailsAwaitFirstLayout &&
          clusterSig === lastClusterRailLayoutSig

        const fmtClusterPx = (n) => `${Math.round(n * 1000) / 1000}px`
        const setClusterPxIf = (el, prop, num) => {
          const next = fmtClusterPx(num)
          if (el.style[prop] !== next) el.style[prop] = next
        }
        const setClusterVarIf = (el, name, num) => {
          const next = fmtClusterPx(num)
          if (el.style.getPropertyValue(name) !== next) {
            el.style.setProperty(name, next)
          }
        }

        if (!clusterLayoutUnchanged) {
          lastClusterRailLayoutSig = clusterSig
          cursorLeft = anchorLeft

          for (const entry of clusterRails) {
            const leftPx =
              entry.root === sRailRoot ? leSlotLeft : cursorLeft
            setClusterPxIf(entry.root, 'left', leftPx)
            setClusterPxIf(entry.root, 'top', railTop)
            const abbrBottom =
              entry.abbrEl.getBoundingClientRect().bottom - rootR.top
            const boxGap =
              entry.root === sRailRoot ? sRailLabelGap : labelGapPx
            if (entry.bottom === 'ws' && wsBottom != null) {
              const barH = wsBottom - abbrBottom - boxGap
              if (Number.isFinite(barH) && barH > 0) {
                setClusterVarIf(
                  entry.root,
                  '--init-hero-ex-energy-rail-h',
                  barH
                )
              }
            } else if (entry.bottom === 'tz' && tzBottom != null) {
              const barH = tzBottom - abbrBottom - boxGap
              if (Number.isFinite(barH) && barH > 0) {
                setClusterVarIf(root, '--init-hero-ex-s-rail-h', barH)
              }
            }
            if (entry.root !== sRailRoot) {
              cursorLeft += railW + railGap
            }
          }

          /* FK→KE: sichtbare Lücke zwischen FK- und KE-Kästchen (Flex) + Schwellenbalken daran ausrichten. */
          if (!fkHidden && keRailShown && extra?.cell) {
            const fkRight = fk.cell.getBoundingClientRect().right - rootR.left
            const keLeft = extra.cell.getBoundingClientRect().left - rootR.left
            const fkKeGapPx = keLeft - fkRight
            const fkKeSig = `${Math.round(fkKeGapPx)}|${Math.round(keLeft)}|${Math.round(fkRight)}|${Math.round(railW)}|${Math.round(railGap)}`
            if (fkKeSig !== lastFkKeLayoutSig) {
              lastFkKeLayoutSig = fkKeSig
              if (Number.isFinite(keLeft) && keLeft >= fkRight) {
                let left = keLeft
                for (const entry of clusterRails) {
                  if (entry.root === sRailRoot) continue
                  setClusterPxIf(entry.root, 'left', left)
                  left += railW + railGap
                }
                if (Number.isFinite(fkKeGapPx) && fkKeGapPx > 0) {
                  setClusterVarIf(root, '--init-hero-fk-ke-gap', fkKeGapPx)
                } else {
                  root.style.removeProperty('--init-hero-fk-ke-gap')
                }
              } else {
                root.style.removeProperty('--init-hero-fk-ke-gap')
              }
            }
          } else {
            lastFkKeLayoutSig = ''
            root.style.removeProperty('--init-hero-fk-ke-gap')
          }

          /* Flex-Platzhalter (extra/ae/au/leRailSlot) + strip-gap; kein clusterW margin. */
          if (Number.isFinite(railGap) && railGap >= 0) {
            const gapPx = fmtClusterPx(railGap)
            if (ibChain.style.getPropertyValue('--init-hero-ib-mod-gap') !== gapPx) {
              ibChain.style.setProperty('--init-hero-ib-mod-gap', gapPx)
            }
          }
        }

        /* Feinabgleich auch bei unveränderter clusterSig (nur top/rail-h, kein Flackern). */
        if (refInpEl instanceof HTMLInputElement) {
          const refInpTop = refInpEl.getBoundingClientRect().top - rootR.top
          for (const entry of clusterRails) {
            const inpTop =
              entry.mainInp.getBoundingClientRect().top - rootR.top
            const shift = refInpTop - inpTop
            if (Number.isFinite(shift) && Math.abs(shift) > 0.5) {
              const curTop = parseFloat(entry.root.style.top) || railTop
              setClusterPxIf(entry.root, 'top', curTop + shift)
              const abbrBottom =
                entry.abbrEl.getBoundingClientRect().bottom - rootR.top
              const boxGap =
                entry.root === sRailRoot ? sRailLabelGap : labelGapPx
              if (entry.bottom === 'ws' && wsBottom != null) {
                const barH = wsBottom - abbrBottom - boxGap
                if (Number.isFinite(barH) && barH > 0) {
                  setClusterVarIf(
                    entry.root,
                    '--init-hero-ex-energy-rail-h',
                    barH
                  )
                }
              } else if (entry.bottom === 'tz' && tzBottom != null) {
                const barH = tzBottom - abbrBottom - boxGap
                if (Number.isFinite(barH) && barH > 0) {
                  setClusterVarIf(root, '--init-hero-ex-s-rail-h', barH)
                }
              }
            }
          }
        }
      }
    }

    /* MOD+: Oberkante = Oberkante LE-Balken; translateY (kein marginTop — sonst wächst strip/Panel). */
    modIbCol.style.marginTop = ''
    if (modIbCol && leThreshRail?.box) {
      const modShell = modIbCol.querySelector(
        ':scope > .init-hero-ex__ib-chain__inp-cell--mod-solo-btn'
      )
      if (modShell instanceof HTMLElement) {
        const barTop = leThreshRail.box.getBoundingClientRect().top
        const shellTop = modShell.getBoundingClientRect().top
        const delta = barTop - shellTop
        if (Number.isFinite(delta) && Math.abs(delta) > 0.5) {
          const y = Math.round(delta * 1000) / 1000
          if (lastModShellTranslateY !== y) {
            lastModShellTranslateY = y
            modShell.style.transform = `translateY(${y}px)`
          }
        } else if (!Number.isNaN(lastModShellTranslateY)) {
          lastModShellTranslateY = Number.NaN
          modShell.style.transform = ''
        }
      }
    }

    syncModStripDockAndPad()

    /* TP/TZ-Kürzel auf gleicher Höhe wie RB/Wappen-Kürzel (Transform nur bei Änderung). */
    const refWappenAbbr = zoneMidRow.querySelector(
      '.init-hero-ex__micro-cell--wappen:not([aria-hidden="true"]) > .init-hero-ex__abbr'
    )
    if (refWappenAbbr) {
      const refTop = refWappenAbbr.getBoundingClientRect().top
      for (const [el, lastRef] of [
        [spAbbr, { get: () => lastSpAbbrTranslateY, set: (v) => { lastSpAbbrTranslateY = v } }],
        [tzAbbr, { get: () => lastTzAbbrTranslateY, set: (v) => { lastTzAbbrTranslateY = v } }],
      ]) {
        if (!el) continue
        const delta = refTop - el.getBoundingClientRect().top
        if (Number.isFinite(delta) && Math.abs(delta) > 0.5) {
          const y = Math.round(delta * 1000) / 1000
          if (lastRef.get() !== y) {
            lastRef.set(y)
            el.style.transform = `translateY(${y}px)`
          }
        }
      }
    }

    /* Ausklapp-Panel: Höhe aus Layout-Box (nicht scrollHeight — vermeidet Wachstumsschleife). */
    const panelBody = root.closest('.init-row-extra-panel__body')
    if (panelBody instanceof HTMLElement && !isHeroInteractionActive()) {
      const h = Math.ceil(root.getBoundingClientRect().height)
      if (
        Number.isFinite(h) &&
        h > 0 &&
        (lastPanelScrollH < 0 || Math.abs(h - lastPanelScrollH) > 1)
      ) {
        lastPanelScrollH = h
        const px = `${h}px`
        panelBody.style.setProperty('--init-row-extra-panel-body-max-h', px)
        panelBody.style.maxHeight = px
      }
    }

    if (heroClusterRailsAwaitFirstLayout) {
      heroClusterRailsAwaitFirstLayout = false
      revealClusterRailsAfterLayout()
    } else if (
      root.classList.contains('init-hero-ex--rails-pending') ||
      (clusterSRailRoot &&
        clusterSRailRoot.style.visibility === 'hidden' &&
        !clusterSRailRoot.hasAttribute('aria-hidden'))
    ) {
      revealClusterRailsAfterLayout()
    }
    } finally {
      heroLayoutSyncing = false
    }
  }

  const syncHeroRowLayout = () => {
    if (heroRowLayoutRaf) return
    heroRowLayoutRaf = requestAnimationFrame(() => {
      heroRowLayoutRaf = 0
      runSyncHeroRowLayout()
    })
  }

  const scheduleHeroRowLayoutAfterIdle = () => {
    if (deferredHeroLayoutTimer != null) {
      clearTimeout(deferredHeroLayoutTimer)
    }
    deferredHeroLayoutTimer = setTimeout(() => {
      deferredHeroLayoutTimer = null
      if (!isHeroInteractionActive()) syncHeroRowLayout()
    }, 150)
  }

  const spTzAlignRo = new ResizeObserver(() => {
    if (heroLayoutRoLock || heroLayoutSyncing) return
    if (isHeroInteractionActive()) {
      scheduleHeroRowLayoutAfterIdle()
      return
    }
    syncHeroRowLayout()
  })
  const __spTzAlignEls = [
    root,
    zoneMidRow,
    bottomStrip,
    leChainCols,
    spAbbr,
    tzAbbr,
    tzInp,
    attrCols,
    attrKoTpWrap,
    frontalLbl,
    stackGs,
    stackW6,
    wsInp,
    stackWs,
    leRailSlot,
  ]
  for (const el of __spTzAlignEls) {
    spTzAlignRo.observe(el)
  }
  const releaseNoGaugeMountAnim = () => {
    if (!isHeroInteractionActive()) {
      root.classList.remove('init-hero-ex--no-gauge-anim')
    }
  }
  requestAnimationFrame(() => {
    syncHeroRowLayout()
    requestAnimationFrame(() => {
      syncHeroRowLayout()
      renderModBadgesAndStrip()
      requestAnimationFrame(() => {
        requestAnimationFrame(releaseNoGaugeMountAnim)
      })
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
    markPair(gsInp, gsAbbrLabel, 'gs')
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
    rsBypassBtn.disabled = true
    spTzBridgeBtn.disabled = true
    /** Nur Anzeige: Wunden/LE-Schwelle periodisch neu bewerten (kein AT/PA-Sync). */
    const MALUS_VIEW_POLL_MS = 1000
    const onVisView = () => {
      if (document.visibilityState !== 'visible' || !root.isConnected) return
      if (isHeroInteractionActive()) return
      refreshComputedPenaltyHighlights()
      scheduleGaugeRefresh()
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
      if (isHeroInteractionActive()) return
      refreshComputedPenaltyHighlights()
      scheduleGaugeRefresh()
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

  const gather = () => {
    const vis = readHeroExpandSnapshot(meta)
    const ef = vis.extraField ?? 'none'
    return {
    at: at.inp.value,
    pa: pa.inp.value,
    a: ausw.inp.value,
    le: le.inp.value,
    leMax: leMax.inp.value,
    auMax: auMaxInp.value,
    aeMax: aeMaxInp.value,
    keMax: keMaxInp.value,
    ae: ae.inp.value,
    ke: ef === 'ke' ? extra.inp.value : snap.ke,
    gw: ef === 'gw' ? extra.inp.value : snap.gw,
    lo: ef === 'lo' ? extra.inp.value : snap.lo,
    extraField: ef,
    au: au.inp.value,
    ko: koAttr.inp.value,
    tp: tpInp.value,
    sp: spInp.value,
    tz: tzInp.value,
    frontal: frontalChk.checked,
    wappenDefs: snap.wappenDefs,
    fk: fk.inp.value,
    showFk: vis.showFk !== false,
    showAu: vis.showAu === true,
    gs: gsInp.value,
    mr: mrAttr.inp.value,
    ib: ib.inp.value,
    be: be.inp.value,
    w6: w6.inp.value,
    ws: ws.inp.value,
    leThreshold: customLeThreshold,
    unfaehigThreshold: snap.unfaehigThreshold,
    unfaehigMarkFields: snap.unfaehigMarkFields,
    unfaehigFixedFields: snap.unfaehigFixedFields,
    deathMode: snap.deathMode,
    deathAtMinusOnePointFiveKo: snap.deathAtMinusOnePointFiveKo,
    mu: mu.inp.value,
    kl: kl.inp.value,
    inn: inn.inp.value,
    ch: ch.inp.value,
    ff: ff.inp.value,
    ge: ge.inp.value,
    kk: kk.inp.value,
    hitZones: buildHitZonesPayload(),
  }
  }

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
  heroSnapAccess.gather = gather
  heroSnapAccess.persistBasis = persistBasisFromGathered

  /** Basis-Snapshot (Meta-Felder) → sichtbare Kästchen inkl. Wundmarken. */
  const applyHeroSnapshotToInputs = (snap) => {
    if (!snap || typeof snap !== 'object') return
    const setModInp = (field, inp, raw) => {
      if (!(inp instanceof HTMLInputElement)) return
      inp.value = microDisplayForModField(field, String(raw ?? ''))
    }
    setModInp('at', at.inp, snap.at)
    setModInp('pa', pa.inp, snap.pa)
    setModInp('a', ausw.inp, snap.a)
    le.inp.value = microDisplayForModField('le', String(snap.le ?? ''))
    leMaxInp.value = String(snap.leMax ?? '')
    setModInp('ae', ae.inp, snap.ae)
    setModInp('au', au.inp, snap.au)
    setModInp('fk', fk.inp, snap.fk)
    setModInp('gs', gsInp, snap.gs)
    setModInp('ib', ibInp, snap.ib)
    setModInp('be', beInp, snap.be)
    w6Inp.value = String(snap.w6 ?? '')
    setModInp('ws', wsInp, snap.ws)
    setModInp('mr', mrAttr.inp, snap.mr)
    setModInp('ko', koAttr.inp, snap.ko)
    tpInp.value = microDisplayForModField('tp', String(snap.tp ?? ''))
    spInp.value = String(snap.sp ?? '')
    tzInp.value = String(snap.tz ?? '')
    if (typeof snap.frontal === 'boolean') frontalChk.checked = snap.frontal
    const zones = snap.hitZones?.zones
    if (zones && typeof zones === 'object') {
      for (const ui of zoneUiMid) {
        const zd = zones[ui.zoneId]
        if (!zd) continue
        ui.rsInp.value = microDisplayForModField(
          ui.zoneId,
          String(zd.rs ?? '')
        )
        if (typeof ui.setWunden === 'function') {
          ui.setWunden(clampWound(zd.w ?? 0))
        }
        syncWappenRsFontSize(ui.rsInp)
      }
    }
  }

  const refreshDerivedUiFromInputs = (metaForVisuals) => {
    scheduleGaugeRefresh()
    syncLeMaxInputVisibility()
    applyUnfaehigVisualOverlay(metaForVisuals)
  }

  const isLeRelatedLiveInput = (inp) =>
    inp === le.inp ||
    inp === leMax.inp ||
    inp === koAttr.inp

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

  let leDerivedStripRaf = 0
  /** @type {Record<string, unknown> | undefined} */
  let leDerivedStripMetaPending

  const scheduleLeDerivedModStrip = (previewMeta) => {
    leDerivedStripMetaPending = previewMeta
    if (leDerivedStripRaf) return
    leDerivedStripRaf = requestAnimationFrame(() => {
      leDerivedStripRaf = 0
      const m = leDerivedStripMetaPending
      leDerivedStripMetaPending = undefined
      if (m) renderModBadgesAndStrip(m)
    })
  }

  /**
   * LE-abgeleitete Anzeige (Schwellen, Mod-Chips) ohne separates Overlay.
   *
   * @param {{ usePreview?: boolean, commitAfter?: boolean }} [opts]
   */
  function runSilentLeDerivedSync(opts = {}) {
    const previewMeta = opts.usePreview ? buildLiveLePreviewMeta() : undefined
    if (previewMeta) {
      refreshComputedPenaltyHighlights(previewMeta)
      refreshDerivedUiFromInputs(previewMeta)
      scheduleLeDerivedModStrip(previewMeta)
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
  /** Debounce für abgeleitete UI (LE-Schwelle, Mod-Vorschau, …) bei kurzer Eingabe. */
  const LIVE_INPUT_DEBOUNCE_MS = 4000

  const scheduleLiveDerivedRefresh = (inp, metaForVisuals) => {
    if (liveRefreshTimer != null) clearTimeout(liveRefreshTimer)
    liveRefreshTimer = setTimeout(() => {
      liveRefreshTimer = null
      if (isLeRelatedLiveInput(inp)) {
        runSilentLeDerivedSync({ usePreview: true })
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
  let persistGeneration = 0
  const PERSIST_DEBOUNCE_MS = 320

  const flushPersistHeroExpand = () => {
    persistTimer = null
    if (!persistQueued || !persistNextSnapshot) return
    const c = getCombat()
    const round =
      c?.started && Number.isFinite(Number(c.round)) ? Number(c.round) : null
    const navIni = readCurrentNavIniGlobal()
    const snapshot = persistNextSnapshot
    persistQueued = false
    persistNextSnapshot = null
    const gen = ++persistGeneration
    void (async () => {
      let metaForBasis = meta
      try {
        const freshItems = await OBR.scene.items.getItems([itemId])
        const fm = freshItems?.[0]?.metadata?.[TRACKER_ITEM_META_KEY]
        if (fm && typeof fm === 'object') metaForBasis = fm
      } catch (_) {
        /* Szene kurz nicht lesbar — Mount-meta nutzen */
      }
      if (gen !== persistGeneration) return
      const snap = basisHeroExpandSnapshotFromDisplayed(
        metaForBasis,
        snapshot,
        ownerIniNum,
        round,
        navIni
      )
      await applyHeroExpandFields(itemId, snap)
      if (gen !== persistGeneration) return
      await refreshModStripFromScene()
      if (container instanceof HTMLElement) {
        delete container[HERO_EXPAND_HAS_PENDING_INPUT]
      }
    })()
  }

  const schedulePersistHeroExpand = (snapshot) => {
    persistNextSnapshot = snapshot
    persistQueued = true
    if (container instanceof HTMLElement) {
      container[HERO_EXPAND_HAS_PENDING_INPUT] = true
    }
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
    if (container instanceof HTMLElement) {
      delete container[HERO_EXPAND_HAS_PENDING_INPUT]
    }
  }

  /** Vor Listen-Remount: Debounce abbrechen, Szene-Meta einlesen, Kästchen sofort persistieren. */
  const flushHeroExpandBeforeListRemount = async () => {
    if (!(container instanceof HTMLElement) || !container.isConnected) return
    cancelPendingPersistHeroExpand()
    persistGeneration += 1
    let metaForBasis = meta
    try {
      const freshItems = await OBR.scene.items.getItems([itemId])
      const fm = freshItems?.[0]?.metadata?.[TRACKER_ITEM_META_KEY]
      if (fm && typeof fm === 'object') metaForBasis = fm
    } catch (_) {
      /* Szene kurz nicht lesbar — Mount-meta nutzen */
    }
    try {
      const cFlush = getCombat()
      const roundFlush =
        cFlush?.started && Number.isFinite(Number(cFlush.round))
          ? Number(cFlush.round)
          : null
      const navIniFlush = readCurrentNavIniGlobal()
      const ownerIniFresh = readOwnerIniReferenceForMods(metaForBasis)
      const gFlush = gather()
      const visFresh = readHeroExpandSnapshot(metaForBasis)
      gFlush.showAu = visFresh.showAu === true
      gFlush.showFk = visFresh.showFk !== false
      gFlush.extraField = visFresh.extraField ?? 'none'
      const snapFlush = basisHeroExpandSnapshotFromDisplayed(
        metaForBasis,
        gFlush,
        ownerIniFresh,
        roundFlush,
        navIniFlush
      )
      await applyHeroExpandFields(itemId, snapFlush)
      await refreshModStripFromScene()
      if (container instanceof HTMLElement) {
        delete container[HERO_EXPAND_HAS_PENDING_INPUT]
      }
    } catch (err) {
      console.warn(
        '[vierpunkteins] flushHeroExpandBeforeListRemount failed',
        itemId,
        err
      )
    }
  }
  /** @type {HTMLElement} */
  const containerFlushHost = /** @type {HTMLElement} */ (container)
  containerFlushHost[HERO_EXPAND_BODY_FLUSH] = flushHeroExpandBeforeListRemount

  const clearTpTypingPersistTimer = () => {}

  spTzBridgeBtn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Offene Debounce-Persistenz kann ansonsten kurz danach alte Werte zurückschreiben
    // und frisch entstandene Auto-Mods (Wunden/LE-Band) wieder entfernen.
    cancelPendingPersistHeroExpand()
    clearTpTypingPersistTimer()
    const g0 = structuredClone(gather())
    const res = applyHitZoneStrikeFromSpTz(g0, {
      ignoreRs: rsBypassActive,
    })
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
    const snapBasis = persistBasisFromGathered(next)
    await applyHeroExpandFields(itemId, snapBasis)
    applyHeroSnapshotToInputs(snapBasis)
    await refreshModStripFromScene({ settle: true })
    if (liveRefreshTimer != null) {
      clearTimeout(liveRefreshTimer)
      liveRefreshTimer = null
    }
    refreshDerivedUiFromInputs()
    syncHeroRowLayout()
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
          const snapBasis = persistBasisFromGathered(/** @type {any} */ (before))
          await applyHeroExpandFields(itemId, snapBasis)
          applyHeroSnapshotToInputs(snapBasis)
          spTzCheckpoint = {
            sp: String(before.sp ?? ''),
            tz: String(before.tz ?? ''),
          }
          await refreshModStripFromScene()
          if (liveRefreshTimer != null) {
            clearTimeout(liveRefreshTimer)
            liveRefreshTimer = null
          }
          refreshDerivedUiFromInputs()
          syncHeroRowLayout()
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
          const snapBasis = persistBasisFromGathered(/** @type {any} */ (after))
          await applyHeroExpandFields(itemId, snapBasis)
          applyHeroSnapshotToInputs(snapBasis)
          spTzCheckpoint = {
            sp: String(after.sp ?? ''),
            tz: String(after.tz ?? ''),
          }
          await refreshModStripFromScene()
          if (liveRefreshTimer != null) {
            clearTimeout(liveRefreshTimer)
            liveRefreshTimer = null
          }
          refreshDerivedUiFromInputs()
          syncHeroRowLayout()
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
    auMaxInp,
    aeMaxInp,
    keMaxInp,
    ae.inp,
    ...(showExtraField ? [extra.inp] : []),
    tpInp,
    ...(showFkField ? [fk.inp] : []),
    gsInp,
    mrAttr.inp,
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
    ...(showAuField ? [au.inp] : []),
    ...allZoneUis.map((u) => u.rsInp),
  ]
  let lastPointerDownInsideAt = 0
  root.addEventListener(
    'pointerdown',
    () => {
      const t = Date.now()
      lastPointerDownInsideAt = t
      markHeroInteraction()
    },
    { capture: true, passive: true }
  )
  root.addEventListener(
    'focusin',
    () => {
      markHeroInteraction()
      root.classList.add('init-hero-ex--no-gauge-anim')
    },
    { capture: true, passive: true }
  )
  for (const inp of liveInputs) {
    inp.addEventListener('input', () => {
      markHeroInteraction()
      // Sofort: Malus-Hervorhebung an aktuellen LE/Wunden-Werten (ohne auf
      // die 4s-Debounce von syncLeThreshold / Popover zu warten).
      refreshComputedPenaltyHighlights()
      const len = inp.value.trim().length
      const immediateDerivedForLe = isLeRelatedLiveInput(inp)
      const criticalLeNow =
        immediateDerivedForLe &&
        (() => {
          const leNow = parseIntAllowSignedLocal(le.inp.value)
          return leNow != null && leNow <= 0
        })()
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
      if (immediateDerivedForLe || criticalLeNow || len >= 2) {
        if (liveRefreshTimer != null) {
          clearTimeout(liveRefreshTimer)
          liveRefreshTimer = null
        }
        if (immediateDerivedForLe) {
          runSilentLeDerivedSync({ usePreview: true })
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
        scheduleHeroRowLayoutAfterIdle()
      }, 45)
    })
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      commit()
    })
    inp.addEventListener('focus', (e) => {
      markHeroInteraction()
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
    if (isHeroInteractionActive()) return
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
    if (isHeroInteractionActive()) return
    if (liveRefreshTimer != null) {
      clearTimeout(liveRefreshTimer)
      liveRefreshTimer = null
    }
    refreshDerivedUiFromInputs()
    applyKrFieldRed()
  }, MALUS_STATE_POLL_MS)
}
