import { beforeEach, describe, expect, it, vi } from 'vitest'

const { gridApi, itemsApi } = vi.hoisted(() => ({
  gridApi: {
    snapPosition: vi.fn(async (pos) => ({ x: pos.x + 5, y: pos.y + 5 })),
  },
  itemsApi: {
    getItemBounds: vi.fn(async () => ({ center: { x: 100, y: 100 } })),
  },
}))

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      grid: gridApi,
      items: itemsApi,
      local: { addItems: vi.fn(), deleteItems: vi.fn() },
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
  buildLine: vi.fn(() => ({
    id: vi.fn().mockReturnThis(),
    startPosition: vi.fn().mockReturnThis(),
    endPosition: vi.fn().mockReturnThis(),
    strokeColor: vi.fn().mockReturnThis(),
    strokeOpacity: vi.fn().mockReturnThis(),
    strokeWidth: vi.fn().mockReturnThis(),
    strokeDash: vi.fn().mockReturnThis(),
    layer: vi.fn().mockReturnThis(),
    locked: vi.fn().mockReturnThis(),
    disableHit: vi.fn().mockReturnThis(),
    zIndex: vi.fn().mockReturnThis(),
    name: vi.fn().mockReturnThis(),
    build: vi.fn(() => ({})),
  })),
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
    build: vi.fn(() => ({})),
  })),
}))

import {
  boxTopLeftForCenter,
  circleTopLeftForCenter,
  isHexGridType,
  manhattanDiamondVertices,
  MOVEMENT_RING_SPECS,
  resolveRingCenter,
  ringRadiusPx,
  ringShapePosition,
} from './distanceRingsOverlay.js'

describe('ringShapePosition', () => {
  const center = { x: 100, y: 100 }

  it('liefert Top-Left fuer RECTANGLE', () => {
    expect(ringShapePosition(center, 50, 'RECTANGLE')).toEqual({ x: 50, y: 50 })
  })

  it('liefert Mittelpunkt fuer CIRCLE und HEXAGON', () => {
    expect(ringShapePosition(center, 50, 'CIRCLE')).toEqual(center)
    expect(ringShapePosition(center, 50, 'HEXAGON')).toEqual(center)
  })
})

describe('isHexGridType', () => {
  it('erkennt Hex-Gitter', () => {
    expect(isHexGridType({ dpi: 100, measurement: 'CHEBYSHEV', type: 'HEX_VERTICAL' })).toBe(
      true
    )
    expect(isHexGridType({ dpi: 100, measurement: 'CHEBYSHEV', type: 'HEX_HORIZONTAL' })).toBe(
      true
    )
    expect(isHexGridType({ dpi: 100, measurement: 'CHEBYSHEV', type: 'SQUARE' })).toBe(false)
  })
})

describe('manhattanDiamondVertices', () => {
  it('liefert Raute um den Mittelpunkt', () => {
    expect(manhattanDiamondVertices({ x: 50, y: 50 }, 10)).toEqual([
      { x: 50, y: 40 },
      { x: 60, y: 50 },
      { x: 50, y: 60 },
      { x: 40, y: 50 },
    ])
  })
})

describe('ringRadiusPx', () => {
  it('rechnet threshold-Schritt in px vom Mittelpunkt', () => {
    expect(ringRadiusPx(100, 0.8)).toBe(80)
    expect(ringRadiusPx(100, 1.5)).toBe(150)
    expect(ringRadiusPx(100, 3)).toBe(300)
    expect(ringRadiusPx(100, 4.5)).toBe(450)
  })

  it('rechnet GS-Bewegungsradien bei gs=8', () => {
    expect(ringRadiusPx(100, 8)).toBe(800)
    expect(ringRadiusPx(100, 16)).toBe(1600)
    expect(ringRadiusPx(100, 24)).toBe(2400)
  })
})

describe('MOVEMENT_RING_SPECS', () => {
  it('definiert 1x/2x/3x GS mit Labels', () => {
    expect(MOVEMENT_RING_SPECS).toEqual([
      { code: 'm1', label: '1 Akt. Bewegen', mult: 1 },
      { code: 'm2', label: '2 Akt. Bewegen', mult: 2 },
      { code: 'sp', label: 'Sprint', mult: 3 },
    ])
  })
})

describe('boxTopLeftForCenter', () => {
  it('liefert obere linke Ecke fuer zentriertes Rechteck', () => {
    expect(boxTopLeftForCenter({ x: 100, y: 100 }, 50)).toEqual({
      x: 50,
      y: 50,
    })
    expect(circleTopLeftForCenter({ x: 100, y: 100 }, 50)).toEqual({
      x: 50,
      y: 50,
    })
  })
})

describe('resolveRingCenter', () => {
  beforeEach(() => {
    gridApi.snapPosition.mockClear()
    itemsApi.getItemBounds.mockClear()
  })

  it('nutzt Token-Bounds bei EUCLIDEAN ohne Snap', async () => {
    const center = await resolveRingCenter(
      { id: 't1', position: { x: 0, y: 0 }, width: 100, height: 100 },
      { dpi: 100, measurement: 'EUCLIDEAN', type: 'SQUARE' }
    )
    expect(center).toEqual({ x: 100, y: 100 })
    expect(gridApi.snapPosition).not.toHaveBeenCalled()
  })

  it('snappt auf Grid bei CHEBYSHEV und MANHATTAN', async () => {
    const cheb = await resolveRingCenter(
      { id: 't1', position: { x: 0, y: 0 }, width: 100, height: 100 },
      { dpi: 100, measurement: 'CHEBYSHEV', type: 'SQUARE' }
    )
    expect(gridApi.snapPosition).toHaveBeenCalledWith(
      { x: 100, y: 100 },
      undefined,
      true
    )
    expect(cheb).toEqual({ x: 105, y: 105 })

    gridApi.snapPosition.mockClear()
    const man = await resolveRingCenter(
      { id: 't1', position: { x: 0, y: 0 }, width: 100, height: 100 },
      { dpi: 100, measurement: 'MANHATTAN', type: 'SQUARE' }
    )
    expect(gridApi.snapPosition).toHaveBeenCalled()
    expect(man).toEqual({ x: 105, y: 105 })
  })
})
