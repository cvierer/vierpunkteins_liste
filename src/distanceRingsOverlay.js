import OBR, { buildLabel, buildShape } from '@owlbear-rodeo/sdk'
import { DIST_CLASS_THRESHOLDS, tokenBounds, tokenCenter } from './tokenDistance.js'

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

/**
 * Radius in px fuer einen Schwellen-Ring (Außenkante + threshold Schritt).
 * @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 */
export function ringRadiusPx(item, dpi, thresholdSchritt) {
  const b = tokenBounds(item, dpi)
  return Math.max(b.w, b.h) / 2 + thresholdSchritt * dpi
}

/**
 * Zeigt H/N/S/P-Distanzkreise am Token (nur lokal fuer den aktuellen Nutzer).
 * @param {{ position?: { x?: number, y?: number }, width?: number, height?: number } | null | undefined} item
 */
export async function showDistanceRingsFor(item, dpi) {
  if (!item || !Number.isFinite(dpi) || dpi <= 0) return
  await hideDistanceRings()
  const c = tokenCenter(item)
  /** @type {import('@owlbear-rodeo/sdk').Item[]} */
  const items = []
  for (const { max, code } of DIST_CLASS_THRESHOLDS) {
    const r = ringRadiusPx(item, dpi, max)
    const color = RING_COLORS[code] ?? '#888888'
    const circle = buildShape()
      .shapeType('CIRCLE')
      .width(r * 2)
      .height(r * 2)
      .position({ x: c.x - r, y: c.y - r })
      .strokeColor(color)
      .strokeOpacity(0.85)
      .strokeWidth(2)
      .strokeDash([8, 6])
      .fillColor(color)
      .fillOpacity(0)
      .layer('DRAWING')
      .locked(true)
      .disableHit(true)
      .name(`Distanz ${code}`)
      .id(ringId('c', code))
      .build()
    const label = buildLabel()
      .plainText(code)
      .position({ x: c.x, y: c.y - r })
      .layer('TEXT')
      .locked(true)
      .disableHit(true)
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
