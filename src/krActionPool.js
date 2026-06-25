// Reine Umwandlungs-Budget-Mathematik (Aktions-/Reaktionspool je KR).
// Schicht über krIniLock (für das INI-Vorzeichen); keine OBR-/Phasen-/ZAO-Deps.
// Aus krCounters.js ausgelagert und dort über das Barrel re-exportiert.
// Die mutierenden Pool-Funktionen (Aufbau von Schilden/Aktionsobjekten) bleiben
// in krCounters, da sie Phasen/ZAO-Slots anfassen.

import { isHeroIniBelowZero } from './krIniLock.js'
import {
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  KR_ACTION_POOL_ABW_REM,
  KR_ACTION_POOL_ANG_REM,
  MAX_HERO_ACTION_POOL_SUM,
  MIN_HERO_ACTION_POOL_SUM,
} from './krMetaKeys.js'

const DEFAULT_HERO_ACTION_POOL_ANG = 1
const DEFAULT_HERO_ACTION_POOL_ABW = 1

/**
 * Rohe ang/abw aus Meta wie vor Einführung von `heroActionPoolMax` (Migration).
 * @param {unknown} meta
 * @returns {{ ang: number, abw: number }}
 */
export function parseLegacyHeroActionPoolAngAbw(meta) {
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
export function readKrActionPoolRemFromStoredOrCfgPair(m) {
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
