import { describe, expect, it } from 'vitest'
import {
  liveAbwCombatAllowsStamp,
  liveAbwStampAnchor,
  liveFaLadungAllowed,
} from './krAbwStampGates.js'
import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'

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
