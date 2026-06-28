import { afterEach, describe, expect, it } from 'vitest'
import {
  liveAbwCombatAllowsStamp,
  liveAbwStampAnchor,
  liveFaLadungAllowed,
} from './krAbwStampGates.js'
import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'
import { setNavStepsCache } from './navActivePhaseLink.js'

describe('krAbwStampGates', () => {
  const running = {
    started: true,
    roundIntroPending: false,
    currentItemId: 'hero-a',
    currentPhaseLinkId: null,
    round: 1,
  }

  it('liveAbwCombatAllowsStamp: true während normalem Zug', () => {
    expect(liveAbwCombatAllowsStamp(running)).toBe(true)
  })

  it('liveAbwCombatAllowsStamp: false bei roundIntroPending', () => {
    expect(
      liveAbwCombatAllowsStamp({ ...running, roundIntroPending: true })
    ).toBe(false)
  })

  it('liveAbwCombatAllowsStamp: false an KR-Beginn/Ende', () => {
    expect(
      liveAbwCombatAllowsStamp({
        ...running,
        currentItemId: ROUND_START_STEP_ID,
      })
    ).toBe(false)
    expect(
      liveAbwCombatAllowsStamp({
        ...running,
        currentItemId: ROUND_END_STEP_ID,
      })
    ).toBe(false)
  })

  it('liveAbwCombatAllowsStamp: true im Reaktions-Substep', () => {
    expect(
      liveAbwCombatAllowsStamp({
        ...running,
        currentTurnSubStep: 'reaction',
      })
    ).toBe(true)
  })

  it('liveFaLadungAllowed: gleiche KR-Grenzen', () => {
    expect(liveFaLadungAllowed(running)).toBe(true)
    expect(
      liveFaLadungAllowed({ ...running, currentItemId: ROUND_START_STEP_ID })
    ).toBe(false)
    expect(liveFaLadungAllowed({ started: false })).toBe(false)
  })

  it('liveAbwStampAnchor nutzt aktuelle Nav-Position', () => {
    expect(liveAbwStampAnchor('hero-b', running)).toEqual({
      rowId: 'hero-a',
      phaseLinkId: null,
    })
    expect(
      liveAbwStampAnchor('hero-b', {
        ...running,
        currentItemId: 'hero-b',
        currentPhaseLinkId: 'zao-1',
      })
    ).toEqual({
      rowId: 'hero-b',
      phaseLinkId: 'zao-1',
    })
  })
})

describe('liveAbwStampAnchor mit Step-Cache (UUID-Churn)', () => {
  afterEach(() => setNavStepsCache(null))

  const running = {
    started: true,
    roundIntroPending: false,
    currentItemId: 'hero-a',
    currentPhaseLinkId: 'stale-old',
    round: 1,
  }

  it('veraltete Phase-Link-ID wird auf aktuelle 2.AO-Wurzel aufgeloest', () => {
    setNavStepsCache([
      { kind: 'token', ownerId: 'hero-a', sub: 'action' },
      { kind: 'phase', ownerId: 'hero-a', linkId: 'zao-new', sub: 'action' },
    ])
    expect(liveAbwStampAnchor('hero-a', running)).toEqual({
      rowId: 'hero-a',
      phaseLinkId: 'zao-new',
    })
  })

  it('exakter Treffer bleibt unveraendert', () => {
    setNavStepsCache([
      { kind: 'phase', ownerId: 'hero-a', linkId: 'stale-old', sub: 'action' },
    ])
    expect(liveAbwStampAnchor('hero-a', running)).toEqual({
      rowId: 'hero-a',
      phaseLinkId: 'stale-old',
    })
  })

  it('null-phaseLinkId (Mutter-Zeile) bleibt null', () => {
    setNavStepsCache([
      { kind: 'phase', ownerId: 'hero-a', linkId: 'zao-new', sub: 'action' },
    ])
    expect(
      liveAbwStampAnchor('hero-a', { ...running, currentPhaseLinkId: null })
    ).toEqual({ rowId: 'hero-a', phaseLinkId: null })
  })

  it('ohne Cache bleibt die rohe Phase-Link-ID erhalten', () => {
    setNavStepsCache(null)
    expect(liveAbwStampAnchor('hero-a', running)).toEqual({
      rowId: 'hero-a',
      phaseLinkId: 'stale-old',
    })
  })
})
