import { describe, expect, it } from 'vitest'
import {
  buildLePopoverModSummary,
  buildWundenZonesTitle,
  computeAutoModAffectedFields,
  leBarColorBand,
  leFractionToThresholdBand,
  zoneStageFromWounds,
} from './heroBlockAutoMod.js'

describe('leFractionToThresholdBand', () => {
  it('maps typical fractions to the documented bands (strict >)', () => {
    expect(leFractionToThresholdBand(0.9)).toBe('std')
    // genau 7/8: nicht "std" (f > 7/8)
    expect(leFractionToThresholdBand(7 / 8)).toBe('gly')
    expect(leFractionToThresholdBand(0.77)).toBe('gly')
    expect(leFractionToThresholdBand(0.66)).toBe('yel')
    expect(leFractionToThresholdBand(0.55)).toBe('yor')
    expect(leFractionToThresholdBand(0.5)).toBe('alert')
    expect(leFractionToThresholdBand(0.26)).toBe('peril')
    expect(leFractionToThresholdBand(0.2)).toBe('crit')
  })

  it('clamps input to 0..1', () => {
    expect(leFractionToThresholdBand(-1)).toBe('crit')
    expect(leFractionToThresholdBand(2)).toBe('std')
  })
})

describe('leBarColorBand', () => {
  it('uses signalred pulse for 1..5 LE (lebend) regardless of share', () => {
    expect(leBarColorBand(3, 100)).toBe('sig')
    expect(leBarColorBand(1, 40)).toBe('sig')
  })

  it('uses share bands when LE >= 6', () => {
    expect(leBarColorBand(20, 40)).toBe('alert')
  })
})

describe('zoneStageFromWounds', () => {
  it('caps at stage 3', () => {
    expect(zoneStageFromWounds(0)).toBe(0)
    expect(zoneStageFromWounds(1)).toBe(1)
    expect(zoneStageFromWounds(2)).toBe(2)
    expect(zoneStageFromWounds(3)).toBe(3)
    expect(zoneStageFromWounds(99)).toBe(3)
  })
})

describe('buildWundenZonesTitle', () => {
  it('shows placeholder when no wounds', () => {
    expect(
      buildWundenZonesTitle([{ zoneId: 'brust', getWunden: () => 0 }])
    ).toMatch(/Keine Wunden gesetzt/)
  })

  it('lists zone abbreviations and total', () => {
    const t = buildWundenZonesTitle([
      { zoneId: 'brust', getWunden: () => 1 },
      { zoneId: 'bauch', getWunden: () => 2 },
    ])
    expect(t).toContain('BR 1')
    expect(t).toContain('BA 2')
    expect(t).toContain('Gesamt: 3')
  })
})

describe('computeAutoModAffectedFields', () => {
  it('includes LE-malus fields when malus > 0', () => {
    expect(computeAutoModAffectedFields([], 2)).toEqual(['at', 'pa', 'a', 'fk'])
  })

  it('adds FK for any total wounds even without LE malus', () => {
    const z = [{ zoneId: 'brust', getWunden: () => 1 }]
    expect(computeAutoModAffectedFields(z, 0).includes('fk')).toBe(true)
  })

  it('merges zone field keys in MOD order', () => {
    const z = [{ zoneId: 'bauch', getWunden: () => 1 }]
    const fields = computeAutoModAffectedFields(z, 0)
    expect(fields[0]).toBe('at')
    expect(fields).toContain('gs')
    expect(fields).toContain('a')
  })
})

describe('buildLePopoverModSummary', () => {
  it('returns empty-state title when no mods apply', () => {
    const r = buildLePopoverModSummary(
      [{ zoneId: 'kopf', getWunden: () => 0 }],
      0
    )
    expect(r.total).toBe(0)
    expect(r.title).toMatch(/Keine automatischen/)
    expect(r.activeFields).toEqual([])
  })

  it('summarizes LE- und Wund-FK when present', () => {
    const r = buildLePopoverModSummary(
      [
        { zoneId: 'brust', getWunden: () => 1 },
        { zoneId: 'bauch', getWunden: () => 0 },
      ],
      0
    )
    expect(r.total).toBeGreaterThan(0)
    expect(r.title).toMatch(/AT:/)
    expect(r.title).toMatch(/W −2/)
  })
})
