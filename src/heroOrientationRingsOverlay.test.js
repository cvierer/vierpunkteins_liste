import { describe, expect, it, afterEach } from 'vitest'
import {
  areOrientationRingsAtTokenCenter,
  clearOrientationRingCentersForTests,
  getOrientationRingDrawCenter,
  imageRenderSize,
  markerOutsideOffset,
  markerScenePosition,
  MARKER_H,
  MARKER_OUTSIDE_PADDING,
  orientationRingIds,
  ORIENTATION_RING_COLOR_FALLBACK,
  resolveRingStrokeColor,
  ringDiameter,
  setOrientationRingCenterForTests,
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

  it('beruecksichtigt item.scale bei Groesse und Offset', () => {
    const scaled = { ...sampleImageItem, scale: { x: 2, y: 2 } }
    const base = imageRenderSize(sampleImageItem, 150)
    const got = imageRenderSize(scaled, 150)
    expect(got.width).toBeCloseTo(base.width * 2, 5)
    expect(got.height).toBeCloseTo(base.height * 2, 5)
  })
})

describe('ringDiameter scale', () => {
  it('verdoppelt Durchmesser bei scale 2', () => {
    const base = ringDiameter(sampleImageItem, 150)
    const scaled = ringDiameter(
      { ...sampleImageItem, scale: { x: 2, y: 2 } },
      150
    )
    expect(scaled).toBeCloseTo(base * 2, 5)
  })
})

describe('imageRenderSize offset', () => {
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

describe('markerOutsideOffset', () => {
  it('addiert Stroke, halbe Dreieck-Hoehe und Luft', () => {
    expect(markerOutsideOffset()).toBe(3 + MARKER_H / 2 + MARKER_OUTSIDE_PADDING)
  })
})

describe('markerScenePosition', () => {
  const center = { x: 100, y: 100 }
  const radius = 50

  it('0° ohne Offset: am Ringrand', () => {
    expect(markerScenePosition(center, radius, 0, 0)).toEqual({
      x: 100,
      y: 50,
    })
  })

  it('0° mit Offset: ausserhalb des Rings', () => {
    const extra = markerOutsideOffset()
    expect(markerScenePosition(center, radius, 0, extra)).toEqual({
      x: 100,
      y: 100 - radius - extra,
    })
  })

  it('90° mit Offset: rechts ausserhalb', () => {
    const extra = markerOutsideOffset()
    expect(markerScenePosition(center, radius, 90, extra)).toEqual({
      x: 100 + radius + extra,
      y: 100,
    })
  })
})

describe('areOrientationRingsAtTokenCenter', () => {
  afterEach(() => {
    clearOrientationRingCentersForTests()
  })

  it('true wenn Draw-Center am Token-Zentrum', () => {
    setOrientationRingCenterForTests('hero-1', { x: 100, y: 200 })
    expect(areOrientationRingsAtTokenCenter('hero-1', { x: 100, y: 200 })).toBe(
      true
    )
    expect(getOrientationRingDrawCenter('hero-1')).toEqual({ x: 100, y: 200 })
  })

  it('false bei Abweichung oder fehlendem Token', () => {
    setOrientationRingCenterForTests('hero-1', { x: 0, y: 0 })
    expect(areOrientationRingsAtTokenCenter('hero-1', { x: 5, y: 0 })).toBe(
      false
    )
    expect(areOrientationRingsAtTokenCenter('missing', { x: 0, y: 0 })).toBe(
      false
    )
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
