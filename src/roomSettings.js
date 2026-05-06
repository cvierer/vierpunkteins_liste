import OBR from '@owlbear-rodeo/sdk'
import { isGmSync } from './editAccess.js'
import { TRACKER_ID } from './participants.js'
import {
  cloneDefaultWappenDefs,
  normalizeWappenDefs,
} from './wappenDefs.js'
import {
  cloneDefaultLeBandDefs,
  normalizeLeBandDefs,
} from './leBandDefs.js'

const ROOM_SETTINGS_KEY = `${TRACKER_ID}/roomSettings`

function initiativeNumeric(iniStr) {
  const n = Number(String(iniStr ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Optionale Hausregel: bei INI **strikt über** 20 / 30 / 40 je eine zusätzliche
 * Freie Aktion (max. 4). INI genau 20/30/40 erhält die jeweils niedrigere Stufe.
 * Ohne Regel: maximal 2 „Klicks“ (Zyklus 0…2).
 */
export function faMaxForInitiative(iniStr, highIniFreeActionsEnabled) {
  if (!highIniFreeActionsEnabled) return 2
  const n = initiativeNumeric(iniStr)
  if (!Number.isFinite(n)) return 2
  let x = 2
  if (n > 20) x++
  if (n > 30) x++
  if (n > 40) x++
  return Math.min(4, x)
}

function defaultSettings() {
  return {
    /** Zusätzliche F.A. bei hoher Initiative (siehe faMaxForInitiative). */
    highIniFreeActions: false,
    /**
     * KR-Einblendung: untersten Token (niedrigste INI in der Liste) hervorheben
     * statt des obersten — für Ansagen in umgekehrter INI-Reihenfolge.
     */
    roundIntroFocusLowestIni: false,
    /**
     * Raum-Standard für „fremde Heldenfarben ausblenden“. Gilt nur, wenn ein
     * Client in den Kampf-Einstellungen keine eigene Wahl gespeichert hat
     * (localStorage); sonst zählt die persönliche Einstellung.
     */
    hideForeignHeroColors: true,
    /**
     * Globaler Schloss-Zustand für die Umwandlungs-Pfeile (nur SL setzbar).
     * - 'open':   Alle Spieler dürfen umwandeln, solange sie Owner sind.
     * - 'auto':   Spieler dürfen am Beginn/Ende der Kampfrunde immer umwandeln;
     *             dazwischen entscheidet die jeweilige Helden-Einstellung
     *             (`convertAllowFirstPhase` / `convertAllowEntireRound`).
     * - 'closed': Spieler dürfen die Umwandlungs-Pfeile nicht mehr nutzen.
     * Die SL ist vom Schloss nicht betroffen.
     */
    convertLockState: 'auto',
    /**
     * Globale Wappen-/Trefferzonen-Definition. Liste mit max 8 Einträgen
     * (siehe `wappenDefs.js`). Kann pro Held über das Tracker-Item-Meta
     * `heroExWappenOverride` überschrieben werden. Wenn nicht gesetzt oder
     * leer, gelten die heute hartkodierten 8 Default-Zonen 1:1.
     */
    wappenDefs: cloneDefaultWappenDefs(),
    /**
     * Globale LE-Band-Definition (Schwellen + Mod-Effekte). Liste max 16
     * Einträge (siehe `leBandDefs.js`). Reihenfolge = Schwere (top zuerst);
     * das erste passende Band gewinnt. Kann pro Held via
     * `heroExLeBandsOverride` überschrieben werden. Default-Set entspricht
     * 1:1 dem alten 1/2/-1/3/-1/4-Schema plus den ≤0/Negativ-KO-Bändern.
     */
    leBandDefs: cloneDefaultLeBandDefs(),
  }
}

const VALID_CONVERT_LOCK_STATES = new Set(['open', 'auto', 'closed'])

export function nextConvertLockState(cur) {
  if (cur === 'open') return 'auto'
  if (cur === 'auto') return 'closed'
  return 'open'
}

function normalize(raw) {
  const d = defaultSettings()
  if (!raw || typeof raw !== 'object') return d
  return {
    ...d,
    highIniFreeActions: Boolean(raw.highIniFreeActions),
    roundIntroFocusLowestIni: Boolean(raw.roundIntroFocusLowestIni),
    hideForeignHeroColors:
      raw.hideForeignHeroColors === undefined
        ? true
        : Boolean(raw.hideForeignHeroColors),
    convertLockState: VALID_CONVERT_LOCK_STATES.has(raw.convertLockState)
      ? raw.convertLockState
      : d.convertLockState,
    wappenDefs: normalizeWappenDefs(raw.wappenDefs),
    leBandDefs: normalizeLeBandDefs(raw.leBandDefs),
  }
}

let cache = defaultSettings()
const listeners = new Set()

function notify() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function getRoomSettings() {
  return cache
}

export function onRoomSettingsChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function pullRoomSettingsFromRoom() {
  const meta = await OBR.room.getMetadata()
  const next = normalize(meta[ROOM_SETTINGS_KEY])
  const same =
    next.highIniFreeActions === cache.highIniFreeActions &&
    next.roundIntroFocusLowestIni === cache.roundIntroFocusLowestIni &&
    next.hideForeignHeroColors === cache.hideForeignHeroColors &&
    next.convertLockState === cache.convertLockState &&
    sameJsonish(next.wappenDefs, cache.wappenDefs) &&
    sameJsonish(next.leBandDefs, cache.leBandDefs)
  if (same) return
  cache = next
  notify()
}

function sameJsonish(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return a === b
  }
}

export async function patchRoomSettings(mutator) {
  if (!isGmSync()) return
  const meta = await OBR.room.getMetadata()
  const cur = normalize(meta[ROOM_SETTINGS_KEY])
  const proposed = mutator({ ...cur })
  const next = normalize(proposed)
  await OBR.room.setMetadata({ [ROOM_SETTINGS_KEY]: next })
  await pullRoomSettingsFromRoom()
}
