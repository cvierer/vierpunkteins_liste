import { describe, expect, it } from 'vitest'
import {
  formatDeltaForTooltip,
  formatModChipValue,
} from './heroExpandModFormat.js'

describe('formatDeltaForTooltip', () => {
  it('positive Werte mit Aufwaerts-Pfeil', () => {
    expect(formatDeltaForTooltip(2)).toBe('\u21912')
    expect(formatDeltaForTooltip(10)).toBe('\u219110')
  })
  it('negative Werte mit Abwaerts-Pfeil und Betrag', () => {
    expect(formatDeltaForTooltip(-3)).toBe('\u21933')
  })
  it('Null und Ungueltiges ergeben "0"', () => {
    expect(formatDeltaForTooltip(0)).toBe('0')
    expect(formatDeltaForTooltip(NaN)).toBe('0')
    expect(formatDeltaForTooltip('abc')).toBe('0')
    expect(formatDeltaForTooltip(null)).toBe('0')
  })
  it('parst numerische Strings', () => {
    expect(formatDeltaForTooltip('4')).toBe('\u21914')
    expect(formatDeltaForTooltip('-1')).toBe('\u21931')
  })
})

describe('formatModChipValue', () => {
  it('Fixwert als =N', () => {
    expect(formatModChipValue(5, true)).toBe('=5')
    expect(formatModChipValue(0, true)).toBe('=0')
    expect(formatModChipValue(-2, true)).toBe('=-2')
  })
  it('ohne absolute wie Delta-Pfeile', () => {
    expect(formatModChipValue(2, false)).toBe('\u21912')
    expect(formatModChipValue(-3)).toBe('\u21933')
  })
})
