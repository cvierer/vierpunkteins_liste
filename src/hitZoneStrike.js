/**
 * Trefferzonen-Treffer aus SP (Schadenspunkte) + TZ (Zone): vereinfachte,
 * im Code dokumentierte Auswertung.
 *
 * Umsetzung (anpassbar über Konstanten unten):
 * 1) SP als ganze Zahl; TZ als Zonen-Kürzel (KF, BR, …) → Zonen-id.
 * 2) RS der Zone (aus Heldenblock) von SP abziehen → Restschaden (≥ 0).
 * 3) Restschaden von LE abziehen (wenn LE numerisch).
 * 4) Bei Restschaden > 0: Zonenwunde +1 (max. 4, clampWound).
 * 5) AT/PA/AW/FK/…-Abzüge aus Wunden und LE-Schwelle: Auto-Mods (heroExMods), nicht Basis-Meta.
 */

import { zoneStageFromWounds } from './heroBlockAutoMod.js'
import {
  leAtPaMalusForBand,
  leBand,
  leTalentZauberErschwernis,
} from './heroAutoMods.js'
import { clampWound, HIT_ZONE_DEFS } from './hitZoneMeta.js'
import { cloneDefaultWappenDefs } from './wappenDefs.js'

const MAX_ZONE_WOUNDS = 4

/** @param {string} raw */
function parseNonNegInt(raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** @param {string} raw */
function parseIntAllowSigned(raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  if (!Number.isFinite(n)) return null
  return n
}

/**
 * @param {number | null} v
 * @param {number} d
 */
function numOr(v, d) {
  return v === null ? d : v
}

/**
 * Führende Zahl aus Strings wie "7", "7+2", "7 (Eisern)".
 * @param {string} raw
 */
function parseLeadingInt(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const m = t.match(/^-?\d+/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string} zoneId
 * @param {0|1|2|3} stage
 * @param {string[]} logLines
 */
function logZoneStageEffects(zoneId, stage, logLines) {
  if (stage <= 0) return
  if (zoneId === 'kopf') {
    if (stage <= 2) {
      logLines.push(`KF W${stage}: MU/KL/IN/IB −2 (auto-Mod); INI −2W6`)
    } else {
      logLines.push('KF W3: +2W6 SP, Bewusstlos, Blut (manuell)')
    }
    return
  }
  if (zoneId === 'brust' || zoneId === 'ruecken') {
    const zn = zoneId === 'ruecken' ? 'Rücken' : 'Brust'
    if (stage <= 2) {
      logLines.push(
        `${zn} W${stage}: AT/PA/KO/KK/AW −1 (auto-Mod); +1W6 SP`
      )
    } else {
      logLines.push(`${zn} W3: Bewusstlos, Blut`)
    }
    return
  }
  if (zoneId === 'schildarm' || zoneId === 'schwertarm') {
    if (stage <= 2) {
      logLines.push(`Arm W${stage}: AT/PA/KK/FF −2 (auto-Mod)`)
    } else {
      logLines.push('Arm W3: Arm aus')
    }
    return
  }
  if (zoneId === 'bauch') {
    if (stage <= 2) {
      logLines.push(
        `Bauch W${stage}: AT/PA/KO/KK/GS/IB/AW −1 (auto-Mod); +1W6 SP`
      )
    } else {
      logLines.push('Bauch W3: Bewusstlos, Blut')
    }
    return
  }
  if (zoneId === 'lbein' || zoneId === 'rbein') {
    if (stage <= 2) {
      logLines.push(
        `Bein W${stage}: AT/PA/GE/IB/AW −2, GS −1 (auto-Mod)`
      )
    } else {
      logLines.push('Bein W3: Sturz, kampfunfähig')
    }
  }
}

/** Standard-Aliase für die Default-Trefferzonen-Codes (KF/BR/…). */
const DEFAULT_TZ_ALIASES = new Map([
  ['kf', 'kopf'],
  ['kopf', 'kopf'],
  ['kop', 'kopf'],
  ['br', 'brust'],
  ['brust', 'brust'],
  ['rü', 'ruecken'],
  ['ruecken', 'ruecken'],
  ['rücken', 'ruecken'],
  ['rucken', 'ruecken'],
  ['la', 'schildarm'],
  ['schildarm', 'schildarm'],
  ['s-arm', 'schildarm'],
  ['ra', 'schwertarm'],
  ['schwertarm', 'schwertarm'],
  ['sw-arm', 'schwertarm'],
  ['ba', 'bauch'],
  ['bauch', 'bauch'],
  ['lb', 'lbein'],
  ['lbein', 'lbein'],
  ['l-bein', 'lbein'],
  ['rb', 'rbein'],
  ['rbein', 'rbein'],
  ['r-bein', 'rbein'],
  ['linkesbein', 'lbein'],
  ['rechtesbein', 'rbein'],
])

/**
 * @param {Array<{ id: string }> | null | undefined} wappenDefs
 */
function resolveWappenList(wappenDefs) {
  if (Array.isArray(wappenDefs) && wappenDefs.length > 0) return wappenDefs
  return cloneDefaultWappenDefs()
}

/**
 * Sucht das aktive Wappen, dessen W20-Range den Wert `n` einschließt.
 * Berücksichtigt parity (odd/even/all). Liefert null, wenn keiner passt.
 *
 * @param {Array<{ id: string, active?: boolean, w20Range?: any }>} list
 * @param {number} n
 */
function findWappenByW20(list, n) {
  for (const def of list) {
    if (def.active === false) continue
    const r = def.w20Range
    if (!r) continue
    if (n < r.from || n > r.to) continue
    if (r.parity === 'odd' && n % 2 === 0) continue
    if (r.parity === 'even' && n % 2 === 1) continue
    return def
  }
  return null
}

/**
 * TZ-Freitext (Kürzel oder W20-Zahl) → Zonen-id.
 *
 * @param {string} tzRaw
 * @param {{ frontal?: boolean, wappenDefs?: Array<{ id: string }> }} [opts]
 */
export function resolveTrefferZoneId(tzRaw, opts = {}) {
  const frontal = opts?.frontal !== false
  const key = String(tzRaw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  if (!key) return null

  const list = resolveWappenList(opts?.wappenDefs)

  const applyFrontalSplit = (def) => {
    if (!def) return null
    const split = def.w20Range?.frontalSplit
    if (split && !frontal) return split
    return def.id
  }

  const w20 = Number(key)
  if (Number.isInteger(w20) && w20 >= 1 && w20 <= 20) {
    const def = findWappenByW20(list, w20)
    if (def) return applyFrontalSplit(def)
    return null
  }

  // Wappen-Aliase: Default-Aliasmap + abbr/label/id der konfigurierten Wappen.
  const aliases = new Map(DEFAULT_TZ_ALIASES)
  for (const def of list) {
    if (!def?.id) continue
    const id = String(def.id).toLowerCase()
    aliases.set(id, def.id)
    if (def.abbr) aliases.set(String(def.abbr).toLowerCase(), def.id)
    if (def.label) aliases.set(String(def.label).toLowerCase(), def.id)
  }

  const aliased = aliases.get(key)
  if (aliased) {
    const def = list.find((z) => z.id === aliased) ?? null
    return def ? applyFrontalSplit(def) : aliased
  }

  const direct = list.find((z) => z.id === key)
  if (direct) return applyFrontalSplit(direct)
  return null
}

/**
 * @param {Record<string, unknown>} base — wie `gather()` Rückgabe
 * @returns {{ next: Record<string, unknown>, logLines: string[], flashKeys: string[] } | null}
 */
export function applyHitZoneStrikeFromSpTz(base) {
  const tp = parseNonNegInt(base.sp)
  if (tp === null) return null

  const wappenDefs = resolveWappenList(base.wappenDefs)
  const zoneId = resolveTrefferZoneId(base.tz, {
    frontal: base.frontal !== false,
    wappenDefs,
  })
  if (!zoneId) return null

  const def = wappenDefs.find((z) => z.id === zoneId)
  const legacyDef = HIT_ZONE_DEFS.find((z) => z.id === zoneId)
  const zoneLabel =
    String(def?.label || '').trim() ||
    legacyDef?.short ||
    zoneId

  /** @type {Record<string, { rs: string, w: number }>} */
  const zones = {}
  for (const z of wappenDefs) {
    const s = base.hitZones?.zones?.[z.id] ?? { rs: '', w: 0 }
    zones[z.id] = {
      rs: String(s.rs ?? ''),
      w: clampWound(s.w ?? 0),
    }
  }

  const zSnap = zones[zoneId]
  const rs = parseNonNegInt(zSnap.rs) ?? 0
  const wOld = clampWound(zSnap.w ?? 0)

  const rest = Math.max(0, tp - rs)

  const logLines = []
  logLines.push(`Treffer ${zoneLabel}: TP${tp} RS${rs}→SP${rest}`)

  /** @type {Record<string, unknown>} */
  const next = { ...base, hitZones: { ...base.hitZones, zones: { ...zones } } }

  /** @type {string[]} */
  const flashKeys = []

  const leNum = parseIntAllowSigned(base.le)
  const leMaxNum = parseNonNegInt(base.leMax)
  if (leNum !== null && rest > 0) {
    const leNew = leNum - rest
    next.le = String(leNew)
    if (leNew < leNum) flashKeys.push('le')
    logLines.push(`LE: ${leNum} − ${rest} = ${leNew}`)
  } else if (rest > 0) {
    logLines.push('LE: — (kein Zahlenwert)')
  } else {
    logLines.push('LE: unverändert (SP 0)')
  }

  let wNew = wOld
  let newWoundsFromHit = 0
  if (rest > 0) {
    const wsRaw = parseLeadingInt(base.ws)
    const koRaw = parseLeadingInt(base.ko)
    const ko = numOr(koRaw, 0)
    // KO-Abzuege sollen keine Folgekaskade auf Trefferzonen- und Ableitungslogik erzeugen:
    // wenn WS nicht gesetzt ist, nutzen wir einen neutralen Fallback statt KO/2.
    const ws = numOr(wsRaw, 1)
    let woundCount = 0
    if (rest > ws) woundCount = 1
    if (ko > 0 && rest > ko) woundCount = 2
    if (ko > 0 && rest > 1.5 * ko) woundCount = 3
    newWoundsFromHit = woundCount
    wNew = clampWound(Math.min(MAX_ZONE_WOUNDS, wOld + woundCount))
    zones[zoneId] = { ...zSnap, w: wNew }
    next.hitZones = { ...next.hitZones, zones: { ...zones } }
    logLines.push(
      `Wundcheck SP${rest}: WS=${wsRaw !== null ? ws : `${ws}?`} KO=${ko > 0 ? ko : '—'} → +${woundCount} W`
    )
    logLines.push(
      `${zoneLabel} Wunden: ${wOld}→${wNew}` +
        (wNew > wOld ? ` (+${wNew - wOld})` : '')
    )
  } else {
    logLines.push(`Zone ${zoneLabel}: Wunden unverändert (${wOld})`)
  }

  const wDelta = wNew - wOld
  if (wDelta > 0) {
    flashKeys.push(`hzw:${zoneId}`)
    const zoneWBefore = zoneStageFromWounds(wOld)
    const zoneWAfter = zoneStageFromWounds(wNew)
    for (let s = zoneWBefore + 1; s <= zoneWAfter; s++) {
      logZoneStageEffects(zoneId, /** @type {0|1|2|3} */ (s), logLines)
    }
    logLines.push(`FK: −${2 * wDelta} (${wDelta}× Marke) (auto-Mod)`)
    logLines.push('Kampfwerte: über Auto-Mods; Basisfelder unverändert.')
    if (newWoundsFromHit <= 0) {
      logLines.push('Hinweis: keine neue Wunde (WS/KO).')
    }
  }

  if (leNum !== null && leMaxNum !== null && leMaxNum > 0) {
    const before = leBand(leNum, leMaxNum)
    const leAfterNum = parseIntAllowSigned(next.le) ?? leNum
    const after = leBand(leAfterNum, leMaxNum)
    const malusBefore = leAtPaMalusForBand(before)
    const malusAfter = leAtPaMalusForBand(after)
    const delta = malusAfter - malusBefore
    if (delta > 0) {
      logLines.push(
        `LE-Schwelle: AT/PA/AW/FK je +${delta} Erschwernis (auto-Mod)`
      )
    }
    if (after >= 0) {
      logLines.push(
        `LE-Band: <${after >= 2 ? '1/4' : after === 1 ? '1/3' : '1/2'} max · Malus AT/PA/AW/FK ${leAtPaMalusForBand(
          after
        )}, Ta/Za ${leTalentZauberErschwernis(after)}`
      )
    } else {
      logLines.push('LE-Band: keine Malus-Schwelle')
    }
  }

  const leNow = parseIntAllowSigned(next.le)
  const koNow = parseLeadingInt(next.ko)
  if (leNow !== null) {
    if (leNow <= 5 && leNow >= 1) {
      logLines.push('LE≤5: kampfunfähig')
    } else if (leNow <= 0) {
      logLines.push(`LE ≤0: Tod in 1W6×KO KR (${koNow ?? 'KO?'})`)
      if (koNow !== null && leNow < -koNow) {
        logLines.push('LE < −KO: tot')
      }
    }
  }

  return { next, logLines, flashKeys }
}
