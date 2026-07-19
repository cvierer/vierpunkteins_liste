import { describe, expect, it } from 'vitest'
import {
  LH_ACTIONS_PER_KR,
  LH_COMMIT_INI,
  LH_COMMIT_ROUND,
  LH_MAX,
  LH_REBASE_ROUND,
  LH_REBASE_TICKS,
  LH_REM,
  LH_TRIGGER_INI_STEP,
  lhDisplayStepFromNav,
  lhEndsInRound,
  lhPieFraction,
  rebaseLhCounterForIniChange,
  readLhCommitKrPriorSpendForRound,
} from './lhMeta.js'

function baseMeta(overrides = {}) {
  return {
    initiative: '7',
    [LH_MAX]: 6,
    [LH_REM]: 6,
    [LH_ACTIONS_PER_KR]: 2,
    [LH_TRIGGER_INI_STEP]: -8,
    [LH_COMMIT_ROUND]: 1,
    [LH_COMMIT_INI]: 7,
    ...overrides,
  }
}

const mech = { actionsPerKr: 2, triggerIniStep: -8 }

describe('rebaseLhCounterForIniChange', () => {
  it('friert Historie ein wenn INI 7→11 in KR 4 (effAp 1→2)', () => {
    const m = baseMeta()
    expect(rebaseLhCounterForIniChange(m, 4, '11')).toBe(true)
    expect(m[LH_REBASE_ROUND]).toBe(4)
    expect(m[LH_REBASE_TICKS]).toBe(3)
  })

  it('No-op wenn Tick-Zahl vor aktueller KR gleich bleibt (15→14, effAp 2)', () => {
    // Beide INIs: effAp=2, commitOffset bleibt 0 (neue INI ≤ commitIni).
    const m = baseMeta({
      initiative: '15',
      [LH_COMMIT_INI]: 15,
      [LH_MAX]: 8,
      [LH_REM]: 8,
    })
    expect(rebaseLhCounterForIniChange(m, 4, '14')).toBe(false)
    expect(m[LH_REBASE_ROUND]).toBeUndefined()
  })

  it('No-op bei Änderung in der Commit-KR', () => {
    const m = baseMeta()
    expect(rebaseLhCounterForIniChange(m, 1, '11')).toBe(false)
    expect(m[LH_REBASE_ROUND]).toBeUndefined()
  })

  it('No-op wenn L.H. inaktiv', () => {
    const m = baseMeta({ [LH_MAX]: 0, [LH_REM]: 0 })
    expect(rebaseLhCounterForIniChange(m, 4, '11')).toBe(false)
  })

  it('zweite INI-Änderung in derselben KR behält ersten Freeze', () => {
    const m = baseMeta()
    expect(rebaseLhCounterForIniChange(m, 4, '11')).toBe(true)
    expect(m[LH_REBASE_TICKS]).toBe(3)
    m.initiative = '11'
    expect(rebaseLhCounterForIniChange(m, 4, '15')).toBe(false)
    expect(m[LH_REBASE_ROUND]).toBe(4)
    expect(m[LH_REBASE_TICKS]).toBe(3)
  })

  it('INI-Senkung 11→7 friert 2/KR-Historie ein', () => {
    const m = baseMeta({
      initiative: '11',
      [LH_COMMIT_INI]: 11,
      [LH_MAX]: 8,
      [LH_REM]: 8,
    })
    // KR1–3 mit effAp=2 → 2 + 2*2 = 6 Ticks vor KR 4
    expect(rebaseLhCounterForIniChange(m, 4, '7')).toBe(true)
    expect(m[LH_REBASE_ROUND]).toBe(4)
    expect(m[LH_REBASE_TICKS]).toBe(6)
  })
})

describe('Counter nach Rebase (max 6, INI 7→11 in KR 4)', () => {
  function rebasedBaseline() {
    const m = baseMeta()
    rebaseLhCounterForIniChange(m, 4, '11')
    m.initiative = '11'
    return readLhCommitKrPriorSpendForRound(m, 4)
  }

  it('Anzeige KR 4 Mutter (nav 11) = 4, 2.AO (nav 3) = 5', () => {
    const prior = rebasedBaseline()
    expect(
      lhDisplayStepFromNav(11, mech, 1, 4, 11, 6, 7, prior)
    ).toBe(4)
    expect(
      lhDisplayStepFromNav(11, mech, 1, 4, 3, 6, 7, prior)
    ).toBe(5)
  })

  it('lhEndsInRound → Ende KR 5 an Mutter-INI 11', () => {
    const prior = rebasedBaseline()
    expect(lhEndsInRound(6, 1, 4, 11, 2, -8, 7, prior)).toEqual({
      endsInThisRound: false,
      endIni: null,
    })
    expect(lhEndsInRound(6, 1, 5, 11, 2, -8, 7, prior)).toEqual({
      endsInThisRound: true,
      endIni: 11,
    })
  })

  it('Pie-Anteil KR 4 an Mutter = 4/6', () => {
    const prior = rebasedBaseline()
    expect(lhPieFraction(4, 11, 1, 11, 2, -8, 6, 7, prior)).toBeCloseTo(4 / 6)
    expect(lhPieFraction(4, 3, 1, 11, 2, -8, 6, 7, prior)).toBeCloseTo(5 / 6)
  })
})

describe('Counter nach Rebase (max 5, INI 7→11 in KR 4)', () => {
  it('Ende bereits in KR 4 an INI 3 (2.AO)', () => {
    const m = baseMeta({ [LH_MAX]: 5, [LH_REM]: 5 })
    rebaseLhCounterForIniChange(m, 4, '11')
    m.initiative = '11'
    expect(m[LH_REBASE_TICKS]).toBe(3)
    const prior = readLhCommitKrPriorSpendForRound(m, 4)
    expect(lhEndsInRound(5, 1, 4, 11, 2, -8, 7, prior)).toEqual({
      endsInThisRound: true,
      endIni: 3,
    })
    expect(
      lhDisplayStepFromNav(11, mech, 1, 4, 3, 5, 7, prior)
    ).toBe(5)
  })
})

describe('ohne Rebase bleibt Legacy-Zahl-API kompatibel', () => {
  it('lhDisplayStepFromNav akzeptiert nackte prior-Zahl', () => {
    expect(
      lhDisplayStepFromNav(15, mech, 1, 1, 15, 5, 15, 0)
    ).toBe(1)
    expect(
      lhDisplayStepFromNav(15, mech, 1, 1, 15, 5, 15, 1)
    ).toBe(1)
  })
})
