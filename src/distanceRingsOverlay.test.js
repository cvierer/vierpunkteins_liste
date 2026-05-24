import { describe, expect, it } from 'vitest'
import { ringRadiusPx } from './distanceRingsOverlay.js'

describe('ringRadiusPx', () => {
  const item = { position: { x: 0, y: 0 }, width: 100, height: 100 }

  it('1x1-Token bei dpi=100', () => {
    expect(ringRadiusPx(item, 100, 0.7)).toBe(120)
    expect(ringRadiusPx(item, 100, 1.5)).toBe(200)
    expect(ringRadiusPx(item, 100, 3)).toBe(350)
    expect(ringRadiusPx(item, 100, 4.5)).toBe(500)
  })
})
