import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem } from './editAccess.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

/** Metadatenschlüssel für die Heldenfarbe (Name, Karte). */
export const HERO_BG_COLOR = 'heroBgColor'

/** Feste Helden-Palette (11 Voreinstellungen). */
const HERO_PALETTE = [
  '#ef4444',
  '#f97316',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#57534e',
  '#1e293b',
]

/** @type {string[][]} Eine Reihe für die Farbauswahl in den Einstellungen. */
export const HERO_PALETTE_ROWS = [HERO_PALETTE]

/**
 * Liefert eine neue zufällige Farbe aus der Palette.
 * @returns {string}
 */
export function pickRandomHeroColor() {
  return HERO_PALETTE[Math.floor(Math.random() * HERO_PALETTE.length)]
}

/**
 * Liest die Heldenfarbe aus dem Tracker-Meta. Liefert null, wenn keine Farbe
 * gesetzt ist.
 * @param {unknown} meta
 * @returns {string | null}
 */
export function readHeroBgColor(meta) {
  const v = meta?.[HERO_BG_COLOR]
  if (typeof v !== 'string') return null
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : null
}

/**
 * Liefert eine kraeftigere (gesaettigtere) und dunklere Variante einer Hex-Farbe
 * fuer Icons (Schwert, Schild, Freie Aktion). Der Heldenname bleibt bei der
 * Rohfarbe. Ungueltige/leere Eingaben werden unveraendert zurueckgegeben.
 * @param {string | null | undefined} hex `#rrggbb`
 * @returns {string | null | undefined}
 */
export function deepenHeroColor(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s2 = Math.max(0, Math.min(1, s * 1.18))
  const l2 = Math.max(0, Math.min(1, l * 0.8))
  const c = (1 - Math.abs(2 * l2 - 1)) * s2
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l2 - c / 2
  let rr = 0
  let gg = 0
  let bb = 0
  if (h < 60) [rr, gg, bb] = [c, x, 0]
  else if (h < 120) [rr, gg, bb] = [x, c, 0]
  else if (h < 180) [rr, gg, bb] = [0, c, x]
  else if (h < 240) [rr, gg, bb] = [0, x, c]
  else if (h < 300) [rr, gg, bb] = [x, 0, c]
  else [rr, gg, bb] = [c, 0, x]
  const toHex = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`
}

/**
 * Setzt die Heldenfarbe für einen Token (nur Besitzer/SL).
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
 * zufällige Heldenfarbe gesetzt ist.
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
