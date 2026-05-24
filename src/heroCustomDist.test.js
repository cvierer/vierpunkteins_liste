import { describe, expect, it } from 'vitest'
import {
  allCustomDistRingCodes,
  buildCustomDistRingSpecs,
  customDistRingCode,
  defaultCustomDistProfiles,
  HERO_CUSTOM_DIST,
  readCustomDistProfiles,
  writeCustomDistProfiles,
} from './heroCustomDist.js'

describe('defaultCustomDistProfiles', () => {
  it('liefert drei deaktivierte Profile mit Standard-Namen und -Baendern', () => {
    const profiles = defaultCustomDistProfiles()
    expect(profiles).toHaveLength(3)
    expect(profiles.every((p) => p.enabled === false)).toBe(true)
    expect(profiles[0].name).toBe('Fernkampfwaffe 1')
    expect(profiles[0].bands).toHaveLength(5)
    expect(profiles[0].bands[0].label).toBe('Sehr nah')
    expect(profiles[0].bands[0].schritt).toBeNull()
  })
})

describe('readCustomDistProfiles', () => {
  it('defaultet leeres Meta', () => {
    expect(readCustomDistProfiles(undefined)).toEqual(defaultCustomDistProfiles())
    expect(readCustomDistProfiles({})).toEqual(defaultCustomDistProfiles())
  })

  it('normalisiert gespeicherte Profile', () => {
    const meta = {
      [HERO_CUSTOM_DIST]: [
        {
          enabled: true,
          name: 'Bogen',
          bands: [
            { label: 'Nah', schritt: 8 },
            { label: '', schritt: '12' },
          ],
        },
      ],
    }
    const got = readCustomDistProfiles(meta)
    expect(got[0].enabled).toBe(true)
    expect(got[0].name).toBe('Bogen')
    expect(got[0].bands[0]).toEqual({ label: 'Nah', schritt: 8 })
    expect(got[0].bands[1].schritt).toBe(12)
    expect(got[0].bands[1].label).toBe('Nah')
    expect(got[1].enabled).toBe(false)
  })

  it('ignoriert ungueltige Schritt-Werte', () => {
    const meta = {
      [HERO_CUSTOM_DIST]: [
        {
          enabled: true,
          name: 'Test',
          bands: [{ label: 'Weit', schritt: '1,5' }, { label: 'X', schritt: 0 }],
        },
      ],
    }
    const got = readCustomDistProfiles(meta)
    expect(got[0].bands[0].schritt).toBeNull()
    expect(got[0].bands[1].schritt).toBeNull()
  })
})

describe('buildCustomDistRingSpecs', () => {
  it('liefert nur enabled Baender mit schritt > 0', () => {
    const profiles = defaultCustomDistProfiles()
    profiles[0].enabled = true
    profiles[0].name = 'Bogen'
    profiles[0].bands[2].schritt = 12
    const specs = buildCustomDistRingSpecs(profiles)
    expect(specs).toHaveLength(1)
    expect(specs[0]).toMatchObject({
      code: customDistRingCode(0, 2),
      label: 'Bogen · Mittel',
      schritt: 12,
    })
    expect(specs[0].color).toMatch(/^#/)
  })

  it('liefert leer wenn alle deaktiviert', () => {
    expect(buildCustomDistRingSpecs(defaultCustomDistProfiles())).toEqual([])
  })
})

describe('writeCustomDistProfiles', () => {
  it('schreibt normalisiertes Array ins Meta', () => {
    /** @type {Record<string, unknown>} */
    const meta = {}
    const profiles = defaultCustomDistProfiles()
    profiles[1].enabled = true
    profiles[1].bands[0].schritt = 5
    writeCustomDistProfiles(meta, profiles)
    expect(Array.isArray(meta[HERO_CUSTOM_DIST])).toBe(true)
    expect(/** @type {any[]} */ (meta[HERO_CUSTOM_DIST])[1].enabled).toBe(true)
    expect(/** @type {any[]} */ (meta[HERO_CUSTOM_DIST])[1].bands[0].schritt).toBe(5)
  })
})

describe('allCustomDistRingCodes', () => {
  it('liefert 15 eindeutige Ring-Codes', () => {
    const codes = allCustomDistRingCodes()
    expect(codes).toHaveLength(15)
    expect(new Set(codes).size).toBe(15)
    expect(codes[0]).toBe('cd-p0-b0')
  })
})
