import { describe, expect, it } from 'vitest'
import {
  defaultDistRingVisible,
  HERO_DIST_RING_VISIBLE,
  isClassRingVisible,
  isCustomRingsEnabled,
  isDistMapRingsInactive,
  isMovementRingVisible,
  readDistRingVisible,
  writeDistRingVisible,
} from './heroDistRingPrefs.js'

describe('defaultDistRingVisible', () => {
  it('deaktiviert alle Klassen-Ringe, GS-Bewegungsringe an', () => {
    expect(defaultDistRingVisible()).toEqual({
      H: false,
      N: false,
      S: false,
      P: false,
      X: false,
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
      [HERO_DIST_RING_VISIBLE]: { H: true, N: false, X: true, custom: true },
    })
    expect(got.H).toBe(true)
    expect(got.N).toBe(false)
    expect(got.X).toBe(true)
    expect(got.custom).toBe(true)
    expect(got.m1).toBe(true)
  })
})

describe('filter helpers', () => {
  it('filtert Klassen- und Bewegungsringe', () => {
    const p = defaultDistRingVisible()
    expect(isClassRingVisible(p, 'N')).toBe(false)
    expect(isClassRingVisible(p, 'H')).toBe(false)
    expect(isClassRingVisible(p, 'X')).toBe(false)
    expect(isMovementRingVisible(p, 'sp')).toBe(true)
    expect(isCustomRingsEnabled(p)).toBe(false)
  })
})

describe('isDistMapRingsInactive', () => {
  it('false bei Standard-Defaults (nur GS-Ringe aktiv)', () => {
    expect(isDistMapRingsInactive(defaultDistRingVisible(), null)).toBe(false)
    expect(isDistMapRingsInactive(defaultDistRingVisible(), 10)).toBe(false)
  })

  it('true wenn alle Ring-Typen aus', () => {
    const off = {
      H: false,
      N: false,
      S: false,
      P: false,
      X: false,
      m1: false,
      m2: false,
      sp: false,
      custom: false,
    }
    expect(isDistMapRingsInactive(off, null)).toBe(true)
  })

  it('false wenn ein Ring-Typ aktiv', () => {
    const p = { ...defaultDistRingVisible(), custom: true }
    expect(isDistMapRingsInactive(p, null)).toBe(false)
  })

  it('X zaehlt nur mit Schwelle', () => {
    const p = { ...defaultDistRingVisible(), m1: false, m2: false, sp: false, X: true }
    expect(isDistMapRingsInactive(p, null)).toBe(true)
    expect(isDistMapRingsInactive(p, 12)).toBe(false)
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
