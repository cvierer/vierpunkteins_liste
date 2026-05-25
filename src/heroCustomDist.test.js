import { describe, expect, it } from 'vitest'
import {
  buildCustomDistRingSpecs,
  customDistRingCode,
  CUSTOM_DIST_MAX_BANDS,
  CUSTOM_DIST_MAX_PROFILES,
  defaultCustomDistProfiles,
  HERO_CUSTOM_DIST,
  readCustomDistProfiles,
  writeCustomDistProfiles,
} from './heroCustomDist.js'

describe('defaultCustomDistProfiles', () => {
  it('liefert Fernkampf und Zauberreichweite deaktiviert', () => {
    const profiles = defaultCustomDistProfiles()
    expect(profiles).toHaveLength(2)
    expect(profiles.every((p) => p.enabled === false)).toBe(true)
    expect(profiles[0].name).toBe('Fernkampf')
    expect(profiles[1].name).toBe('Zauberreichweite')
    expect(profiles[0].bands).toHaveLength(1)
  })
})

describe('readCustomDistProfiles', () => {
  it('defaultet leeres Meta', () => {
    expect(readCustomDistProfiles(undefined)).toEqual(defaultCustomDistProfiles())
  })

  it('liest variable Profile und Baender', () => {
    const meta = {
      [HERO_CUSTOM_DIST]: [
        {
          enabled: true,
          name: 'Feuerball',
          bands: [
            { label: 'Nah', schritt: 8 },
            { label: 'Fern', schritt: 24 },
          ],
        },
        { enabled: false, name: 'Bogen', bands: [{ label: '', schritt: null }] },
      ],
    }
    const got = readCustomDistProfiles(meta)
    expect(got).toHaveLength(2)
    expect(got[0].name).toBe('Feuerball')
    expect(got[0].bands[1].schritt).toBe(24)
  })

  it('begrenzt auf MAX_PROFILES und MAX_BANDS', () => {
    const manyProfiles = Array.from({ length: CUSTOM_DIST_MAX_PROFILES + 5 }, (_, i) => ({
      enabled: false,
      name: `P${i}`,
      bands: [{ label: '', schritt: null }],
    }))
    const manyBands = Array.from({ length: CUSTOM_DIST_MAX_BANDS + 5 }, (_, i) => ({
      label: `B${i}`,
      schritt: i + 1,
    }))
    manyProfiles[0].bands = manyBands
    const got = readCustomDistProfiles({ [HERO_CUSTOM_DIST]: manyProfiles })
    expect(got).toHaveLength(CUSTOM_DIST_MAX_PROFILES)
    expect(got[0].bands).toHaveLength(CUSTOM_DIST_MAX_BANDS)
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
    profiles[0].bands[0].label = 'Mittel'
    profiles[0].bands[0].schritt = 12
    const specs = buildCustomDistRingSpecs(profiles)
    expect(specs).toHaveLength(1)
    expect(specs[0]).toMatchObject({
      code: customDistRingCode(0, 0),
      label: 'Bogen · Mittel',
      schritt: 12,
    })
    expect(specs[0].color).toMatch(/^hsl\(/)
  })

  it('liefert leer wenn alle deaktiviert', () => {
    expect(buildCustomDistRingSpecs(defaultCustomDistProfiles())).toEqual([])
  })
})

describe('writeCustomDistProfiles', () => {
  it('schreibt variable Profile ins Meta', () => {
    /** @type {Record<string, unknown>} */
    const meta = {}
    const profiles = defaultCustomDistProfiles()
    profiles.push({
      enabled: true,
      name: 'Zauber',
      bands: [{ label: 'Reichweite', schritt: 16 }],
    })
    writeCustomDistProfiles(meta, profiles)
    expect(/** @type {any[]} */ (meta[HERO_CUSTOM_DIST])).toHaveLength(3)
    expect(/** @type {any[]} */ (meta[HERO_CUSTOM_DIST])[2].name).toBe('Zauber')
  })
})
