import { describe, expect, it } from 'vitest'
import {
  HERO_DIST_CLASS_X_SCHRITT,
  readHeroDistClassXSchritt,
  writeHeroDistClassXSchritt,
} from './heroDistClassX.js'

describe('readHeroDistClassXSchritt', () => {
  it('defaultet leer', () => {
    expect(readHeroDistClassXSchritt(undefined)).toBeNull()
    expect(readHeroDistClassXSchritt({})).toBeNull()
  })

  it('liest 1–99', () => {
    expect(readHeroDistClassXSchritt({ [HERO_DIST_CLASS_X_SCHRITT]: '12' })).toBe(12)
    expect(readHeroDistClassXSchritt({ [HERO_DIST_CLASS_X_SCHRITT]: '99' })).toBe(99)
  })

  it('ignoriert ungueltige Werte', () => {
    expect(readHeroDistClassXSchritt({ [HERO_DIST_CLASS_X_SCHRITT]: '0' })).toBeNull()
    expect(readHeroDistClassXSchritt({ [HERO_DIST_CLASS_X_SCHRITT]: '100' })).toBeNull()
  })
})

describe('writeHeroDistClassXSchritt', () => {
  it('schreibt oder loescht', () => {
    const meta = {}
    writeHeroDistClassXSchritt(meta, 8)
    expect(meta[HERO_DIST_CLASS_X_SCHRITT]).toBe('8')
    writeHeroDistClassXSchritt(meta, null)
    expect(meta[HERO_DIST_CLASS_X_SCHRITT]).toBeUndefined()
  })
})
