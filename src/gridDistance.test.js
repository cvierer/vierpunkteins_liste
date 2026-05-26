import { beforeEach, describe, expect, it, vi } from 'vitest'

const { gridApi, itemsApi } = vi.hoisted(() => ({
  gridApi: {
    getDpi: vi.fn(),
    getMeasurement: vi.fn(),
    getType: vi.fn(),
    getDistance: vi.fn(),
    snapPosition: vi.fn(async (pos) => ({ x: pos.x, y: pos.y })),
    onChange: vi.fn(() => () => {}),
  },
  itemsApi: {
    getItemBounds: vi.fn(),
  },
}))

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      grid: gridApi,
      items: itemsApi,
    },
  },
}))

import {
  areTokensTouching,
  cellSetsTouching,
  computeGridSchrittFromCenters,
  formatGridDistWithClass,
  getGridContext,
  invalidateGridContextCache,
  normalizeGridDistanceRaw,
  resolveDistanceCenter,
} from './gridDistance.js'

describe('normalizeGridDistanceRaw', () => {
  it('liefert EUCLIDEAN-Rohwert unveraendert', () => {
    expect(normalizeGridDistanceRaw(8, 'EUCLIDEAN', 100)).toBe(8)
    expect(normalizeGridDistanceRaw(141.4, 'EUCLIDEAN', 100)).toBeCloseTo(141.4, 3)
  })

  it('liefert Zellwert direkt bei CHEBYSHEV', () => {
    expect(normalizeGridDistanceRaw(1, 'CHEBYSHEV', 100)).toBe(1)
    expect(normalizeGridDistanceRaw(2, 'MANHATTAN', 100)).toBe(2)
    expect(normalizeGridDistanceRaw(3, 'ALTERNATING', 100)).toBe(3)
  })

  it('liefert NaN bei ungueltigem Rohwert', () => {
    expect(normalizeGridDistanceRaw(NaN, 'EUCLIDEAN', 100)).toBeNaN()
  })
})

describe('resolveDistanceCenter', () => {
  beforeEach(() => {
    invalidateGridContextCache()
    gridApi.getDpi.mockResolvedValue(100)
    itemsApi.getItemBounds.mockResolvedValue({ center: { x: 42, y: 84 } })
  })

  it('bevorzugt getItemBounds().center', async () => {
    const center = await resolveDistanceCenter(
      { id: 'tok-1', position: { x: 0, y: 0 }, width: 100, height: 100 },
      { dpi: 100, measurement: 'EUCLIDEAN', type: 'SQUARE' }
    )
    expect(center).toEqual({ x: 42, y: 84 })
    expect(itemsApi.getItemBounds).toHaveBeenCalledWith(['tok-1'])
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

  it('liefert EUCLIDEAN-Schritt direkt aus getDistance', async () => {
    invalidateGridContextCache()
    gridApi.getMeasurement.mockResolvedValue('EUCLIDEAN')
    gridApi.getDistance.mockResolvedValue(8)
    const schritt = await computeGridSchrittFromCenters(
      { x: 0, y: 0 },
      { x: 800, y: 0 }
    )
    expect(schritt).toBe(8)
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

describe('cellSetsTouching', () => {
  it('erkennt Zellenueberlappung', () => {
    expect(cellSetsTouching(new Set(['0,0']), new Set(['0,0']), 'SQUARE')).toBe(true)
  })

  it('erkennt Nachbarzellen auf Square', () => {
    expect(cellSetsTouching(new Set(['0,0']), new Set(['1,0']), 'SQUARE')).toBe(true)
    expect(cellSetsTouching(new Set(['0,0']), new Set(['2,0']), 'SQUARE')).toBe(false)
  })
})

describe('areTokensTouching', () => {
  beforeEach(() => {
    invalidateGridContextCache()
    gridApi.getDpi.mockResolvedValue(100)
    gridApi.getMeasurement.mockResolvedValue('CHEBYSHEV')
    gridApi.getType.mockResolvedValue('SQUARE')
    gridApi.getDistance.mockResolvedValue(1)
  })

  it('true bei benachbarten Mittelzellen', async () => {
    itemsApi.getItemBounds.mockRejectedValue(new Error('no bounds'))
    expect(
      await areTokensTouching(
        { position: { x: 0, y: 0 }, width: 100, height: 100 },
        { position: { x: 100, y: 0 }, width: 100, height: 100 }
      )
    ).toBe(true)
  })

  it('false bei entfernten Mittelzellen auch wenn getDistance 1', async () => {
    itemsApi.getItemBounds.mockRejectedValue(new Error('no bounds'))
    gridApi.getDistance.mockResolvedValue(1)
    expect(
      await areTokensTouching(
        { position: { x: 0, y: 0 }, width: 100, height: 100 },
        { position: { x: 200, y: 0 }, width: 100, height: 100 }
      )
    ).toBe(false)
  })
})

describe('formatGridDistWithClass', () => {
  beforeEach(() => {
    invalidateGridContextCache()
    gridApi.getDpi.mockResolvedValue(100)
    gridApi.getMeasurement.mockResolvedValue('EUCLIDEAN')
    gridApi.getType.mockResolvedValue('SQUARE')
    gridApi.getDistance.mockResolvedValue(1.5)
    itemsApi.getItemBounds.mockRejectedValue(new Error('no bounds'))
  })

  it('formatiert Schritt mit Klasse in Klammern', async () => {
    expect(
      await formatGridDistWithClass(
        { position: { x: 0, y: 0 }, width: 100, height: 100 },
        { position: { x: 300, y: 0 }, width: 100, height: 100 }
      )
    ).toBe('2(N)')
  })

  it('liefert (H) bei Berührung', async () => {
    gridApi.getDistance.mockResolvedValue(1)
    gridApi.getMeasurement.mockResolvedValue('CHEBYSHEV')
    itemsApi.getItemBounds.mockRejectedValue(new Error('no bounds'))
    expect(
      await formatGridDistWithClass(
        { position: { x: 0, y: 0 }, width: 100, height: 100 },
        { position: { x: 100, y: 0 }, width: 100, height: 100 }
      )
    ).toBe('1(H)')
  })
})

describe('getGridContext', () => {
  beforeEach(() => {
    invalidateGridContextCache()
    gridApi.getDpi.mockClear()
    gridApi.getMeasurement.mockClear()
    gridApi.getType.mockClear()
    gridApi.getDpi.mockResolvedValue(100)
    gridApi.getMeasurement.mockResolvedValue('CHEBYSHEV')
    gridApi.getType.mockResolvedValue('SQUARE')
  })

  it('forceRefresh ignoriert Cache und liest erneut von OBR', async () => {
    await getGridContext()
    expect(gridApi.getMeasurement).toHaveBeenCalledTimes(1)

    gridApi.getMeasurement.mockResolvedValue('MANHATTAN')
    const cached = await getGridContext()
    expect(cached?.measurement).toBe('CHEBYSHEV')
    expect(gridApi.getMeasurement).toHaveBeenCalledTimes(1)

    const fresh = await getGridContext({ forceRefresh: true })
    expect(fresh?.measurement).toBe('MANHATTAN')
    expect(gridApi.getMeasurement).toHaveBeenCalledTimes(2)
  })
})
