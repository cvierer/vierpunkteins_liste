import { readKrFirstSlotKind, readZaoSlot } from './krCounters.js'
import { normalizePhases } from './phaseLinks.js'
import { deepenHeroColor } from './heroColors.js'

// L.H.-Icon: Sanduhr (kein Stern). Sand nutzt currentColor -> Heldenfarbe via
// applyHeroPrimaryIconColor; Glas/Kappen bleiben neutral. Konstantenname aus
// Kompatibilitaetsgruenden unveraendert (wird in initiativeList.js mehrfach genutzt).
// Geometrie tiefer platziert. Neck/Engstelle bei (12, 17.5); obere Kammer
// y8.5..17.5, untere Kammer y17.5..26.5 (Kammerhoehe je 9, Box 34).
// Ruhezustand (nicht laufende L.H.): NUR die obere Kammer enthaelt Sand
// (currentColor -> Heldenfarbe); untere Kammer leer, kein Rinnsal.
export const SVG_PRIMARY_LH_STAR = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--lh" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#fffdf5" opacity="0.22" d="M6 8.5 H18 L12 17.5 Z M6 26.5 H18 L12 17.5 Z"/><path fill="currentColor" d="M6 8.5 H18 L12 17.5 Z"/><path fill="none" stroke="#5d4037" stroke-width="0.8" stroke-linejoin="round" d="M6 8.5 H18 L12 17.5 L18 26.5 H6 L12 17.5 Z"/><path fill="#b8860b" d="M4.8 7.1 H19.2 V8.5 H4.8 Z M4.8 26.5 H19.2 V27.9 H4.8 Z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M4.8 7.1 H19.2 V8.5 H4.8 Z M4.8 26.5 H19.2 V27.9 H4.8 Z"/></svg>`

// Laufende L.H. (Pie-Zustand): Sanduhr aus drei deckungsgleichen Layern, damit
// der Sand per CSS-Maske (--lh-pie-frac) von oben nach unten rieseln kann.
// FRAME = neutrales Glas + Kappen (kein currentColor, keine kind__svg-Klasse).
export const SVG_LH_FRAME = `<svg class="init-kr-primary-lh-hg__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#fffdf5" opacity="0.22" d="M6 8.5 H18 L12 17.5 Z M6 26.5 H18 L12 17.5 Z"/><path fill="none" stroke="#5d4037" stroke-width="0.8" stroke-linejoin="round" d="M6 8.5 H18 L12 17.5 L18 26.5 H6 L12 17.5 Z"/><path fill="#b8860b" d="M4.8 7.1 H19.2 V8.5 H4.8 Z M4.8 26.5 H19.2 V27.9 H4.8 Z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M4.8 7.1 H19.2 V8.5 H4.8 Z M4.8 26.5 H19.2 V27.9 H4.8 Z"/></svg>`

// Obere Kammer-Sand (Heldenfarbe via currentColor); CSS-Maske zeigt die untere
// (1 - frac)-Portion (Sand sammelt sich an der Engstelle, Oberflaeche sinkt).
export const SVG_LH_SAND_TOP = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--lh" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="currentColor" d="M6 8.5 H18 L12 17.5 Z"/></svg>`

// Untere Kammer-Sand; CSS-Maske zeigt die untere frac-Portion (fuellt vom Boden).
export const SVG_LH_SAND_BOTTOM = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--lh" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="currentColor" d="M6 26.5 H18 L12 17.5 Z"/></svg>`

// Duenner rieselnder Sandstrahl an der Engstelle (Heldenfarbe via currentColor).
export const SVG_LH_STREAM = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--lh" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><rect x="11.7" y="17.5" width="0.6" height="8" fill="currentColor"/></svg>`

export const SVG_PRIMARY_ATTACK = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--ang" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><ellipse cx="12" cy="30.6" rx="2.5" ry="2.3" fill="#5d4037"/><circle cx="12" cy="30.6" r="1.85" fill="#b8860b"/><circle cx="12" cy="30.6" r="0.85" fill="#7e1010"/><path fill="#3e2723" d="M10.4 22.4 H13.6 V29.8 H10.4 Z"/><path fill="#5d4037" d="M10.55 22.6 H13.45 V23.5 H10.55 Z M10.55 24.4 H13.45 V25.3 H10.55 Z M10.55 26.2 H13.45 V27.1 H10.55 Z M10.55 28.0 H13.45 V28.9 H10.55 Z"/><path fill="#4f4643" d="M3.4 18.9 H20.6 L18.6 22.4 H5.4 Z"/><path fill="#6d615d" d="M4.2 19.3 H19.8 L18.0 22.0 H6.0 Z"/><ellipse cx="12" cy="20.7" rx="1.7" ry="1.0" fill="#584e4a"/><path fill="currentColor" opacity="0.62" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 Z"/><path fill="currentColor" opacity="0.82" d="M10.2 18.5 L11.6 2.5 L12.4 2.5 L13.8 18.5 Z"/><path fill="currentColor" d="M10.65 18.3 L11.7 3.4 L12.3 3.4 L13.35 18.3 Z"/><path fill="#ffffff" opacity="0.16" d="M11.85 4 L12.15 4 L12.0 17.6 Z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 H20.6 L18.6 22.4 H13.6 V29.8 A1.6 1.6 0 1 1 10.4 29.8 V22.4 H5.4 L3.4 18.9 Z"/></svg>`

export const SVG_PRIMARY_ACTION = `<svg class="init-kr-primary-kind__svg init-kr-primary-kind__svg--sra" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#5d4037" d="M12 5l3.35 6.95 7.55.55-5.75 4.95 1.8 7.4L12 21.05 5.05 24.85l1.8-7.4L1.1 12.5l7.55-.55z"/><path fill="currentColor" opacity="0.55" d="M12 6.45 14.85 12.4l6.55.5-4.95 4.25 1.55 6.45L12 20.2 5.95 23.6l1.55-6.45L2.6 12.9l6.55-.5z"/><path fill="currentColor" opacity="0.8" d="M12 8 14.45 13l5.65.45-4.3 3.7 1.35 5.55L12 19.5l-5.15 3.2 1.35-5.55-4.3-3.7 5.65-.45z"/><path fill="currentColor" d="M12 9.65 13.95 13.7l4.6.35-3.55 3.05 1.1 4.55L12 19l-4.1 2.6 1.1-4.55-3.55-3.05 4.6-.35z"/><circle cx="12" cy="14.95" r="1.55" fill="#ff8f00"/><circle cx="12" cy="14.95" r="0.85" fill="#fffde7"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M12 5l3.35 6.95 7.55.55-5.75 4.95 1.8 7.4L12 21.05 5.05 24.85l1.8-7.4L1.1 12.5l7.55-.55z"/></svg>`

// Leere Aktion (UO): grauer, gestrichelter Kreis. Verdeutlicht, dass die Phase
// keine gestempelte Aktion traegt, aber als Schild-Quelle (Abwehr) zaehlt.
export const SVG_PRIMARY_UO_DASHED = `<svg class="init-kr-primary-kind__svg--uo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" fill="none" aria-hidden="true"><circle cx="12" cy="17" r="8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3"/></svg>`

export const SVG_ABW_SHIELD = `<svg class="init-kr-abw-shield__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#5d4037" d="M12 2l8 3v8.4c0 6.9-3.2 13-8 15.8-4.8-2.8-8-8.9-8-15.8V5l8-3z"/><path fill="currentColor" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/><path fill="#ffffff" opacity="0.10" d="M12 5.55 7.15 7.25v6.45c0 4.2 1.85 8.1 4.85 10.2 3-2.1 4.85-6 4.85-10.2V7.25L12 5.55z"/><path fill="#b8860b" d="M12 2.75 19.05 4.85 18.85 5.45 12 3.75 5.15 5.45 4.95 4.85 12 2.75z"/><path fill="#ffffff" opacity="0.26" d="M8.65 9.1c1.05 2.5 1.55 5.15 1.55 7.95 0 3.45-.75 6.75-2.1 9.75 1.85-1.7 3.05-4.55 3.05-7.75 0-3.25-.85-6.3-2.5-8.95z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/></svg>`

const SVG_UO_INNER = `<svg class="init-kr-abw-shield__svg init-kr-abw-shield__svg--uo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#5d4037" d="M12 2l8 3v8.4c0 6.9-3.2 13-8 15.8-4.8-2.8-8-8.9-8-15.8V5l8-3z"/><path fill="#1a237e" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/><path fill="#3949ab" d="M12 5.55 7.15 7.25v6.45c0 4.2 1.85 8.1 4.85 10.2 3-2.1 4.85-6 4.85-10.2V7.25L12 5.55z"/><path fill="#b8860b" d="M12 2.75 19.05 4.85 18.85 5.45 12 3.75 5.15 5.45 4.95 4.85 12 2.75z"/><path fill="#90caf9" opacity="0.4" d="M8.65 9.1c1.05 2.5 1.55 5.15 1.55 7.95 0 3.45-.75 6.75-2.1 9.75 1.85-1.7 3.05-4.55 3.05-7.75 0-3.25-.85-6.3-2.5-8.95z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/><path class="init-kr-uo-convert-arrow" fill="#fff" stroke="#1a237e" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round" d="M13.2 17h6.1M17.8 17l-2.6-2.6M17.8 17l-2.6 2.6"/></svg>`

export const SVG_UO_CONVERT_SHIELD = `<span class="init-kr-uo-convert-icon" aria-hidden="true">${SVG_UO_INNER}</span>`

export const SVG_ABW_SHIELD_DARK = `<svg class="init-kr-abw-shield__svg init-kr-abw-shield__svg--parade" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true"><path fill="#3e2723" d="M12 2l8 3v8.4c0 6.9-3.2 13-8 15.8-4.8-2.8-8-8.9-8-15.8V5l8-3z"/><path fill="#0d1117" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/><path fill="#263238" d="M12 5.55 7.15 7.25v6.45c0 4.2 1.85 8.1 4.85 10.2 3-2.1 4.85-6 4.85-10.2V7.25L12 5.55z"/><path fill="#6d4c41" d="M12 2.75 19.05 4.85 18.85 5.45 12 3.75 5.15 5.45 4.95 4.85 12 2.75z"/><path fill="#78909c" opacity="0.35" d="M8.65 9.1c1.05 2.5 1.55 5.15 1.55 7.95 0 3.45-.75 6.75-2.1 9.75 1.85-1.7 3.05-4.55 3.05-7.75 0-3.25-.85-6.3-2.5-8.95z"/><path fill="none" stroke="#212121" stroke-width="0.45" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/></svg>`

/** @type {Record<string, string>} */
export const KIND_LABEL = Object.freeze({
  ang: 'Angriff',
  sra: 'S.R.A.',
  lh: 'L.H.',
  uo: 'Umwandel-Obj.',
  par: 'Abwehr',
})

/**
 * @param {unknown} combat
 */
export function combatOverlayKey(combat) {
  if (!combat) return ''
  return `${combat.currentItemId ?? ''}\0${combat.currentPhaseLinkId ?? ''}\0${combat.currentTurnSubStep ?? ''}`
}

/**
 * @param {unknown} meta
 * @param {string | null | undefined} phaseLinkId
 * @returns {'ang' | 'sra' | 'lh' | 'uo' | 'par' | null}
 */
export function resolvePrimaryKindForNav(meta, phaseLinkId) {
  if (!meta || typeof meta !== 'object') return null
  if (!phaseLinkId) {
    const k = readKrFirstSlotKind(meta)
    if (k === 'ang' || k === 'sra' || k === 'lh' || k === 'uo') return k
    return 'ang'
  }
  const phases = normalizePhases(meta.phases)
  const link = phases.links.find((l) => l.id === phaseLinkId)
  if (!link) return null
  if (link.heroExtra === 'ang') return 'ang'
  const slot = readZaoSlot(meta, phaseLinkId)
  const kind = slot?.kind ?? 'ang'
  if (kind === 'ang' || kind === 'sra' || kind === 'lh' || kind === 'uo') return kind
  if (kind === 'par') return 'par'
  return 'ang'
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par' | string} kind
 */
export function primaryKindSvgMarkup(kind) {
  if (kind === 'sra') return SVG_PRIMARY_ACTION
  if (kind === 'lh') return SVG_PRIMARY_LH_STAR
  if (kind === 'uo') return SVG_UO_INNER
  if (kind === 'par') return SVG_ABW_SHIELD_DARK
  return SVG_PRIMARY_ATTACK
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par' | string} kind
 */
export function primaryKindSvgDataUrl(kind) {
  const svg = primaryKindSvgMarkup(kind)
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Angriff: Dolch-Emoji (U+1F5E1); L.H.: Sanduhr (U+231B) statt Stern. */
const KIND_MAP_SYMBOL = Object.freeze({
  ang: '\u{1F5E1}',
  sra: '\u2605',
  lh: '\u231B',
  uo: '\u25CC',
  par: '\u26e8',
})

/** @type {Record<string, number>} */
const KIND_MAP_FONT_WEIGHT = Object.freeze({
  ang: 500,
})

/** @type {Record<string, number>} */
const KIND_MAP_FONT_SIZE = Object.freeze({
  ang: 22,
})

const DEFAULT_MAP_FONT_WEIGHT = 700
const DEFAULT_MAP_FONT_SIZE = 26

/** @type {Record<string, { fillColor: string, backgroundColor: string, backgroundOpacity: number }>} */
const KIND_MAP_STYLE = Object.freeze({
  ang: { fillColor: '#ffffff', backgroundColor: '#6d0718', backgroundOpacity: 0.9 },
  sra: { fillColor: '#fffde7', backgroundColor: '#ef6c00', backgroundOpacity: 0.9 },
  lh: { fillColor: '#fffde7', backgroundColor: '#1f6b4a', backgroundOpacity: 0.9 },
  uo: { fillColor: '#ffffff', backgroundColor: '#616161', backgroundOpacity: 0.9 },
  par: { fillColor: '#e0e0e0', backgroundColor: '#263238', backgroundOpacity: 0.9 },
})

/**
 * Unicode-Symbol für Map-Badge (OBR buildLabel, kein Bild).
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par' | string} kind
 */
export function primaryKindMapSymbol(kind) {
  return KIND_MAP_SYMBOL[kind] ?? KIND_MAP_SYMBOL.ang
}

/**
 * Map-Badge-Style. Mit gueltiger Heldenfarbe wird der Hintergrund in der
 * vertieften Heldenfarbe gezeichnet (helles Symbol bleibt lesbar), passend zur
 * Liste; ohne Heldenfarbe gilt die Aktionstyp-Fallbackfarbe.
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par' | string} kind
 * @param {string | null} [heroColor]
 * @returns {{ fillColor: string, backgroundColor: string, backgroundOpacity: number }}
 */
export function primaryKindMapStyle(kind, heroColor) {
  const base = KIND_MAP_STYLE[kind] ?? KIND_MAP_STYLE.ang
  if (heroColor) {
    const bg = deepenHeroColor(heroColor)
    if (bg) return { ...base, backgroundColor: bg }
  }
  return base
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par' | string} kind
 */
export function primaryKindMapFontWeight(kind) {
  return KIND_MAP_FONT_WEIGHT[kind] ?? DEFAULT_MAP_FONT_WEIGHT
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par' | string} kind
 */
export function primaryKindMapFontSize(kind) {
  return KIND_MAP_FONT_SIZE[kind] ?? DEFAULT_MAP_FONT_SIZE
}

/**
 * @param {'ang' | 'sra' | 'lh' | 'uo' | 'par' | string | null | undefined} kind
 */
export function shouldShowTurnActionMapBadge(kind) {
  return (
    kind === 'ang' ||
    kind === 'sra' ||
    kind === 'lh' ||
    kind === 'uo' ||
    kind === 'par'
  )
}
