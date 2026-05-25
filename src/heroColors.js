import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem } from './editAccess.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

/** Metadatenschlüssel für die Heldenfarbe (Name, INI-Rahmen, Karte). */
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
