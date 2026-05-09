import { describe, expect, it } from 'vitest'
import {
  LH_MAX,
  LH_REM,
  lhAwaitingCompletionStamp,
  lhDisplayStepFromNav,
  lhEndsInRound,
  lhPieFraction,
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
