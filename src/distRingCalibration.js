import OBR from '@owlbear-rodeo/sdk'
import { normalizeGridDistanceRaw } from './gridDistance.js'

/**
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {import('./gridDistance.js').GridMeasurement} measurement
 * @param {number} dpi
 */
export async function measureGridSchrittAt(from, to, measurement, dpi) {
  const raw = await OBR.scene.grid.getDistance(from, to)
  return normalizeGridDistanceRaw(raw, measurement, dpi)
}

/**
 * Prüft: alle Ring-Eckpunkte liegen innerhalb der Schritt-Schwelle (Owlbear-Maßband).
 * @param {{ x: number, y: number }} center
 * @param {{ x: number, y: number }[]} verts
 * @param {number} schritt
 * @param {import('./gridDistance.js').GridMeasurement} measurement
 * @param {number} dpi
 * @param {number} [epsilon]
 */
export async function verifyRingVerticesWithinSchritt(
  center,
  verts,
  schritt,
  measurement,
  dpi,
  epsilon = 0.02
) {
  for (const v of verts) {
    const d = await measureGridSchrittAt(center, v, measurement, dpi)
    if (!Number.isFinite(d) || d > schritt + epsilon) {
      return { ok: false, vertex: v, distance: d }
    }
  }
  return { ok: true }
}

/**
 * Eck-/Randpunkte aus Ring-Outline-Items (Linien-Polygon oder Kreis/Rechteck-Fallback).
 * @param {import('@owlbear-rodeo/sdk').Item[]} items
 * @param {{ x: number, y: number }} center
 * @param {number} schritt
 * @param {number} dpi
 * @param {import('./gridDistance.js').GridContext} gridContext
 * @returns {{ x: number, y: number }[]}
 */
export function extractRingBoundaryVertices(items, center, schritt, dpi, gridContext) {
  /** @type {{ x: number, y: number }[]} */
  const verts = []
  for (const it of items) {
    if (it?.startPosition) verts.push(it.startPosition)
    if (it?.endPosition) verts.push(it.endPosition)
  }
  if (verts.length > 0) return verts

  const r = schritt * dpi
  const { measurement } = gridContext
  if (measurement === 'EUCLIDEAN') {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8
      verts.push({
        x: center.x + Math.sin(a) * r,
        y: center.y - Math.cos(a) * r,
      })
    }
    return verts
  }
  verts.push(
    { x: center.x, y: center.y - r },
    { x: center.x + r, y: center.y },
    { x: center.x, y: center.y + r },
    { x: center.x - r, y: center.y }
  )
  return verts
}

/**
 * Vitest: getDistance-Mock in Schritt-Einheiten (dpi=100 → 100px = 1 Schritt).
 * @param {import('./gridDistance.js').GridMeasurement} measurement
 * @param {number} [dpi]
 */
export function schrittDistanceMockImpl(measurement, dpi = 100) {
  return async (from, to) => {
    const dx = Math.abs(to.x - from.x)
    const dy = Math.abs(to.y - from.y)
    if (measurement === 'MANHATTAN') return (dx + dy) / dpi
    if (measurement === 'EUCLIDEAN') return Math.hypot(dx, dy) / dpi
    return Math.max(dx, dy) / dpi
  }
}
