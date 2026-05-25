import { describe, expect, it } from 'vitest'
import {
  markerOffsetY,
  orientationRingIds,
  ORIENTATION_RING_COLOR_FALLBACK,
  resolveRingStrokeColor,
  ringRadiusFromBounds,
} from './heroOrientationRingsOverlay.js'

describe('orientationRingIds', () => {
  it('liefert stabile Ring- und Marker-IDs pro Token', () => {
    expect(orientationRingIds('abc-123')).toEqual({
      ring: 'vierpunkteins/hero-orientation/ring/abc-123',
      marker: 'vierpunkteins/hero-orientation/marker/abc-123',
    })
  })
})

describe('ringRadiusFromBounds', () => {
  it('nutzt max(width,height)/2 mit Padding und Minimum', () => {
    expect(ringRadiusFromBounds({ width: 100, height: 80 })).toBeCloseTo(54, 5)
    expect(ringRadiusFromBounds({ width: 0, height: 0 })).toBe(20)
  })
})

describe('markerOffsetY', () => {
  it('platziert Marker am oberen Ringrand', () => {
    expect(markerOffsetY(50)).toBe(-50 - 9)
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
