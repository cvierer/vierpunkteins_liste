import { describe, expect, it } from 'vitest'
import {
  MOVEMENT_MIN_SCHRITT,
  resolveSpokeColor,
  shouldShowMovementSpoke,
  SPOKE_COLOR_FALLBACK,
  spokeItemId,
  spokeLabelPosition,
} from './distanceSpokesOverlay.js'

describe('spokeItemId', () => {
  it('stabile IDs für Linie und Label', () => {
    expect(spokeItemId('hero-b', 'line')).toBe(
      'vierpunkteins/dist-spoke/line/hero-b'
    )
    expect(spokeItemId('hero-b', 'label')).toBe(
      'vierpunkteins/dist-spoke/label/hero-b'
    )
  })
})

describe('spokeLabelPosition', () => {
  it('Mittelpunkt zwischen zwei Token-Zentren', () => {
    expect(spokeLabelPosition({ x: 0, y: 0 }, { x: 100, y: 200 })).toEqual({
      x: 50,
      y: 100,
    })
  })
})

describe('shouldShowMovementSpoke', () => {
  it('zeigt Linie ab Mindest-Schritt', () => {
    expect(shouldShowMovementSpoke(MOVEMENT_MIN_SCHRITT)).toBe(true)
    expect(shouldShowMovementSpoke(1.2)).toBe(true)
    expect(shouldShowMovementSpoke(0.04)).toBe(false)
    expect(shouldShowMovementSpoke(NaN)).toBe(false)
  })
})

describe('resolveSpokeColor', () => {
  it('liest heroBgColor aus Meta', () => {
    expect(resolveSpokeColor({ heroBgColor: '#ff5722' })).toBe('#ff5722')
  })

  it('nutzt Fallback ohne Farbe', () => {
    expect(resolveSpokeColor({})).toBe(SPOKE_COLOR_FALLBACK)
    expect(resolveSpokeColor(null)).toBe(SPOKE_COLOR_FALLBACK)
  })
})
