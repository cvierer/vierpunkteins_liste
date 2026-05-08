import { describe, expect, it, vi } from 'vitest'
import * as combatRoom from './combatRoom.js'
import {
  applyIniLockCharges,
  applyIniNegativePoolShiftForMetaMutation,
  effectiveHeroPoolSplit,
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  initKrActionPoolsFromHeroDefaults,
  KR_ABW,
  KR_ACTION_POOL_ABW_REM,
  KR_ACTION_POOL_ANG_REM,
  KR_INI_LOCK_MINUS_B,
  KR_INI_NEG_POOL_SHIFT_APPLIED,
  KR_PAIR_MODE,
  KR_FIRST_SLOT_KIND,
  readKrFirstSlotKind,
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
    expect(m[KR_ACTION_POOL_ANG_REM]).toBe(2)
    expect(m[KR_ACTION_POOL_ABW_REM]).toBe(2)
  })
})

describe('initKrActionPoolsFromHeroDefaults / INI-neg Flag', () => {
  it('sets KR_INI_NEG_POOL_SHIFT_APPLIED after load when INI < 0 and cfgAng >= 1', () => {
    const m = {
      ...poolMeta({ initiative: '-11' }),
      phases: { links: [], rowPanelOpen: false },
    }
    initKrActionPoolsFromHeroDefaults(m)
    expect(m[KR_INI_NEG_POOL_SHIFT_APPLIED]).toBe(1)
    expect(m[KR_ACTION_POOL_ANG_REM]).toBe(1)
    expect(m[KR_ACTION_POOL_ABW_REM]).toBe(3)
  })

  it('does not set flag when cfgAng is 0 with negative INI', () => {
    const m = {
      ...poolMeta({
        initiative: '-11',
        [HERO_ACTION_POOL_ANG]: 0,
        [HERO_ACTION_POOL_ABW]: 4,
      }),
      phases: { links: [], rowPanelOpen: false },
    }
    initKrActionPoolsFromHeroDefaults(m)
    expect(m[KR_INI_NEG_POOL_SHIFT_APPLIED]).toBeUndefined()
  })

  it('updates REM on leave-negative; KR_ABW unchanged if Kampf nicht gestartet', () => {
    const m = {
      ...poolMeta({ initiative: '-11' }),
      phases: { links: [], rowPanelOpen: false },
    }
    initKrActionPoolsFromHeroDefaults(m)
    const marksNeg = m[KR_ABW]
    m.initiative = '1'
    applyIniNegativePoolShiftForMetaMutation(m, true, false)
    expect(effectiveHeroPoolSplit(m)).toEqual({ ang: 2, abw: 2 })
    expect(m[KR_ACTION_POOL_ANG_REM]).toBe(2)
    expect(m[KR_ACTION_POOL_ABW_REM]).toBe(2)
    expect(m[KR_ABW]).toEqual(marksNeg)
  })

  it('rebuilds KR_ABW when leaving negative with Kampf gestartet', () => {
    vi.spyOn(combatRoom, 'getCombat').mockReturnValue({
      started: true,
      round: 1,
      currentItemId: null,
      currentPhaseLinkId: null,
      roundIntroPending: false,
      roundIntroPrevRound: null,
      roundIntroPrevItemId: null,
      roundIntroPrevPhaseLinkId: null,
    })
    try {
      const m = {
        ...poolMeta({ initiative: '-11' }),
        phases: { links: [], rowPanelOpen: false },
      }
      initKrActionPoolsFromHeroDefaults(m)
      const marksNeg = m[KR_ABW]
      m.initiative = '1'
      applyIniNegativePoolShiftForMetaMutation(m, true, false)
      expect(m[KR_ABW]).not.toEqual(marksNeg)
      expect(m[KR_ACTION_POOL_ANG_REM]).toBe(2)
      expect(m[KR_ACTION_POOL_ABW_REM]).toBe(2)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('setzt Mutter-Slot auf AN/ang_abw nach INI-Recovery (vorher SRA-Migration)', () => {
    vi.spyOn(combatRoom, 'getCombat').mockReturnValue({
      started: true,
      round: 1,
      currentItemId: null,
      currentPhaseLinkId: null,
      roundIntroPending: false,
      roundIntroPrevRound: null,
      roundIntroPrevItemId: null,
      roundIntroPrevPhaseLinkId: null,
    })
    try {
      const m = {
        ...poolMeta(),
        initiative: '-5',
        phases: { links: [], rowPanelOpen: false },
        [KR_FIRST_SLOT_KIND]: 'sra',
        [KR_PAIR_MODE]: 'sra_ang',
        [KR_ACTION_POOL_ANG_REM]: 1,
        [KR_ACTION_POOL_ABW_REM]: 3,
      }
      m.initiative = '4'
      applyIniNegativePoolShiftForMetaMutation(m, true, false)
      expect(readKrFirstSlotKind(m)).toBe('ang')
      expect(m[KR_PAIR_MODE]).toBe('ang_abw')
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('INI leave-negative: Lock vor Rebuild — keine extra KR_ABW-Mark durch minusB', () => {
    vi.spyOn(combatRoom, 'getCombat').mockReturnValue({
      started: true,
      round: 1,
      currentItemId: null,
      currentPhaseLinkId: null,
      roundIntroPending: false,
      roundIntroPrevRound: null,
      roundIntroPrevItemId: null,
      roundIntroPrevPhaseLinkId: null,
    })
    try {
      const m = {
        ...poolMeta({ initiative: '7' }),
        phases: { links: [], rowPanelOpen: false },
      }
      initKrActionPoolsFromHeroDefaults(m)
      const canonicalAbwDigit = m[KR_ABW]
      m[KR_INI_LOCK_MINUS_B] = 1

      applyIniLockCharges(m)
      applyIniNegativePoolShiftForMetaMutation(m, true, false)

      expect(m[KR_ABW]).toEqual(canonicalAbwDigit)
      expect(m[KR_INI_LOCK_MINUS_B]).toBeUndefined()

      const mBug = {
        ...poolMeta({ initiative: '7' }),
        phases: { links: [], rowPanelOpen: false },
      }
      initKrActionPoolsFromHeroDefaults(mBug)
      mBug[KR_INI_LOCK_MINUS_B] = 1
      applyIniNegativePoolShiftForMetaMutation(mBug, true, false)
      applyIniLockCharges(mBug)
      expect(mBug[KR_ABW]).not.toEqual(canonicalAbwDigit)
    } finally {
      vi.restoreAllMocks()
    }
  })
})
