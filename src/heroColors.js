import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem } from './editAccess.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

/** Metadatenschlüssel für die helle Hauptzeilen-Farbe eines Helden. */
export const HERO_BG_COLOR = 'heroBgColor'

/**
 * Zwei Reihen à 16 Tönen: Basis per HSL, danach feste Vorgaben (siehe
 * `applyHeroPaletteManualSwatches`) für viele Felder — weiterhin hell genug für
 * schwarze Listen-Schrift.
 *
 * @returns {[string[], string[]]}
 */
function buildHeroPaletteRows() {
  const row1 = []
  const row2 = []
  /** Vier Helligkeitsstufen im Wechsel — Nachbarn wirken klar verschieden. */
  const l1c = [89, 74, 92, 71]
  const l2c = [79, 91, 76, 86]
  for (let i = 0; i < 16; i++) {
    const h1 = (i * 22.5) % 360
    const h2 = (11.25 + i * 22.5) % 360
    const l1 = l1c[i % 4]
    const l2 = l2c[i % 4]
    /* Sättigung stark geschichtet, Reihe 2 etwas kräftiger als Reihe 1 */
    const s1 = 54 + ((i * 5) % 8) * 3.1
    const s2 = 58 + ((i * 5 + 4) % 8) * 3.1
    row1.push(hslToHex(h1, s1, l1))
    row2.push(hslToHex(h2, s2, l2))
  }
  return [row1, row2]
}

/**
 * Reihe 2: Spektrum links → rechts wie ein Regenbogen (16 Stufen).
 * Drei zusätzliche gelbliche Töne nach dem Basis-Gelb (Honig, Vanille,
 * Cremig-Zitrone); dafür entfallen Indigo, Violett und Magenta.
 *
 * @param {string[]} row2
 */
function applyHeroPaletteRow2Rainbow(row2) {
  /** [H°, S%, L%] — ohne gedämpfte Braun-Orange */
  const spec = [
    [352, 78, 86] /* 1: Rosé-Rot */,
    [18, 76, 86] /* 2: Koralle */,
    [38, 78, 87] /* 3: Orange */,
    [54, 76, 88] /* 4: Bernstein */,
    [72, 74, 88] /* 5: Gelb */,
    [62, 68, 90] /* 6: Honiggelb */,
    [76, 62, 91] /* 7: Vanille / hellgelb */,
    [84, 58, 92] /* 8: Cremig-Zitrone */,
    [92, 72, 86] /* 9: Zitronengrün */,
    [122, 70, 85] /* 10: Grasgrün */,
    [156, 68, 86] /* 11: Mint */,
    [182, 70, 86] /* 12: Türkis */,
    [204, 72, 87] /* 13: Cyan */,
    [226, 74, 88] /* 14: Himmelblau */,
    [248, 72, 87] /* 15: Blau */,
    [332, 76, 86] /* 16: Pink */,
  ]
  for (let i = 0; i < 16; i++) {
    const [h, s, l] = spec[i]
    row2[i] = hslToHex(h, s, l)
  }
}

/**
 * Manuelle Farbvorgaben (oben links = Index 0). Reihe 2 = Regenbogen.
 *
 * @param {string[]} row1
 * @param {string[]} row2
 */
function applyHeroPaletteManualSwatches(row1, row2) {
  /* Reihe 1, Platz 1: Grau */
  row1[0] = '#c4c0b8'
  applyHeroPaletteRow2Rainbow(row2)
}

const _HERO_BASE = buildHeroPaletteRows()
applyHeroPaletteManualSwatches(_HERO_BASE[0], _HERO_BASE[1])
const _HERO_PALETTE_ROWS = _HERO_BASE

/** Erste Reihe (16 × #rrggbb). */
const HERO_PALETTE_ROW1 = _HERO_PALETTE_ROWS[0]
/** Zweite Reihe, gegenüber Reihe 1 versetzt — klar andere Tönung pro Index. */
const HERO_PALETTE_ROW2 = _HERO_PALETTE_ROWS[1]

/** @type {string[]} Alle 32 Voreinstellungen (Zufallswahl). */
const HERO_PALETTE = [...HERO_PALETTE_ROW1, ...HERO_PALETTE_ROW2]

/** @type {string[][]} [Reihe1, Reihe2] für die UI. */
export const HERO_PALETTE_ROWS = _HERO_PALETTE_ROWS

/**
 * Liefert eine neue zufällige Farbe aus der Palette.
 * @returns {string}
 */
export function pickRandomHeroColor() {
  return HERO_PALETTE[Math.floor(Math.random() * HERO_PALETTE.length)]
}

/**
 * Liest die aktuelle Hintergrundfarbe aus dem Tracker-Meta. Liefert null,
 * wenn keine Farbe gesetzt ist.
 * @param {unknown} meta
 * @returns {string | null}
 */
export function readHeroBgColor(meta) {
  const v = meta?.[HERO_BG_COLOR]
  if (typeof v !== 'string') return null
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : null
}

/**
 * Setzt die Hintergrundfarbe für einen Token (nur Besitzer/SL).
 * @param {string} itemId
 * @param {string | null} color  Hex `#rrggbb` oder null zum Löschen.
 */
export async function patchHeroBgColor(itemId, color) {
  const items = await OBR.scene.items.getItems()
  const it = items.find((i) => i.id === itemId)
  if (!it || !canEditSceneItem(it)) return
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[TRACKER_ITEM_META_KEY]
      if (!m) continue
      if (color === null) {
        delete m[HERO_BG_COLOR]
      } else {
        m[HERO_BG_COLOR] = color
      }
    }
  })
}

/** Tracker-Set, damit die Initial-Zuweisung pro Item nur ein Mal versucht
 * wird (vermeidet Endlosschleifen, wenn das Schreiben fehlschlägt). */
const initialAssignmentTried = new Set()

/**
 * Stellt sicher, dass für editierbare Tokens beim ersten Anzeigen eine
 * zufällige helle Hintergrundfarbe gesetzt ist.
 * @param {string} itemId
 * @param {unknown} meta
 */
export function ensureRandomHeroBgColor(itemId, meta) {
  if (!itemId) return
  if (readHeroBgColor(meta)) return
  if (initialAssignmentTried.has(itemId)) return
  initialAssignmentTried.add(itemId)
  void patchHeroBgColor(itemId, pickRandomHeroColor())
}

/**
 * @param {number} h  Hue 0..360
 * @param {number} s  Saturation 0..100
 * @param {number} l  Lightness 0..100
 */
function hslToHex(h, s, l) {
  const sN = s / 100
  const lN = l / 100
  const k = (n) => (n + h / 30) % 12
  const a = sN * Math.min(lN, 1 - lN)
  const f = (n) => {
    const x = lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(255 * x)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
