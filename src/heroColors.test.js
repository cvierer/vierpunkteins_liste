import { describe, expect, it } from 'vitest'
import {
  HERO_BG_COLOR,
  HERO_PALETTE_ROWS,
  deepenHeroColor,
  pickRandomHeroColor,
  readHeroBgColor,
} from './heroColors.js'

/** Relative Helligkeit (einfache Luma) zum Vergleich heller/dunkler. */
function luma(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

describe('HERO_PALETTE_ROWS', () => {
  it('hat eine Reihe mit 11 Hex-Farben', () => {
    expect(HERO_PALETTE_ROWS).toHaveLength(1)
    expect(HERO_PALETTE_ROWS[0]).toHaveLength(11)
    for (const c of HERO_PALETTE_ROWS[0]) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('pickRandomHeroColor', () => {
  it('liefert eine Hex-Farbe aus der Palette', () => {
    const all = new Set(HERO_PALETTE_ROWS[0])
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

describe('deepenHeroColor', () => {
  it('liefert ein gültiges #rrggbb', () => {
    for (const c of HERO_PALETTE_ROWS[0]) {
      expect(deepenHeroColor(c)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('macht die Farbe dunkler', () => {
    for (const c of HERO_PALETTE_ROWS[0]) {
      const deep = deepenHeroColor(c)
      expect(luma(deep)).toBeLessThan(luma(c))
    }
  })

  it('lässt ungültige/leere Eingaben unverändert', () => {
    expect(deepenHeroColor(null)).toBeNull()
    expect(deepenHeroColor(undefined)).toBeUndefined()
    expect(deepenHeroColor('not-a-hex')).toBe('not-a-hex')
    expect(deepenHeroColor('#fff')).toBe('#fff')
  })
})
