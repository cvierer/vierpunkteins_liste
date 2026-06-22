import { describe, expect, it } from 'vitest'
import {
  buildRoundIntroPendingPatch,
  isCombatAtRoundEndMarker,
} from './combatRoundNav.js'
import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './phaseLinks.js'

describe('isCombatAtRoundEndMarker', () => {
  it('true auf roundEnd ohne Phasen-Link', () => {
    expect(
      isCombatAtRoundEndMarker({
        currentItemId: ROUND_END_STEP_ID,
        currentPhaseLinkId: null,
      })
    ).toBe(true)
  })

  it('false auf Token-Zeile', () => {
    expect(
      isCombatAtRoundEndMarker({
        currentItemId: 'hero-a',
        currentPhaseLinkId: null,
      })
    ).toBe(false)
  })

  it('false wenn Phasen-Link gesetzt', () => {
    expect(
      isCombatAtRoundEndMarker({
        currentItemId: ROUND_END_STEP_ID,
        currentPhaseLinkId: 'zao1',
      })
    ).toBe(false)
  })
})

describe('buildRoundIntroPendingPatch', () => {
  it('setzt roundIntroPending und Merker', () => {
    const patch = buildRoundIntroPendingPatch(
      {
        round: 2,
        currentItemId: ROUND_END_STEP_ID,
        currentPhaseLinkId: null,
      },
      { kind: 'roundStart', id: ROUND_START_STEP_ID }
    )
    expect(patch.roundIntroPending).toBe(true)
    expect(patch.roundIntroPrevRound).toBe(2)
    expect(patch.roundIntroPrevItemId).toBe(ROUND_END_STEP_ID)
    expect(patch.currentItemId).toBe(ROUND_START_STEP_ID)
  })
})
