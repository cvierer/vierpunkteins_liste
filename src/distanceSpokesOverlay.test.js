import { describe, expect, it } from 'vitest'
import { spokeItemId, spokeLabelPosition } from './distanceSpokesOverlay.js'

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
