import { describe, expect, it } from 'vitest'
import {
  imageRenderSize,
  markerScenePosition,
  orientationRingIds,
  ORIENTATION_RING_COLOR_FALLBACK,
  resolveRingStrokeColor,
  ringDiameter,
  tokenCenterScene,
} from './heroOrientationRingsOverlay.js'

const sampleImageItem = {
  position: { x: 100, y: 200 },
  image: { width: 512, height: 512 },
  grid: { dpi: 256, offset: { x: 0, y: 0 } },
}

describe('orientationRingIds', () => {
  it('liefert stabile Ring- und Marker-IDs pro Token', () => {
    expect(orientationRingIds('abc-123')).toEqual({
      ring: 'vierpunkteins/hero-orientation/ring/abc-123',
      marker: 'vierpunkteins/hero-orientation/marker/abc-123',
    })
  })
})

describe('imageRenderSize', () => {
  it('skaliert Bildgroesse mit sceneDpi/item.grid.dpi', () => {
    expect(imageRenderSize(sampleImageItem, 150)).toEqual({
      width: 300,
      height: 300,
      offsetX: 0,
      offsetY: 0,
    })
  })

  it('rechnet Grid-Offset in Szene-Pixel um', () => {
    const item = {
      ...sampleImageItem,
      grid: { dpi: 256, offset: { x: 64, y: 128 } },
    }
    expect(imageRenderSize(item, 150)).toEqual({
      width: 300,
      height: 300,
      offsetX: 37.5,
      offsetY: 75,
    })
  })
})

describe('tokenCenterScene', () => {
  it('liefert Bildmittelpunkt in Szene-Koordinaten', () => {
    expect(tokenCenterScene(sampleImageItem, 150)).toEqual({
      x: 250,
      y: 350,
    })
  })

  it('beruecksichtigt Grid-Offset', () => {
    const item = {
      position: { x: 100, y: 200 },
      image: { width: 512, height: 512 },
      grid: { dpi: 256, offset: { x: 64, y: 128 } },
    }
    expect(tokenCenterScene(item, 150)).toEqual({
      x: 212.5,
      y: 275,
    })
  })
})

describe('ringDiameter', () => {
  it('nutzt min(width,height) mit leichtem Padding', () => {
    expect(ringDiameter(sampleImageItem, 150)).toBeCloseTo(312, 5)
  })
})

describe('markerScenePosition', () => {
  const center = { x: 100, y: 100 }
  const radius = 50

  it('0°: Marker oben am Ring', () => {
    expect(markerScenePosition(center, radius, 0)).toEqual({
      x: 100,
      y: 50,
    })
  })

  it('90°: Marker rechts am Ring', () => {
    expect(markerScenePosition(center, radius, 90)).toEqual({
      x: 150,
      y: 100,
    })
  })

  it('180°: Marker unten am Ring', () => {
    expect(markerScenePosition(center, radius, 180)).toEqual({
      x: 100,
      y: 150,
    })
  })

  it('270°: Marker links am Ring', () => {
    const pos = markerScenePosition(center, radius, 270)
    expect(pos.x).toBeCloseTo(50, 5)
    expect(pos.y).toBeCloseTo(100, 5)
  })
})

describe('resolveRingStrokeColor', () => {
  it('liest heroBgColor aus Meta', () => {
    expect(resolveRingStrokeColor({ heroBgColor: '#ff5722' })).toBe('#ff5722')
  })

  it('nutzt Fallback ohne Farbe', () => {
    expect(resolveRingStrokeColor({})).toBe(ORIENTATION_RING_COLOR_FALLBACK)
    expect(resolveRingStrokeColor(null)).toBe(ORIENTATION_RING_COLOR_FALLBACK)
  })
})
