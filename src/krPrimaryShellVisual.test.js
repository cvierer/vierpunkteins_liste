import { describe, expect, it } from 'vitest'
import {
  shouldKrPrimaryLhEmptyVisual,
  shouldKrPrimaryShellNoCharge,
} from './krPrimaryShellVisual.js'

describe('krPrimaryShellVisual', () => {
  it('shouldKrPrimaryShellNoCharge: L.H. gewählt ohne Ladung bleibt sichtbar', () => {
    expect(
      shouldKrPrimaryShellNoCharge('lh', {
        isRegularZaoSlot: false,
        hasPrimaryCharge: false,
        lhVoided: false,
      })
    ).toBe(false)
  })

  it('shouldKrPrimaryShellNoCharge: laufende L.H. mit Ladung bleibt sichtbar', () => {
    expect(
      shouldKrPrimaryShellNoCharge('lh', {
        isRegularZaoSlot: false,
        hasPrimaryCharge: true,
        lhVoided: false,
      })
    ).toBe(false)
  })

  it('shouldKrPrimaryShellNoCharge: S.R.A. ohne Ladung wird versteckt', () => {
    expect(
      shouldKrPrimaryShellNoCharge('sra', {
        isRegularZaoSlot: false,
        hasPrimaryCharge: false,
        lhVoided: false,
      })
    ).toBe(true)
  })

  it('shouldKrPrimaryShellNoCharge: reguläre 2.A.O. ohne Ladung bleibt sichtbar', () => {
    expect(
      shouldKrPrimaryShellNoCharge('ang', {
        isRegularZaoSlot: true,
        hasPrimaryCharge: false,
        lhVoided: false,
      })
    ).toBe(false)
  })

  it('shouldKrPrimaryLhEmptyVisual nur bei voided', () => {
    expect(shouldKrPrimaryLhEmptyVisual('lh', false)).toBe(false)
    expect(shouldKrPrimaryLhEmptyVisual('lh', true)).toBe(true)
    expect(shouldKrPrimaryLhEmptyVisual('sra', false)).toBe(false)
  })
})
