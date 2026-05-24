import OBR, { buildLabel, buildShape } from '@owlbear-rodeo/sdk'
import { DIST_CLASS_THRESHOLDS, tokenBounds } from './tokenDistance.js'

const RING_ID_PREFIX = 'vierpunkteins/dist-ring/'

/** @type {Record<string, string>} */
const RING_COLORS = {
  H: '#d23a3a',
  N: '#e08a1f',
  S: '#e0c020',
  P: '#3aa84a',
}

/** @param {'c' | 'l'} kind @param {string} code */
function ringId(kind, code) {
  return `${RING_ID_PREFIX}${kind}-${code}`
}

export function ringRadiusPxFromHalfMax(halfMax, dpi, thresholdSchritt) {
  return halfMax + thresholdSchritt * dpi
}

/**
 * Radius in px fuer einen Schwellen-Ring (Außenkante + threshold Schritt).
 * @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 */
export function ringRadiusPx(item, dpi, thresholdSchritt) {
  const b = tokenBounds(item, dpi)
  return ringRadiusPxFromHalfMax(Math.max(b.w, b.h) / 2, dpi, thresholdSchritt)
}

/** @param {{ x: number, y: number }} center @param {number} radius */
export function circleTopLeftForCenter(center, radius) {
  return { x: center.x - radius, y: center.y - radius }
}

/**
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 * @returns {Promise<{ center: { x: number, y: number }, halfMax: number }>}
 */
async function resolveTokenRingAnchor(item, dpi) {
  if (item?.id) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id])
      if (bounds?.center && Number.isFinite(bounds.width) && bounds.width > 0) {
        return {
          center: bounds.center,
          halfMax: Math.max(bounds.width, bounds.height) / 2,
        }
      }
    } catch {
      /* fallback */
    }
  }
  const b = tokenBounds(item, dpi)
  return {
    center: {
      x: b.x + b.w / 2,
      y: b.y + b.h / 2,
    },
    halfMax: Math.max(b.w, b.h) / 2,
  }
}

/**
 * Zeigt H/N/S/P-Distanzkreise am Token (nur lokal fuer den aktuellen Nutzer).
 * @param {{ id?: string, position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 */
export async function showDistanceRingsFor(item, dpi) {
  if (!item || !Number.isFinite(dpi) || dpi <= 0) return
  await hideDistanceRings()
  const { center: c, halfMax } = await resolveTokenRingAnchor(item, dpi)
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const items = []
  for (const { max, code } of DIST_CLASS_THRESHOLDS) {
    const r = ringRadiusPxFromHalfMax(halfMax, dpi, max)
    const color = RING_COLORS[code] ?? '#888888'
    const topLeft = circleTopLeftForCenter(c, r)
    const circle = buildShape()
      .shapeType('CIRCLE')
      .width(r * 2)
      .height(r * 2)
      .position(topLeft)
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
    const label = buildLabel()
      .plainText(code)
      .position({ x: c.x, y: c.y - r })
      .layer('TEXT')
      .locked(true)
      .disableHit(true)
      .zIndex(-999)
      .id(ringId('l', code))
      .build()
    items.push(circle, label)
  }
  await OBR.scene.local.addItems(items)
}

export async function hideDistanceRings() {
  const ids = []
  for (const { code } of DIST_CLASS_THRESHOLDS) {
    ids.push(ringId('c', code), ringId('l', code))
  }
  try {
    await OBR.scene.local.deleteItems(ids)
  } catch {
    /* ignore: local API oder Items evtl. nicht vorhanden */
  }
}
