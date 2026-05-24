import { describe, expect, it } from 'vitest'
import {
  circleTopLeftForCenter,
  ringRadiusPx,
  ringRadiusPxFromHalfMax,
} from './distanceRingsOverlay.js'

describe('ringRadiusPxFromHalfMax', () => {
  it('addiert halfMax und threshold-Schritt in px', () => {
    expect(ringRadiusPxFromHalfMax(50, 100, 0.7)).toBe(120)
    expect(ringRadiusPxFromHalfMax(50, 100, 1.5)).toBe(200)
    expect(ringRadiusPxFromHalfMax(50, 100, 3)).toBe(350)
    expect(ringRadiusPxFromHalfMax(50, 100, 4.5)).toBe(500)
  })
})

describe('ringRadiusPx', () => {
  const item = { position: { x: 0, y: 0 }, width: 100, height: 100 }

  it('1x1-Token bei dpi=100', () => {
    expect(ringRadiusPx(item, 100, 0.7)).toBe(120)
    expect(ringRadiusPx(item, 100, 1.5)).toBe(200)
    expect(ringRadiusPx(item, 100, 3)).toBe(350)
    expect(ringRadiusPx(item, 100, 4.5)).toBe(500)
  })
})

describe('circleTopLeftForCenter', () => {
  it('liefert obere linke Ecke fuer zentrierten Kreis', () => {
    expect(circleTopLeftForCenter({ x: 100, y: 100 }, 50)).toEqual({
      x: 50,
      y: 50,
    })
  })
})
