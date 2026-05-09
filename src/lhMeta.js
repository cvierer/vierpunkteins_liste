/**
 * L.H.-Metadaten (Schlüssel + Lesen) ohne Abhängigkeit von phaseLinks/longHandlung.
 */

export const LH_MAX = 'lhMax'
export const LH_REM = 'lhRemaining'
export const LH_ACTIONS_PER_KR = 'lhActionsPerKr'
export const LH_TRIGGER_INI_STEP = 'lhTriggerIniStep'
export const LH_KR_FIRED_ROUND = 'lhKrFiredRound'
export const LH_KR_FIRED_MASK = 'lhKrFiredMask'
export const LH_DONE_ROUND = 'lhDoneRound'
export const LH_DONE_INI = 'lhDoneIni'
export const HERO_EXTRA_ANG_PHASE_OFFSET = 'heroExtraAngPhaseOffset'
export const HERO_SECOND_AO_PHASE_OFFSET = 'heroSecondAoPhaseOffset'
/**
 * Kampfrunde, in der die L.H. per Eingabefeld aktiviert wurde. Wird beim
 * Commit gesetzt und bei Abschluss / Reset gelöscht. Dient ausschließlich der
 * Fortschritts-Anzeige (nav-basierter Counter) und ist unabhängig von der
 * internen Auslöser-Maske (`LH_KR_FIRED_MASK` / `LH_KR_FIRED_ROUND`).
 */
export const LH_COMMIT_ROUND = 'lhCommitRound'
/** Nav-INI beim LH-Start (n.A.-Phase = nicht T0); fehlt → wie Helden-INI. */
export const LH_COMMIT_INI = 'lhCommitIni'
/**
 * Beim LH-Start eingefroren: wie viele Mutter-Primäraktionen (Ang/SRA/Abw)
 * in der Commit-KR schon verbraucht waren — reduziert die nav-basierten LH-Ticks.
 */
export const LH_COMMIT_KR_PRIOR_SPEND = 'lhCommitKrPriorSpend'

export const DEFAULT_LH_ACTIONS_PER_KR = 2
export const DEFAULT_LH_TRIGGER_INI_STEP = -8
export const DEFAULT_HERO_EXTRA_ANG_PHASE_OFFSET = 4
export const DEFAULT_HERO_SECOND_AO_PHASE_OFFSET = 8

const MAX_ACTIONS = 10

/** Bitmaske für `LH_KR_FIRED_MASK`: ein Bit pro möglichem Auslöser-Slot (0 … MAX_ACTIONS−1). */
function lhFiredMaskAllBits() {
  return (1 << MAX_ACTIONS) - 1
}

function normalizeActionsPerKr(raw) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return DEFAULT_LH_ACTIONS_PER_KR
  return Math.min(MAX_ACTIONS, Math.max(1, n))
}

function normalizeTriggerStep(raw) {
  if (raw == null || raw === '') return DEFAULT_LH_TRIGGER_INI_STEP
  const n = Number(raw)
  if (!Number.isFinite(n) || n === 0) return DEFAULT_LH_TRIGGER_INI_STEP
  return n
}

function normalizeFiredRound(raw) {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n >= 1 ? n : null
}

function normalizeFiredMask(raw) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 0) return 0
  return n & lhFiredMaskAllBits()
}

export function readLhMechanics(meta) {
  if (!meta || typeof meta !== 'object') {
    return {
      actionsPerKr: DEFAULT_LH_ACTIONS_PER_KR,
      triggerIniStep: DEFAULT_LH_TRIGGER_INI_STEP,
      firedRound: null,
      firedMask: 0,
    }
  }
  return {
    actionsPerKr: normalizeActionsPerKr(meta[LH_ACTIONS_PER_KR]),
    triggerIniStep: normalizeTriggerStep(meta[LH_TRIGGER_INI_STEP]),
    firedRound: normalizeFiredRound(meta[LH_KR_FIRED_ROUND]),
    firedMask: normalizeFiredMask(meta[LH_KR_FIRED_MASK]),
  }
}

export function readLhState(meta) {
  if (!meta || typeof meta !== 'object') {
    return { max: 0, rem: 0 }
  }
  const max = Math.max(0, Math.floor(Number(meta[LH_MAX])) || 0)
  let rem = Math.max(0, Math.floor(Number(meta[LH_REM])) || 0)
  if (rem > max && max > 0) rem = max
  return { max, rem }
}

/**
 * Mehrteilige L.H. im letzten Auslöser-Segment (`rem === 1`): Anzeige „GO!“,
 * voller Stern — Abschluss-Stempel am Mutterobjekt steht noch aus. Navigation
 * (Phase 6) soll den Tracker dann nicht per `clearLhTrackerActivity` leeren.
 *
 * @param {unknown} meta
 * @returns {boolean}
 */
export function lhAwaitingCompletionStamp(meta) {
  const { max, rem } = readLhState(meta)
  return max > 1 && rem === 1
}

/**
 * Sperr-Prädikat (V2): Wahr genau dann, wenn eine Längerfristige Handlung
 * läuft (max > 0 && rem > 0). Pure Funktion, keine OBR-/Async-Abhängigkeiten —
 * darf von `krCounters.js` gefahrlos importiert werden.
 *
 * @param {unknown} meta
 * @returns {boolean}
 */
export function isLhActive(meta) {
  const st = readLhState(meta)
  return st.max > 0 && st.rem > 0
}

/**
 * Sperr-Prädikat (V3, kontextsensitiv): true wenn eine L.H. läuft UND
 * sie NICHT in der aktuellen KR endet. In der End-KR (in der die L.H.
 * ablaeuft) gibt die Funktion `false` zurueck — Umwandeln, Schild- und
 * Primaer-Stempel sind dann wieder erlaubt; nur der L.H.-Stempel-Slot
 * selbst bleibt ueber `stampLhCompletion`/Slot-Konflikt geschuetzt.
 *
 * Aufrufer ohne `currentRound` (oder mit ungueltigem Wert) erhalten das
 * konservative `true` (Verhalten wie `isLhActive`).
 *
 * @param {unknown} meta
 * @param {number | null | undefined} currentRound
 * @param {number | null | undefined} [ownerIniOverride]
 * @returns {boolean}
 */
export function isLhLockingActions(meta, currentRound, ownerIniOverride) {
  if (!isLhActive(meta)) return false
  const cr = Number(currentRound)
  if (!Number.isFinite(cr)) return true
  const { max } = readLhState(meta)
  const ownerIni = Number.isFinite(Number(ownerIniOverride))
    ? Number(ownerIniOverride)
    : Number(
        String(/** @type {any} */ (meta)?.initiative ?? '')
          .trim()
          .replace(',', '.')
      )
  if (!Number.isFinite(ownerIni)) return true
  const mech = readLhMechanics(meta)
  const commitRound =
    Math.max(
      1,
      Math.floor(Number(/** @type {any} */ (meta)?.[LH_COMMIT_ROUND])) || 0
    ) || cr
  const commitIniRaw = /** @type {any} */ (meta)?.[LH_COMMIT_INI]
  const commitIniN = Number(commitIniRaw)
  const priorSpend = readLhCommitKrPriorSpendForRound(meta, cr)
  const { endsInThisRound } = lhEndsInRound(
    max,
    commitRound,
    cr,
    ownerIni,
    mech.actionsPerKr,
    mech.triggerIniStep,
    Number.isFinite(commitIniN) ? commitIniN : null,
    priorSpend
  )
  return !endsInThisRound
}

/**
 * Gespeichertes Phasen-Offset (positiv) aus L.H.-Auslöser-Schritt, z. B. −8 → 8.
 */
export function phaseOffsetFromLhTriggerStep(triggerIniStep) {
  const n = Number(triggerIniStep)
  if (!Number.isFinite(n) || n === 0) {
    return Math.max(
      0,
      Math.min(99, Math.round(Math.abs(DEFAULT_LH_TRIGGER_INI_STEP)))
    )
  }
  return Math.max(0, Math.min(99, Math.round(Math.abs(n))))
}

export function phaseOffsetFromLhMeta(meta) {
  return phaseOffsetFromLhTriggerStep(readLhMechanics(meta).triggerIniStep)
}

function normalizePhaseOffsetMeta(raw, fallback) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 0 || n > 99) return fallback
  if (n === 0) return fallback
  return n
}

export function phaseOffsetFromHeroExtraAngMeta(meta) {
  if (!meta || typeof meta !== 'object') return DEFAULT_HERO_EXTRA_ANG_PHASE_OFFSET
  return normalizePhaseOffsetMeta(
    meta[HERO_EXTRA_ANG_PHASE_OFFSET],
    DEFAULT_HERO_EXTRA_ANG_PHASE_OFFSET
  )
}

export function phaseOffsetFromHeroSecondAoMeta(meta) {
  if (!meta || typeof meta !== 'object') return DEFAULT_HERO_SECOND_AO_PHASE_OFFSET
  return normalizePhaseOffsetMeta(
    meta[HERO_SECOND_AO_PHASE_OFFSET],
    DEFAULT_HERO_SECOND_AO_PHASE_OFFSET
  )
}

/**
 * Positiver Phasen-Offset (z. B. 8) → gespeicherter `lhTriggerIniStep` (z. B. −8).
 */
export function storedTriggerIniStepFromPhaseOffsetPositive(positiveOffset) {
  const n = Math.floor(Number(positiveOffset))
  if (!Number.isFinite(n) || n < 0) return DEFAULT_LH_TRIGGER_INI_STEP
  if (n === 0) return DEFAULT_LH_TRIGGER_INI_STEP
  return -Math.min(99, Math.max(1, n))
}

/** 1…10 für `lhActionsPerKr`. */
export function clampLhActionsPerKrForStorage(raw) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return DEFAULT_LH_ACTIONS_PER_KR
  return Math.min(MAX_ACTIONS, Math.max(1, n))
}

function popcountLhFiredMask(mask) {
  let v = Math.floor(Number(mask)) & lhFiredMaskAllBits()
  let c = 0
  while (v) {
    c++
    v &= v - 1
  }
  return c
}

/**
 * Zähler für „x“ in x/max bei mehrteiliger L.H.: sobald in dieser KR mindestens ein Auslöser
 * in der Maske steht, um 1 hinter `max - rem + 1` — passt zur strengen INI-Überquerung
 * (Anzeige nicht einen Schritt vor dem tatsächlichen Verbrauch).
 */
function lhProgressDisplayNumerator(max, rem, meta, combatRound) {
  if (!(max > 0 && rem > 0)) return 0
  const naive = max - rem + 1
  if (max === 1) return naive
  if (
    max > 1 &&
    meta &&
    typeof meta === 'object' &&
    typeof combatRound === 'number' &&
    combatRound >= 1
  ) {
    const bits = popcountLhFiredMask(
      effectiveLhFiredMaskForRound(meta, combatRound)
    )
    return Math.max(1, naive - (bits > 0 ? 1 : 0))
  }
  return naive
}

/**
 * Kurztext im L.H.-Kuchen am Token: 1/x … (x−1)/x, zuletzt „GO!“ wenn nur noch ein Auslöser offen (mehrteilige L.H.).
 * @param [meta] Tracker-Metadaten; mit `combatRound` für korrigierte Mehrteil-Anzeige.
 * @param [combatRound] Aktuelle Kampfrunde (≥1), sonst Fallback ohne Masken-Korrektur.
 */
export function lhProgressFractionText(max, rem, meta, combatRound) {
  if (!(max > 0 && rem > 0)) return ''
  if (max > 1 && rem === 1) return 'GO!'
  const n = lhProgressDisplayNumerator(max, rem, meta, combatRound)
  return `${n}/${max}`
}


/**
 * Füllgrad 0…1 für den L.H.-Kuchen, gleiche Logik wie die Bruch-Anzeige.
 * @param [meta] @param [combatRound] siehe `lhProgressFractionText`.
 */
export function lhProgressPieFillRatio(max, rem, meta, combatRound) {
  if (max <= 0) return 0
  if (rem <= 0) return 1
  if (max > 1 && rem === 1) {
    return Math.max(0, Math.min(1, (max - rem + 1) / max))
  }
  const n = lhProgressDisplayNumerator(max, rem, meta, combatRound)
  return Math.max(0, Math.min(1, n / max))
}

const LEGACY_LH_P2_ROUND = 'lhPendingSecondRound'
const LEGACY_LH_P2_INI = 'lhPendingSecondTargetIni'

/** Wie L.H. leer speichern: Zelle und Fortschritt zurücksetzen (z. B. × am Listen-Stempel). */
export function clearLhTrackerActivity(m) {
  if (!m || typeof m !== 'object') return
  delete m[LEGACY_LH_P2_ROUND]
  delete m[LEGACY_LH_P2_INI]
  m[LH_MAX] = 0
  m[LH_REM] = 0
  delete m[LH_KR_FIRED_ROUND]
  delete m[LH_KR_FIRED_MASK]
  delete m[LH_DONE_ROUND]
  delete m[LH_DONE_INI]
  delete m[LH_COMMIT_ROUND]
  delete m[LH_COMMIT_INI]
  delete m[LH_COMMIT_KR_PRIOR_SPEND]
}

/**
 * Eingefrorener Mutter-Primär-Verbrauch vor LH-Start (`lhCommitKrPriorSpend`).
 * Gilt für alle Kampfrunden bis zum LH-Ende — wird für `ticksInCommitKr`,
 * Pie und Sanduhr über KR hinweg benötigt (nicht nur in der Commit-KR).
 *
 * @param {unknown} meta
 * @param {number | null | undefined} currentRound — nur API-Kompatibilität
 * @returns {number}
 */
export function readLhCommitKrPriorSpendForRound(meta, currentRound) {
  void currentRound
  if (!meta || typeof meta !== 'object') return 0
  const n = Math.floor(Number(/** @type {any} */ (meta)[LH_COMMIT_KR_PRIOR_SPEND]))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Maske für Listen-Anzeige: in anderer KR als `combatRound` wie leer behandeln.
 */
export function effectiveLhFiredMaskForRound(meta, combatRound) {
  const mech = readLhMechanics(meta)
  if (combatRound == null || mech.firedRound == null) return mech.firedMask
  if (mech.firedRound !== combatRound) return 0
  return mech.firedMask
}

/**
 * Nächste noch nicht verbrauchte Auslöser-INI (höchstes T≥0 unter den offenen Stufen),
 * sonst niedrigstes bereits verbrauchtes T (Restzustand vor Abschluss).
 */
export function hookIniForLhProgressRow(heroIni, mechanics, firedMask) {
  const { actionsPerKr, triggerIniStep } = mechanics
  const H = heroIni
  if (!Number.isFinite(H)) return null
  let bestUnfired = null
  for (let k = 0; k < actionsPerKr; k++) {
    const bit = 1 << k
    if (firedMask & bit) continue
    const T = H + k * triggerIniStep
    if (!Number.isFinite(T) || (k > 0 && T < 0)) continue
    if (bestUnfired === null || T > bestUnfired) bestUnfired = T
  }
  if (bestUnfired !== null) return bestUnfired
  let lowestFired = null
  for (let k = 0; k < actionsPerKr; k++) {
    const bit = 1 << k
    if (!(firedMask & bit)) continue
    const T = H + k * triggerIniStep
    if (!Number.isFinite(T) || (k > 0 && T < 0)) continue
    if (lowestFired === null || T < lowestFired) lowestFired = T
  }
  return lowestFired
}

/**
 * L.H. mit genau einer Gesamt-Aktion (max=1): 2.A. eine Stufe am Phasen-Offset unter dem Heldenwert
 * (Standard-Offset −8 → INI = Helden-INI − 8).
 */
export function lhSingleActionHookIni(heroIni, triggerIniStep) {
  if (!Number.isFinite(heroIni)) return null
  const step = Number(triggerIniStep)
  if (!Number.isFinite(step) || step === 0) return null
  const t = heroIni + step
  return Number.isFinite(t) && t >= 0 ? t : null
}

/** INI der laufenden L.H.-Zeile für Liste / Kampfschritte (inkl. Sonderfall max=1). */
export function computeLhProgressDisplayHookIni(
  lhMax,
  lhRem,
  heroIni,
  meta,
  combatRound
) {
  if (!(lhMax > 0 && lhRem > 0 && Number.isFinite(heroIni)) || !meta) {
    return null
  }
  const mech = readLhMechanics(meta)
  if (lhMax === 1 && lhRem === lhMax) {
    return lhSingleActionHookIni(heroIni, mech.triggerIniStep)
  }
  const firedMask = effectiveLhFiredMaskForRound(meta, combatRound)
  return hookIniForLhProgressRow(heroIni, mech, firedMask)
}

/**
 * Synthetische 2.A.-INI-Zeile nur nach abgeschlossener L.H. (Zusatzaktion laut Regelwerk).
 * Laufender Fortschritt (1/x … GO!) steht ausschließlich am Mutter-Token.
 */
export function trackerShowsLhSyntheticRow(meta, ownerIniNum, _combatRound) {
  if (!meta || typeof meta !== 'object') return false
  const doneRound = Math.floor(Number(meta[LH_DONE_ROUND]))
  const doneIni = Number(meta[LH_DONE_INI])
  return (
    Number.isFinite(doneRound) &&
    doneRound >= 1 &&
    Number.isFinite(doneIni) &&
    doneIni >= 0 &&
    (!Number.isFinite(ownerIniNum) || doneIni !== ownerIniNum)
  )
}

/**
 * Nav-basierter L.H.-Counter (pragmatisch, unabhängig von der internen
 * firedMask-Logik). Liefert die Nummer, die in den L.H.-Eingabefeldern aller
 * Tokens/2.A.-Objekte angezeigt werden soll, gegeben:
 *
 * - `heroIniNum`  : numerische Helden-INI (z. B. 15)
 * - `mechanics`   : `readLhMechanics(meta)` (liefert actionsPerKr + triggerIniStep)
 * - `commitRound` : Kampfrunde, in der die L.H. per Eingabefeld aktiviert wurde
 * - `currentRound`: aktuelle Kampfrunde (≥1, aus `getCombat().round`)
 * - `currNavIni`  : INI des aktuellen Navigationsschritts (aus `activeIni`)
 * - `lhMax`       : Gesamtaktionen der L.H.
 *
 * Regeln:
 * - Pro Kampfrunde gibt es `actionsPerKr` Auslöser-INIs
 *   `T_k = heroIni + k * triggerIniStep` (gültig, wenn `T_k ≥ 0`).
 * - In der aktuellen KR zählen alle `T_k`, die die Navigation **erreicht
 *   oder überquert** hat (`currNavIni ≤ T_k`), als „in dieser KR passiert".
 * - Alle vorangegangenen KRs seit `commitRound` zählen jeweils mit vollen
 *   `actionsPerKr` Schritten.
 * - Untergrenze 1, Obergrenze `lhMax`.
 *
 * Beispiel (hero_ini=15, triggerIniStep=-8, actionsPerKr=2, lhMax=5, commitRound=1):
 *   KR1 mother (INI 15)   → 1/5
 *   KR1 2.A.O. (INI 7)    → 2/5
 *   KR2 mother (INI 15)   → 3/5
 *   KR2 2.A.O. (INI 7)    → 4/5
 *   KR3 mother (INI 15)   → 5/5  (danach abgeschlossen)
 */
/**
 * Berechnet deterministisch, ob die L.H. in `currentRound` endet — und wenn
 * ja, an welcher INI das Ende liegt. Wird sowohl beim KR-Beginn (zum Anlegen
 * eines temporaeren n.A.-Objekts) als auch beim Vorbei-Navigieren (zum
 * Tracker-Reset ohne Stempel) verwendet.
 *
 * Modell:
 *  - Pro KR werden hoechstens `ap` Aktionsphasen verbraucht (Helden-Turn +
 *    weitere Auslöser an Helden-INI + k * triggerIniStep).
 *  - Insgesamt benoetigte KRs = ceil(max / ap).
 *  - Letzte KR = commitRound + ceil(max/ap) - 1.
 *  - End-Index k innerhalb der letzten KR = (max - 1) % ap.
 *  - endIni = ownerIni + k * step (kann negativ sein, z. B. Helden-Turn bei INI&lt;0).
 *
 * Beispiele (ownerIni=15, step=-8):
 *  - max=1, ap=2 → endsInRound 1, k=0, endIni=15 (Mutter).
 *  - max=4, ap=2 → endsInRound 2, k=1, endIni=7  (n.A.-Objekt).
 *  - max=5, ap=2 → endsInRound 3, k=0, endIni=15 (Mutter in KR 3).
 *
 * @param {number} maxCommitted
 * @param {number} commitRound
 * @param {number} currentRound
 * @param {number} ownerIni
 * @param {number} ap actionsPerKr
 * @param {number} step triggerIniStep (typischerweise negativ, z. B. -8)
 * @param {number | null | undefined} [commitIni] Nav-INI beim LH-Start (fehlt → ownerIni)
 * @param {number} [priorKrSpend] Mutter-Primäraktionen vor LH-Start in der Commit-KR (eingefroren)
 * @returns {{ endsInThisRound: boolean, endIni: number | null }}
 */
export function lhEndsInRound(
  maxCommitted,
  commitRound,
  currentRound,
  ownerIni,
  ap,
  step,
  commitIni,
  priorKrSpend = 0
) {
  const max = Math.max(0, Math.floor(Number(maxCommitted)) || 0)
  const cr = Math.max(1, Math.floor(Number(currentRound)) || 1)
  const cmtR = Math.max(1, Math.floor(Number(commitRound)) || 1)
  const apN = Math.max(1, Math.floor(Number(ap)) || DEFAULT_LH_ACTIONS_PER_KR)
  const stepN = Number(step)
  const owner = Number(ownerIni)
  if (max <= 0) return { endsInThisRound: false, endIni: null }
  if (!Number.isFinite(owner)) return { endsInThisRound: false, endIni: null }
  if (!Number.isFinite(stepN) || stepN === 0) {
    return { endsInThisRound: false, endIni: null }
  }
  const effAp = effectiveActionsPerKr(owner, apN, stepN)
  const commitRef = lhCommitIniRef(commitIni, owner)
  const commitOffset = commitOffsetFromIni(owner, apN, stepN, commitRef)
  const priorCapped = clampPriorKrSpendForCommitKr(priorKrSpend, effAp, commitOffset)
  const ticksInCommitKr = Math.max(0, effAp - commitOffset - priorCapped)
  const carryTicks = implicitLhZaoCommitCarryTicks(
    ticksInCommitKr,
    commitRef,
    owner
  )
  const ticksAfterCommitKr = ticksInCommitKr + carryTicks

  if (max <= ticksAfterCommitKr) {
    const lastKr = cmtR
    if (cr !== lastKr) return { endsInThisRound: false, endIni: null }
    // Sonderfall: Start auf 2.A. ohne verbleibenden Trigger-Slot in der
    // Commit-KR (`ticksInCommitKr === 0`) wird als impliziter Tick gutgeschrieben.
    // Dann endet die L.H. am Commit-INI-Schritt selbst.
    if (max > ticksInCommitKr) {
      if (!Number.isFinite(commitRef)) {
        return { endsInThisRound: false, endIni: null }
      }
      return { endsInThisRound: true, endIni: commitRef }
    }
    const k = commitOffset + priorCapped + max - 1
    const endIni = owner + k * stepN
    if (!Number.isFinite(endIni)) return { endsInThisRound: false, endIni: null }
    return { endsInThisRound: true, endIni }
  }

  const remaining = max - ticksAfterCommitKr
  const extraKrs = Math.ceil(remaining / effAp)
  const lastKr = cmtR + extraKrs
  if (cr !== lastKr) return { endsInThisRound: false, endIni: null }
  const kInLastKr = remaining - (extraKrs - 1) * effAp - 1
  let endIni = owner + kInLastKr * stepN
  if (!Number.isFinite(endIni)) {
    return { endsInThisRound: false, endIni: null }
  }
  return { endsInThisRound: true, endIni }
}

/**
 * Anzahl gültiger L.H.-Auslöser pro KR: k=0 (Helden-Turn) zählt immer;
 * weitere Stufen k&gt;0 nur wenn deren INI nicht negativ ist (INI&lt;0:
 * höchstens eine Aktion pro KR).
 *
 * @param {number} heroIni
 * @param {number} apN
 * @param {number} step
 * @returns {number}
 */
function effectiveActionsPerKr(heroIni, apN, step) {
  const ap = Math.max(1, Math.floor(Number(apN)) || DEFAULT_LH_ACTIONS_PER_KR)
  if (!Number.isFinite(heroIni) || !Number.isFinite(step) || step === 0) {
    return ap
  }
  let count = 0
  for (let k = 0; k < ap; k++) {
    const T = heroIni + k * step
    if (k === 0 || T >= 0) count++
  }
  return Math.max(1, count)
}

/**
 * Zählt gültige Auslöser-Indizes k mit T_k &gt; commitIni (vor dem LH-Start
 * in der Commit-KR schon passiert).
 *
 * @param {number} heroIni
 * @param {number} apN
 * @param {number} stepN
 * @param {number} commitIni
 */
/**
 * Nav-INI beim LH-/Mod-Start. `null`/`undefined` (inkl. ES-Default bei explizitem `undefined`)
 * gelten als „fehlt“ → Helden-INI — nicht `Number(null) === 0`.
 *
 * @param {number | null | undefined} commitIni
 * @param {number} ownerIni
 */
export function lhCommitIniRef(commitIni, ownerIni) {
  if (commitIni == null) return ownerIni
  const n = Number(commitIni)
  return Number.isFinite(n) ? n : ownerIni
}

function commitOffsetFromIni(heroIni, apN, stepN, commitIni) {
  if (
    !Number.isFinite(heroIni) ||
    !Number.isFinite(stepN) ||
    stepN === 0 ||
    !Number.isFinite(commitIni)
  ) {
    return 0
  }
  const ap = Math.max(1, Math.floor(Number(apN)) || DEFAULT_LH_ACTIONS_PER_KR)
  let off = 0
  for (let k = 0; k < ap; k++) {
    const T = heroIni + k * stepN
    if (!Number.isFinite(T)) continue
    if (k > 0 && T < 0) continue
    if (T > commitIni) off++
  }
  const effAp = effectiveActionsPerKr(heroIni, apN, stepN)
  return Math.min(off, effAp)
}

/**
 * @param {unknown} priorRaw
 * @param {number} effAp
 * @param {number} commitOffset
 */
function clampPriorKrSpendForCommitKr(priorRaw, effAp, commitOffset) {
  const p = Math.max(0, Math.floor(Number(priorRaw)) || 0)
  const headroom = Math.max(0, effAp - commitOffset)
  return Math.min(p, headroom)
}

/**
 * Beim LH-Start: Live-Zähler Mutter-Primär → gespeicherten Prior-Wert (gecappt).
 *
 * @param {number} ownerIni
 * @param {number} apN
 * @param {number} stepN
 * @param {number | null | undefined} commitIni
 * @param {unknown} liveCounterRaw
 */
export function freezeLhCommitKrPriorSpendFromLive(
  ownerIni,
  apN,
  stepN,
  commitIni,
  liveCounterRaw
) {
  const owner = Number(ownerIni)
  if (!Number.isFinite(owner)) return 0
  const ap = Math.max(1, Math.floor(Number(apN)) || DEFAULT_LH_ACTIONS_PER_KR)
  const step = Number(stepN)
  if (!Number.isFinite(step) || step === 0) return 0
  const effAp = effectiveActionsPerKr(owner, ap, step)
  const commitRef = lhCommitIniRef(commitIni, owner)
  const commitOffset = commitOffsetFromIni(owner, ap, step, commitRef)
  return clampPriorKrSpendForCommitKr(liveCounterRaw, effAp, commitOffset)
}

/**
 * Wenn die L.H. auf der 2.-Aktion gestartet wurde (`commitRef !== Helden-INI`)
 * und `ticksInCommitKr === 0` ist, deckt Offset + Prior die Commit-KR ohne
 * navigierbare Restschritte ab — der ZAO-Start zählt aber einen Ausloeser.
 * Ein Schritt wird fuer Folge-KRs in Pie/Bruch gutgeschrieben.
 *
 * @param {number} ticksInCommitKr
 * @param {number} commitRef
 * @param {number} ownerIni
 * @returns {0 | 1}
 */
function implicitLhZaoCommitCarryTicks(ticksInCommitKr, commitRef, ownerIni) {
  if (ticksInCommitKr !== 0) return 0
  const owner = Number(ownerIni)
  const cref = Number(commitRef)
  if (!Number.isFinite(owner) || !Number.isFinite(cref)) return 0
  if (cref === owner) return 0
  return 1
}

/**
 * Pie-Anteil 0…1 des LH-Sterns. Baut sich kontinuierlich ueber die gesamte
 * Lebensdauer der L.H. auf — jeder L.H.-Trigger-INI-Schritt, an dem die
 * Navigation vorbei wandert, erhoeht den Anteil um 1/max. Die Funktion
 * arbeitet ueber mehrere Kampfrunden hinweg konsistent.
 *
 *  - Vor commitRound: 0 (grau, 12-Uhr).
 *  - Komplett vorbei (alle Trigger durchlaufen): 1 (voll satt).
 *  - Dazwischen: (passierte Ticks) / max.
 *
 * Innerhalb der aktuellen KR wird ein Trigger als „passiert" gezaehlt, wenn
 * `currentNavIni <= triggerIni` (Navigation laeuft von hoher zu niedriger INI).
 * Damit ist die L.H. bereits am Helden-Turn (Moeglichkeit A: End-INI ===
 * Helden-INI) voll ausgebaut und stempelbar.
 *
 * @param {number} currentRound
 * @param {number | null | undefined} currentNavIni
 * @param {number} commitRound
 * @param {number} ownerIni
 * @param {number} ap actionsPerKr
 * @param {number} step triggerIniStep (typischerweise negativ)
 * @param {number} maxCommitted
 * @param {number | null | undefined} [commitIni] Nav-INI beim LH-Start
 * @param {number} [priorKrSpend]
 */
export function lhPieFraction(
  currentRound,
  currentNavIni,
  commitRound,
  ownerIni,
  ap,
  step,
  maxCommitted,
  commitIni,
  priorKrSpend = 0
) {
  const max = Math.max(0, Math.floor(Number(maxCommitted)) || 0)
  if (max <= 0) return 0
  const cr = Math.max(1, Math.floor(Number(currentRound)) || 1)
  const cmt = Math.max(1, Math.floor(Number(commitRound)) || 1)
  if (cr < cmt) return 0
  const apN = Math.max(1, Math.floor(Number(ap)) || DEFAULT_LH_ACTIONS_PER_KR)
  const stepN = Number(step)
  const owner = Number(ownerIni)
  if (!Number.isFinite(owner) || !Number.isFinite(stepN) || stepN === 0) {
    return 0
  }
  const effAp = effectiveActionsPerKr(owner, apN, stepN)
  const commitRef = lhCommitIniRef(commitIni, owner)
  const commitOffset = commitOffsetFromIni(owner, apN, stepN, commitRef)
  const priorCapped = clampPriorKrSpendForCommitKr(priorKrSpend, effAp, commitOffset)
  const ticksInCommitKr = Math.max(0, effAp - commitOffset - priorCapped)

  let ticksPassed = 0
  if (cr > cmt) {
    ticksPassed = Math.min(max, ticksInCommitKr + (cr - cmt - 1) * effAp)
    ticksPassed = Math.min(
      max,
      ticksPassed +
        implicitLhZaoCommitCarryTicks(ticksInCommitKr, commitRef, owner)
    )
  }
  if (ticksPassed >= max) return 1
  if (currentNavIni != null) {
    const navNum = Number(currentNavIni)
    if (!(navNum === Number.NEGATIVE_INFINITY || Number.isFinite(navNum))) {
      return Math.max(0, Math.min(1, ticksPassed / max))
    }
    const navRaw = navNum
    const remaining = max - ticksPassed
    if (cr === cmt) {
      for (let i = commitOffset + priorCapped; i < effAp && ticksPassed < max; i++) {
        const triggerIni = owner + i * stepN
        if (i > 0 && triggerIni < 0) continue
        if (navRaw <= triggerIni) ticksPassed++
      }
    } else {
      const ticksThisKr = Math.min(effAp, remaining)
      for (let i = 0; i < ticksThisKr; i++) {
        const triggerIni = owner + i * stepN
        if (i > 0 && triggerIni < 0) continue
        if (navRaw <= triggerIni) ticksPassed++
      }
    }
  }
  return Math.max(0, Math.min(1, ticksPassed / max))
}

export function lhDisplayStepFromNav(
  heroIniNum,
  mechanics,
  commitRound,
  currentRound,
  currNavIni,
  lhMax,
  commitIni,
  priorKrSpend = 0
) {
  const max = Math.max(0, Math.floor(Number(lhMax)) || 0)
  if (max <= 0) return 0
  const cr = Math.max(1, Math.floor(Number(currentRound)) || 1)
  const commit = Math.max(1, Math.floor(Number(commitRound)) || 1)
  const ap = Math.max(
    1,
    Math.floor(Number(mechanics?.actionsPerKr)) || DEFAULT_LH_ACTIONS_PER_KR
  )
  const step = Number(mechanics?.triggerIniStep)
  const heroIni = Number(heroIniNum)
  const effAp = effectiveActionsPerKr(heroIni, ap, step)
  const commitRef = lhCommitIniRef(commitIni, heroIni)
  const commitOffset = commitOffsetFromIni(heroIni, ap, step, commitRef)
  const priorCapped = clampPriorKrSpendForCommitKr(priorKrSpend, effAp, commitOffset)
  const ticksInCommitKr = Math.max(0, effAp - commitOffset - priorCapped)

  let positionInCurrentKr = 0
  if (Number.isFinite(heroIni) && Number.isFinite(step) && step !== 0) {
    const roundEndNav = currNavIni === Number.NEGATIVE_INFINITY
    if (cr === commit) {
      for (let k = commitOffset + priorCapped; k < effAp; k++) {
        const T = heroIni + k * step
        if (!Number.isFinite(T) || (k > 0 && T < 0)) continue
        const navN = Number(currNavIni)
        if (
          roundEndNav ||
          (Number.isFinite(navN) && navN <= T)
        ) {
          positionInCurrentKr++
        }
      }
    } else {
      for (let k = 0; k < effAp; k++) {
        const T = heroIni + k * step
        if (!Number.isFinite(T) || (k > 0 && T < 0)) continue
        const navN = Number(currNavIni)
        if (
          roundEndNav ||
          (Number.isFinite(navN) && navN <= T)
        ) {
          positionInCurrentKr++
        }
      }
    }
  }
  let passedPriorKr = 0
  if (cr > commit) {
    passedPriorKr = ticksInCommitKr + Math.max(0, cr - commit - 1) * effAp
    passedPriorKr = Math.min(
      max,
      passedPriorKr +
        implicitLhZaoCommitCarryTicks(ticksInCommitKr, commitRef, heroIni)
    )
  }
  const raw = passedPriorKr + positionInCurrentKr
  return Math.min(max, Math.max(1, raw))
}
