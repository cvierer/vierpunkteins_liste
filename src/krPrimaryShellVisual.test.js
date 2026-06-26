import { describe, expect, it } from 'vitest'
import {
  shouldKrPrimaryLhEmptyVisual,
  shouldKrPrimaryShellNoCharge,
  isLhEndSlotConvertible,
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

  describe('isLhEndSlotConvertible', () => {
    it('End-KR (L.H. sperrt nicht mehr): n.A.-Slot wird regulaer/umwandelbar', () => {
      expect(isLhEndSlotConvertible(true, false)).toBe(true)
    })

    it('L.H. sperrt noch Aktionen: n.A.-Slot bleibt gesperrter Stempel-Anker', () => {
      expect(isLhEndSlotConvertible(true, true)).toBe(false)
    })

    it('Kein lhEnd-Slot: nie umwandelbar ueber diesen Pfad', () => {
      expect(isLhEndSlotConvertible(false, false)).toBe(false)
      expect(isLhEndSlotConvertible(false, true)).toBe(false)
    })

    it('konvertierter n.A.-Slot (isRegularZaoSlot=true) wird bei kind ang nicht grau', () => {
      expect(
        shouldKrPrimaryShellNoCharge('ang', {
          isRegularZaoSlot: true,
          hasPrimaryCharge: false,
          lhVoided: false,
        })
      ).toBe(false)
    })
  })
})
