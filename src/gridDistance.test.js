import { beforeEach, describe, expect, it, vi } from 'vitest'

const { gridApi } = vi.hoisted(() => ({
  gridApi: {
    getDpi: vi.fn(),
    getMeasurement: vi.fn(),
    getType: vi.fn(),
    getDistance: vi.fn(),
    onChange: vi.fn(() => () => {}),
  },
}))

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      grid: gridApi,
    },
  },
}))

import {
  computeGridSchrittFromCenters,
  invalidateGridContextCache,
  normalizeGridDistanceRaw,
} from './gridDistance.js'

describe('normalizeGridDistanceRaw', () => {
  it('teilt EUCLIDEAN-Rohwert durch dpi', () => {
    expect(normalizeGridDistanceRaw(141.4, 'EUCLIDEAN', 100)).toBeCloseTo(1.414, 3)
  })

  it('liefert Zellwert direkt bei CHEBYSHEV', () => {
    expect(normalizeGridDistanceRaw(1, 'CHEBYSHEV', 100)).toBe(1)
    expect(normalizeGridDistanceRaw(2, 'MANHATTAN', 100)).toBe(2)
    expect(normalizeGridDistanceRaw(3, 'ALTERNATING', 100)).toBe(3)
  })

  it('liefert NaN bei ungueltigem Rohwert oder dpi in EUCLIDEAN', () => {
    expect(normalizeGridDistanceRaw(NaN, 'EUCLIDEAN', 100)).toBeNaN()
    expect(normalizeGridDistanceRaw(100, 'EUCLIDEAN', 0)).toBeNaN()
  })
})

describe('computeGridSchrittFromCenters', () => {
  beforeEach(() => {
    invalidateGridContextCache()
    gridApi.getDpi.mockResolvedValue(100)
    gridApi.getMeasurement.mockResolvedValue('CHEBYSHEV')
    gridApi.getType.mockResolvedValue('SQUARE')
    gridApi.getDistance.mockResolvedValue(1)
  })

  it('nutzt getDistance und normalisiert nach Messmodus', async () => {
    const schritt = await computeGridSchrittFromCenters(
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    )
    expect(gridApi.getDistance).toHaveBeenCalledWith(
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    )
    expect(schritt).toBe(1)
  })

  it('rechnet EUCLIDEAN in Schritt um', async () => {
    invalidateGridContextCache()
    gridApi.getMeasurement.mockResolvedValue('EUCLIDEAN')
    gridApi.getDistance.mockResolvedValue(141.421356)
    const schritt = await computeGridSchrittFromCenters(
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    )
    expect(schritt).toBeCloseTo(1.414, 3)
  })

  it('faellt auf euklidische Berechnung zurueck wenn getDistance fehlschlaegt', async () => {
    gridApi.getDistance.mockRejectedValue(new Error('offline'))
    const schritt = await computeGridSchrittFromCenters(
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    )
    expect(schritt).toBe(1)
  })
})
