import { describe, expect, it } from 'vitest'
import { KR_ANG } from './krMetaKeys.js'
import {
  LH_MAX,
  LH_REM,
  countMotherPrimaryStampsForItem,
  lhAwaitingCompletionStamp,
  lhCompletionStampReady,
  lhDisplayStepFromNav,
  lhEndsInRound,
  lhPieFraction,
  priorKrSpendRawForLhFreeze,
} from './lhMeta.js'

describe('lhAwaitingCompletionStamp', () => {
  it('true bei mehrteiliger L.H. mit rem 1 (GO!)', () => {
    expect(
      lhAwaitingCompletionStamp({ [LH_MAX]: 3, [LH_REM]: 1 })
    ).toBe(true)
  })
  it('false bei einteiliger L.H. (max 1, rem 1)', () => {
    expect(
      lhAwaitingCompletionStamp({ [LH_MAX]: 1, [LH_REM]: 1 })
    ).toBe(false)
  })
  it('false bei mittendrin (rem > 1)', () => {
    expect(
      lhAwaitingCompletionStamp({ [LH_MAX]: 3, [LH_REM]: 2 })
    ).toBe(false)
  })
})

describe('lhCompletionStampReady', () => {
  it('true wenn Pie voll (frac >= 1)', () => {
    expect(
      lhCompletionStampReady(
        {
          initiative: '17',
          [LH_MAX]: 1,
          [LH_REM]: 1,
          lhCommitRound: 1,
          lhCommitIni: 17,
        },
        1,
        17
      )
    ).toBe(true)
  })

  it('false bei voided Mutter-L.H.', () => {
    expect(
      lhCompletionStampReady(
        {
          initiative: '17',
          krFirstSlotKind: 'lh',
          krLhVoidByTransfer: true,
          [LH_MAX]: 1,
          [LH_REM]: 1,
          lhCommitRound: 1,
        },
        1,
        17
      )
    ).toBe(false)
  })

  it('false ohne laufende L.H. (max 0)', () => {
    expect(lhCompletionStampReady({ initiative: '17' }, 1, 17)).toBe(false)
  })

  it('false bei null Nav-INI', () => {
    expect(
      lhCompletionStampReady(
        {
          initiative: '17',
          [LH_MAX]: 5,
          [LH_REM]: 5,
          lhCommitRound: 1,
          lhCommitIni: 17,
        },
        1,
        null
      )
    ).toBe(false)
  })

  it('false bei +inf Nav-INI und frischer mehrteiliger L.H.', () => {
    expect(
      lhCompletionStampReady(
        {
          initiative: '17',
          [LH_MAX]: 5,
          [LH_REM]: 5,
          lhCommitRound: 1,
          lhCommitIni: 17,
        },
        1,
        Number.POSITIVE_INFINITY
      )
    ).toBe(false)
  })
})

describe('lhDisplayStepFromNav', () => {
  const mechanics2Ap = {
    actionsPerKr: 2,
    triggerIniStep: -8,
  }

  it('at second trigger INI (hero−8): priorSpend 0 → step 2 / priorSpend 1 → step 1 (LH max 3)', () => {
    const heroIni = 17
    const navSecondTrigger = 9
    const commitIni = 17
    const commitRound = 1
    const currentRound = 1
    const lhMax = 3

    const stepNoPrior = lhDisplayStepFromNav(
      heroIni,
      mechanics2Ap,
      commitRound,
      currentRound,
      navSecondTrigger,
      lhMax,
      commitIni,
      0
    )
    const stepWithPrior = lhDisplayStepFromNav(
      heroIni,
      mechanics2Ap,
      commitRound,
      currentRound,
      navSecondTrigger,
      lhMax,
      commitIni,
      1
    )

    expect(stepNoPrior).toBe(2)
    expect(stepWithPrior).toBe(1)
  })

  it('steigt mit sinkender Nav-INI (Regression y/x bei Navigation)', () => {
    const heroIni = 17
    const lhMax = 5
    const mechanics = { actionsPerKr: 2, triggerIniStep: -8 }
    const stepAtHero = lhDisplayStepFromNav(
      heroIni,
      mechanics,
      1,
      1,
      17,
      lhMax
    )
    const stepBelowTrigger = lhDisplayStepFromNav(
      heroIni,
      mechanics,
      1,
      1,
      9,
      lhMax
    )
    expect(stepBelowTrigger).toBeGreaterThan(stepAtHero)
  })

  it('KR2 am Mutterobjekt: nach Prior 1 in KR1 → 2/3 (Fortschritt über KR wie gewohnt)', () => {
    const heroIni = 17
    const commitIni = 17
    const commitRound = 1
    const currentRound = 2
    const navMother = 17
    const lhMax = 3
    const priorFrozen = 1

    const stepMotherKr2 = lhDisplayStepFromNav(
      heroIni,
      mechanics2Ap,
      commitRound,
      currentRound,
      navMother,
      lhMax,
      commitIni,
      priorFrozen
    )

    expect(stepMotherKr2).toBe(2)
  })

  it('KR3 am Mutterobjekt mit Prior 1: 3/3 vor Ende an −8', () => {
    const stepMotherKr3 = lhDisplayStepFromNav(
      17,
      mechanics2Ap,
      1,
      3,
      17,
      3,
      17,
      1
    )
    expect(stepMotherKr3).toBe(3)
  })

  it('KR2 Mutter: L.H. auf 2.A. gestartet (commitIni zweite Zeile) + priorSpend 1 → Schritt 2/3, Pie 2/3', () => {
    const heroIni = 8
    const commitIniSecondAo = 0
    const navMother = 8
    const commitRound = 1
    const currentRound = 2
    const lhMax = 3
    const priorFrozen = 1

    const step = lhDisplayStepFromNav(
      heroIni,
      mechanics2Ap,
      commitRound,
      currentRound,
      navMother,
      lhMax,
      commitIniSecondAo,
      priorFrozen
    )
    expect(step).toBe(2)

    const frac = lhPieFraction(
      currentRound,
      navMother,
      commitRound,
      heroIni,
      mechanics2Ap.actionsPerKr,
      mechanics2Ap.triggerIniStep,
      lhMax,
      commitIniSecondAo,
      priorFrozen
    )
    expect(frac).toBeCloseTo(2 / 3, 6)
  })

  it('hero INI 11, Offset 8, max 4: KR1 Mutter → 1/4, Offset INI 3 → 2/4', () => {
    const heroIni = 11
    const mechanics = { actionsPerKr: 2, triggerIniStep: -8 }
    const commitRound = 1
    const currentRound = 1
    const commitIni = 11
    const lhMax = 4
    const priorSpend = 0

    expect(
      lhDisplayStepFromNav(
        heroIni,
        mechanics,
        commitRound,
        currentRound,
        11,
        lhMax,
        commitIni,
        priorSpend
      )
    ).toBe(1)

    expect(
      lhDisplayStepFromNav(
        heroIni,
        mechanics,
        commitRound,
        currentRound,
        3,
        lhMax,
        commitIni,
        priorSpend
      )
    ).toBe(2)
  })

  it('hero INI 11, priorSpend 0: KR2 Mutter INI 11 → 3/4', () => {
    expect(
      lhDisplayStepFromNav(
        11,
        { actionsPerKr: 2, triggerIniStep: -8 },
        1,
        2,
        11,
        4,
        11,
        0
      )
    ).toBe(3)
  })
})

describe('countMotherPrimaryStampsForItem / priorKrSpendRawForLhFreeze', () => {
  it('zählt nur Mutter-Primär-Stempel ohne Phasen-Anker', () => {
    const stamps = {
      entries: [
        {
          itemId: 'hero-a',
          field: KR_ANG,
          anchorPhaseLinkId: null,
          anchorRowId: 'hero-a',
        },
        {
          itemId: 'hero-a',
          field: KR_ANG,
          anchorPhaseLinkId: 'phase-1',
          anchorRowId: 'hero-a',
        },
        {
          itemId: 'hero-b',
          field: KR_ANG,
          anchorPhaseLinkId: null,
        },
      ],
    }
    expect(countMotherPrimaryStampsForItem('hero-a', stamps)).toBe(1)
  })

  it('priorKrSpendRawForLhFreeze: counter=1 ohne Stempel → 0', () => {
    expect(
      priorKrSpendRawForLhFreeze('hero-a', { entries: [] }, 1)
    ).toBe(0)
  })

  it('priorKrSpendRawForLhFreeze: Stempel zählen auch bei hohem Live-Counter', () => {
    const stamps = {
      entries: [
        {
          itemId: 'hero-a',
          field: KR_ANG,
          anchorPhaseLinkId: null,
          anchorRowId: 'hero-a',
        },
      ],
    }
    expect(priorKrSpendRawForLhFreeze('hero-a', stamps, 0)).toBe(1)
  })
})

describe('lhEndsInRound', () => {
  it('2.A.-Start mit priorSpend: Ende in KR2 auf 2.A.-INI', () => {
    const rKr1 = lhEndsInRound(3, 1, 1, 8, 2, -8, 0, 1)
    expect(rKr1.endsInThisRound).toBe(false)

    const rKr2 = lhEndsInRound(3, 1, 2, 8, 2, -8, 0, 1)
    expect(rKr2).toEqual({
      endsInThisRound: true,
      endIni: 0,
    })
  })

  it('2.A.-Start ohne restliche Commit-Ticks und max=1 endet auf commitIni', () => {
    const r = lhEndsInRound(1, 1, 1, 8, 2, -8, 0, 1)
    expect(r).toEqual({
      endsInThisRound: true,
      endIni: 0,
    })
  })
})
