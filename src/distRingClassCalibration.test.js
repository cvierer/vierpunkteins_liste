import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DIST_CLASS_RING_CODES,
  DIST_CLASS_RING_RADIUS,
} from './tokenDistance.js'

const { gridApi, itemsApi, lineBuildCount } = vi.hoisted(() => ({
  gridApi: {
    snapPosition: vi.fn(async (pos) => ({ x: pos.x, y: pos.y })),
    getDistance: vi.fn(),
  },
  itemsApi: {
    getItemBounds: vi.fn(async () => ({ center: { x: 200, y: 200 } })),
  },
  lineBuildCount: { value: 0 },
}))

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      grid: gridApi,
      items: itemsApi,
      local: {
        addItems: vi.fn(),
        deleteItems: vi.fn(),
        updateItems: vi.fn(),
      },
    },
  },
  buildLabel: vi.fn(() => ({
    plainText: vi.fn().mockReturnThis(),
    position: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    backgroundColor: vi.fn().mockReturnThis(),
    backgroundOpacity: vi.fn().mockReturnThis(),
    layer: vi.fn().mockReturnThis(),
    locked: vi.fn().mockReturnThis(),
    disableHit: vi.fn().mockReturnThis(),
    zIndex: vi.fn().mockReturnThis(),
    id: vi.fn().mockReturnThis(),
    build: vi.fn(() => ({})),
  })),
  buildLine: vi.fn(() => {
    /** @type {{ start?: { x: number, y: number }, end?: { x: number, y: number } }} */
    const state = {}
    const chain = {
      id: vi.fn().mockReturnThis(),
      startPosition: vi.fn((p) => {
        state.start = p
        return chain
      }),
      endPosition: vi.fn((p) => {
        state.end = p
        return chain
      }),
      strokeColor: vi.fn().mockReturnThis(),
      strokeOpacity: vi.fn().mockReturnThis(),
      strokeWidth: vi.fn().mockReturnThis(),
      strokeDash: vi.fn().mockReturnThis(),
      layer: vi.fn().mockReturnThis(),
      locked: vi.fn().mockReturnThis(),
      disableHit: vi.fn().mockReturnThis(),
      zIndex: vi.fn().mockReturnThis(),
      name: vi.fn().mockReturnThis(),
      build: vi.fn(() => {
        lineBuildCount.value += 1
        return {
          type: 'LINE',
          startPosition: state.start,
          endPosition: state.end,
        }
      }),
    }
    return chain
  }),
  buildShape: vi.fn(() => ({
    position: vi.fn().mockReturnThis(),
    strokeColor: vi.fn().mockReturnThis(),
    strokeOpacity: vi.fn().mockReturnThis(),
    strokeWidth: vi.fn().mockReturnThis(),
    strokeDash: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    fillOpacity: vi.fn().mockReturnThis(),
    layer: vi.fn().mockReturnThis(),
    locked: vi.fn().mockReturnThis(),
    disableHit: vi.fn().mockReturnThis(),
    zIndex: vi.fn().mockReturnThis(),
    name: vi.fn().mockReturnThis(),
    id: vi.fn().mockReturnThis(),
    shapeType: vi.fn().mockReturnThis(),
    width: vi.fn().mockReturnThis(),
    height: vi.fn().mockReturnThis(),
    rotation: vi.fn().mockReturnThis(),
    build: vi.fn(() => ({ type: 'SHAPE' })),
  })),
}))

import { buildRingOutlineItemsAsync } from './distanceRingsOverlay.js'
import {
  extractRingBoundaryVertices,
  schrittDistanceMockImpl,
  verifyRingVerticesWithinSchritt,
} from './distRingCalibration.js'

const CENTER = { x: 200, y: 200 }
const DPI = 100

/** @type {import('./gridDistance.js').GridContext[]} */
const GRID_MATRIX = [
  { type: 'SQUARE', measurement: 'CHEBYSHEV', dpi: DPI },
  { type: 'SQUARE', measurement: 'MANHATTAN', dpi: DPI },
  { type: 'SQUARE', measurement: 'EUCLIDEAN', dpi: DPI },
  { type: 'SQUARE', measurement: 'ALTERNATING', dpi: DPI },
  { type: 'HEX_VERTICAL', measurement: 'CHEBYSHEV', dpi: DPI },
  { type: 'HEX_VERTICAL', measurement: 'EUCLIDEAN', dpi: DPI },
  { type: 'HEX_HORIZONTAL', measurement: 'CHEBYSHEV', dpi: DPI },
  { type: 'ISOMETRIC', measurement: 'CHEBYSHEV', dpi: DPI },
  { type: 'ISOMETRIC', measurement: 'MANHATTAN', dpi: DPI },
  { type: 'ISOMETRIC', measurement: 'EUCLIDEAN', dpi: DPI },
  { type: 'DIMETRIC', measurement: 'CHEBYSHEV', dpi: DPI },
]

describe('verifyRingVerticesWithinSchritt', () => {
  it('lehnt Eckpunkte ueber Schwelle ab', async () => {
    gridApi.getDistance.mockImplementation(schrittDistanceMockImpl('CHEBYSHEV', DPI))
    const r = await verifyRingVerticesWithinSchritt(
      CENTER,
      [{ x: 500, y: 200 }],
      2,
      'CHEBYSHEV',
      DPI
    )
    expect(r.ok).toBe(false)
  })
})

describe('H/N/S/P class rings per grid', () => {
  beforeEach(() => {
    lineBuildCount.value = 0
    gridApi.snapPosition.mockImplementation(async (pos) => ({ x: pos.x, y: pos.y }))
  })

  for (const ctx of GRID_MATRIX) {
    const label = `${ctx.type}/${ctx.measurement}`
    it(`${label}: Ring-Ecken innerhalb DIST_CLASS_RING_RADIUS`, async () => {
      gridApi.getDistance.mockImplementation(
        schrittDistanceMockImpl(ctx.measurement, ctx.dpi)
      )
      for (const code of DIST_CLASS_RING_CODES) {
        const schritt = DIST_CLASS_RING_RADIUS[code]
        const { items } = await buildRingOutlineItemsAsync(
          CENTER,
          ctx.dpi,
          schritt,
          code,
          '#000',
          ctx
        )
        const verts = extractRingBoundaryVertices(
          items,
          CENTER,
          schritt,
          ctx.dpi,
          ctx
        )
        expect(verts.length).toBeGreaterThan(0)
        const check = await verifyRingVerticesWithinSchritt(
          CENTER,
          verts,
          schritt,
          ctx.measurement,
          ctx.dpi
        )
        expect(check, `${code} @ ${label}: d=${check.distance}`).toEqual({ ok: true })
      }
    })
  }

  it('HEX EUCLIDEAN: kalibriertes Polygon statt Kreis', async () => {
    const ctx = { type: 'HEX_VERTICAL', measurement: 'EUCLIDEAN', dpi: DPI }
    gridApi.getDistance.mockImplementation(schrittDistanceMockImpl('EUCLIDEAN', DPI))
    const { items } = await buildRingOutlineItemsAsync(
      CENTER,
      DPI,
      DIST_CLASS_RING_RADIUS.N,
      'N',
      '#000',
      ctx
    )
    expect(lineBuildCount.value).toBeGreaterThan(0)
    expect(items.some((i) => i?.type === 'LINE')).toBe(true)
  })

  it('ISOMETRIC EUCLIDEAN: kalibriertes Polygon statt Kreis', async () => {
    const ctx = { type: 'ISOMETRIC', measurement: 'EUCLIDEAN', dpi: DPI }
    gridApi.getDistance.mockImplementation(schrittDistanceMockImpl('EUCLIDEAN', DPI))
    const { items } = await buildRingOutlineItemsAsync(
      CENTER,
      DPI,
      DIST_CLASS_RING_RADIUS.S,
      'S',
      '#000',
      ctx
    )
    expect(lineBuildCount.value).toBeGreaterThan(0)
  })
})
