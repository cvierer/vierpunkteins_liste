import { describe, expect, it } from 'vitest'
import {
  NEG_LE_KO_RANGE,
  blinkStopLeBoundaryForMode,
  isDeathTriggeredForLeUi,
  leThresholdMalusForValues,
  parseIntOrNull,
  parseNonNegIntOrNull,
  resolveDeathModeForLeUi,
} from './heroExpandGauges.js'

describe('parseIntOrNull', () => {
  it('parst ganze Zahlen inkl. negativer Werte', () => {
    expect(parseIntOrNull('12')).toBe(12)
    expect(parseIntOrNull('-3')).toBe(-3)
    expect(parseIntOrNull('  7 ')).toBe(7)
  })
  it('liefert null bei leer/ungültig', () => {
    expect(parseIntOrNull('')).toBeNull()
    expect(parseIntOrNull('   ')).toBeNull()
    expect(parseIntOrNull('abc')).toBeNull()
    expect(parseIntOrNull(null)).toBeNull()
    expect(parseIntOrNull(undefined)).toBeNull()
  })
})

describe('parseNonNegIntOrNull', () => {
  it('parst nicht-negative Zahlen', () => {
    expect(parseNonNegIntOrNull('0')).toBe(0)
    expect(parseNonNegIntOrNull('42')).toBe(42)
  })
  it('liefert null bei negativ/leer/ungültig', () => {
    expect(parseNonNegIntOrNull('-1')).toBeNull()
    expect(parseNonNegIntOrNull('')).toBeNull()
    expect(parseNonNegIntOrNull('x')).toBeNull()
  })
})

describe('leThresholdMalusForValues', () => {
  it('liefert 0 bei ungültigen Eingaben', () => {
    expect(leThresholdMalusForValues(null, 30, null)).toBe(0)
    expect(leThresholdMalusForValues(15, null, null)).toBe(0)
    expect(leThresholdMalusForValues(15, 0, null)).toBe(0)
  })
  it('berechnet AT/PA-Malus aus dem LE-Band', () => {
    expect(leThresholdMalusForValues(30, 30, null)).toBe(0) // ≥ 1/2 → kein Malus
    expect(leThresholdMalusForValues(14, 30, null)).toBe(1) // < 1/2
    expect(leThresholdMalusForValues(9, 30, null)).toBe(2) // < 1/3
    expect(leThresholdMalusForValues(7, 30, null)).toBe(3) // < 1/4
    expect(leThresholdMalusForValues(0, 30, null)).toBe(3) // LE ≤ 0
  })
  it('berücksichtigt eine eigene Schwelle', () => {
    expect(leThresholdMalusForValues(10, 30, 12)).toBe(3) // le ≤ Schwelle → band 3
  })
})

describe('resolveDeathModeForLeUi', () => {
  it('liest explizite deathMode-Werte (case-insensitiv)', () => {
    expect(resolveDeathModeForLeUi({ deathMode: 'lt0' })).toBe('lt0')
    expect(resolveDeathModeForLeUi({ deathMode: 'minusKo' })).toBe('minusKo')
    expect(resolveDeathModeForLeUi({ deathMode: 'MINUSONEPOINTFIVEKO' })).toBe(
      'minusOnePointFiveKo'
    )
  })
  it('fällt auf Legacy-Flag zurück', () => {
    expect(resolveDeathModeForLeUi({ deathAtMinusOnePointFiveKo: 'ja' })).toBe(
      'minusOnePointFiveKo'
    )
    expect(resolveDeathModeForLeUi({ deathAtMinusOnePointFiveKo: '1' })).toBe(
      'minusOnePointFiveKo'
    )
  })
  it('Default ist minusKo', () => {
    expect(resolveDeathModeForLeUi({})).toBe('minusKo')
    expect(resolveDeathModeForLeUi(null)).toBe('minusKo')
  })
})

describe('isDeathTriggeredForLeUi', () => {
  it('lt0: tot ab LE ≤ 0', () => {
    expect(isDeathTriggeredForLeUi(1, 12, 'lt0')).toBe(false)
    expect(isDeathTriggeredForLeUi(0, 12, 'lt0')).toBe(true)
    expect(isDeathTriggeredForLeUi(-1, null, 'lt0')).toBe(true)
  })
  it('minusKo: Tiefe ≥ KO', () => {
    expect(isDeathTriggeredForLeUi(-11, 12, 'minusKo')).toBe(false)
    expect(isDeathTriggeredForLeUi(-12, 12, 'minusKo')).toBe(true)
    expect(isDeathTriggeredForLeUi(-12, 0, 'minusKo')).toBe(false) // KO ungültig
  })
  it('minusOnePointFiveKo: Tiefe ≥ 1,5·KO', () => {
    expect(isDeathTriggeredForLeUi(-17, 12, 'minusOnePointFiveKo')).toBe(false)
    expect(isDeathTriggeredForLeUi(-18, 12, 'minusOnePointFiveKo')).toBe(true)
  })
  it('null-LE ist nie tot', () => {
    expect(isDeathTriggeredForLeUi(null, 12, 'minusKo')).toBe(false)
  })
})

describe('blinkStopLeBoundaryForMode', () => {
  it('lt0 → 0', () => {
    expect(blinkStopLeBoundaryForMode(12, 'lt0')).toBe(0)
  })
  it('ungültiges KO → -Infinity', () => {
    expect(blinkStopLeBoundaryForMode(0, 'minusKo')).toBe(Number.NEGATIVE_INFINITY)
    expect(blinkStopLeBoundaryForMode(null, 'minusKo')).toBe(
      Number.NEGATIVE_INFINITY
    )
  })
  it('minusKo → -KO, minusOnePointFiveKo → -1,5·KO', () => {
    expect(blinkStopLeBoundaryForMode(12, 'minusKo')).toBe(-12)
    expect(blinkStopLeBoundaryForMode(12, 'minusOnePointFiveKo')).toBe(-18)
  })
})

describe('NEG_LE_KO_RANGE', () => {
  it('ist 1,6', () => {
    expect(NEG_LE_KO_RANGE).toBe(1.6)
  })
})
