import { describe, expect, it } from 'vitest'
import { circleTopLeftForCenter, ringRadiusPx } from './distanceRingsOverlay.js'

describe('ringRadiusPx', () => {
  it('rechnet threshold-Schritt in px vom Mittelpunkt', () => {
    expect(ringRadiusPx(100, 0.8)).toBe(80)
    expect(ringRadiusPx(100, 1.5)).toBe(150)
    expect(ringRadiusPx(100, 3)).toBe(300)
    expect(ringRadiusPx(100, 4.5)).toBe(450)
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
