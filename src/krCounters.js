import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem, isGmSync } from './editAccess.js'
import {
  getTokenListDisplayName,
  TRACKER_ITEM_META_KEY,
} from './participants.js'
import {
  ACTION_STAMPS_KEY,
  getCombat,
  normalizeActionStamps,
  patchActionStamps,
} from './combatRoom.js'
import {
  canCreateSecondActionRoot,
  ensureExtraAttackPhaseRoot,
  finalizePhasesWithOrderedRoots,
  nextChainedZaoParentForTransfer,
  normalizePhases,
  removeLastZaoRoot,
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
  sortedLinksForLayout,
} from './phaseLinks.js'
import {
  clearLhTrackerActivity,
  LH_COMMIT_INI,
  LH_DONE_INI,
  LH_DONE_ROUND,
  LH_KR_FIRED_MASK,
  LH_KR_FIRED_ROUND,
  LH_MAX,
  LH_REM,
  isLhActive,
  isLhLockingActions,
  phaseOffsetFromHeroExtraAngMeta,
  phaseOffsetFromHeroSecondAoMeta,
  phaseOffsetFromLhMeta,
} from './lhMeta.js'
import { faMaxForInitiative, getRoomSettings } from './roomSettings.js'

/**
 * Aktive Kampfrunde fuer das `isLhLockingActions`-Praedikat. Liefert die
 * aktuelle KR, wenn der Kampf laeuft — sonst `null`. Ohne gueltige Runde
 * faellt `isLhLockingActions` defensiv auf das alte Sperr-Verhalten zurueck.
 *
 * @returns {number | null}
 */
function lhLockRoundFromCombat() {
  const c = getCombat()
  if (!c.started) return null
  return Number.isFinite(c.round) ? c.round : null
}

export const KR_ANG = 'krAng'
export const KR_ABW = 'krAbw'
/** Mutterzeilen-Primärstempel (Ang/SRA/blaues Abw) in dieser KR — für LH-Prior-Budget. */
export const KR_MOTHER_PRIMARY_USED_THIS_ROUND = 'krMotherPrimaryUsedThisRound'
/**
 * Zusätzliche Parade (Helden-Einstellung): separates schwarzes Schild.
 * `0` = Ladung im Slot sichtbar, `1` = verbraucht (Stempel aktiv).
 */
export const KR_PARADE_EXTRA = 'krParadeExtra'
const HERO_EXTRA_MAX = 10
/** Sonstige reguläre Aktionen (z. B. Atem holen, Bewegen, Position, Taktik) */
export const KR_SRA = 'krSra'
/** Welche Aktionstypen den beiden vorderen Slots zugeordnet sind (Standard: Ang + Abw). */
export const KR_PAIR_MODE = 'krPairMode'
/** Erstes Aktionsfeld der Zeile: Angriff oder S.R.A. (UI-Dropdown). */
export const KR_FIRST_SLOT_KIND = 'krFirstSlotKind'
/**
 * Gemeinsame Ladung des ersten Aktionsfeldes (AN / S.R.A. / L.H.): bleibt beim Umschalten erhalten.
 * Fehlender Schlüssel: Migration aus dem jeweils aktiven Zählerfeld.
 */
export const KR_PRIMARY_LADUNG = 'krPrimaryLadung'

/**
 * Standard-Zähler für neue Kampf-Teilnehmer: je eine volle Ladung
 * im ersten Aktionsfeld und bei Abwehr (UI: Zähler 0 = Ladung geladen).
 */
/** Zweite L.H.-Ladung (Schild → Feld); 0 = nur Grundladung (UI halbiert), 1 = voll. Fehlender Schlüssel = 1 (Altbestand). */
export const KR_LH_SECOND = 'krLhSecondCharge'
/** L.H. mit genau einer Aktion: klickbarer Stempel wie Ang./Abw./S.R.A./F.A. */
export const KR_LH_ACTION = 'krLhAction'
/** Freie Aktion (Zyklus): verbrauchte Klicks vs. Obergrenze. */
export const KR_FREE_ACTION = 'krFreeAction'
/** 1: L.H.-Feld per oberem Pfeil geleert (krLhAction 1 ohne Stempel); Rechtsklick −1 hebt Leerung auf, ohne zweite Ladung zu erfinden. */
export const KR_LH_VOID_BY_TRANSFER = 'krLhVoidByTransfer'
/**
 * 1: Ang./S.R.A.-Primärfeld per Umwandlung ins Abwehr-Schild geleert (wie L.H.
 * `KR_LH_VOID_BY_TRANSFER`); UI blendet das Aktions-Icon aus.
 */
export const KR_PRIMARY_VOID_BY_ABW_TRANSFER = 'krPrimaryVoidByAbwTransfer'

/**
 * Bei INI < 0 wird die Gesamtladung auf höchstens 1 reduziert (Priorität: erst
 * die Primärseite A, dann ggf. die Schildseite B). Die beiden Felder merken,
 * wie viele Marks durch die Sperre abgezogen wurden, damit sie bei INI ≥ 0
 * wieder ergänzt werden können.
 */
export const KR_INI_LOCK_MINUS_A = 'krIniLockMinusA'
export const KR_INI_LOCK_MINUS_B = 'krIniLockMinusB'

/**
 * Konfiguration des Verhaltens bei INI < 0 (pro Held, token-meta).
 * `heroIniNegActionsLost`: Anzahl Ladungen, die bei INI < 0 wegfallen (Standard 1).
 * `heroIniNegAngMode`: Schwert-Freigabe ('no' | 'yes' | 'zatOnly', Standard 'no').
 */
export const HERO_INI_NEG_ACTIONS_LOST = 'heroIniNegActionsLost'
export const HERO_INI_NEG_ANG_MODE = 'heroIniNegAngMode'

/**
 * Wie viele Ladungen bei INI < 0 gesperrt werden (0–10, Standard 1).
 * @param {unknown} meta
 * @returns {number}
 */
export function readHeroIniNegActionsLost(meta) {
  if (!meta || typeof meta !== 'object') return 1
  const n = Math.floor(Number(meta[HERO_INI_NEG_ACTIONS_LOST]))
  return Number.isFinite(n) && n >= 0 ? Math.min(10, n) : 1
}

/**
 * Schwert-Freigabe im negativen INI-Bereich.
 * 'no'      — kein Schwert (Standard/bisheriges Verhalten)
 * 'yes'     — Schwert als Mutter-Aktion erlaubt
 * 'zatOnly' — Mutter bleibt SRA, aber z.AT-Objekte dürfen in den negativen Bereich
 * @param {unknown} meta
 * @returns {'no' | 'yes' | 'zatOnly'}
 */
export function readHeroIniNegAngMode(meta) {
  if (!meta || typeof meta !== 'object') return 'no'
  const v = meta[HERO_INI_NEG_ANG_MODE]
  return v === 'yes' || v === 'zatOnly' ? v : 'no'
}

/**
 * Zustand der einzelnen 2.A.-Objekt-Slots (Wurzel-Phasen-Links).
 * Jeder Eintrag: `{ kind: 'ang'|'sra'|'lh', marks: 0|1, lodgedAbw?: true }`.
 * `lodgedAbw`: Ladung liegt im gemeinsamen `KR_ABW` (Zeile bleibt, Primär leer).
 * Fehlt der Eintrag, wird bei der Anzeige Kind = Mutter-Kind und `marks = 1`
 * angenommen (Kompatibilität mit alten Daten).
 */
export const KR_ZAO_SLOTS = 'krZaoSlots'

/** SL: Angriffsanteil des Umwandlungs-Speichers pro KR (mit `heroActionPoolAbw`, Summe konstant). */
export const HERO_ACTION_POOL_ANG = 'heroActionPoolAng'
/** SL: Abwehranteil des Umwandlungs-Speichers pro KR. */
export const HERO_ACTION_POOL_ABW = 'heroActionPoolAbw'
/** SL: Obergrenze ang+abw pro KR (1…20). Ohne Key: aus gespeichertem ang+abw abgeleitet. */
export const HERO_ACTION_POOL_MAX = 'heroActionPoolMax'
/** Laufzeit: Rest-Angriffsanteil in der laufenden KR. */
export const KR_ACTION_POOL_ANG_REM = 'krActionPoolAngRem'
/** Laufzeit: Rest-Abwehranteil in der laufenden KR. */
export const KR_ACTION_POOL_ABW_REM = 'krActionPoolAbwRem'

/**
 * 1: In dieser KR wurde bei INI&lt;0 eine Einheit vom Aktions- zum Reaktionspool
 * verschoben — wird bei INI wieder ≥0 symmetrisch zurückgenommen (keine Drift).
 */
export const KR_INI_NEG_POOL_SHIFT_APPLIED = 'krIniNegPoolShiftApplied'

const DEFAULT_HERO_ACTION_POOL_ANG = 1
const DEFAULT_HERO_ACTION_POOL_ABW = 1
/** Summe Aktions- + Reaktionsladungen pro KR (untere Grenze). */
export const MIN_HERO_ACTION_POOL_SUM = 1
export const MAX_HERO_ACTION_POOL_SUM = 20

/**
 * Rohe ang/abw aus Meta wie vor Einführung von `heroActionPoolMax` (Migration).
 * @param {unknown} meta
 * @returns {{ ang: number, abw: number }}
 */
function parseLegacyHeroActionPoolAngAbw(meta) {
  let ang = Math.floor(Number(meta?.[HERO_ACTION_POOL_ANG]))
  let abw = Math.floor(Number(meta?.[HERO_ACTION_POOL_ABW]))
  if (!Number.isFinite(ang) || ang < 0) ang = DEFAULT_HERO_ACTION_POOL_ANG
  if (!Number.isFinite(abw) || abw < 0) abw = DEFAULT_HERO_ACTION_POOL_ABW
  ang = Math.max(0, Math.min(MAX_HERO_ACTION_POOL_SUM, ang))
  abw = Math.max(0, Math.min(MAX_HERO_ACTION_POOL_SUM, abw))
  let sum = ang + abw
  if (sum > MAX_HERO_ACTION_POOL_SUM) {
    const scale = MAX_HERO_ACTION_POOL_SUM / sum
    ang = Math.max(0, Math.floor(ang * scale))
    abw = Math.max(0, MAX_HERO_ACTION_POOL_SUM - ang)
    sum = ang + abw
  }
  if (sum < 1) {
    ang = DEFAULT_HERO_ACTION_POOL_ANG
    abw = DEFAULT_HERO_ACTION_POOL_ABW
  }
  return { ang, abw }
}

/**
 * @param {unknown} meta
 * @returns {number} Summe S (1…20)
 */
export function readHeroActionPoolMax(meta) {
  const legacy = parseLegacyHeroActionPoolAngAbw(meta)
  const legacySum = legacy.ang + legacy.abw
  const rawMax = Math.floor(Number(meta?.[HERO_ACTION_POOL_MAX]))
  if (
    Number.isFinite(rawMax) &&
    rawMax >= MIN_HERO_ACTION_POOL_SUM &&
    rawMax <= MAX_HERO_ACTION_POOL_SUM
  ) {
    return rawMax
  }
  return Math.max(
    MIN_HERO_ACTION_POOL_SUM,
    Math.min(MAX_HERO_ACTION_POOL_SUM, legacySum)
  )
}

/**
 * Konfiguriertes Umw.-Budget: Summe = `readHeroActionPoolMax`, Abwehr = Rest nach Angriffsanteil.
 * @param {unknown} meta
 * @returns {{ ang: number, abw: number }}
 */
export function readHeroActionPoolPair(meta) {
  const legacy = parseLegacyHeroActionPoolAngAbw(meta)
  const S = readHeroActionPoolMax(meta)
  const ang = Math.min(Math.max(0, legacy.ang), S)
  const abw = S - ang
  return { ang, abw }
}

/**
 * Effektive Aufteilung für Pool und KR-Ladevorgang: bei INI &lt; 0 eine
 * Aktionsladung nach Reaktionsseite verschoben (Summe S unverändert).
 *
 * @param {unknown} meta
 * @returns {{ ang: number, abw: number }}
 */
export function effectiveHeroPoolSplit(meta) {
  const pair = readHeroActionPoolPair(meta)
  if (!isHeroIniBelowZero(meta)) return pair
  const S = readHeroActionPoolMax(meta)
  const angEff = Math.max(0, pair.ang - 1)
  return { ang: angEff, abw: S - angEff }
}

/**
 * Rohe Pool-REM ohne INI-effektiven Fallback (nur konfigurierte Aufteilung),
 * damit Zeichenwechsel nicht doppelt verschiebt.
 *
 * @param {Record<string, unknown>} m
 * @returns {{ ang: number, abw: number }}
 */
function readKrActionPoolRemFromStoredOrCfgPair(m) {
  const pair = readHeroActionPoolPair(m)
  const S = pair.ang + pair.abw
  const ra = m?.[KR_ACTION_POOL_ANG_REM]
  const rb = m?.[KR_ACTION_POOL_ABW_REM]
  if (!Number.isFinite(Number(ra)) || !Number.isFinite(Number(rb))) {
    return { ang: pair.ang, abw: pair.abw }
  }
  const a = Math.max(0, Math.floor(Number(ra)))
  const b = Math.max(0, Math.floor(Number(rb)))
  if (a + b !== S) return { ang: pair.ang, abw: pair.abw }
  return { ang: a, abw: b }
}

/**
 * Nach INI < 0 war die Mutter-Aktion oft auf S.R.A. migriert (`sra_ang`).
 * Beim Zurückkehren zu INI >= 0 und Neuaufbau der Ladungen muss der Paarmodus
 * wieder dem KR-Standard entsprechen — sonst bleiben Hilfs-Zähler inkonsistent
 * und "Nächste Aktion" / Umwandlung können einen leeren Primärslot erzeugen.
 *
 * @param {Record<string, unknown>} m
 */
function resetMotherPrimarySlotAfterIniRecoveryFromNegative(m) {
  if (!m || typeof m !== 'object') return
  m[KR_FIRST_SLOT_KIND] = 'ang'
  m[KR_PAIR_MODE] = 'ang_abw'
  m[KR_ANG] = 1
  m[KR_SRA] = 1
  m[KR_LH_ACTION] = 1
  delete m[KR_LH_SECOND]
  delete m[KR_LH_VOID_BY_TRANSFER]
  delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
}

/**
 * Bei INI-Zeichenwechsel über die Null: REM verschieben; beim Verlassen der
 * negativen INI Mutter-Slot und Visuals an positiven Split anbinden.
 *
 * @param {Record<string, unknown>} m
 * @param {boolean} iniWasBelowZero
 * @param {boolean} iniNowBelowZero
 */
export function applyIniNegativePoolShiftForMetaMutation(
  m,
  iniWasBelowZero,
  iniNowBelowZero
) {
  if (!m || typeof m !== 'object') return
  if (iniWasBelowZero === iniNowBelowZero) return
  const S = readHeroActionPoolMax(m)
  const cfg = readHeroActionPoolPair(m)
  const rem = readKrActionPoolRemFromStoredOrCfgPair(m)

  if (iniNowBelowZero) {
    if (cfg.ang < 1) return
    const prevAng = rem.ang
    const ang = Math.max(0, rem.ang - 1)
    m[KR_ACTION_POOL_ANG_REM] = ang
    m[KR_ACTION_POOL_ABW_REM] = S - ang
    if (prevAng > 0) m[KR_INI_NEG_POOL_SHIFT_APPLIED] = 1
    else delete m[KR_INI_NEG_POOL_SHIFT_APPLIED]
    return
  }

  // INI wieder >= 0: REM und ggf. Schilde/Aktionsobjekte an positiven Split anbinden
  // (m.initiative wurde vom Aufrufer bereits gesetzt).
  const splitPos = effectiveHeroPoolSplit(m)
  m[KR_ACTION_POOL_ANG_REM] = splitPos.ang
  m[KR_ACTION_POOL_ABW_REM] = splitPos.abw
  delete m[KR_INI_NEG_POOL_SHIFT_APPLIED]

  if (!getCombat().started) return

  const lhMaxActive = Math.max(0, Math.floor(Number(m[LH_MAX])) || 0) > 0
  if (!lhMaxActive) {
    resetMotherPrimarySlotAfterIniRecoveryFromNegative(m)
    rebuildKrActionPoolVisualsFromAngAbw(m, splitPos.ang, splitPos.abw)
  }
}

/**
 * @param {unknown} meta
 * @returns {{ ang: number, abw: number }}
 */
export function readKrActionPoolRem(meta) {
  const cfg = effectiveHeroPoolSplit(meta)
  const sumCfg = cfg.ang + cfg.abw
  const ra = meta?.[KR_ACTION_POOL_ANG_REM]
  const rb = meta?.[KR_ACTION_POOL_ABW_REM]
  if (!Number.isFinite(Number(ra)) || !Number.isFinite(Number(rb))) {
    return { ang: cfg.ang, abw: cfg.abw }
  }
  const a = Math.max(0, Math.floor(Number(ra)))
  const b = Math.max(0, Math.floor(Number(rb)))
  if (a + b !== sumCfg) return { ang: cfg.ang, abw: cfg.abw }
  return { ang: a, abw: b }
}

/**
 * Merkt, dass diese KR mit INI&lt;0-Umverteilung geladen wurde (REM + ggf. Visuals).
 *
 * @param {Record<string, unknown>} m
 */
function setIniNegPoolShiftAppliedFlagIfNegativeShift(m) {
  const cfg = readHeroActionPoolPair(m)
  const eff = effectiveHeroPoolSplit(m)
  if (isHeroIniBelowZero(m) && cfg.ang >= 1 && eff.ang < cfg.ang) {
    m[KR_INI_NEG_POOL_SHIFT_APPLIED] = 1
  }
}

/**
 * Baut Schilde und Aktionsobjekte aus fester ang/abw-Aufteilung (ohne REM).
 *
 * @param {Record<string, unknown>} m
 * @param {number} ang
 * @param {number} abw
 */
export function rebuildKrActionPoolVisualsFromAngAbw(m, ang, abw) {
  if (!m || typeof m !== 'object') return

  // --- Reaktionsschilde aus Abw.-Budget ---
  m[KR_ABW] = chargeValueFromMarks(abw)

  // --- Aktionsobjekte aus Ang.-Budget ---
  // 1. Vorhandene nicht-heroExtra ZAO-Links/-Slots aus der Vorrunde entfernen.
  const p = normalizePhases(m.phases)
  const nonHeroExtraIds = new Set(
    p.links
      .filter((l) => l.parentId === null && !l.heroExtra)
      .map((l) => l.id)
  )
  const slots = readZaoSlots(m)
  for (const id of nonHeroExtraIds) {
    delete slots[id]
  }
  m[KR_ZAO_SLOTS] = slots
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...p,
    links: p.links.filter((l) => !(l.parentId === null && !l.heroExtra)),
  })

  // 2. Mutter-Ladung setzen (ang >= 1).
  delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
  delete m[KR_LH_VOID_BY_TRANSFER]
  const field = primaryFieldForKind(m)
  if (ang >= 1) {
    m[field] = chargeValueFromMarks(1)
    syncKrPrimaryLadungFromPrimaryField(m)
  } else {
    m[field] = chargeValueFromMarks(0)
    syncKrPrimaryLadungFromPrimaryField(m)
  }

  // 3. ZAO-Objekte für jede zusätzliche Aktionsladung (ang > 1) anlegen.
  if (ang > 1) {
    const iniStr = m?.initiative
    const phaseOffset = phaseOffsetFromHeroSecondAoMeta(m)
    const firstKind = readKrFirstSlotKind(m)
    const zaoKind = firstKind === 'sra' || firstKind === 'lh' ? firstKind : 'ang'
    const p2 = normalizePhases(m.phases)
    const newSlots = readZaoSlots(m)
    if (typeof iniStr === 'string') {
      let phasesAcc = { ...p2, links: [...p2.links], rowPanelOpen: true }
      for (let i = 1; i < ang; i++) {
        phasesAcc = finalizePhasesWithOrderedRoots(m, phasesAcc)
        const next = nextChainedZaoParentForTransfer(
          iniStr,
          phasesAcc,
          phaseOffset
        )
        if (!next) break
        const newLinkId = crypto.randomUUID()
        phasesAcc = {
          ...phasesAcc,
          links: [
            ...phasesAcc.links,
            {
              id: newLinkId,
              parentId: next.parentId,
              offset: next.offset,
            },
          ],
        }
        newSlots[newLinkId] = { kind: zaoKind, marks: 1 }
      }
      phasesAcc = finalizePhasesWithOrderedRoots(m, phasesAcc)
      if (phasesAcc.links.length > p2.links.length) {
        m.phases = phasesAcc
        m[KR_ZAO_SLOTS] = newSlots
      }
    }
  }
}

/**
 * Setzt die Laufzeit-Pools auf die SL-konfigurierten Werte (neue KR / SL-Änderung)
 * und befüllt beim Rundenstart automatisch Aktionsobjekte und Reaktionsschilde
 * entsprechend der Ang./Abw.-Aufteilung des Budgets.
 *
 * @param {Record<string, unknown>} m
 * @param {{ skipActionInit?: boolean }} [opts]
 *   skipActionInit: true = Aktionsobjekte / Schilde NICHT neu aufbauen (z. B. bei
 *   laufender L.H., wo Mutter-Ladung und ZAO-Slots separat verwaltet werden).
 */
export function initKrActionPoolsFromHeroDefaults(m, { skipActionInit = false } = {}) {
  if (!m || typeof m !== 'object') return
  delete m[KR_INI_NEG_POOL_SHIFT_APPLIED]
  const { ang, abw } = effectiveHeroPoolSplit(m)
  m[KR_ACTION_POOL_ANG_REM] = ang
  m[KR_ACTION_POOL_ABW_REM] = abw

  if (skipActionInit) {
    setIniNegPoolShiftAppliedFlagIfNegativeShift(m)
    return
  }

  rebuildKrActionPoolVisualsFromAngAbw(m, ang, abw)
  setIniNegPoolShiftAppliedFlagIfNegativeShift(m)
}

/**
 * @param {Record<string, unknown>} m
 * @returns {boolean} true wenn gebucht
 */
function tickActionPoolAngToAbw(m) {
  if (readKrFirstSlotKind(m) !== 'ang') return false
  const { ang, abw } = readKrActionPoolRem(m)
  if (ang <= 0) return false
  m[KR_ACTION_POOL_ANG_REM] = ang - 1
  m[KR_ACTION_POOL_ABW_REM] = abw + 1
  return true
}

function clampHeroExtraCount(raw) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(HERO_EXTRA_MAX, n))
}

/**
 * @param {unknown} meta
 * @returns {number}
 */
export function readHeroExtraAngCount(meta) {
  if (meta && typeof meta === 'object') {
    if (Object.prototype.hasOwnProperty.call(meta, 'heroExtraAngCount')) {
      return clampHeroExtraCount(meta.heroExtraAngCount)
    }
    return meta.heroExtraAng ? 1 : 0
  }
  return 0
}

/**
 * @param {unknown} meta
 * @returns {number}
 */
export function readHeroExtraParCount(meta) {
  if (meta && typeof meta === 'object') {
    if (Object.prototype.hasOwnProperty.call(meta, 'heroExtraParCount')) {
      return clampHeroExtraCount(meta.heroExtraParCount)
    }
    return meta.heroExtraPar ? 1 : 0
  }
  return 0
}

function migrateHeroExtraCountFields(m) {
  if (!m || typeof m !== 'object') return
  if (m.heroExtraAngCount === undefined && m.heroExtraAng !== undefined) {
    m.heroExtraAngCount = m.heroExtraAng ? 1 : 0
  }
  if (m.heroExtraParCount === undefined && m.heroExtraPar !== undefined) {
    m.heroExtraParCount = m.heroExtraPar ? 1 : 0
  }
  delete m.heroExtraAng
  delete m.heroExtraPar
}

/**
 * @param {unknown} meta
 * @param {string | number | undefined} iniStr
 * @param {{ highIniFreeActions?: boolean } | undefined} settings
 * @returns {number}
 */
export function readHeroFaMax(meta, iniStr, settings) {
  if (meta && typeof meta === 'object') {
    if (Object.prototype.hasOwnProperty.call(meta, 'heroFaMax')) {
      const n = Math.floor(Number(meta.heroFaMax))
      if (Number.isFinite(n) && n >= 0) return Math.max(0, Math.min(HERO_EXTRA_MAX, n))
    }
  }
  return faMaxForInitiative(iniStr, Boolean(settings?.highIniFreeActions))
}

function paradeExtraFieldForIndex(index) {
  return index <= 0 ? KR_PARADE_EXTRA : `${KR_PARADE_EXTRA}_${index + 1}`
}

function paradeExtraIndexForField(field) {
  if (field === KR_PARADE_EXTRA) return 0
  if (typeof field !== 'string') return null
  if (!field.startsWith(`${KR_PARADE_EXTRA}_`)) return null
  const n = Math.floor(Number(field.slice(KR_PARADE_EXTRA.length + 1)))
  if (!Number.isFinite(n) || n < 2 || n > HERO_EXTRA_MAX) return null
  return n - 1
}

/**
 * @param {unknown} meta
 * @returns {Record<string, { kind: 'ang'|'sra'|'lh', marks: 0|1, lodgedAbw?: true }>}
 */
export function readZaoSlots(meta) {
  const raw = meta?.[KR_ZAO_SLOTS]
  if (!raw || typeof raw !== 'object') return {}
  /** @type {Record<string, { kind: 'ang'|'sra'|'lh', marks: 0|1, lodgedAbw?: true }>} */
  const out = {}
  for (const key of Object.keys(raw)) {
    const s = raw[key]
    if (!s || typeof s !== 'object') continue
    const kind = s.kind === 'sra' || s.kind === 'lh' ? s.kind : 'ang'
    const marks = s.marks === 1 ? 1 : 0
    const lodgedAbw =
      /** @type {{ lodgedAbw?: unknown }} */ (s).lodgedAbw === true
    out[key] = lodgedAbw ? { kind, marks, lodgedAbw: true } : { kind, marks }
  }
  return out
}

/**
 * Liefert den expliziten Slot-Zustand zu einem 2.A.-Link – oder `null`,
 * falls kein Eintrag im Meta vorhanden ist (z. B. L.H.-Counter-ZAO).
 *
 * @param {unknown} meta
 * @param {string} linkId
 * @returns {{ kind: 'ang'|'sra'|'lh', marks: 0|1, lodgedAbw?: true } | null}
 */
export function readZaoSlot(meta, linkId) {
  const slots = readZaoSlots(meta)
  return slots[linkId] || null
}

/**
 * Mindestens eine reguläre (nicht `heroExtra`) 2.A.-Wurzel mit voller Ladung
 * (`marks === 1`). Wird genutzt, um Abwehr→leeres Mutterfeld zu sperren, solange
 * noch eine zweite Aktion abgearbeitet werden soll.
 *
 * @param {unknown} meta
 * @returns {boolean}
 */
export function metaHasPendingLoadedNonHeroExtraZao(meta) {
  if (!meta || typeof meta !== 'object') return false
  const zaoSlotsMap = readZaoSlots(meta)
  const phaseLinksForTransfer = normalizePhases(meta.phases).links
  const heroExtraLinkIds = new Set(
    phaseLinksForTransfer
      .filter((l) => l.parentId === null && l.heroExtra)
      .map((l) => l.id)
  )
  return Object.entries(zaoSlotsMap).some(
    ([linkId, s]) => s && s.marks === 1 && !heroExtraLinkIds.has(linkId)
  )
}

/** Primär-Stempel am Mutteranker (kein Phasen-Link) — für Umwandlungs-Sperre. */
const MOTHER_PRIMARY_STAMP_FIELDS = new Set([KR_ANG, KR_SRA, KR_LH_ACTION])

/**
 * Mutter-Primärstempel, angelegt während die Navigation auf der **eigenen**
 * Token-Zeile stand (`anchorRowId === itemId`). Fremde `anchorRowId` (andere
 * Zeile) sperren die Umwandlung am Mutterobjekt nicht.
 *
 * @param {unknown[]} entries
 * @param {string} itemId
 * @returns {boolean}
 */
export function motherPrimarySelfStamped(entries, itemId) {
  if (!Array.isArray(entries) || typeof itemId !== 'string') return false
  return entries.some((e) => {
    if (!e || typeof e !== 'object') return false
    if (e.itemId !== itemId) return false
    if (e.paradeExtra) return false
    if (e.anchorPhaseLinkId != null) return false
    if (e.anchorRowId != null && e.anchorRowId !== itemId) return false
    if (!MOTHER_PRIMARY_STAMP_FIELDS.has(e.field)) return false
    return true
  })
}

/** @deprecated Nutze `motherPrimarySelfStamped` — Alias für Kompatibilität. */
export const motherPrimaryActionStamped = motherPrimarySelfStamped

/**
 * KR, in der eine L.H. endet: Tracker noch aktiv, aber keine „mittendrin“-Sperre.
 *
 * @param {unknown} meta
 * @param {number | null | undefined} combatRound
 * @returns {boolean}
 */
export function lhEndKrConvertMode(meta, combatRound) {
  return isLhActive(meta) && !isLhLockingActions(meta, combatRound)
}

/** @param {unknown} meta */
function isConvertAnytimeEnabled(meta) {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    /** @type {{ convertAnytimeEnabled?: unknown }} */ (meta)
      .convertAnytimeEnabled === true
  )
}

/**
 * End-KR-Umwandlung: fixe L.H. am Mutterfeld vs. reguläre 2.A.-Kette — exklusive Pfeile.
 *
 * @param {unknown} meta
 * @param {number | null | undefined} combatRound
 * @returns {{ blockUpperLhMotherNoZao: boolean, blockLowerPendingZao: boolean }}
 */
export function lhEndKrConvertArrowGates(meta, combatRound) {
  if (isConvertAnytimeEnabled(meta)) {
    return { blockUpperLhMotherNoZao: false, blockLowerPendingZao: false }
  }
  if (!lhEndKrConvertMode(meta, combatRound)) {
    return { blockUpperLhMotherNoZao: false, blockLowerPendingZao: false }
  }
  const anyZao = metaHasPendingLoadedNonHeroExtraZao(meta)
  const firstKind = readKrFirstSlotKind(meta)
  return {
    blockUpperLhMotherNoZao: firstKind === 'lh' && !anyZao,
    blockLowerPendingZao: anyZao,
  }
}

/**
 * @param {string} itemId
 * @param {string} linkId
 * @param {{ kind?: 'ang'|'sra'|'lh', marks?: 0|1, lodgedAbw?: boolean }} patch
 */
export async function patchZaoSlot(itemId, linkId, patch) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const slots = readZaoSlots(m)
      const prev = slots[linkId] || {
        kind: readKrFirstSlotKind(m),
        marks: 1,
      }
      const nextMarks =
        patch.marks === 0 || patch.marks === 1 ? patch.marks : prev.marks
      const nextKind =
        patch.kind === 'ang' ||
        patch.kind === 'sra' ||
        patch.kind === 'lh'
          ? patch.kind
          : prev.kind
      let nextLodged =
        patch.lodgedAbw === true
          ? true
          : patch.lodgedAbw === false
            ? false
            : nextMarks === 1
              ? false
              : prev.lodgedAbw === true
      const next = /** @type {Record<string, unknown>} */ ({
        kind: nextKind,
        marks: nextMarks,
      })
      if (nextLodged) next.lodgedAbw = true
      slots[linkId] = /** @type {{ kind: 'ang'|'sra'|'lh', marks: 0|1, lodgedAbw?: true }} */ (
        next
      )
      m[KR_ZAO_SLOTS] = slots
    }
  })
}

/**
 * @param {ReturnType<typeof normalizePhases>} phases
 * @returns {{ links: typeof phases.links, dropIds: Set<string> }}
 */
function linksWithoutHeroExtraRoots(phases) {
  const extraRoots = phases.links.filter(
    (l) => l.parentId === null && (l.heroExtra === 'ang' || l.heroExtra === 'par')
  )
  const dropIds = new Set(extraRoots.map((l) => l.id))
  return {
    links: phases.links.filter((l) => !dropIds.has(l.id)),
    dropIds,
  }
}

/**
 * Nach Kampf-Start/-Ende (`resetAllTrackerStateForCombatStart`): z.AT-
 * Phasenwurzeln und zugehörige ZAO-Slots entfernen, **ohne** sie sofort neu
 * anzulegen — das 2.A.-Panel bleibt zu; `heroExtraZaoAvailableForRestore`
 * zeigt das rote „+", solange noch nicht alle konfigurierten z.AT wieder
 * hereingeholt sind (`patchRestoreHeroExtraZao`).
 *
 * @param {Record<string, unknown>} m Token-Tracker-Meta (Mutationsziel)
 */
function stripHeroExtraZatAfterCombatFullReset(m) {
  if (!m || typeof m !== 'object') return
  migrateHeroExtraCountFields(m)
  const phases = normalizePhases(m.phases)
  const { links } = linksWithoutHeroExtraRoots(phases)
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...phases,
    links,
    rowPanelOpen: false,
  })
}

/**
 * Helden-Einstellungs-Zusatzobjekt (z.AT):
 * - Pro **Kampfrunden**-Reset (nicht beim vollen Kampf-Start/-Ende-Reset oben)
 *   werden heroExtra-Wurzeln verworfen und aus den Helden-Einstellungen neu
 *   aufgebaut (Soll-Anzahl, stabile Offsets).
 * - Das Objekt trägt pro Wurzel eine stempelbare Ladung (`kind:'ang', marks:1`).
 *
 * @param {Record<string, unknown>} m Token-Tracker-Meta (Mutationsziel)
 */
function rebuildHeroExtraAttackRootAndSlot(m) {
  if (!m || typeof m !== 'object') return
  migrateHeroExtraCountFields(m)
  const wanted = readHeroExtraAngCount(m)
  const phases = normalizePhases(m.phases)
  const { links: linksBase, dropIds } = linksWithoutHeroExtraRoots(phases)
  let links = linksBase
  if (wanted > 0) {
    const off = Math.max(1, phaseOffsetFromHeroExtraAngMeta(m))
    for (let i = 0; i < wanted; i++) {
      links.push({
        id: crypto.randomUUID(),
        parentId: null,
        offset: off * (i + 1),
        heroExtra: 'ang',
        expiresNextRound: false,
      })
    }
  }
  m.phases = finalizePhasesWithOrderedRoots(m, { ...phases, links })
  const slots = readZaoSlots(m)
  for (const id of dropIds) delete slots[id]
  if (wanted > 0) {
    const roots = normalizePhases(m.phases).links.filter(
      (l) => l.parentId === null && l.heroExtra === 'ang'
    )
    for (const r of roots) slots[r.id] = { kind: 'ang', marks: 1 }
  }
  m[KR_ZAO_SLOTS] = slots
}

/**
 * Prüft, ob für das Token „Zusätzliche Angriffsaktion" in den Helden-
 * einstellungen aktiv ist, aktuell aber kein heroExtra-Wurzel-Link (ZAO)
 * mehr existiert – z. B. weil der Spieler das ZAO innerhalb der Runde per
 * X-Button geschlossen hat, ohne die Ladung zu stempeln. In diesem Zustand
 * soll die UI ein kleines rotes „+" am Mutter-Aktionsfeld anzeigen.
 *
 * @param {Record<string, unknown> | null | undefined} meta
 */
export function heroExtraZaoAvailableForRestore(meta) {
  if (!meta || typeof meta !== 'object') return false
  const wanted = readHeroExtraAngCount(meta)
  if (wanted <= 0) return false
  // Mutex-Schutz: Wenn das schwarze Schild dieser KR bereits gestempelt wurde,
  // ist die z.AT in dieser KR endgueltig vergeben — kein "+" mehr anbieten.
  if (meta.krExtraChoiceUsed === 'par') return false
  const phases = normalizePhases(meta.phases)
  const existing = phases.links.filter((l) => l.parentId === null && l.heroExtra === 'ang')
  return existing.length < wanted
}

/**
 * Erzeugt im Token-Meta `m` (Mutationsziel) eine frische heroExtra-'ang'-
 * Wurzel mit einer Ladung. Vorhandene heroExtra-Wurzeln + ihre Slots werden
 * vorher entfernt. No-op, wenn `heroExtraAng` nicht aktiv ist.
 *
 * Wiederverwendet von `patchRestoreHeroExtraZao` (manuelles "+") und vom
 * `undoKrActionStamp`-Pfad fuer das schwarze Schild (Mutex-Wiederherstellung).
 *
 * @param {Record<string, unknown>} m Token-Tracker-Meta (Mutationsziel)
 */
function restoreHeroExtraAttackInPlace(m) {
  if (!m || typeof m !== 'object') return
  migrateHeroExtraCountFields(m)
  const wanted = readHeroExtraAngCount(m)
  if (wanted <= 0) return
  const phases = normalizePhases(m.phases)
  const existingAngRoots = phases.links.filter(
    (l) => l.parentId === null && l.heroExtra === 'ang'
  )
  if (existingAngRoots.length >= wanted) return
  const off = Math.max(1, phaseOffsetFromHeroExtraAngMeta(m))
  const nextIndex = existingAngRoots.length + 1
  const links = [...phases.links]
  const newId = crypto.randomUUID()
  links.push({
    id: newId,
    parentId: null,
    offset: off * nextIndex,
    heroExtra: 'ang',
    expiresNextRound: false,
  })
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...phases,
    links,
    rowPanelOpen: true,
  })
  const slots = readZaoSlots(m)
  slots[newId] = { kind: 'ang', marks: 1 }
  m[KR_ZAO_SLOTS] = slots
}

/**
 * Stellt das zusätzliche Angriffsaktions-Objekt (ZAO) wieder her, falls es
 * innerhalb der Runde über den X-Button geschlossen wurde. Hat genau den
 * gleichen Effekt wie ein erneutes Öffnen + „Speichern und Beenden" in den
 * Helden-Einstellungen: ein frischer `heroExtra:'ang'`-Wurzel-Link bei
 * +4 INI mit einer Ladung.
 *
 * Erfordert, dass in den Token-Einstellungen `heroExtraAng === true` gesetzt
 * ist; andernfalls ist die Aktion ein No-op (die UI sollte das „+" in diesem
 * Fall ohnehin nicht anzeigen).
 *
 * @param {string} itemId
 */
export async function patchRestoreHeroExtraZao(itemId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta || readHeroExtraAngCount(meta) <= 0) return
  // Mutex-Schutz: Wenn der Held in dieser KR bereits das schwarze Schild
  // gestempelt hat, darf die z.AT-Wurzel NICHT wiederkehren.
  if (meta.krExtraChoiceUsed === 'par') return
  if (!heroExtraZaoAvailableForRestore(meta)) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      restoreHeroExtraAttackInPlace(m)
    }
  })
}

export const DEFAULT_TRACKER_KR_COUNTERS = Object.freeze({
  [KR_ANG]: 0,
  [KR_ABW]: 0,
  [KR_SRA]: 0,
  [KR_FREE_ACTION]: 0,
  [KR_LH_ACTION]: 0,
  [KR_LH_SECOND]: 0,
  [KR_PRIMARY_LADUNG]: 0,
  [KR_PAIR_MODE]: 'ang_abw',
  [KR_FIRST_SLOT_KIND]: 'ang',
  [KR_MOTHER_PRIMARY_USED_THIS_ROUND]: 0,
})

/**
 * `krFreeAction` zählt verbrauchte freie Aktionen (0 = volles Kontingent).
 * Explizit setzen, damit nach KR-/Kampf-Reset kein Altlast-Wert stehen bleibt.
 *
 * @param {Record<string, unknown>} m Token-Tracker-Meta (Mutationsziel)
 */
export function ensureFullFreeActionQuota(m) {
  if (!m || typeof m !== 'object') return
  m[KR_FREE_ACTION] = 0
}

/**
 * @param {unknown} meta
 * @returns {boolean} true, wenn die gespeicherte INI eine endliche Zahl < 0 ist.
 */
export function isHeroIniBelowZero(meta) {
  if (!meta || typeof meta !== 'object') return false
  const raw = String(meta.initiative ?? '').trim().replace(',', '.')
  if (raw === '') return false
  const n = Number(raw)
  return Number.isFinite(n) && n < 0
}

/**
 * INI-Sperre (V362): Solange die INI < 0 ist, darf die Summe der Ladungen auf
 * Primärseite A (`KR_PRIMARY_LADUNG` bzw. das aktive Primärfeld) und Schild B
 * (`KR_ABW`) höchstens 1 betragen. Marks werden bevorzugt auf Seite A
 * abgebaut; nur wenn A leer ist und B mehr als eine Ladung hat, wird eine
 * Mark aus B entfernt. Abgebaute Marks werden in `KR_INI_LOCK_MINUS_A` /
 * `KR_INI_LOCK_MINUS_B` bilanziert.
 *
 * Wird die INI wieder ≥ 0, stellt die Funktion die gemerkten Marks wieder
 * her und räumt die Bilanzfelder auf. Die Funktion ist idempotent und wird
 * bei jeder INI-Änderung sowie zu Rundenwechsel aufgerufen.
 *
 * Mutiert `m` direkt. Tut nichts, wenn INI leer oder ungültig ist, damit
 * Tokens ohne Initiative (z. B. NSCs ohne INI) nicht angefasst werden.
 */
export function applyIniLockCharges(m) {
  if (!m || typeof m !== 'object') return
  const iniRaw = String(m.initiative ?? '').trim().replace(',', '.')
  if (iniRaw === '') return
  const iniNum = Number(iniRaw)
  if (!Number.isFinite(iniNum)) return

  const minusA = Math.max(0, Math.floor(Number(m[KR_INI_LOCK_MINUS_A]) || 0))
  const minusB = Math.max(0, Math.floor(Number(m[KR_INI_LOCK_MINUS_B]) || 0))

  if (iniNum >= 0) {
    // INI erholt sich: abgezogene Ladungen zurückgeben.
    if (minusA > 0) {
      const pf = primaryFieldForKind(m)
      const curMarks = marksFromChargeValue(normalizeKrDigit(m[pf]))
      const nextMarks = Math.min(KR_COUNTER_MAX, curMarks + minusA)
      m[pf] = chargeValueFromMarks(nextMarks)
      // L.H.-Rückgabe hebt eine vom Transfer stammende Leerung auf.
      if (pf === KR_LH_ACTION && nextMarks > 0) {
        delete m[KR_LH_VOID_BY_TRANSFER]
      }
      if ((pf === KR_ANG || pf === KR_SRA) && nextMarks > 0) {
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
      }
      syncKrPrimaryLadungFromPrimaryField(m)
    }
    if (minusB > 0) {
      const curB = marksFromChargeValue(normalizeKrDigit(m[KR_ABW]))
      m[KR_ABW] = chargeValueFromMarks(Math.min(KR_COUNTER_MAX, curB + minusB))
    }
    if (Object.prototype.hasOwnProperty.call(m, KR_INI_LOCK_MINUS_A)) {
      delete m[KR_INI_LOCK_MINUS_A]
    }
    if (Object.prototype.hasOwnProperty.call(m, KR_INI_LOCK_MINUS_B)) {
      delete m[KR_INI_LOCK_MINUS_B]
    }
    return
  }

  // INI < 0: Schwert als Mutter-Aktion abhaengig von heroIniNegAngMode.
  // 'no' und 'zatOnly': Mutter auf SRA migrieren (Schwert weg).
  // 'yes': Schwert bleibt im Zyklus - keine Migration.
  const angMode = readHeroIniNegAngMode(m)
  if (angMode !== 'yes' && readKrFirstSlotKind(m) === 'ang') {
    const angMarks = marksFromChargeValue(normalizeKrDigit(m[KR_ANG]))
    const sraMarks = marksFromChargeValue(normalizeKrDigit(m[KR_SRA]))
    const mergedMarks = Math.min(KR_COUNTER_MAX, angMarks + sraMarks)
    m[KR_FIRST_SLOT_KIND] = 'sra'
    const curPair = m[KR_PAIR_MODE]
    if (
      curPair !== 'sra_sra' &&
      curPair !== 'sra_ang' &&
      curPair !== 'sra_abw'
    ) {
      m[KR_PAIR_MODE] = 'sra_ang'
    }
    m[KR_ANG] = 1
    m[KR_SRA] = chargeValueFromMarks(mergedMarks)
    delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
    syncKrPrimaryLadungFromPrimaryField(m)
  }

  // Gesamtladung auf <= actionsLost reduzieren (A bevorzugt).
  const actionsLost = readHeroIniNegActionsLost(m)
  const pf = primaryFieldForKind(m)
  const aMarks = marksFromChargeValue(normalizeKrDigit(m[pf]))
  const bMarks = marksFromChargeValue(normalizeKrDigit(m[KR_ABW]))
  const total = aMarks + bMarks
  let excess = total - actionsLost
  if (excess <= 0) return

  const removeA = Math.min(excess, aMarks)
  excess -= removeA
  const removeB = Math.min(excess, bMarks)

  if (removeA > 0) {
    m[pf] = chargeValueFromMarks(aMarks - removeA)
    syncKrPrimaryLadungFromPrimaryField(m)
    m[KR_INI_LOCK_MINUS_A] = minusA + removeA
  }
  if (removeB > 0) {
    m[KR_ABW] = chargeValueFromMarks(bMarks - removeB)
    m[KR_INI_LOCK_MINUS_B] = minusB + removeB
  }
}

/** @typedef {'ang_abw' | 'ang_ang' | 'abw_abw' | 'sra_sra' | 'sra_ang' | 'sra_abw'} KrPairMode */
const KR_PAIR_MODE_ORDER = /** @type {const} */ ([
  'ang_abw',
  'ang_ang',
  'abw_abw',
  'sra_sra',
  'sra_ang',
  'sra_abw',
])
const KR_PAIR_MODE_VALID = new Set(KR_PAIR_MODE_ORDER)

/**
 * @param {unknown} meta
 * @returns {KrPairMode}
 */
export function readKrPairMode(meta) {
  const v = meta?.[KR_PAIR_MODE]
  return typeof v === 'string' && KR_PAIR_MODE_VALID.has(v) ? v : 'ang_abw'
}

/** @param {KrPairMode} cur */
export function nextKrPairMode(cur) {
  const i = KR_PAIR_MODE_ORDER.indexOf(cur)
  const idx = i < 0 ? 0 : (i + 1) % KR_PAIR_MODE_ORDER.length
  return KR_PAIR_MODE_ORDER[idx]
}

/**
 * @param {KrPairMode} mode
 * @param {0 | 1} slot
 */
export function krPairModeFieldForSlot(mode, slot) {
  if (slot === 0) {
    if (mode === 'ang_abw' || mode === 'ang_ang') return KR_ANG
    if (mode === 'abw_abw') return KR_ABW
    if (mode === 'sra_ang' || mode === 'sra_abw' || mode === 'sra_sra') return KR_SRA
    return KR_SRA
  }
  if (mode === 'ang_abw') return KR_ABW
  if (mode === 'ang_ang') return KR_ANG
  if (mode === 'abw_abw') return KR_ABW
  if (mode === 'sra_ang') return KR_ANG
  if (mode === 'sra_abw') return KR_ABW
  return KR_SRA
}

/**
 * @param {string} field
 * @returns {'ang' | 'abw' | 'sra' | 'lh'}
 */
export function krFieldToCounterKind(field) {
  if (field === KR_ABW) return 'abw'
  if (field === KR_SRA) return 'sra'
  if (field === KR_LH_ACTION) return 'lh'
  return 'ang'
}

/**
 * @param {string} itemId
 * @param {KrPairMode} mode
 */
export async function patchKrPairMode(itemId, mode) {
  if (!KR_PAIR_MODE_VALID.has(mode)) return
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (m) {
        m[KR_PAIR_MODE] = mode
        m[KR_FIRST_SLOT_KIND] =
          krPairModeFieldForSlot(mode, 0) === KR_SRA ? 'sra' : 'ang'
      }
    }
  })
}

/**
 * @param {unknown} meta
 * @returns {'ang' | 'sra' | 'lh'}
 */
export function readKrFirstSlotKind(meta) {
  const v = meta?.[KR_FIRST_SLOT_KIND]
  if (v === 'sra' || v === 'ang' || v === 'lh') return v
  const mode = readKrPairMode(meta)
  return krPairModeFieldForSlot(mode, 0) === KR_SRA ? 'sra' : 'ang'
}

/**
 * Mutter-Aktion tauschen (Ang ↔ SRA ↔ L.H.).
 *
 * Ladungs-Erhaltungsgesetz pro Token (Mutter-Ebene, **nur Zähler/Marks**):
 * Die sichtbare Primärladung (Marks auf dem neu gewählten Primärfeld) entspricht
 * der bisherigen Ladung auf dem alten Primärfeld — ohne doppelte Markierung.
 *
 * Umsetzung:
 * 1. Altes Primärfeld wird auf „leer" (1) zurückgesetzt — sonst bliebe dort
 *    eine unsichtbare Mark übrig und würde sich beim nächsten Tausch wieder
 *    „aufaddieren".
 * 2. Neues Primärfeld übernimmt die **selbe Anzahl Marks** (`newCounter =
 *    chargeValueFromMarks(oldMarks)`).
 * 3. **Mutter-Stempel** (Raum-Metadaten) werden **nicht** umgeschrieben: `field`
 *    bleibt die Aktion zum Zeitpunkt des Stempelns; ×/Undo bucht weiter über
 *    dieses Feld zurück.
 * 4. L.H.-Begleitfelder (`KR_LH_SECOND`, `KR_LH_VOID_BY_TRANSFER`) werden
 *    bereinigt bzw. initialisiert.
 *
 * ZAO-Slots (`KR_ZAO_SLOTS`) bleiben unverändert — jeder 2.A.O.-Slot hat
 * seine eigene `kind` und wird separat über den Slot-Tauscher umgeschaltet.
 *
 * @param {string} itemId
 * @param {'ang' | 'sra' | 'lh'} kind
 */
export async function patchKrFirstSlotKind(itemId, kind) {
  if (kind !== 'ang' && kind !== 'sra' && kind !== 'lh') return
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  const prevKind = readKrFirstSlotKind(meta || {})
  if (prevKind === kind) return

  const oldPF = primaryFieldForKind(meta || {})
  const newPF =
    kind === 'sra' ? KR_SRA : kind === 'lh' ? KR_LH_ACTION : KR_ANG

  // Anzahl Marks auf der alten Primärseite ermitteln. L.H. hat Sonderlogik:
  // LH_ACTION=0 heißt geladen, aber nur wenn NICHT gerade per Transfer ins
  // Abwehr-Schild geleert (dann ist die Ladung woanders sichtbar, nicht in
  // der Primärbilanz).
  let oldMarks
  if (prevKind === 'lh') {
    const lhVal = normalizeKrDigit(meta?.[KR_LH_ACTION])
    const loaded = lhVal === 0 && !meta?.[KR_LH_VOID_BY_TRANSFER]
    oldMarks = loaded ? 1 : 0
  } else {
    oldMarks = marksFromChargeValue(normalizeKrDigit(meta?.[oldPF]))
  }
  const newCounter = chargeValueFromMarks(oldMarks)
  const pair = kind === 'sra' ? 'sra_ang' : 'ang_abw'

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_FIRST_SLOT_KIND] = kind
      m[KR_PAIR_MODE] = pair
      if (oldPF !== newPF) {
        if (oldPF === KR_LH_ACTION) {
          m[KR_LH_ACTION] = 1
          delete m[KR_LH_SECOND]
          delete m[KR_LH_VOID_BY_TRANSFER]
        } else {
          m[oldPF] = 1
        }
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
      }
      if (kind === 'lh') {
        m[KR_LH_ACTION] = newCounter
        m[KR_LH_SECOND] = 0
        delete m[KR_LH_VOID_BY_TRANSFER]
      } else {
        m[newPF] = newCounter
      }
      m[KR_PRIMARY_LADUNG] = newCounter
    }
  })
}

/**
 * Primärladung → Abwehr-Schild.
 * Ladungs-Erhaltungsgesetz: 1 Ladung pro Objekt. Verschiebt zuerst die Ladung
 * aus dem letzten geladenen 2.A.-Slot (und entfernt diesen) — sonst aus dem
 * Mutter-Primärfeld. Gilt für Ang., S.R.A. und L.H.
 */
export async function patchKrTransferPrimaryToAbw(itemId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  const abw = normalizeKrDigit(meta[KR_ABW])

  // 1) Letzter 2.A.-Slot mit Ladung (marks=1) → entladen & entfernen.
  const phases = normalizePhases(meta.phases)
  const roots = sortedLinksForLayout(phases.links).filter(
    (l) => l.parentId === null && !l.heroExtra
  )
  const slots = readZaoSlots(meta)
  let sourceZaoId = null
  for (let i = roots.length - 1; i >= 0; i--) {
    const slot = slots[roots[i].id]
    if (slot && slot.marks === 1) {
      sourceZaoId = roots[i].id
      break
    }
  }
  if (sourceZaoId) {
    const nextAbw = addOneAbwTransferChargeValue(abw)
    if (nextAbw === abw) return
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        m[KR_ABW] = nextAbw
        const s = readZaoSlots(m)
        delete s[sourceZaoId]
        m[KR_ZAO_SLOTS] = s
        const p = normalizePhases(m.phases)
        const keep = new Set(p.links.map((l) => l.id))
        keep.delete(sourceZaoId)
        for (const l of p.links) {
          if (l.parentId != null && !keep.has(l.parentId)) keep.delete(l.id)
        }
        m.phases = finalizePhasesWithOrderedRoots(m, {
          ...p,
          links: p.links.filter((l) => keep.has(l.id)),
        })
      }
    })
    return
  }

  {
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    if (motherPrimarySelfStamped(stamps.entries, itemId)) return
  }

  const firstKind = readKrFirstSlotKind(meta)
  const field = primaryFieldForKind(meta)

  const nextAbw = addOneAbwTransferChargeValue(abw)
  if (nextAbw === abw) return

  if (firstKind === 'lh') {
    // Edge-Case 3 (Plan): bei aktiver L.H. (auch in der End-KR mit
    // aufgehobenem Lock) den L.H.-Stempel-Slot NICHT ueber Transfer in
    // die Schildspalte verschieben — der LH-Slot wird ausschliesslich
    // ueber `stampLhCompletion` bedient. Sonst entstuenden Pseudo-
    // Schildladungen, die das `KR_LH_SECOND`-Modell umgehen.
    if (isLhActive(meta)) return
    const lh = normalizeKrDigit(meta[KR_LH_ACTION])
    if (lh !== 0) return
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        m[KR_ABW] = nextAbw
        m[KR_LH_ACTION] = 1
        m[KR_LH_SECOND] = 0
        m[KR_LH_VOID_BY_TRANSFER] = true
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        syncKrPrimaryLadungFromPrimaryField(m)
      }
    })
    return
  }
  const primary = normalizeKrDigit(meta[field])
  if (!krTransferMarkPresent(primary)) return
  const nextPrimary = consumeOneChargeValue(primary)
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[field] = nextPrimary
      m[KR_ABW] = nextAbw
      m[KR_PRIMARY_VOID_BY_ABW_TRANSFER] = true
      syncKrPrimaryLadungFromPrimaryField(m)
    }
  })
}

/**
 * Regulärer ZAO-Wurzel-Link ohne heroExtra/lhEnd (spiegelte Umwandlungs-Spalte).
 * @param {{ parentId?: string | null, heroExtra?: unknown, lhEnd?: boolean } | undefined} link
 * @returns {boolean}
 */
function zaoRootEligibleForLodgedScopedTransfer(link) {
  return Boolean(
    link &&
      link.parentId === null &&
      !link.heroExtra &&
      link.lhEnd !== true
  )
}

/**
 * Umwandeln wie an der Zeile selbst („Aktion→Schild“): nur diese ZAO erhält
 * `lodgedAbw`; Phasen-Link bleibt (keine Lösch-Logik wie `patchKrTransferPrimaryToAbw`).
 *
 * @param {string} itemId
 * @param {string} linkId
 */
export async function patchKrTransferZaoPrimaryToAbw(itemId, linkId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  const phases = normalizePhases(meta.phases)
  const linkRef = phases.links.find((l) => l.id === linkId)
  if (!zaoRootEligibleForLodgedScopedTransfer(linkRef)) return

  const slot = readZaoSlots(meta)[linkId]
  if (!slot || slot.marks !== 1 || slot.lodgedAbw) return
  if (slot.kind === 'lh') return

  const abw = normalizeKrDigit(meta[KR_ABW])
  const nextAbw = addOneAbwTransferChargeValue(abw)
  if (nextAbw === abw) return

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_ABW] = nextAbw
      const s = readZaoSlots(m)
      const cur = s[linkId]
      if (!cur || cur.marks !== 1) continue
      s[linkId] = {
        kind: cur.kind,
        marks: 0,
        lodgedAbw: true,
      }
      m[KR_ZAO_SLOTS] = s
    }
  })
}

/**
 * Gegenstück zu `patchKrTransferZaoPrimaryToAbw`: Ladung zurück auf Primär dieser ZAO-Zeile.
 *
 * @param {string} itemId
 * @param {string} linkId
 */
export async function patchKrTransferAbwToZaoPrimary(itemId, linkId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return

  const phases = normalizePhases(meta.phases)
  const linkRef = phases.links.find((l) => l.id === linkId)
  if (!zaoRootEligibleForLodgedScopedTransfer(linkRef)) return

  const slot = readZaoSlots(meta)[linkId]
  if (!slot?.lodgedAbw || slot.marks !== 0) return

  const abw = normalizeKrDigit(meta[KR_ABW])
  if (!krTransferMarkPresent(abw)) return
  const nextAbw = consumeOneChargeValue(abw)
  if (nextAbw === abw) return

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_ABW] = nextAbw
      const s = readZaoSlots(m)
      const cur = s[linkId]
      if (!cur?.lodgedAbw || cur.marks !== 0) continue
      s[linkId] = { kind: cur.kind, marks: 1 }
      m[KR_ZAO_SLOTS] = s
    }
  })
}

/**
 * Abwehr-Schild → Primärladung.
 * Ladungs-Erhaltungsgesetz: 1 Ladung pro Objekt. Wenn das Mutter-Primärfeld
 * schon eine Ladung hat, wird ein neuer 2.A.-Slot (Mutter-Kind, marks=1)
 * erzeugt. Gilt für Ang., S.R.A. und L.H.
 */
export async function patchKrTransferAbwToPrimary(itemId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  const roundForLh = lhLockRoundFromCombat()
  if (
    !isConvertAnytimeEnabled(meta) &&
    lhEndKrConvertMode(meta, roundForLh) &&
    metaHasPendingLoadedNonHeroExtraZao(meta)
  ) {
    return
  }
  if (!isConvertAnytimeEnabled(meta)) {
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    if (motherPrimarySelfStamped(stamps.entries, itemId)) return
  }
  const firstKind = readKrFirstSlotKind(meta)
  // Edge-Case 3: Schild → L.H.-Stempel-Slot nur solange die „mittendrin“-
  // Sperre gilt; in der End-KR (`lhEndKrConvertMode`) ist Umwandeln erlaubt.
  if (
    firstKind === 'lh' &&
    isLhActive(meta) &&
    !lhEndKrConvertMode(meta, roundForLh)
  ) {
    return
  }
  /* INI < 0: kein Schwert — wie bei den Tauschpfeilen wird Angriff wie S.R.A. behandelt. */
  const transferKind =
    firstKind === 'ang' && isHeroIniBelowZero(meta) ? 'sra' : firstKind
  const field = primaryFieldForKind(meta)
  const abw = normalizeKrDigit(meta[KR_ABW])

  const motherHasCharge =
    firstKind === 'lh'
      ? normalizeKrDigit(meta[KR_LH_ACTION]) === 0 &&
        !meta[KR_LH_VOID_BY_TRANSFER]
      : krTransferMarkPresent(normalizeKrDigit(meta[field]))
  const iniStr = meta?.initiative
  const phaseOffset = phaseOffsetFromHeroSecondAoMeta(meta)

  if (!krTransferMarkPresent(abw)) return
  const nextAbw = consumeOneChargeValue(abw)
  if (nextAbw === abw) return

  if (!motherHasCharge) {
    if (
      !isConvertAnytimeEnabled(meta) &&
      metaHasPendingLoadedNonHeroExtraZao(meta)
    ) {
      return
    }
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        m[KR_ABW] = nextAbw
        if (transferKind === 'lh') {
          m[KR_LH_ACTION] = 0
          m[KR_LH_SECOND] = 0
          delete m[KR_LH_VOID_BY_TRANSFER]
          delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        } else if (transferKind === 'sra') {
          if (firstKind === 'ang') {
            m[KR_FIRST_SLOT_KIND] = 'sra'
            m[KR_PAIR_MODE] = 'sra_ang'
            m[KR_ANG] = 1
          }
          m[KR_SRA] = 0
        } else {
          m[KR_ANG] = 0
        }
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        syncKrPrimaryLadungFromPrimaryField(m)
      }
    })
    return
  }

  const pSnap = normalizePhases(meta.phases)
  const nextSpec =
    typeof iniStr === 'string'
      ? nextChainedZaoParentForTransfer(iniStr, pSnap, phaseOffset)
      : null
  if (!nextSpec) {
    return
  }
  const newLinkId = crypto.randomUUID()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_ABW] = nextAbw
      const p = normalizePhases(m.phases)
      const nextLinks = [
        ...p.links,
        {
          id: newLinkId,
          parentId: nextSpec.parentId,
          offset: nextSpec.offset,
        },
      ]
      m.phases = finalizePhasesWithOrderedRoots(m, {
        ...p,
        rowPanelOpen: true,
        links: nextLinks,
      })
      const s = readZaoSlots(m)
      // Standard für neu erzeugtes 2.A.-Objekt aus Schild-Umwandlung: Schwert.
      s[newLinkId] = { kind: 'ang', marks: 1 }
      m[KR_ZAO_SLOTS] = s
    }
  })
}

export async function patchKrTransferAngToAbw(itemId) {
  await patchKrTransferPrimaryToAbw(itemId)
}

export async function patchKrTransferAbwToAng(itemId) {
  await patchKrTransferAbwToPrimary(itemId)
}

/** Legacy-Alias: L.H. verhält sich jetzt wie Ang/SRA. */
export async function patchKrTransferAbwToLhSecond(itemId) {
  await patchKrTransferAbwToPrimary(itemId)
}

/** Legacy-Alias: L.H. verhält sich jetzt wie Ang/SRA. */
export async function patchKrLhChargeBackToAbw(itemId) {
  await patchKrTransferPrimaryToAbw(itemId)
}

/**
 * Genau diesen 2.A.-Slot ins Abwehr-Schild zurückführen (Close-X).
 * Entfernt Slot-Zustand + den Phasen-Link (inkl. Kind-Links).
 *
 * Ladungs-Bilanz — „Stempel-zuerst-Trick":
 * Ein Close mit aktivem Stempel (`slot.marks === 0`) wird intern als zwei
 * atomare Schritte behandelt, die auch in dieser Reihenfolge von Hand zum
 * identischen Ergebnis führen:
 *   1. Stempel entfernen → Slot wieder `marks = 1` (Aktion zurückgegeben).
 *   2. Slot/Link schließen → Ladung wandert ins Abwehr-Schild (oder ist bei
 *      `heroExtra` fest im ZAO und verloren, wie ohne Stempel).
 *
 * Damit hat die Reihenfolge „erst × dann X" und „einfach X" das exakt
 * gleiche Ergebnis; es entstehen keine verwaisten Stempel, die später × noch
 * Ladungen erstatten müssten, und die Gesamtzahl verfügbarer Aktionen bleibt
 * wie beim manuellen Vorgehen.
 *
 * Cases im Detail:
 * - `slot.marks === 1` (kein Stempel), kein `heroExtra`: Ladung → Abw (+1),
 *   Slot + Link weg.
 * - `slot.marks === 1`, `heroExtra` (ZAO): Ladung fest im Objekt, Slot + Link
 *   weg, Abw unverändert.
 * - `slot.marks === 0` (Stempel aktiv), kein `heroExtra`: Stempel(n) für
 *   diesen `zaoLinkId` entfernen, Ladung → Abw (+1), Slot + Link weg.
 * - `slot.marks === 0`, `heroExtra`: Stempel(n) entfernen, Slot + Link weg,
 *   Abw unverändert.
 * - Ladung bereits im gemeinsamen Schild pendelnd (`lodgedAbw`): kein weiteres
 *   Abw+; Zeile wird entfernt, Schildzahl unverändert.
 *
 * @param {string} itemId
 * @param {string} linkId
 */
export async function patchKrCloseZaoSlotToAbw(itemId, linkId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  const roomMetaEarly = await OBR.room.getMetadata()
  const stampsEarly = normalizeActionStamps(roomMetaEarly[ACTION_STAMPS_KEY])
  const hasZaoStampEarly = stampsEarly.entries.some(
    (e) => e.itemId === itemId && e.zaoLinkId === linkId
  )

  const phasesMeta = normalizePhases(meta.phases)
  const linkRef = phasesMeta.links.find((l) => l.id === linkId)
  const isHeroExtraZao = Boolean(
    linkRef && linkRef.parentId === null && linkRef.heroExtra
  )
  const slot = readZaoSlots(meta)[linkId]
  const lodgedInAbw = Boolean(slot?.lodgedAbw)
  // Nur echte Stempel rechtfertigen marks=0 → Abw-Buchung; `lodgedAbw` bereits
  // in KR_ABW verbucht.
  const hadStampedCharge = Boolean(slot) && slot.marks === 0 && hasZaoStampEarly
  const needsAbwOnCloseNonExtra =
    !isHeroExtraZao &&
    Boolean(slot) &&
    !lodgedInAbw &&
    (slot.marks === 1 || hadStampedCharge)

  const abw = normalizeKrDigit(meta[KR_ABW])
  let nextAbw = abw
  if (needsAbwOnCloseNonExtra) {
    nextAbw = addOneAbwTransferChargeValue(abw)
    // Nur blockieren, wenn keine Stempel-Rückerstattung nötig (Schild evtl. voll).
    if (nextAbw === abw && !hadStampedCharge) return
  }

  // Mutex z.AT vs schwarzes Schild: war der geschlossene Slot ein gestempelter
  // heroExtra-'ang'-Slot, geben wir die Mutex-Wahl wieder frei und stellen das
  // schwarze Schild bei aktivem `heroExtraPar` geladen wieder her — analog zum
  // Undo-Pfad. Ohne Stempel (X auf geladenes z.AT) bleibt die Wahl unberuehrt.
  const releaseMutexAng =
    isHeroExtraZao && hadStampedCharge && linkRef?.heroExtra === 'ang'
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      if (nextAbw !== abw) m[KR_ABW] = nextAbw
      const s = readZaoSlots(m)
      if (s[linkId] !== undefined) {
        delete s[linkId]
        m[KR_ZAO_SLOTS] = s
      }
      const p = normalizePhases(m.phases)
      const keep = new Set(p.links.map((l) => l.id))
      keep.delete(linkId)
      for (const l of p.links) {
        if (l.parentId != null && !keep.has(l.parentId)) keep.delete(l.id)
      }
      m.phases = finalizePhasesWithOrderedRoots(m, {
        ...p,
        links: p.links.filter((l) => keep.has(l.id)),
      })
      if (releaseMutexAng) {
        delete m.krExtraChoiceUsed
        if (readHeroExtraParCount(m) > 0) m[KR_PARADE_EXTRA] = 0
      }
    }
  })
  // Alle Stempel, die per `zaoLinkId` an diesem Slot hingen, jetzt entfernen.
  // Das entspricht dem konzeptuellen Schritt 1 („erst die Marker, dann die
  // Objekte") — die Ladung wurde oben schon ins Schild gebucht bzw. bei
  // `heroExtra` (ZAO) korrekt als Verlust verbucht. Ohne Stempel gibt es
  // später kein × mehr, das weitere Ladungen „erfinden" könnte.
  await patchActionStamps(
    (stamps) => {
      const entries = stamps.entries.filter(
        (e) => !(e.itemId === itemId && e.zaoLinkId === linkId)
      )
      const anchorId = entries.length > 0 ? stamps.anchorId : null
      return { anchorId, entries }
    },
    { skipGmCheck: true }
  )
}

/**
 * Klick auf das Primärfeld eines 2.A.-Slots: Ladung verbrauchen + Stempel
 * an dieser Zeile (mit `zaoLinkId`) anlegen. Slot bleibt sichtbar (marks=0),
 * damit der Pfeil zum Schild weiterhin verfügbar ist und der Stempel per X
 * die Ladung wieder zurückführt.
 *
 * @param {string} itemId
 * @param {string} linkId
 */
export async function patchZaoSlotStampPrimary(itemId, linkId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  const slot = readZaoSlots(meta)[linkId]
  if (!slot || slot.marks !== 1) return
  const field =
    slot.kind === 'sra'
      ? KR_SRA
      : slot.kind === 'lh'
        ? KR_LH_ACTION
        : KR_ANG
  // L.H. laeuft (und endet NICHT in dieser KR): ZAO-Slots duerfen fuer
  // Ang/SRA nicht gestempelt werden. In der End-KR ist Ang/SRA wieder frei.
  // Der L.H.-Slot selbst wird ueber `stampLhCompletion` (separater Pfad)
  // bedient — hier wird er sicherheitshalber blockiert, damit der ZAO-
  // Stempelpfad nicht versehentlich einen LH-Stempel setzt.
  if (
    field === KR_LH_ACTION ||
    (isLhLockingActions(meta, lhLockRoundFromCombat()) && field !== KR_LH_ACTION)
  ) {
    return
  }
  // Symmetrischer Slot-Konflikt (Phase D): liegt am gleichen Anker (n.A.-
  // Slot via `linkId`) bereits ein L.H.-Abschluss-Stempel, blockt das den
  // Ang/SRA-Stempel — pro Aktionsslot nur EIN Primaer-Stempel.
  {
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    const conflict = stamps.entries.some(
      (e) =>
        e.itemId === itemId &&
        (e.anchorRowId || itemId) === itemId &&
        (e.anchorPhaseLinkId || null) === linkId &&
        !e.paradeExtra &&
        e.field === KR_LH_ACTION
    )
    if (conflict) return
  }
  const ownerName =
    getTokenListDisplayName(item) || String(item?.name ?? '')
  // Mutex z.AT vs schwarzes Schild: Wenn der gestempelte ZAO-Slot zu einer
  // heroExtra-'ang'-Wurzel gehoert, beansprucht der Held mit diesem Stempel
  // die "Zusatzaktion oder Zusatzparade"-Wahl auf 'ang'. Das schwarze Schild
  // wird in dieser KR vollstaendig entfernt; die Wahl wird in
  // `m.krExtraChoiceUsed` festgehalten, damit `ensureParadeExtraShield` die
  // Schild-Ladung nicht stillschweigend wieder herstellt.
  const isHeroExtraAngStamp = (() => {
    const phases = normalizePhases(meta.phases)
    const link = phases.links.find((l) => l.id === linkId)
    return Boolean(link && link.parentId === null && link.heroExtra === 'ang')
  })()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      const s = readZaoSlots(m)
      if (s[linkId]) {
        s[linkId] = { ...s[linkId], marks: 0 }
        m[KR_ZAO_SLOTS] = s
      }
      if (isHeroExtraAngStamp) {
        m.krExtraChoiceUsed = 'ang'
        for (let i = 0; i < HERO_EXTRA_MAX; i++) {
          delete m[paradeExtraFieldForIndex(i)]
        }
      }
    }
  })
  const skipGmStampZao = canEditSceneItem(item) && !isGmSync()
  await patchActionStamps((stamps) => {
    const entries = [...stamps.entries]
    const stampEntry = {
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      ownerName,
      field,
      anchorRowId: itemId,
      anchorPhaseLinkId: linkId,
      zaoLinkId: linkId,
    }
    if (isHeroExtraAngStamp) stampEntry.heroExtraStamp = true
    entries.push(stampEntry)
    const curId = getCombat().currentItemId
    const anchorId =
      stamps.anchorId ||
      (typeof curId === 'string' &&
      curId !== ROUND_START_STEP_ID &&
      curId !== ROUND_END_STEP_ID
        ? curId
        : itemId)
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStampZao })
}

/**
 * Letzten Stempel zu (itemId, zaoLinkId) entfernen und die Slot-Ladung
 * (marks=1) wiederherstellen.
 * @param {string} itemId
 * @param {string} linkId
 */
export async function undoLastZaoSlotStamp(itemId, linkId) {
  const roomMeta = await OBR.room.getMetadata()
  const cur = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
  for (let i = cur.entries.length - 1; i >= 0; i--) {
    const e = cur.entries[i]
    if (e.itemId === itemId && e.zaoLinkId === linkId) {
      await undoKrActionStamp(e.id)
      return
    }
  }
}

/** Max. Abwehr-Schildladungen per Umwandlung (Ang.→Abw bzw. L.H.→Abw). */
export function krAbwTransferMaxMarks() {
  return MAX_HERO_ACTION_POOL_SUM
}

/** Zählerstand 1 = leer; 0 und ≥2 = verschiebbare Markierung (Ang./Abw.-Umwandlung). */
export function krTransferMarkPresent(v) {
  return marksFromChargeValue(v) > 0
}

function consumeOneChargeValue(v) {
  const marks = marksFromChargeValue(v)
  if (marks <= 0) return normalizeKrDigit(v)
  return chargeValueFromMarks(marks - 1)
}

function addOneChargeValue(v) {
  const marks = marksFromChargeValue(v)
  return chargeValueFromMarks(marks + 1)
}

function addOneAbwTransferChargeValue(v) {
  const marks = marksFromChargeValue(v)
  if (marks >= krAbwTransferMaxMarks()) return normalizeKrDigit(v)
  return chargeValueFromMarks(marks + 1)
}

/** Noch Platz für eine per Umwandlung (Ang.→Abw) hinzugefügte Markierung? */
export function krAbwCanAcceptTransferMark(abwRaw) {
  const abw = normalizeKrDigit(abwRaw)
  return addOneAbwTransferChargeValue(abw) !== abw
}

/** Abw.→Primär: Primärzähler kann noch eine Markierung aufnehmen (inkl. von 1 auf 2). */
export function krPrimaryCanAcceptTransferMark(primaryRaw) {
  const primary = normalizeKrDigit(primaryRaw)
  return addOneChargeValue(primary) !== primary
}

export function krAngCanAcceptTransferMark(primaryRaw) {
  return krPrimaryCanAcceptTransferMark(primaryRaw)
}

/**
 * UI-/Speicher-Kodierung der Ladungen:
 * 1 => 0 Markierungen (leer), 0 => 1 Markierung (geladen), >=2 => Anzahl Markierungen.
 */
function marksFromChargeValue(v) {
  const n = normalizeKrDigit(v)
  if (n === 1) return 0
  if (n === 0) return 1
  return n
}

function chargeValueFromMarks(marksRaw) {
  const marks = Math.max(0, Math.min(KR_COUNTER_MAX, Math.floor(Number(marksRaw)) || 0))
  if (marks <= 0) return 1
  if (marks === 1) return 0
  return marks
}

function primaryFieldForKind(meta) {
  const kind = readKrFirstSlotKind(meta)
  if (kind === 'sra') return KR_SRA
  if (kind === 'lh') return KR_LH_ACTION
  return KR_ANG
}

/**
 * @param {unknown} meta
 */
export function readKrPrimaryLadung(meta) {
  if (!meta || typeof meta !== 'object') return 0
  if (Object.prototype.hasOwnProperty.call(meta, KR_PRIMARY_LADUNG)) {
    return normalizeKrDigit(meta[KR_PRIMARY_LADUNG])
  }
  const pf = primaryFieldForKind(meta)
  return normalizeKrDigit(meta[pf])
}

function syncKrPrimaryLadungFromPrimaryField(m) {
  if (!m) return
  const pf = primaryFieldForKind(m)
  m[KR_PRIMARY_LADUNG] = normalizeKrDigit(m[pf])
}

/** @deprecated Altes Feld; wird nur noch beim Lesen für Migration genutzt. */
const LEGACY_KR_ACTION = 'krAction'

/** Obergrenze Ang./Abw./S.R.A./F.A. (zyklisch 10→0 bzw. 0→10). */
export const KR_COUNTER_MAX = 10

/** Ziffer 0…max aus gespeichertem Wert (Standard max 10). */
export function normalizeKrDigit(raw, max = KR_COUNTER_MAX) {
  const cap = Math.max(0, Math.floor(Number(max)) || KR_COUNTER_MAX)
  let n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return 0
  if (n < 0) n = 0
  if (n > cap) n = cap
  return n
}

export function readKrFreeAction(meta, faMax) {
  const cap = Math.max(1, Math.min(HERO_EXTRA_MAX, Math.floor(Number(faMax)) || 2))
  return normalizeKrDigit(meta?.[KR_FREE_ACTION], cap)
}

export function readKrAng(meta) {
  if (meta && meta[KR_ANG] != null) return normalizeKrDigit(meta[KR_ANG])
  if (meta && meta[LEGACY_KR_ACTION] != null)
    return normalizeKrDigit(meta[LEGACY_KR_ACTION])
  return 0
}

export function readKrAbw(meta) {
  return normalizeKrDigit(meta?.[KR_ABW])
}

/**
 * @param {unknown} meta
 * @returns {undefined | 0 | 1} `0` = Parade-Schild geladen, `1` = verbraucht, `undefined` = kein Eintrag
 */
export function readKrParadeExtra(meta) {
  if (!meta || typeof meta !== 'object') return undefined
  if (meta[KR_PARADE_EXTRA] === undefined) return undefined
  return normalizeKrDigit(meta[KR_PARADE_EXTRA], 1)
}

/**
 * @param {unknown} meta
 * @returns {(undefined | 0 | 1)[]}
 */
export function readKrParadeExtraSlots(meta) {
  if (!meta || typeof meta !== 'object') return []
  const out = []
  const count = readHeroExtraParCount(meta)
  for (let i = 0; i < count; i++) {
    const key = paradeExtraFieldForIndex(i)
    if (meta[key] === undefined) out.push(undefined)
    else out.push(normalizeKrDigit(meta[key], 1))
  }
  return out
}

export function readKrSra(meta) {
  return normalizeKrDigit(meta?.[KR_SRA])
}

export function readKrLhAction(meta) {
  return normalizeKrDigit(meta?.[KR_LH_ACTION])
}

/**
 * Zweite L.H.-Ladung (nach Schild-Umwandlung). `undefined`/`null` = 1 (wie früher: ein Feld ohne Zweiteilung).
 * @param {unknown} meta
 * @returns {0 | 1}
 */
export function readKrLhSecondCharge(meta) {
  if (meta?.[KR_LH_SECOND] == null) return 1
  return normalizeKrDigit(meta[KR_LH_SECOND], 1) >= 1 ? 1 : 0
}

/**
 * Links +1 (10→0), Rechts −1 (0→10).
 * @param {{ stampAnchor?: { rowId: string, phaseLinkId: string | null }, skipLhSecondCheck?: boolean }} [options]
 */
export async function patchKrCounterByDelta(itemId, field, delta, options = {}) {
  const inc = delta > 0
  const paradeExtraSlotIdx = paradeExtraIndexForField(field)
  const isParadeExtraField = paradeExtraSlotIdx !== null
  if (field === KR_FREE_ACTION && !getCombat().started) return
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (meta) migrateHeroExtraCountFields(meta)
  // Laengerfristige Handlung laeuft und endet NICHT in dieser KR:
  // Ang/SRA/Schild/Parade gesperrt; FA und L.H.-Action selbst bleiben frei.
  // In der End-KR werden alle Felder freigegeben (Held kann weiterkaempfen).
  if (
    isLhLockingActions(meta, lhLockRoundFromCombat()) &&
    (field === KR_ANG ||
      field === KR_SRA ||
      field === KR_ABW ||
      isParadeExtraField)
  ) {
    return
  }
  let maxDigit = KR_COUNTER_MAX
  if (field === KR_FREE_ACTION) {
    const iniStr = meta?.initiative
    const settings = getRoomSettings()
    maxDigit = readHeroFaMax(meta, iniStr, settings)
  }
  if (isParadeExtraField) {
    maxDigit = 1
  }
  const mod = maxDigit + 1
  const cur = normalizeKrDigit(meta?.[field], maxDigit)
  if (field === KR_FREE_ACTION && !inc && cur === 0) {
    return
  }
  const next = inc ? (cur + 1) % mod : (cur + mod - 1) % mod
  const lhSecondBefore =
    field === KR_LH_ACTION && meta ? readKrLhSecondCharge(meta) : 1
  if (
    field === KR_LH_ACTION &&
    inc &&
    !options.skipLhSecondCheck &&
    lhSecondBefore === 0
  ) {
    return
  }
  const ownerName =
    getTokenListDisplayName(item) || String(item?.name ?? '')
  const pfBefore = primaryFieldForKind(meta)

  // Symmetrischer Slot-Konflikt (Phase D): wenn an diesem Anker bereits ein
  // L.H.-Abschluss-Stempel (KR_LH_ACTION) liegt, darf an gleicher Stelle
  // KEIN Ang/SRA-Stempel hinzukommen — pro Aktionsslot nur EIN Primaer-
  // Stempel. Symmetrisch zur Slot-Konfliktpruefung in `stampLhCompletion`.
  if (
    inc &&
    (field === KR_ANG || field === KR_SRA || field === KR_LH_ACTION)
  ) {
    const c = getCombat()
    const forcedAnchor = options?.stampAnchor
    let anchorRowIdForCheck = itemId
    let anchorPhaseLinkIdForCheck = null
    if (forcedAnchor && typeof forcedAnchor.rowId === 'string') {
      anchorRowIdForCheck = forcedAnchor.rowId
      anchorPhaseLinkIdForCheck =
        typeof forcedAnchor.phaseLinkId === 'string'
          ? forcedAnchor.phaseLinkId
          : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowIdForCheck = c.currentItemId
      anchorPhaseLinkIdForCheck =
        typeof c.currentPhaseLinkId === 'string'
          ? c.currentPhaseLinkId
          : null
    }
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    const conflict = stamps.entries.some((e) => {
      if (e.itemId !== itemId) return false
      if ((e.anchorRowId || itemId) !== anchorRowIdForCheck) return false
      if ((e.anchorPhaseLinkId || null) !== anchorPhaseLinkIdForCheck) {
        return false
      }
      if (e.paradeExtra) return false
      if (
        e.field !== KR_ANG &&
        e.field !== KR_SRA &&
        e.field !== KR_LH_ACTION
      ) {
        return false
      }
      // Slot-Konflikt: ein anderer Primaer-Stempel als der eigene Stempel-
      // Typ blockiert. (Weiter-Inkrement gleicher Field-Typ ist hier ok —
      // der Code unten erlaubt sowieso nur addCount > 0.)
      return e.field !== field
    })
    if (conflict) return
  }

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[field] = next
      if (field === KR_LH_ACTION && inc && cur === 0) {
        m[KR_LH_SECOND] = 0
        delete m[KR_LH_VOID_BY_TRANSFER]
      }
      if (field === KR_LH_ACTION && !inc && cur === 1 && next === 0) {
        if (m[KR_LH_VOID_BY_TRANSFER]) {
          delete m[KR_LH_VOID_BY_TRANSFER]
        } else {
          m[KR_LH_SECOND] = 1
        }
      }
      if (
        field === pfBefore &&
        (field === KR_ANG || field === KR_SRA) &&
        krTransferMarkPresent(next)
      ) {
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
      }
      if (field === pfBefore) {
        m[KR_PRIMARY_LADUNG] = next
      }
    }
  })

  let addCount = 0
  let removeCount = 0
  if (inc) {
    if (next === 0 && cur > 0) removeCount = cur
    else if (next > cur) addCount = next - cur
  } else {
    if (cur === 0 && next > 0) addCount = next
    else if (next < cur) removeCount = cur - next
  }
  if (addCount <= 0 && removeCount <= 0) return

  const skipGmStamp = canEditSceneItem(item) && !isGmSync()
  await patchActionStamps((stamps) => {
    const entries = [...stamps.entries]
    if (removeCount > 0) {
      let remaining = removeCount
      for (let i = entries.length - 1; i >= 0 && remaining > 0; i--) {
        const e = entries[i]
        if (e.itemId !== itemId || e.field !== field) continue
        if (field === KR_ABW && e.paradeExtra) continue
        if (isParadeExtraField && !e.paradeExtra) continue
        if (isParadeExtraField && e.paradeExtraSlot !== paradeExtraSlotIdx) continue
        // Mutter-Counter-Undo darf nur Mutter-Stempel entfernen;
        // ZAO-Stempel werden ausschließlich über × (undoKrActionStamp)
        // bzw. Slot-Schließen behandelt.
        if (e.zaoLinkId) continue
        entries.splice(i, 1)
        remaining--
      }
    }
    if (addCount > 0) {
      const c = getCombat()
      let anchorRowId = itemId
      let anchorPhaseLinkId = null
      const forced = options?.stampAnchor
      if (forced && typeof forced.rowId === 'string') {
        anchorRowId = forced.rowId
        anchorPhaseLinkId =
          typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
      } else if (
        c.started &&
        !c.roundIntroPending &&
        typeof c.currentItemId === 'string' &&
        c.currentItemId !== ROUND_START_STEP_ID &&
        c.currentItemId !== ROUND_END_STEP_ID
      ) {
        anchorRowId = c.currentItemId
        anchorPhaseLinkId =
          typeof c.currentPhaseLinkId === 'string'
            ? c.currentPhaseLinkId
            : null
      }
      for (let i = 0; i < addCount; i++) {
        const stampEntry = {
          id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          itemId,
          ownerName,
          field: isParadeExtraField ? KR_ABW : field,
          anchorRowId,
          anchorPhaseLinkId,
        }
        if (isParadeExtraField) {
          stampEntry.paradeExtra = true
          stampEntry.paradeExtraSlot = paradeExtraSlotIdx
        }
        entries.push(stampEntry)
      }
    }
    const curId = getCombat().currentItemId
    const anchorId =
      entries.length > 0
        ? stamps.anchorId ||
          (typeof curId === 'string' &&
          curId !== ROUND_START_STEP_ID &&
          curId !== ROUND_END_STEP_ID
            ? curId
            : itemId)
        : null
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStamp })

  if (
    inc &&
    addCount > 0 &&
    !isParadeExtraField &&
    (field === KR_ANG || field === KR_SRA || field === KR_ABW)
  ) {
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = /** @type {string | null} */ (null)
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string'
          ? c.currentPhaseLinkId
          : null
    }
    /* Gleiche Logik wie Abwehr-/Parade-Stempel: Zähler am Token itemId. */
    if (anchorPhaseLinkId === null && addCount > 0) {
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const prev = Math.max(
            0,
            Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
          )
          m[KR_MOTHER_PRIMARY_USED_THIS_ROUND] = prev + addCount
        }
      })
    }
  }

  if (
    (field === KR_ANG || field === KR_SRA) &&
    inc &&
    next >= 2 &&
    ((field === KR_ANG && readKrFirstSlotKind(meta) === 'ang') ||
      (field === KR_SRA && readKrFirstSlotKind(meta) === 'sra'))
  ) {
    const iniStr = meta?.initiative
    if (
      typeof iniStr === 'string' &&
      canCreateSecondActionRoot(iniStr, phaseOffsetFromHeroSecondAoMeta(meta))
    ) {
      await ensureExtraAttackPhaseRoot(itemId, iniStr)
    }
  }
}

/**
 * L.H.-Abschluss manuell stempeln (Klick auf vollen LH-Pie-Stern).
 *
 * Verhalten:
 *  - Anker = entweder Mutter-Slot (`anchorPhaseLinkId === null`) oder
 *    n.A.-Slot (`anchorPhaseLinkId === <lhEndLinkId>`).
 *  - Slot-Konflikt: existiert am gleichen Anker bereits ein Primaer-Stempel
 *    (KR_ANG / KR_SRA / KR_LH_ACTION ohne paradeExtra), wird der LH-Stempel
 *    NICHT gesetzt — pro Aktionsslot kann nur EINER aktiv sein.
 *  - Setzt einen `KR_LH_ACTION`-Stempel an diesem Anker.
 *  - Setzt die Tracker-Aktivitaet zurueck (`clearLhTrackerActivity`), sodass
 *    das LH-Wertfeld wieder frei und editierbar wird.
 *
 * @param {string} itemId
 * @param {string | null} anchorPhaseLinkId  null = Mutter-Slot, sonst LH-End n.A.-Link
 */
export async function stampLhCompletion(itemId, anchorPhaseLinkId = null) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const ownerName = getTokenListDisplayName(item) || String(item?.name ?? '')
  const skipGmStamp = canEditSceneItem(item) && !isGmSync()
  let stamped = false
  await patchActionStamps((stamps) => {
    const anchorRowId = itemId
    const anchorPid =
      typeof anchorPhaseLinkId === 'string' && anchorPhaseLinkId
        ? anchorPhaseLinkId
        : null
    // Slot-Konflikt: existiert hier bereits ein Primaer-Stempel?
    const conflict = stamps.entries.some(
      (e) =>
        e.itemId === itemId &&
        (e.anchorRowId || itemId) === anchorRowId &&
        ((e.anchorPhaseLinkId || null) === anchorPid) &&
        (e.field === KR_ANG ||
          e.field === KR_SRA ||
          e.field === KR_LH_ACTION) &&
        !e.paradeExtra
    )
    if (conflict) return stamps
    const entries = [...stamps.entries]
    entries.push({
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      ownerName,
      field: KR_LH_ACTION,
      anchorRowId,
      anchorPhaseLinkId: anchorPid,
    })
    const curId = getCombat().currentItemId
    const anchorId =
      stamps.anchorId ||
      (typeof curId === 'string' &&
      curId !== ROUND_START_STEP_ID &&
      curId !== ROUND_END_STEP_ID
        ? curId
        : itemId)
    stamped = true
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStamp })

  if (!stamped) return

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      clearLhTrackerActivity(m)
    }
  })
}

/**
 * Abwehr-Ladung direkt stempeln (auch bei mehreren geladenen Schildladungen).
 * Verbraucht genau eine Abwehr-Markierung und legt einen Abwehr-Stempel an.
 * @param {{ stampAnchor?: { rowId: string, phaseLinkId: string | null } }} [options]
 */
export async function patchKrStampAbwFromCharge(itemId, options = {}) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  {
    const c = getCombat()
    if (!c.started || c.roundIntroPending) return
    const cid = c.currentItemId
    if (cid === ROUND_START_STEP_ID || cid === ROUND_END_STEP_ID) return
  }
  const cur = normalizeKrDigit(meta?.[KR_ABW])
  if (!krTransferMarkPresent(cur)) return
  const next = consumeOneChargeValue(cur)
  if (next === cur) return

  const ownerName = getTokenListDisplayName(item) || String(item?.name ?? '')
  const skipGmStampAbw = canEditSceneItem(item) && !isGmSync()
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[KR_ABW] = next
    }
  })
  await patchActionStamps((stamps) => {
    const entries = [...stamps.entries]
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = null
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string' ? c.currentPhaseLinkId : null
    }
    entries.push({
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      ownerName,
      field: KR_ABW,
      anchorRowId,
      anchorPhaseLinkId,
    })
    const curId = getCombat().currentItemId
    const anchorId =
      entries.length > 0
        ? stamps.anchorId ||
          (typeof curId === 'string' &&
          curId !== ROUND_START_STEP_ID &&
          curId !== ROUND_END_STEP_ID
            ? curId
            : itemId)
        : null
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStampAbw })

  {
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = /** @type {string | null} */ (null)
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string'
          ? c.currentPhaseLinkId
          : null
    }
    /* Primärverbrauch gilt für dieses Token (itemId), auch wenn die Navigation
       gerade auf einer anderen Heldenzeile steht (anchorRowId ≠ itemId). */
    if (anchorPhaseLinkId === null) {
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const prev = Math.max(
            0,
            Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
          )
          m[KR_MOTHER_PRIMARY_USED_THIS_ROUND] = prev + 1
        }
      })
    }
  }
}

/**
 * Stempelt die Zusatz-Parade (schwarzes Schild); berührt `KR_ABW` nicht.
 * @param {{ stampAnchor?: { rowId: string, phaseLinkId: string | null } }} [options]
 */
export async function patchKrStampParadeExtraFromCharge(itemId, options = {}) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  migrateHeroExtraCountFields(meta)
  const slotIndex = Math.max(
    0,
    Math.min(
      HERO_EXTRA_MAX - 1,
      Math.floor(Number(options?.paradeExtraSlot ?? 0)) || 0
    )
  )
  const slotField = paradeExtraFieldForIndex(slotIndex)
  if (readHeroExtraParCount(meta) <= slotIndex) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  if (normalizeKrDigit(meta[slotField], 1) !== 0) return
  {
    const c = getCombat()
    if (!c.started || c.roundIntroPending) return
    const cid = c.currentItemId
    if (cid === ROUND_START_STEP_ID || cid === ROUND_END_STEP_ID) return
  }

  // Mutex z.AT vs schwarzes Schild: vor dem Update die heroExtra-'ang'-
  // Wurzel-IDs sammeln, damit nach dem Stempel auch zugehoerige Stempel-
  // Eintraege im Raum-State entfernt werden koennen (defensiv: durch den
  // Mutex sollte es eigentlich keinen z.AT-Stempel geben, wenn jetzt das
  // Schild gestempelt wird).
  const droppedHeroExtraLinkIds = new Set()
  {
    const phases = normalizePhases(meta.phases)
    for (const l of phases.links) {
      if (
        l.parentId === null &&
        (l.heroExtra === 'ang' || l.heroExtra === 'par')
      ) {
        droppedHeroExtraLinkIds.add(l.id)
      }
    }
  }

  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[slotField] = 1
      m.krExtraChoiceUsed = 'par'
      // heroExtra-Wurzel + Slot entfernen (Mutex): die z.AT verschwindet aus
      // der Liste, das rote "+" erscheint nicht (Guard in
      // `heroExtraZaoAvailableForRestore`).
      if (droppedHeroExtraLinkIds.size > 0) {
        const phases = normalizePhases(m.phases)
        const keptLinks = phases.links.filter(
          (l) => !droppedHeroExtraLinkIds.has(l.id)
        )
        m.phases = finalizePhasesWithOrderedRoots(m, { ...phases, links: keptLinks })
        const slots = readZaoSlots(m)
        for (const id of droppedHeroExtraLinkIds) delete slots[id]
        m[KR_ZAO_SLOTS] = slots
      }
    }
  })

  const ownerName = getTokenListDisplayName(item) || String(item?.name ?? '')
  const skipGmStampAbw = canEditSceneItem(item) && !isGmSync()
  await patchActionStamps((stamps) => {
    // Mutex-defensiv: vorhandene Stempel auf der entfernten heroExtra-Wurzel
    // (sollten durch Mutex eigentlich nicht existieren, koennen aber durch
    // Race-Conditions/Altzustaende vorkommen) mit weg-filtern.
    const baseEntries =
      droppedHeroExtraLinkIds.size > 0
        ? stamps.entries.filter(
            (e) =>
              !(
                e.itemId === itemId &&
                typeof e.zaoLinkId === 'string' &&
                droppedHeroExtraLinkIds.has(e.zaoLinkId)
              )
          )
        : stamps.entries
    const entries = [...baseEntries]
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = null
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string' ? c.currentPhaseLinkId : null
    }
    entries.push({
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      ownerName,
      field: KR_ABW,
      anchorRowId,
      anchorPhaseLinkId,
      paradeExtra: true,
      paradeExtraSlot: slotIndex,
    })
    const curId = getCombat().currentItemId
    const anchorId =
      entries.length > 0
        ? stamps.anchorId ||
          (typeof curId === 'string' &&
          curId !== ROUND_START_STEP_ID &&
          curId !== ROUND_END_STEP_ID
            ? curId
            : itemId)
        : null
    return { anchorId, entries }
  }, { skipGmCheck: skipGmStampAbw })

  {
    const c = getCombat()
    let anchorRowId = itemId
    let anchorPhaseLinkId = /** @type {string | null} */ (null)
    const forced = options?.stampAnchor
    if (forced && typeof forced.rowId === 'string') {
      anchorRowId = forced.rowId
      anchorPhaseLinkId =
        typeof forced.phaseLinkId === 'string' ? forced.phaseLinkId : null
    } else if (
      c.started &&
      !c.roundIntroPending &&
      typeof c.currentItemId === 'string' &&
      c.currentItemId !== ROUND_START_STEP_ID &&
      c.currentItemId !== ROUND_END_STEP_ID
    ) {
      anchorRowId = c.currentItemId
      anchorPhaseLinkId =
        typeof c.currentPhaseLinkId === 'string'
          ? c.currentPhaseLinkId
          : null
    }
    if (anchorPhaseLinkId === null) {
      await OBR.scene.items.updateItems([itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const prev = Math.max(
            0,
            Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
          )
          m[KR_MOTHER_PRIMARY_USED_THIS_ROUND] = prev + 1
        }
      })
    }
  }
}

const paradeExtraEnsureInFlight = new Set()

/**
 * Stellt sicher: bei aktivem Haken „Zusätzliche Parade“ existiert genau ein
 * Parade-Schild (Slot oder Stempel). Setzt `krParadeExtra = 0`, wenn noch keins da ist.
 * Nur Spielleitung (Schreibzugriff auf Raum-Stempel).
 *
 * @param {string} itemId
 */
export async function ensureParadeExtraShield(itemId) {
  if (!isGmSync()) return
  if (paradeExtraEnsureInFlight.has(itemId)) return
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!item || !canEditSceneItem(item)) return
  const meta = item.metadata?.[TRACKER_ITEM_META_KEY]
  if (!meta) return
  migrateHeroExtraCountFields(meta)
  const targetCount = readHeroExtraParCount(meta)
  if (targetCount <= 0) return
  if (isLhLockingActions(meta, lhLockRoundFromCombat())) return
  // Mutex z.AT vs schwarzes Schild: Wenn der Held in dieser KR bereits den
  // z.AT gestempelt hat, darf das Schild NICHT stillschweigend
  // wiederhergestellt werden — sonst waere die Mutex-Wahl wirkungslos.
  if (meta.krExtraChoiceUsed === 'ang') return

  paradeExtraEnsureInFlight.add(itemId)
  try {
    const roomMeta = await OBR.room.getMetadata()
    const stamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
    const stampedSlots = new Set(
      stamps.entries
        .filter((e) => e.itemId === itemId && e.paradeExtra)
        .map((e) => Math.max(0, Math.floor(Number(e.paradeExtraSlot)) || 0))
    )
    await OBR.scene.items.updateItems([itemId], (drafts) => {
      for (const d of drafts) {
        const m = d.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        migrateHeroExtraCountFields(m)
        const count = readHeroExtraParCount(m)
        for (let i = 0; i < HERO_EXTRA_MAX; i++) {
          const key = paradeExtraFieldForIndex(i)
          if (i >= count) {
            delete m[key]
            continue
          }
          if (stampedSlots.has(i)) continue
          if (m[key] !== 0) m[key] = 0
        }
      }
    })
  } finally {
    paradeExtraEnsureInFlight.delete(itemId)
  }
}

/**
 * Einen Aktions-Stempel schließen: Zähler um eins wie Rechtsklick (−1), Stempel aus der Liste.
 */
export async function undoKrActionStamp(stampId) {
  if (typeof stampId !== 'string' || !stampId) return
  const roomMeta = await OBR.room.getMetadata()
  const curStamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
  const entry = curStamps.entries.find((e) => e.id === stampId)
  if (!entry) return

  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === entry.itemId)
  if (!canEditSceneItem(item)) return

  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  if (entry.zaoLinkId) {
    // Stempel eines 2.A.-Slots: Ladung zurück in den Slot (marks=1), Mutter-
    // Zähler (Ang./S.R.A./L.H.) unverändert.
    const slotExists = Boolean(readZaoSlots(meta || {})[entry.zaoLinkId])
    const skipGmStampZao = canEditSceneItem(item) && !isGmSync()
    // Mutex z.AT vs schwarzes Schild: war dies der entscheidende heroExtra-
    // 'ang'-Stempel, gibt der Undo die Wahl wieder frei und stellt — falls
    // `heroExtraPar` aktiv ist — das geladene schwarze Schild wieder her.
    const isHeroExtraAngUndo =
      Boolean(entry.heroExtraStamp) ||
      (() => {
        const phases = normalizePhases(meta?.phases)
        const link = phases.links.find((l) => l.id === entry.zaoLinkId)
        return Boolean(
          link && link.parentId === null && link.heroExtra === 'ang'
        )
      })()
    if (slotExists) {
      await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const s = readZaoSlots(m)
          if (s[entry.zaoLinkId]) {
            s[entry.zaoLinkId] = { ...s[entry.zaoLinkId], marks: 1 }
            m[KR_ZAO_SLOTS] = s
          }
          if (isHeroExtraAngUndo) {
            delete m.krExtraChoiceUsed
            if (readHeroExtraParCount(m) > 0) m[KR_PARADE_EXTRA] = 0
          }
        }
      })
    } else if (entry.restoreZao && typeof entry.restoreZao === 'object') {
      // Legacy-Pfad (V335): damals hinterließ ein 2.A.O.-Close mit aktivem
      // Stempel einen verwaisten Stempel mit `restoreZao`. × stellte Slot
      // und Link wieder her. Neue Schließvorgänge erzeugen kein
      // `restoreZao` mehr (siehe `patchKrCloseZaoSlotToAbw`), aber alte
      // Raum-Metadaten können solche Stempel noch enthalten — für die
      // bleibt das Verhalten hier erhalten.
      const r = entry.restoreZao
      const slotKind =
        r.slotKind === 'sra' || r.slotKind === 'lh' || r.slotKind === 'ang'
          ? r.slotKind
          : 'ang'
      const linkParentId =
        typeof r.linkParentId === 'string' ? r.linkParentId : null
      const linkOffset =
        typeof r.linkOffset === 'number' && Number.isFinite(r.linkOffset)
          ? r.linkOffset
          : 0
      const linkHeroExtra =
        r.linkHeroExtra === 'ang' || r.linkHeroExtra === 'par'
          ? r.linkHeroExtra
          : null
      const linkExpiresNextRound = Boolean(r.linkExpiresNextRound)
      await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          const p = normalizePhases(m.phases)
          const alreadyThere = p.links.some((l) => l.id === entry.zaoLinkId)
          if (!alreadyThere) {
            const newLink = {
              id: entry.zaoLinkId,
              parentId: linkParentId,
              offset: linkOffset,
            }
            if (linkHeroExtra) newLink.heroExtra = linkHeroExtra
            if (linkExpiresNextRound) newLink.expiresNextRound = true
            m.phases = finalizePhasesWithOrderedRoots(m, {
              ...p,
              links: [...p.links, newLink],
              rowPanelOpen: true,
            })
          }
          const s = readZaoSlots(m)
          s[entry.zaoLinkId] = { kind: slotKind, marks: 1 }
          m[KR_ZAO_SLOTS] = s
          if (isHeroExtraAngUndo || linkHeroExtra === 'ang') {
            delete m.krExtraChoiceUsed
            if (readHeroExtraParCount(m) > 0) m[KR_PARADE_EXTRA] = 0
          }
        }
      })
    } else if (isHeroExtraAngUndo) {
      // Verwaister heroExtra-Stempel ohne Slot/restoreZao: Mutex trotzdem
      // freigeben, damit der Spieler das schwarze Schild wieder bekommt
      // (falls `heroExtraPar` gesetzt ist) bzw. die Wahl neu treffen kann.
      await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
        for (const draft of drafts) {
          const m = draft.metadata[TRACKER_ITEM_META_KEY]
          if (!m) continue
          delete m.krExtraChoiceUsed
          if (readHeroExtraParCount(m) > 0) m[KR_PARADE_EXTRA] = 0
        }
      })
    }
    // In allen Fällen: Stempel entfernen. Wenn Slot existierte oder
    // wiederhergestellt wurde, ist die Ladung bereits zurückgebucht.
    // Verwaister Legacy-Stempel ohne restoreZao wird stumm entfernt
    // (keine Mutter-Erstattung — das würde Ladungen aus dem Nichts
    // erschaffen).
    await patchActionStamps(
      (stamps) => {
        const entries = stamps.entries.filter((e) => e.id !== stampId)
        const anchorId =
          entries.length > 0
            ? stamps.anchorId ||
              (typeof getCombat().currentItemId === 'string'
                ? getCombat().currentItemId
                : entry.itemId)
            : null
        return { anchorId, entries }
      },
      { skipGmCheck: skipGmStampZao }
    )
    return
  }
  if (entry.field === KR_ABW && entry.abwFromSplit) {
    const skipGmLegacy = canEditSceneItem(item) && !isGmSync()
    await patchActionStamps(
      (stamps) => {
        const entries = stamps.entries.filter((e) => e.id !== stampId)
        const anchorId =
          entries.length > 0
            ? stamps.anchorId ||
              (typeof getCombat().currentItemId === 'string'
                ? getCombat().currentItemId
                : entry.itemId)
            : null
        return { anchorId, entries }
      },
      { skipGmCheck: skipGmLegacy }
    )
    return
  }
  if (entry.paradeExtra) {
    await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
      for (const draft of drafts) {
        const m = draft.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        const slotIdx = Math.max(
          0,
          Math.floor(Number(entry.paradeExtraSlot)) || 0
        )
        m[paradeExtraFieldForIndex(slotIdx)] = 0
        // Mutex z.AT vs schwarzes Schild: Undo des Schild-Stempels gibt die
        // Wahl wieder frei. Falls `heroExtraAng` aktiv ist und keine
        // heroExtra-Wurzel mehr existiert (sie wurde beim Stempel entfernt),
        // bauen wir sie geladen wieder auf — symmetrisch zur Wiederherstellung
        // des Schilds beim Undo eines z.AT-Stempels.
        delete m.krExtraChoiceUsed
        if (readHeroExtraAngCount(m) > 0) {
          const phases = normalizePhases(m.phases)
          const hasRoot = phases.links.some(
            (l) =>
              l.parentId === null &&
              (l.heroExtra === 'ang' || l.heroExtra === 'par')
          )
          if (!hasRoot) restoreHeroExtraAttackInPlace(m)
        }
      }
    })
    const skipGmStampPar = canEditSceneItem(item) && !isGmSync()
    await patchActionStamps(
      (stamps) => {
        const entries = stamps.entries.filter((e) => e.id !== stampId)
        const anchorId =
          entries.length > 0
            ? stamps.anchorId ||
              (typeof getCombat().currentItemId === 'string'
                ? getCombat().currentItemId
                : entry.itemId)
            : null
        return { anchorId, entries }
      },
      { skipGmCheck: skipGmStampPar }
    )
    return
  }
  let maxDigit = KR_COUNTER_MAX
  if (entry.field === KR_FREE_ACTION) {
    const iniStr = meta?.initiative
    const settings = getRoomSettings()
    maxDigit = faMaxForInitiative(iniStr, settings.highIniFreeActions)
  }
  const mod = maxDigit + 1
  const cur = normalizeKrDigit(meta?.[entry.field], maxDigit)
  /**
   * Abwehr wird beim Stempeln mit `consumeOneChargeValue` verringert (0/1/≥2-
   * Kodierung), nicht mit zyklischem +1 wie Ang./S.R.A. Ein Undo mit
   * `(cur+mod-1)%mod` würde z. B. bei cur===0 (eine Ladung) zu Ziffer 10
   * springen (= scheinbar viele Schildladungen). Rückgängig = eine Markierung
   * zurückgeben: `addOneChargeValue` (invers zu `consumeOneChargeValue`).
   */
  const next =
    entry.field === KR_ABW
      ? addOneChargeValue(cur)
      : (cur + mod - 1) % mod
  if (entry.field === KR_ABW && next === cur) return
  const pfBefore = primaryFieldForKind(meta)

  await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      m[entry.field] = next
      if (entry.field === pfBefore) {
        m[KR_PRIMARY_LADUNG] = next
      }
    }
  })

  const skipGmStamp = canEditSceneItem(item) && !isGmSync()
  await patchActionStamps(
    (stamps) => {
      const entries = stamps.entries.filter((e) => e.id !== stampId)
      const anchorId =
        entries.length > 0
          ? stamps.anchorId ||
            (typeof getCombat().currentItemId === 'string'
              ? getCombat().currentItemId
              : entry.itemId)
          : null
      return { anchorId, entries }
    },
    { skipGmCheck: skipGmStamp }
  )

  if (
    !entry.zaoLinkId &&
    !entry.paradeExtra &&
    (entry.field === KR_ANG ||
      entry.field === KR_SRA ||
      entry.field === KR_ABW) &&
    (entry.anchorPhaseLinkId || null) === null &&
    (entry.anchorRowId || entry.itemId) === entry.itemId
  ) {
    await OBR.scene.items.updateItems([entry.itemId], (drafts) => {
      for (const draft of drafts) {
        const m = draft.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        const prev = Math.max(
          0,
          Math.floor(Number(m[KR_MOTHER_PRIMARY_USED_THIS_ROUND])) || 0
        )
        m[KR_MOTHER_PRIMARY_USED_THIS_ROUND] = Math.max(0, prev - 1)
      }
    })
  }
}

/**
 * Letzten Stempel zu itemId+field entfernen (wie × in der Liste); sonst ein Schritt −1 am Zähler.
 */
export async function undoLastKrFieldStamp(itemId, field) {
  const roomMeta = await OBR.room.getMetadata()
  const curStamps = normalizeActionStamps(roomMeta[ACTION_STAMPS_KEY])
  for (let i = curStamps.entries.length - 1; i >= 0; i--) {
    const e = curStamps.entries[i]
    // Nur Mutter-Stempel (ohne `zaoLinkId`) zählen als letzter
    // Feld-Stempel — ZAO-Stempel gehören zu ihrem Slot und werden
    // dort über das × der Zeile behandelt.
    if (e.itemId === itemId && e.field === field && !e.zaoLinkId) {
      await undoKrActionStamp(e.id)
      return
    }
  }
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!canEditSceneItem(item)) return
  const meta = item?.metadata?.[TRACKER_ITEM_META_KEY]
  let maxDigit = KR_COUNTER_MAX
  if (field === KR_FREE_ACTION) {
    const iniStr = meta?.initiative
    const settings = getRoomSettings()
    maxDigit = faMaxForInitiative(iniStr, settings.highIniFreeActions)
  }
  const cur = normalizeKrDigit(meta?.[field], maxDigit)
  if (cur <= 0) return
  await patchKrCounterByDelta(itemId, field, -1)
}

function lhStampMatchesAnchorRemoval(e, itemId, onlyAnchorPhaseLinkId) {
  if (e.itemId !== itemId || e.field !== KR_LH_ACTION) return false
  if (onlyAnchorPhaseLinkId === undefined) return true
  const apl = e.anchorPhaseLinkId
  if (onlyAnchorPhaseLinkId === null)
    return apl == null || apl === ''
  return apl === onlyAnchorPhaseLinkId
}

/**
 * L.H.-Stempel für das Token entfernen und krLhAction an verbleibende Stempel anpassen.
 * @param {string | null | undefined} [onlyAnchorPhaseLinkId] — `undefined`: alle L.H.-Stempel; `null`: nur unter Token-Zeile; `string`: nur dieser Phasen-Link (2.A. / lhDone).
 */
export async function clearKrLhStampsForItem(itemId, onlyAnchorPhaseLinkId) {
  const items = await OBR.scene.items.getItems()
  const item = items.find((i) => i.id === itemId)
  if (!canEditSceneItem(item)) return
  const skipGmStamp = canEditSceneItem(item) && !isGmSync()
  let newLhCount = 0
  await patchActionStamps(
    (stamps) => {
      const entries = stamps.entries.filter(
        (e) =>
          !lhStampMatchesAnchorRemoval(e, itemId, onlyAnchorPhaseLinkId)
      )
      newLhCount = entries.filter(
        (e) => e.itemId === itemId && e.field === KR_LH_ACTION
      ).length
      const anchorId =
        entries.length > 0
          ? stamps.anchorId ||
            (typeof getCombat().currentItemId === 'string'
              ? getCombat().currentItemId
              : itemId)
          : null
      return { anchorId, entries }
    },
    { skipGmCheck: skipGmStamp }
  )
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const draft of drafts) {
      const m = draft.metadata[TRACKER_ITEM_META_KEY]
      if (m) {
        m[KR_LH_ACTION] = newLhCount
        if (readKrFirstSlotKind(m) === 'lh') {
          syncKrPrimaryLadungFromPrimaryField(m)
        }
      }
    }
  })
}

/**
 * Wie einmal S.R.A. o. ä. klicken: Stempel + Zähler 1 (vorher L.H.-Stempel dieses Tokens leeren).
 * @param {string | null | undefined} [stampPhaseLinkId] — `null` = Token-Zeile; String = Phasen-Link (2.A. …); `undefined` = Anker wie aktueller Kampfschritt.
 */
export async function applyLhOneClickStamp(itemId, stampPhaseLinkId) {
  if (stampPhaseLinkId === undefined) {
    await clearKrLhStampsForItem(itemId)
  } else {
    await clearKrLhStampsForItem(itemId, stampPhaseLinkId)
  }
  const stampOpts =
    stampPhaseLinkId !== undefined
      ? {
          stampAnchor: {
            rowId: itemId,
            phaseLinkId:
              typeof stampPhaseLinkId === 'string' ? stampPhaseLinkId : null,
          },
        }
      : {}
  await patchKrCounterByDelta(itemId, KR_LH_ACTION, 1, {
    ...stampOpts,
    skipLhSecondCheck: true,
  })
}

/**
 * Alle Kampfteilnehmer: Ang./Abw./S.R.A./F.A. auf 0 (neue Kampfrunde / Kampfstart).
 *
 * Wichtig: Wenn eine Längerfristige Handlung (LH_MAX > 0) noch läuft, darf
 * weder `KR_FIRST_SLOT_KIND` noch die L.H.-Ladung (`KR_LH_ACTION`) auf den
 * Angriffs-Default zurückgesetzt werden — sonst verschwindet der Stern und in
 * der nächsten KR steht wieder ein Schwert trotz laufender L.H.
 *
 * @param {{ resetStamps?: boolean }} [opts]
 */
export async function resetAllKrCountersInScene(opts = {}) {
  const { resetStamps = true } = opts
  const items = await OBR.scene.items.getItems((item) =>
    Boolean(item.metadata?.[TRACKER_ITEM_META_KEY])
  )
  if (items.length === 0) {
    if (resetStamps) {
      await patchActionStamps(() => ({ anchorId: null, entries: [] }))
    }
    return
  }
  await OBR.scene.items.updateItems(
    items.map((i) => i.id),
    (drafts) => {
      for (const draft of drafts) {
        const m = draft.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        migrateHeroExtraCountFields(m)
        const lhMaxActive =
          Math.max(0, Math.floor(Number(m[LH_MAX])) || 0) > 0
        const phasesSnap = normalizePhases(m.phases)
        const keepPhasePanelOpen =
          lhMaxActive &&
          phasesSnap.rowPanelOpen &&
          phasesSnap.links.length > 0
        const commitIniN = Number(m[LH_COMMIT_INI])
        const ownerIniN = Number(
          String(m.initiative ?? '')
            .trim()
            .replace(',', '.')
        )
        const lhFrom2A =
          lhMaxActive &&
          Number.isFinite(commitIniN) &&
          Number.isFinite(ownerIniN) &&
          commitIniN !== ownerIniN
        const keepKind = lhMaxActive
          ? lhFrom2A
            ? 'lh'
            : m[KR_FIRST_SLOT_KIND]
          : undefined
        const keepPairMode = lhMaxActive ? m[KR_PAIR_MODE] : undefined
        const keepLhSecond = lhMaxActive ? m[KR_LH_SECOND] : undefined
        Object.assign(m, DEFAULT_TRACKER_KR_COUNTERS)
        delete m[LEGACY_KR_ACTION]
        delete m[KR_LH_VOID_BY_TRANSFER]
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        if (lhMaxActive) {
          if (keepKind === 'lh' || keepKind === 'ang' || keepKind === 'sra') {
            m[KR_FIRST_SLOT_KIND] = keepKind
          }
          if (
            typeof keepPairMode === 'string' &&
            KR_PAIR_MODE_VALID.has(keepPairMode)
          ) {
            m[KR_PAIR_MODE] = keepPairMode
          }
          if (keepLhSecond === 0 || keepLhSecond === 1) {
            m[KR_LH_SECOND] = keepLhSecond
          }
          // In jeder neuen KR die Mutter-Ladung der laufenden L.H. wieder
          // bereitstellen (Stern darf nicht „verblasst" aus der Vorrunde
          // übernommen werden). Die Zähler `KR_LH_ACTION` / `KR_PRIMARY_LADUNG`
          // starten deshalb bei 0 (geladen); die Auslöser-Logik in
          // `runLongHandlungAfterCombatUpdate` entscheidet über das Feuern.
          m[KR_LH_ACTION] = 0
          m[KR_PRIMARY_LADUNG] = 0
          const slots = readZaoSlots(m)
          let slotsChanged = false
          for (const key of Object.keys(slots)) {
            if (slots[key].kind === 'lh' && slots[key].marks !== 1) {
              slots[key] = { ...slots[key], marks: 1 }
              slotsChanged = true
            }
          }
          if (slotsChanged) m[KR_ZAO_SLOTS] = slots
        }
        // Mutex z.AT vs schwarzes Schild: jede neue KR startet die Wahl
        // wieder neutral — beide Optionen sind verfuegbar, bis der Spieler
        // den ersten Mutex-Stempel setzt.
        delete m.krExtraChoiceUsed
        // Pro KR-Ladevorgang: heroExtra-ZAO verworfen und frisch — außer eine
        // L.H. läuft noch; dann bleibt die zweite Aktionszeile (L.H. auf ZAO)
        // erhalten, sonst fehlt der Slot nach dem KR-Wechsel.
        if (!lhMaxActive) {
          rebuildHeroExtraAttackRootAndSlot(m)
        }
        const parCount = readHeroExtraParCount(m)
        if (parCount > 0) {
          for (let i = 0; i < parCount; i++) {
            m[paradeExtraFieldForIndex(i)] = 0
          }
          for (let i = parCount; i < HERO_EXTRA_MAX; i++) {
            delete m[paradeExtraFieldForIndex(i)]
          }
        } else {
          for (let i = 0; i < HERO_EXTRA_MAX; i++) {
            delete m[paradeExtraFieldForIndex(i)]
          }
        }
        ensureFullFreeActionQuota(m)
        initKrActionPoolsFromHeroDefaults(m, { skipActionInit: lhMaxActive })
        applyIniLockCharges(m)
        // 2.A.-Panel offen lassen: Liste zeigt Phasen-Zeilen nur bei
        // rowPanelOpen; nach KR-Reset sonst nur Mutterzeile trotz laufender L.H.
        if (keepPhasePanelOpen) {
          const p = normalizePhases(m.phases)
          if (p.links.length > 0) {
            m.phases = finalizePhasesWithOrderedRoots(m, {
              ...p,
              rowPanelOpen: true,
            })
          }
        }
      }
    }
  )
  if (resetStamps) {
    await patchActionStamps(() => ({ anchorId: null, entries: [] }))
  }
}

/**
 * Voll-Reset für Kampfstart / Kampfende: löscht zusätzlich die
 * 2.A.-Slot-Zustände (`KR_ZAO_SLOTS`) und die komplette L.H.-Aktivität
 * (`LH_MAX`, `LH_REM`, `LH_KR_FIRED_ROUND`, `LH_KR_FIRED_MASK`,
 * `LH_DONE_ROUND`, `LH_DONE_INI`) sowie alle Paar-Modi zurück auf Standard
 * (Angriff + Abwehr, Zähler leer).
 *
 * Die 2.A.-Wurzel-Phasen-Links werden separat über
 * `clearAllRootPhaseLinksInScene` aus `phaseLinks.js` geleert.
 */
export async function resetAllTrackerStateForCombatStart() {
  const items = await OBR.scene.items.getItems((item) =>
    Boolean(item.metadata?.[TRACKER_ITEM_META_KEY])
  )
  if (items.length === 0) {
    await patchActionStamps(() => ({ anchorId: null, entries: [] }))
    return
  }
  await OBR.scene.items.updateItems(
    items.map((i) => i.id),
    (drafts) => {
      for (const draft of drafts) {
        const m = draft.metadata[TRACKER_ITEM_META_KEY]
        if (!m) continue
        migrateHeroExtraCountFields(m)
        Object.assign(m, DEFAULT_TRACKER_KR_COUNTERS)
        delete m[LEGACY_KR_ACTION]
        delete m[KR_LH_VOID_BY_TRANSFER]
        delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
        delete m[KR_ZAO_SLOTS]
        delete m[LH_MAX]
        delete m[LH_REM]
        delete m[LH_KR_FIRED_ROUND]
        delete m[LH_KR_FIRED_MASK]
        delete m[LH_DONE_ROUND]
        delete m[LH_DONE_INI]
        delete m[KR_INI_LOCK_MINUS_A]
        delete m[KR_INI_LOCK_MINUS_B]
        // Mutex z.AT vs schwarzes Schild: Voll-Reset gibt die Wahl wieder
        // vollstaendig frei.
        delete m.krExtraChoiceUsed
        // z.AT: Wurzeln entfernen, Panel zu — Spieler holt sie per „+“ herein
        // (nicht sofort alle aufklappen wie beim KR-internen Neuaufbau).
        stripHeroExtraZatAfterCombatFullReset(m)
        const parCount = readHeroExtraParCount(m)
        if (parCount > 0) {
          for (let i = 0; i < parCount; i++) {
            m[paradeExtraFieldForIndex(i)] = 0
          }
          for (let i = parCount; i < HERO_EXTRA_MAX; i++) {
            delete m[paradeExtraFieldForIndex(i)]
          }
        } else {
          for (let i = 0; i < HERO_EXTRA_MAX; i++) {
            delete m[paradeExtraFieldForIndex(i)]
          }
        }
        ensureFullFreeActionQuota(m)
        initKrActionPoolsFromHeroDefaults(m)
        applyIniLockCharges(m)
      }
    }
  )
  await patchActionStamps(() => ({ anchorId: null, entries: [] }))
}

/**
 * Stempel erneut anwenden (nach „Wiederherstellen“ + Navigation).
 * Nur Spielleitung / skipGmCheck-Pfade.
 *
 * @param {object} entry normalisiertes Stempel-Objekt (inkl. anchor*, zaoLinkId, …)
 */
export async function reapplyActionStampForCombatRedo(entry) {
  if (!entry || typeof entry !== 'object') return
  const itemId = entry.itemId
  if (typeof itemId !== 'string') return
  const ownerName =
    typeof entry.ownerName === 'string' ? entry.ownerName : ''
  const anchorRowId =
    typeof entry.anchorRowId === 'string' ? entry.anchorRowId : itemId
  const anchorPhaseLinkId =
    typeof entry.anchorPhaseLinkId === 'string'
      ? entry.anchorPhaseLinkId
      : null
  const stampAnchor = { rowId: anchorRowId, phaseLinkId: anchorPhaseLinkId }

  if (typeof entry.zaoLinkId === 'string' && entry.zaoLinkId) {
    await patchZaoSlotStampPrimary(itemId, entry.zaoLinkId)
    return
  }
  if (entry.paradeExtra) {
    await patchKrStampParadeExtraFromCharge(itemId, {
      stampAnchor,
      paradeExtraSlot: entry.paradeExtraSlot,
    })
    return
  }
  if (entry.field === KR_ABW && entry.abwFromSplit) {
    await patchActionStamps(
      (stamps) => {
        const entries = [...stamps.entries]
        entries.push({
          id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          itemId,
          ownerName,
          field: KR_ABW,
          anchorRowId,
          anchorPhaseLinkId,
          abwFromSplit: true,
        })
        const curId = getCombat().currentItemId
        const anchorId =
          entries.length > 0
            ? stamps.anchorId ||
              (typeof curId === 'string' &&
              curId !== ROUND_START_STEP_ID &&
              curId !== ROUND_END_STEP_ID
                ? curId
                : itemId)
            : null
        return { anchorId, entries }
      },
      { skipGmCheck: true, fromRedo: true }
    )
    return
  }
  if (entry.field === KR_ABW) {
    await patchKrStampAbwFromCharge(itemId, { stampAnchor })
    return
  }
  if (entry.field === KR_LH_ACTION) {
    await patchKrCounterByDelta(itemId, KR_LH_ACTION, 1, { stampAnchor })
    return
  }
  await patchKrCounterByDelta(itemId, entry.field, 1, { stampAnchor })
}
