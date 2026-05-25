import { describe, expect, it } from 'vitest'
import {
  defaultDistRingVisible,
  HERO_DIST_RING_VISIBLE,
  isClassRingVisible,
  isCustomRingsEnabled,
  isMovementRingVisible,
  readDistRingVisible,
  writeDistRingVisible,
} from './heroDistRingPrefs.js'

describe('defaultDistRingVisible', () => {
  it('aktiviert N und GS-Bewegungsringe, nicht H/S/P/custom', () => {
    expect(defaultDistRingVisible()).toEqual({
      H: false,
      N: true,
      S: false,
      P: false,
      m1: true,
      m2: true,
      sp: true,
      custom: false,
    })
  })
})

describe('readDistRingVisible', () => {
  it('defaultet leeres Meta', () => {
    expect(readDistRingVisible(undefined)).toEqual(defaultDistRingVisible())
  })

  it('liest gespeicherte Werte', () => {
    const got = readDistRingVisible({
      [HERO_DIST_RING_VISIBLE]: { H: true, N: false, custom: true },
    })
    expect(got.H).toBe(true)
    expect(got.N).toBe(false)
    expect(got.custom).toBe(true)
    expect(got.m1).toBe(true)
  })
})

describe('filter helpers', () => {
  it('filtert Klassen- und Bewegungsringe', () => {
    const p = defaultDistRingVisible()
    expect(isClassRingVisible(p, 'N')).toBe(true)
    expect(isClassRingVisible(p, 'H')).toBe(false)
    expect(isMovementRingVisible(p, 'sp')).toBe(true)
    expect(isCustomRingsEnabled(p)).toBe(false)
  })
})

describe('writeDistRingVisible', () => {
  it('schreibt normalisiert ins Meta', () => {
    const meta = {}
    writeDistRingVisible(meta, {
      ...defaultDistRingVisible(),
      H: true,
      custom: true,
    })
    expect(/** @type {any} */ (meta[HERO_DIST_RING_VISIBLE]).H).toBe(true)
    expect(/** @type {any} */ (meta[HERO_DIST_RING_VISIBLE]).custom).toBe(true)
  })
})
