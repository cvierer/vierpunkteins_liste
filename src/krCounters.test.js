import { describe, expect, it } from 'vitest'
import {
  KR_ANG,
  KR_PRIMARY_LADUNG,
  motherHasTransferablePrimaryCharge,
  primaryChargeStampEligible,
} from './krCounters.js'

describe('primaryChargeStampEligible', () => {
  it('true wenn KR_PRIMARY_LADUNG geladen, krAng leer kodiert', () => {
    const meta = {
      krFirstSlotKind: 'ang',
      [KR_PRIMARY_LADUNG]: 0,
      [KR_ANG]: 1,
    }
    expect(primaryChargeStampEligible(meta)).toBe(true)
    expect(motherHasTransferablePrimaryCharge(meta)).toBe(true)
  })

  it('false wenn nur krAng leer ohne geladene KR_PRIMARY_LADUNG', () => {
    expect(
      primaryChargeStampEligible({
        krFirstSlotKind: 'ang',
        [KR_ANG]: 1,
      })
    ).toBe(false)
  })

  it('false bei laufender L.H. am Mutterfeld', () => {
    expect(
      primaryChargeStampEligible({
        krFirstSlotKind: 'lh',
        lhMax: 3,
        lhRemaining: 2,
      })
    ).toBe(false)
  })
})
