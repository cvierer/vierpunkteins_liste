import { describe, expect, it } from 'vitest'
import {
  circleTopLeftForCenter,
  MOVEMENT_RING_SPECS,
  ringRadiusPx,
} from './distanceRingsOverlay.js'

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

describe('circleTopLeftForCenter', () => {
  it('liefert obere linke Ecke fuer zentrierten Kreis', () => {
    expect(circleTopLeftForCenter({ x: 100, y: 100 }, 50)).toEqual({
      x: 50,
      y: 50,
    })
  })
})
