import { describe, expect, it } from 'vitest'
import {
  applyIniNegativePoolShiftForMetaMutation,
  effectiveHeroPoolSplit,
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  KR_ACTION_POOL_ABW_REM,
  KR_ACTION_POOL_ANG_REM,
  KR_INI_NEG_POOL_SHIFT_APPLIED,
} from './krCounters.js'

function poolMeta(over = {}) {
  return {
    initiative: '10',
    [HERO_ACTION_POOL_MAX]: 4,
    [HERO_ACTION_POOL_ANG]: 2,
    [HERO_ACTION_POOL_ABW]: 2,
    ...over,
  }
}

describe('effectiveHeroPoolSplit', () => {
  it('matches configured pair when INI is non-negative', () => {
    const m = poolMeta({ initiative: '0' })
    expect(effectiveHeroPoolSplit(m)).toEqual({ ang: 2, abw: 2 })
  })

  it('shifts one unit from ang to abw when INI < 0 and cfgAng >= 1', () => {
    const m = poolMeta({ initiative: '-8' })
    expect(effectiveHeroPoolSplit(m)).toEqual({ ang: 1, abw: 3 })
  })

  it('does not reduce ang below zero when cfgAng is 0', () => {
    const m = poolMeta({
      initiative: '-1',
      [HERO_ACTION_POOL_ANG]: 0,
      [HERO_ACTION_POOL_ABW]: 4,
      [HERO_ACTION_POOL_MAX]: 4,
    })
    expect(effectiveHeroPoolSplit(m)).toEqual({ ang: 0, abw: 4 })
  })
})

describe('applyIniNegativePoolShiftForMetaMutation', () => {
  it('moves one REM unit when crossing into negative INI and restores when leaving', () => {
    const m = {
      ...poolMeta(),
      [KR_ACTION_POOL_ANG_REM]: 2,
      [KR_ACTION_POOL_ABW_REM]: 2,
    }
    m.initiative = '-1'
    applyIniNegativePoolShiftForMetaMutation(m, false, true)
    expect(m[KR_ACTION_POOL_ANG_REM]).toBe(1)
    expect(m[KR_ACTION_POOL_ABW_REM]).toBe(3)
    expect(m[KR_INI_NEG_POOL_SHIFT_APPLIED]).toBe(1)

    m.initiative = '5'
    applyIniNegativePoolShiftForMetaMutation(m, true, false)
    expect(m[KR_ACTION_POOL_ANG_REM]).toBe(2)
    expect(m[KR_ACTION_POOL_ABW_REM]).toBe(2)
    expect(m[KR_INI_NEG_POOL_SHIFT_APPLIED]).toBeUndefined()
  })

  it('does not drift when crossing twice with same REM start', () => {
    const m = {
      ...poolMeta(),
      [KR_ACTION_POOL_ANG_REM]: 2,
      [KR_ACTION_POOL_ABW_REM]: 2,
    }
    const snapshot = () => ({
      a: m[KR_ACTION_POOL_ANG_REM],
      b: m[KR_ACTION_POOL_ABW_REM],
      f: m[KR_INI_NEG_POOL_SHIFT_APPLIED],
    })
    const start = snapshot()
    m.initiative = '-2'
    applyIniNegativePoolShiftForMetaMutation(m, false, true)
    m.initiative = '1'
    applyIniNegativePoolShiftForMetaMutation(m, true, false)
    expect(snapshot()).toEqual(start)
  })

  it('does not set shift flag when ang_rem was already 0 on entering negative', () => {
    const m = {
      ...poolMeta(),
      [KR_ACTION_POOL_ANG_REM]: 0,
      [KR_ACTION_POOL_ABW_REM]: 4,
    }
    m.initiative = '-3'
    applyIniNegativePoolShiftForMetaMutation(m, false, true)
    expect(m[KR_INI_NEG_POOL_SHIFT_APPLIED]).toBeUndefined()
    m.initiative = '8'
    applyIniNegativePoolShiftForMetaMutation(m, true, false)
    expect(m[KR_ACTION_POOL_ANG_REM]).toBe(0)
    expect(m[KR_ACTION_POOL_ABW_REM]).toBe(4)
  })
})
