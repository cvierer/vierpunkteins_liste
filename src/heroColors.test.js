import { describe, expect, it } from 'vitest'
import {
  HERO_BG_COLOR,
  HERO_PALETTE_ROWS,
  pickRandomHeroColor,
  readHeroBgColor,
} from './heroColors.js'

describe('HERO_PALETTE_ROWS', () => {
  it('hat zwei Reihen mit jeweils 16 Hex-Farben', () => {
    expect(HERO_PALETTE_ROWS).toHaveLength(2)
    for (const row of HERO_PALETTE_ROWS) {
      expect(row).toHaveLength(16)
      for (const c of row) {
        expect(c).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
  })
})

describe('pickRandomHeroColor', () => {
  it('liefert eine Hex-Farbe aus der Palette', () => {
    const all = new Set([...HERO_PALETTE_ROWS[0], ...HERO_PALETTE_ROWS[1]])
    for (let i = 0; i < 50; i++) {
      const c = pickRandomHeroColor()
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(all.has(c)).toBe(true)
    }
  })
})

describe('readHeroBgColor', () => {
  it('liest gültige Hex-Werte aus Meta', () => {
    expect(readHeroBgColor({ [HERO_BG_COLOR]: '#aabbcc' })).toBe('#aabbcc')
  })

  it('liefert null bei ungültigen oder fehlenden Werten', () => {
    expect(readHeroBgColor(null)).toBeNull()
    expect(readHeroBgColor(undefined)).toBeNull()
    expect(readHeroBgColor({})).toBeNull()
    expect(readHeroBgColor({ [HERO_BG_COLOR]: 'not-a-hex' })).toBeNull()
    expect(readHeroBgColor({ [HERO_BG_COLOR]: '#fff' })).toBeNull()
    expect(readHeroBgColor({ [HERO_BG_COLOR]: 123 })).toBeNull()
  })
})
