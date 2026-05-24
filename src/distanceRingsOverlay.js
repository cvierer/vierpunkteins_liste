import OBR, { buildLabel, buildShape } from '@owlbear-rodeo/sdk'
import { DIST_CLASS_THRESHOLDS, tokenCenter } from './tokenDistance.js'

const RING_ID_PREFIX = 'vierpunkteins/dist-ring/'

/** @type {Record<string, string>} */
const RING_COLORS = {
  H: '#d23a3a',
  N: '#e08a1f',
  S: '#e0c020',
  P: '#3aa84a',
}

/** @type {Record<string, string>} */
export const MOVEMENT_RING_COLORS = {
  m1: '#3d8fd1',
  m2: '#2563eb',
  sp: '#7c3aed',
}

export const MOVEMENT_RING_SPECS = [
  { code: 'm1', label: '1 Akt. Bewegen', mult: 1 },
  { code: 'm2', label: '2 Akt. Bewegen', mult: 2 },
  { code: 'sp', label: 'Sprint', mult: 3 },
]

/** @param {'c' | 'l'} kind @param {string} code */
function ringId(kind, code) {
  return `${RING_ID_PREFIX}${kind}-${code}`
}

/** Radius in px fuer einen Schwellen-Ring (Mittelpunkt + threshold Schritt). */
export function ringRadiusPx(dpi, thresholdSchritt) {
  return thresholdSchritt * dpi
}

/** @param {{ x: number, y: number }} center @param {number} radius */
export function circleTopLeftForCenter(center, radius) {
  return { x: center.x - radius, y: center.y - radius }
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @returns {Promise<{ x: number, y: number }>}
 */
async function resolveTokenRingCenter(item) {
  if (item?.id) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id])
      if (bounds?.center) {
        return bounds.center
      }
    } catch {
      /* fallback */
    }
  }
  return tokenCenter(item)
}

/**
 * @param {string} text
 * @param {string} color
 * @param {{ x: number, y: number }} position
 */
function buildRingLabel(text, color, position, id) {
  return buildLabel()
    .plainText(text)
    .position(position)
    .backgroundColor(color)
    .backgroundOpacity(0.85)
    .layer('TEXT')
    .locked(true)
    .disableHit(true)
    .zIndex(-999)
    .id(id)
    .build()
}

/**
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {{ x: number, y: number }} center
 * @param {number} dpi
 * @param {number} schritt
 * @param {string} code
 * @param {string} labelText
 * @param {string} color
 */
function appendRingPair(items, center, dpi, schritt, code, labelText, color) {
  const r = ringRadiusPx(dpi, schritt)
  const circle = buildShape()
    .shapeType('CIRCLE')
    .width(r * 2)
    .height(r * 2)
    .position(center)
    .strokeColor(color)
    .strokeOpacity(0.85)
    .strokeWidth(2)
    .strokeDash([8, 6])
    .fillColor(color)
    .fillOpacity(0)
    .layer('DRAWING')
    .locked(true)
    .disableHit(true)
    .zIndex(-1000)
    .name(`Distanz ${code}`)
    .id(ringId('c', code))
    .build()
  const label = buildRingLabel(labelText, color, { x: center.x, y: center.y - r }, ringId('l', code))
  items.push(circle, label)
}

/**
 * Zeigt H/N/S/P-Distanzkreise am Token (nur lokal fuer den aktuellen Nutzer).
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @param {number | null | undefined} [gsSchritt]
 */
export async function showDistanceRingsFor(item, dpi, gsSchritt = null) {
  if (!item || !Number.isFinite(dpi) || dpi <= 0) return
  await hideDistanceRings()
  const c = await resolveTokenRingCenter(item)
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const items = []
  for (const { max, code } of DIST_CLASS_THRESHOLDS) {
    appendRingPair(items, c, dpi, max, code, code, RING_COLORS[code] ?? '#888888')
  }
  if (Number.isFinite(gsSchritt) && gsSchritt > 0) {
    for (const { code, label, mult } of MOVEMENT_RING_SPECS) {
      appendRingPair(
        items,
        c,
        dpi,
        gsSchritt * mult,
        code,
        label,
        MOVEMENT_RING_COLORS[code] ?? '#888888'
      )
    }
  }
  await OBR.scene.local.addItems(items)
}

export async function hideDistanceRings() {
  const ids = []
  for (const { code } of DIST_CLASS_THRESHOLDS) {
    ids.push(ringId('c', code), ringId('l', code))
  }
  for (const { code } of MOVEMENT_RING_SPECS) {
    ids.push(ringId('c', code), ringId('l', code))
  }
  try {
    await OBR.scene.local.deleteItems(ids)
  } catch {
    /* ignore: local API oder Items evtl. nicht vorhanden */
  }
}
