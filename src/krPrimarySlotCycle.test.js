import { describe, expect, it } from 'vitest'
import {
  KR_FIRST_SLOT_KIND,
  KR_ZAO_SLOTS,
  HERO_INI_NEG_ANG_MODE,
  cycleKrPrimarySlotKind,
  isKrPrimarySlotIniLocked,
  nextKrPrimarySlotKind,
  prevKrPrimarySlotKind,
  resolveKrPrimarySlotKind,
} from './krCounters.js'

describe('krPrimarySlotCycle', () => {
  it('nextKrPrimarySlotKind cycles AN → A → L.H. → UO → AN', () => {
    expect(nextKrPrimarySlotKind('ang')).toBe('sra')
    expect(nextKrPrimarySlotKind('sra')).toBe('lh')
    expect(nextKrPrimarySlotKind('lh')).toBe('uo')
    expect(nextKrPrimarySlotKind('uo')).toBe('ang')
  })

  it('prevKrPrimarySlotKind cycles rückwärts', () => {
    expect(prevKrPrimarySlotKind('ang')).toBe('uo')
    expect(prevKrPrimarySlotKind('sra')).toBe('ang')
    expect(prevKrPrimarySlotKind('lh')).toBe('sra')
    expect(prevKrPrimarySlotKind('uo')).toBe('lh')
  })

  it('cycleKrPrimarySlotKind überspringt ang bei iniLocked', () => {
    expect(cycleKrPrimarySlotKind('uo', 'next', true)).toBe('sra')
    expect(cycleKrPrimarySlotKind('sra', 'prev', true)).toBe('uo')
  })

  it('resolveKrPrimarySlotKind liest Mutter und ZAO', () => {
    expect(
      resolveKrPrimarySlotKind({ [KR_FIRST_SLOT_KIND]: 'lh' })
    ).toBe('lh')
    expect(
      resolveKrPrimarySlotKind(
        { [KR_ZAO_SLOTS]: { z1: { kind: 'uo', marks: 0, lodgedAbw: true } } },
        'z1'
      )
    ).toBe('uo')
  })

  it('isKrPrimarySlotIniLocked nur am Mutter-Slot', () => {
    expect(
      isKrPrimarySlotIniLocked({
        initiative: '-1',
        [HERO_INI_NEG_ANG_MODE]: 'no',
      })
    ).toBe(true)
    expect(
      isKrPrimarySlotIniLocked(
        { initiative: '-1', [HERO_INI_NEG_ANG_MODE]: 'no' },
        'zao-1'
      )
    ).toBe(false)
    expect(
      isKrPrimarySlotIniLocked({
        initiative: '-1',
        [HERO_INI_NEG_ANG_MODE]: 'yes',
      })
    ).toBe(false)
  })

  it('Step-Zyklus aus frischem Stand: sra + next → lh (nicht No-Op)', () => {
    const prevKind = 'sra'
    const staleNext = 'sra'
    const freshNext = cycleKrPrimarySlotKind(prevKind, 'next', false)
    expect(staleNext).toBe(prevKind)
    expect(freshNext).toBe('lh')
    expect(staleNext === prevKind).toBe(true)
    expect(freshNext !== prevKind).toBe(true)
  })
})
