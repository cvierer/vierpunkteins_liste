import { describe, expect, it } from 'vitest'
import { lhDisplayStepFromNav, lhEndsInRound } from './lhMeta.js'
import {
  basisHeroExpandSnapshotFromDisplayed,
  basisTpStringFromDisplayedIntegrated,
  countHeroModUiSlots,
  formatTpDisplayIntegrated,
  generateModBundleId,
  HERO_EX_MODS,
  MAX_MOD_LABEL_LEN,
  MOD_DISPLAY_MODE,
  MOD_FIELDS,
  effectiveDeltaForField,
  krIntervalsPassed,
  listActiveMods,
  modEffectiveContribution,
  modNavCountdownLabelFromNav,
  modNavFractionLabelFromNav,
  modRemaining,
  normalizeModLabel,
  readHeroExMods,
  readModDisplayMode,
  ticksPassedForMod,
} from './heroExMods.js'
import { readOwnerIniReferenceForMods } from './ownerIniReference.js'

const MECH_DEFAULT = { actionsPerKr: 2, triggerIniStep: -8 }

/** @returns {import('./heroExMods.js').HeroExMod} */
function mkMod(overrides = {}) {
  return {
    id: 'm1',
    field: 'at',
    delta: 2,
    duration: 5,
    addedRound: 1,
    addedNavIni: Number.POSITIVE_INFINITY,
    ...overrides,
  }
}

describe('normalizeModLabel', () => {
  it('trims and caps length', () => {
    expect(normalizeModLabel('  foo  ')).toBe('foo')
    expect(normalizeModLabel('')).toBe('')
    expect(normalizeModLabel(null)).toBe('')
    const long = 'a'.repeat(MAX_MOD_LABEL_LEN + 8)
    expect(normalizeModLabel(long).length).toBe(MAX_MOD_LABEL_LEN)
  })
})

describe('generateModBundleId', () => {
  it('returns a non-empty bun- id', () => {
    const id = generateModBundleId()
    expect(typeof id).toBe('string')
    expect(id.startsWith('bun-')).toBe(true)
    expect(id.length).toBeGreaterThan(8)
  })
})

describe('countHeroModUiSlots', () => {
  it('counts each standalone mod as one slot', () => {
    expect(
      countHeroModUiSlots([
        mkMod({ id: 'a', field: 'at' }),
        mkMod({ id: 'b', field: 'pa' }),
      ])
    ).toBe(2)
  })

  it('counts a bundle only once', () => {
    expect(
      countHeroModUiSlots([
        mkMod({ id: 'a', bundleId: 'bun-test', field: 'at' }),
        mkMod({ id: 'b', bundleId: 'bun-test', field: 'pa' }),
      ])
    ).toBe(1)
  })
})

describe('readOwnerIniReferenceForMods', () => {
  it('prefers IB − BE + W6 when complete', () => {
    const meta = {
      heroExIb: '10',
      heroExBe: '1',
      heroExW6: '2',
      initiative: '99',
    }
    expect(readOwnerIniReferenceForMods(meta)).toBe(11)
  })

  it('falls back to initiative when IB chain incomplete', () => {
    expect(readOwnerIniReferenceForMods({ initiative: '8' })).toBe(8)
    expect(readOwnerIniReferenceForMods({ heroExIb: '10', initiative: '7' })).toBe(
      7
    )
  })
})

describe('formatTpDisplayIntegrated', () => {
  it('bumps last number or appends signed delta', () => {
    expect(formatTpDisplayIntegrated('SP 12', 3)).toBe('SP +15')
    expect(formatTpDisplayIntegrated('foo', 4)).toBe('foo +4')
    expect(formatTpDisplayIntegrated('foo', -2)).toBe('foo -2')
    expect(formatTpDisplayIntegrated('x', 0)).toBe('x')
  })

  it('avoids +- after unary plus segment and uses +0 when result is zero', () => {
    expect(formatTpDisplayIntegrated('note +1', -2)).toBe('note -1')
    expect(formatTpDisplayIntegrated('note +1', -1)).toBe('note +0')
    expect(formatTpDisplayIntegrated('SP 5', -5)).toBe('SP +0')
  })
})

describe('basisTpStringFromDisplayedIntegrated', () => {
  it('inverts TP integrated display', () => {
    const meta = {
      [MOD_DISPLAY_MODE]: 'integrated',
      [HERO_EX_MODS]: [
        mkMod({
          field: 'tp',
          delta: 2,
          duration: 5,
          addedRound: 1,
          addedNavIni: Number.POSITIVE_INFINITY,
        }),
      ],
    }
    const owner = 10
    const round = 1
    const nav = Number.POSITIVE_INFINITY
    expect(effectiveDeltaForField(meta, 'tp', owner, round, nav)).toBe(2)
    const disp = formatTpDisplayIntegrated('9', 2)
    expect(disp).toBe('+11')
    expect(
      basisTpStringFromDisplayedIntegrated(meta, disp, owner, round, nav)
    ).toBe('9')
    const disp2 = formatTpDisplayIntegrated('note', 2)
    expect(disp2).toBe('note +2')
    expect(
      basisTpStringFromDisplayedIntegrated(meta, disp2, owner, round, nav)
    ).toBe('note')
  })
})

describe('readModDisplayMode', () => {
  it('defaults to separate', () => {
    expect(readModDisplayMode(undefined)).toBe('separate')
    expect(readModDisplayMode({})).toBe('separate')
    expect(readModDisplayMode({ [MOD_DISPLAY_MODE]: 'nope' })).toBe('separate')
  })

  it('accepts integrated', () => {
    expect(
      readModDisplayMode({ [MOD_DISPLAY_MODE]: 'integrated' })
    ).toBe('integrated')
  })
})

describe('basisHeroExpandSnapshotFromDisplayed', () => {
  it('passes through if not integrated or no owner INI', () => {
    const g = { at: '12', pa: '10' }
    expect(
      basisHeroExpandSnapshotFromDisplayed(
        { [MOD_DISPLAY_MODE]: 'separate' },
        g,
        5,
        1,
        Number.POSITIVE_INFINITY
      )
    ).toEqual(g)
    expect(
      basisHeroExpandSnapshotFromDisplayed(
        { [MOD_DISPLAY_MODE]: 'integrated' },
        g,
        null,
        1,
        Number.POSITIVE_INFINITY
      )
    ).toEqual(g)
  })

  it('subtracts effective mod delta for integer fields', () => {
    const meta = {
      [MOD_DISPLAY_MODE]: 'integrated',
      [HERO_EX_MODS]: [
        mkMod({
          field: 'at',
          delta: 2,
          duration: 5,
          addedRound: 1,
          addedNavIni: Number.POSITIVE_INFINITY,
        }),
      ],
    }
    const ownerIni = 12
    const displayed = { at: '14' }
    const basis = basisHeroExpandSnapshotFromDisplayed(
      meta,
      displayed,
      ownerIni,
      1,
      Number.POSITIVE_INFINITY
    )
    expect(basis.at).toBe('12')
  })
})

describe('readHeroExMods', () => {
  it('preserves bundleId when present', () => {
    const meta = {
      [HERO_EX_MODS]: [
        {
          id: 'a',
          field: 'at',
          delta: 1,
          duration: 3,
          addedRound: 1,
          addedNavIni: Number.POSITIVE_INFINITY,
          bundleId: 'bun-test-1',
        },
        {
          id: 'b',
          field: 'kl',
          delta: 2,
          duration: 3,
          addedRound: 1,
          addedNavIni: Number.POSITIVE_INFINITY,
          bundleId: 'bun-test-1',
        },
      ],
    }
    const got = readHeroExMods(meta)
    expect(got).toHaveLength(2)
    expect(got[0].bundleId).toBe('bun-test-1')
    expect(got[1].bundleId).toBe('bun-test-1')
  })

  it('returns [] for missing/invalid meta', () => {
    expect(readHeroExMods(undefined)).toEqual([])
    expect(readHeroExMods({})).toEqual([])
    expect(readHeroExMods({ [HERO_EX_MODS]: null })).toEqual([])
    expect(readHeroExMods({ [HERO_EX_MODS]: 'oops' })).toEqual([])
  })

  it('drops entries with unknown field or invalid duration; keeps delta 0', () => {
    const meta = {
      [HERO_EX_MODS]: [
        { id: 'a', field: 'at', delta: 2, duration: 3, addedRound: 1 },
        { id: 'b', field: 'unknown', delta: 1, duration: 1, addedRound: 1 },
        { id: 'c', field: 'pa', delta: 0, duration: 5, addedRound: 1 },
        { id: 'd', field: 'ws', delta: -1, duration: 0, addedRound: 1 },
        null,
      ],
    }
    const got = readHeroExMods(meta)
    expect(got.length).toBe(2)
    expect(got.map((m) => m.id).sort()).toEqual(['a', 'c'])
    expect(got.find((m) => m.id === 'c')?.delta).toBe(0)
  })

  it('contains a curated whitelist of fields', () => {
    expect(MOD_FIELDS).toContain('at')
    expect(MOD_FIELDS).toContain('pa')
    expect(MOD_FIELDS).toContain('ib')
    expect(MOD_FIELDS).toContain('be')
    expect(MOD_FIELDS).toContain('mr')
    expect(MOD_FIELDS).toContain('ws')
    expect(MOD_FIELDS).toContain('mu')
    expect(MOD_FIELDS).toContain('inn')
  })
})

describe('ticksPassedForMod (committed at roundStart)', () => {
  const ownerIni = 15
  const cr1Mod = mkMod({ addedRound: 1, addedNavIni: Number.POSITIVE_INFINITY })

  it('roundStart of commit-KR has 0 ticks passed', () => {
    expect(
      ticksPassedForMod(cr1Mod, ownerIni, 1, Number.POSITIVE_INFINITY, MECH_DEFAULT)
    ).toBe(0)
  })

  it('hero-turn (navIni=ownerIni) matches LH trigger reached (nav <= T0)', () => {
    expect(ticksPassedForMod(cr1Mod, ownerIni, 1, ownerIni, MECH_DEFAULT)).toBe(1)
  })

  it('phase-offset (navIni=ownerIni-8) counts both T0 and T1 reached', () => {
    expect(
      ticksPassedForMod(cr1Mod, ownerIni, 1, ownerIni - 8, MECH_DEFAULT)
    ).toBe(2)
  })

  it('roundEnd of commit-KR has full effAp ticks', () => {
    expect(
      ticksPassedForMod(cr1Mod, ownerIni, 1, Number.NEGATIVE_INFINITY, MECH_DEFAULT)
    ).toBe(2)
  })

  it('roundStart of next KR keeps prior-KR ticks', () => {
    expect(
      ticksPassedForMod(cr1Mod, ownerIni, 2, Number.POSITIVE_INFINITY, MECH_DEFAULT)
    ).toBe(2)
  })

  it('hero-turn KR2 = 3 ticks, phase-offset KR2 = 4', () => {
    expect(ticksPassedForMod(cr1Mod, ownerIni, 2, 15, MECH_DEFAULT)).toBe(3)
    expect(ticksPassedForMod(cr1Mod, ownerIni, 2, 7, MECH_DEFAULT)).toBe(4)
  })
})

describe('modRemaining and expiry', () => {
  const ownerIni = 15
  it('5-action mod: aligned with LH-style nav (<= on triggers)', () => {
    const m = mkMod({
      duration: 5,
      addedRound: 1,
      addedNavIni: Number.POSITIVE_INFINITY,
    })
    expect(modRemaining(m, ownerIni, 1, Number.POSITIVE_INFINITY, MECH_DEFAULT)).toBe(5)
    expect(modRemaining(m, ownerIni, 1, 15, MECH_DEFAULT)).toBe(4)
    expect(modRemaining(m, ownerIni, 1, 14, MECH_DEFAULT)).toBe(4)
    expect(modRemaining(m, ownerIni, 1, 7, MECH_DEFAULT)).toBe(3)
    expect(modRemaining(m, ownerIni, 1, 6, MECH_DEFAULT)).toBe(3)
    expect(modRemaining(m, ownerIni, 2, 15, MECH_DEFAULT)).toBe(2)
    expect(modRemaining(m, ownerIni, 2, 7, MECH_DEFAULT)).toBe(1)
    expect(modRemaining(m, ownerIni, 3, 15, MECH_DEFAULT)).toBe(0)
    expect(modRemaining(m, ownerIni, 3, 14, MECH_DEFAULT)).toBe(0)
  })

  it('mod committed mid-KR (after hero-turn, navIni=12)', () => {
    const m = mkMod({ duration: 4, addedRound: 1, addedNavIni: 12 })
    expect(modRemaining(m, 15, 1, 12, MECH_DEFAULT)).toBe(4)
    expect(modRemaining(m, 15, 1, 7, MECH_DEFAULT)).toBe(3)
    expect(modRemaining(m, 15, 1, 6, MECH_DEFAULT)).toBe(3)
    expect(modRemaining(m, 15, 2, 15, MECH_DEFAULT)).toBe(2)
  })
})

describe('INI < 0 special case (1 tick per KR)', () => {
  const m = mkMod({
    field: 'pa',
    delta: -1,
    duration: 3,
    addedRound: 1,
    addedNavIni: Number.POSITIVE_INFINITY,
  })
  it('only the hero-turn (k=0) counts; offset (k=1, T<0) ignored', () => {
    const owner = 5
    expect(modRemaining(m, owner, 1, Number.POSITIVE_INFINITY, MECH_DEFAULT)).toBe(3)
    expect(modRemaining(m, owner, 1, 5, MECH_DEFAULT)).toBe(2)
    expect(modRemaining(m, owner, 1, -3, MECH_DEFAULT)).toBe(2)
    expect(modRemaining(m, owner, 1, Number.NEGATIVE_INFINITY, MECH_DEFAULT)).toBe(2)
    expect(modRemaining(m, owner, 2, 5, MECH_DEFAULT)).toBe(1)
    expect(modRemaining(m, owner, 2, 4, MECH_DEFAULT)).toBe(1)
    expect(modRemaining(m, owner, 3, 5, MECH_DEFAULT)).toBe(0)
    expect(modRemaining(m, owner, 3, 4, MECH_DEFAULT)).toBe(0)
  })
})

describe('mod ticks vs lhDisplayStepFromNav', () => {
  const ownerIni = 15
  const m = mkMod({ duration: 5, addedRound: 1, addedNavIni: Number.POSITIVE_INFINITY })

  it('lhDisplayStepFromNav sanity (KR1 nav at second trigger)', () => {
    expect(lhDisplayStepFromNav(ownerIni, MECH_DEFAULT, 1, 1, 7, 5, undefined)).toBe(2)
  })

  it('lhDisplayStepFromNav subtracts one slot when priorKrSpend is 1 (commit KR)', () => {
    expect(lhDisplayStepFromNav(ownerIni, MECH_DEFAULT, 1, 1, 7, 5, undefined, 0)).toBe(2)
    expect(lhDisplayStepFromNav(ownerIni, MECH_DEFAULT, 1, 1, 7, 5, undefined, 1)).toBe(1)
  })

  it('lhEndsInRound respects priorKrSpend for same-round completion', () => {
    const noPrior = lhEndsInRound(2, 1, 1, 15, 2, -8, 15, 0)
    const withPrior = lhEndsInRound(2, 1, 1, 15, 2, -8, 15, 1)
    expect(noPrior.endsInThisRound && noPrior.endIni === 7).toBe(true)
    expect(withPrior.endsInThisRound).toBe(false)
  })

  it('ticksPassed matches raw sum inside lhDisplayStepFromNav', () => {
    const navs = [
      Number.POSITIVE_INFINITY,
      15,
      14,
      7,
      6,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      15,
      7,
    ]
    const rounds = [1, 1, 1, 1, 1, 1, 2, 2, 2]
    for (let i = 0; i < navs.length; i++) {
      const ticks = ticksPassedForMod(m, ownerIni, rounds[i], navs[i], MECH_DEFAULT)
      const step = lhDisplayStepFromNav(
        ownerIni,
        MECH_DEFAULT,
        1,
        rounds[i],
        navs[i],
        5,
        undefined
      )
      expect(Math.min(5, Math.max(1, ticks))).toBe(step)
    }
  })

  it('modNavFractionLabelFromNav matches LH fraction shape', () => {
    expect(modNavFractionLabelFromNav(m, ownerIni, MECH_DEFAULT, 1, Number.POSITIVE_INFINITY)).toBe(
      '1/5'
    )
    expect(modNavFractionLabelFromNav(m, ownerIni, MECH_DEFAULT, 1, 15)).toBe('1/5')
    expect(modNavFractionLabelFromNav(m, ownerIni, MECH_DEFAULT, 1, 7)).toBe('2/5')
  })

  it('modNavCountdownLabelFromNav shows remaining steps as one number', () => {
    expect(
      modNavCountdownLabelFromNav(m, ownerIni, MECH_DEFAULT, 1, Number.POSITIVE_INFINITY)
    ).toBe('5')
    expect(modNavCountdownLabelFromNav(m, ownerIni, MECH_DEFAULT, 1, 15)).toBe('5')
    expect(modNavCountdownLabelFromNav(m, ownerIni, MECH_DEFAULT, 1, 7)).toBe('4')
  })
})

describe('permanent mod', () => {
  const ownerIni = 15
  it('modRemaining stays full and label is infinity', () => {
    const m = mkMod({
      duration: 3,
      permanent: true,
      addedRound: 1,
      addedNavIni: Number.POSITIVE_INFINITY,
    })
    expect(modRemaining(m, ownerIni, 99, 15, MECH_DEFAULT)).toBe(3)
    expect(
      modNavFractionLabelFromNav(m, ownerIni, MECH_DEFAULT, 5, 15)
    ).toBe('\u221e')
  })

  it('effective contribution is flat delta', () => {
    const m = mkMod({
      delta: 4,
      permanent: true,
      duration: 1,
      addedRound: 1,
      addedNavIni: Number.POSITIVE_INFINITY,
    })
    expect(
      modEffectiveContribution(m, ownerIni, 2, 15, MECH_DEFAULT)
    ).toBe(4)
  })
})

describe('accrual action', () => {
  const ownerIni = 15
  const m = mkMod({
    accrual: 'action',
    delta: 2,
    duration: 5,
    addedRound: 1,
    addedNavIni: Number.POSITIVE_INFINITY,
  })

  it('contribution is delta * ticksPassed', () => {
    expect(
      modEffectiveContribution(m, ownerIni, 1, Number.POSITIVE_INFINITY, MECH_DEFAULT)
    ).toBe(0)
    expect(modEffectiveContribution(m, ownerIni, 1, ownerIni, MECH_DEFAULT)).toBe(2)
    expect(modEffectiveContribution(m, ownerIni, 1, ownerIni - 8, MECH_DEFAULT)).toBe(4)
  })
})

describe('accrual round', () => {
  const m = mkMod({
    accrual: 'round',
    delta: 3,
    duration: 4,
    addedRound: 2,
    addedNavIni: Number.POSITIVE_INFINITY,
  })

  it('krIntervalsPassed is zero on commit KR', () => {
    expect(krIntervalsPassed(m, 2)).toBe(0)
  })

  it('counts full rounds since addedRound', () => {
    expect(krIntervalsPassed(m, 3)).toBe(1)
    expect(krIntervalsPassed(m, 5)).toBe(3)
  })

  it('contribution is delta * kr passed', () => {
    const ownerIni = 15
    expect(
      modEffectiveContribution(m, ownerIni, 2, Number.POSITIVE_INFINITY, MECH_DEFAULT)
    ).toBe(0)
    expect(
      modEffectiveContribution(m, ownerIni, 3, Number.POSITIVE_INFINITY, MECH_DEFAULT)
    ).toBe(3)
    expect(
      modEffectiveContribution(m, ownerIni, 5, Number.POSITIVE_INFINITY, MECH_DEFAULT)
    ).toBe(9)
  })

  it('expires when kr intervals reach duration', () => {
    const ownerIni = 15
    expect(modRemaining(m, ownerIni, 5, Number.POSITIVE_INFINITY, MECH_DEFAULT)).toBe(1)
    expect(modRemaining(m, ownerIni, 6, Number.POSITIVE_INFINITY, MECH_DEFAULT)).toBe(0)
  })

  it('modNavFractionLabelFromNav uses KR step', () => {
    const ownerIni = 15
    expect(
      modNavFractionLabelFromNav(m, ownerIni, MECH_DEFAULT, 2, Number.POSITIVE_INFINITY)
    ).toBe('1/4')
    expect(
      modNavFractionLabelFromNav(m, ownerIni, MECH_DEFAULT, 3, Number.POSITIVE_INFINITY)
    ).toBe('2/4')
  })

  it('modNavCountdownLabelFromNav counts down KR accrual', () => {
    const ownerIni = 15
    expect(
      modNavCountdownLabelFromNav(m, ownerIni, MECH_DEFAULT, 2, Number.POSITIVE_INFINITY)
    ).toBe('4')
    expect(
      modNavCountdownLabelFromNav(m, ownerIni, MECH_DEFAULT, 3, Number.POSITIVE_INFINITY)
    ).toBe('3')
  })
})

describe('permanent + action accrual (uncapped growth)', () => {
  const ownerIni = 15
  const m = mkMod({
    permanent: true,
    accrual: 'action',
    delta: 1,
    duration: 1,
    addedRound: 1,
    addedNavIni: Number.POSITIVE_INFINITY,
  })

  it('contribution grows with ticks (not capped by duration when permanent)', () => {
    const a = modEffectiveContribution(m, ownerIni, 2, 15, MECH_DEFAULT)
    const b = modEffectiveContribution(m, ownerIni, 3, Number.NEGATIVE_INFINITY, MECH_DEFAULT)
    expect(b).toBeGreaterThan(a)
  })
})

describe('effectiveDeltaForField + listActiveMods', () => {
  const owner = 15
  const meta = {
    initiative: '15',
    [HERO_EX_MODS]: [
      {
        id: 'm1',
        field: 'at',
        delta: 2,
        duration: 3,
        addedRound: 1,
        addedNavIni: Number.POSITIVE_INFINITY,
      },
      {
        id: 'm2',
        field: 'at',
        delta: -1,
        duration: 5,
        addedRound: 1,
        addedNavIni: Number.POSITIVE_INFINITY,
      },
      {
        id: 'm3',
        field: 'pa',
        delta: 1,
        duration: 1,
        addedRound: 1,
        addedNavIni: Number.POSITIVE_INFINITY,
      },
    ],
  }

  it('sums multiple stacked mods on the same field', () => {
    expect(effectiveDeltaForField(meta, 'at', owner, 1, Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('drops expired mods from the sum', () => {
    expect(effectiveDeltaForField(meta, 'at', owner, 2, 14)).toBe(-1)
  })

  it('listActiveMods filters expired and adds remaining', () => {
    const list = listActiveMods(meta, owner, 1, Number.POSITIVE_INFINITY)
    expect(list).toHaveLength(3)
    expect(list.find((m) => m.id === 'm1')?.remaining).toBe(3)
    expect(list.find((m) => m.id === 'm3')?.remaining).toBe(1)

    const list2 = listActiveMods(meta, owner, 1, 14)
    expect(list2.find((m) => m.id === 'm3')).toBeUndefined()
  })
})
