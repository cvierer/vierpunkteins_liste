import { describe, expect, it } from 'vitest'
import { formatDeltaForTooltip } from './heroExpandModFormat.js'

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
