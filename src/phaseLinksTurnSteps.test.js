import { describe, expect, it, vi } from 'vitest'

vi.mock('./editAccess.js', () => ({
  isGmSync: vi.fn(() => true),
}))

vi.mock('./roomSettings.js', () => ({
  getRoomSettings: vi.fn(() => ({ convertLockState: 'open' })),
}))

import { TRACKER_ITEM_META_KEY } from './participants.js'
import {
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
  buildCombatTurnSteps,
  combatPatchForStep,
  findCombatStepIndex,
  isStampableCombatStep,
} from './phaseLinks.js'

function item(id, meta = {}) {
  return {
    id,
    name: id,
    metadata: { [TRACKER_ITEM_META_KEY]: meta },
  }
}

describe('buildCombatTurnSteps action step per row', () => {
  const tokenRows = [
    { id: 'hero-a', initiative: '10', name: 'A' },
    { id: 'hero-b', initiative: '5', name: 'B' },
  ]
  const items = [
    item('hero-a', {
      initiative: '10',
      krFirstSlotKind: 'ang',
      phases: { links: [{ id: 'zao1', parentId: null }] },
      krZaoSlots: { zao1: { kind: 'ang', marks: 1 } },
    }),
    item('hero-b', { initiative: '5', krFirstSlotKind: 'sra' }),
  ]

  it('emittiert einen action-Schritt pro Token und 2.AO-Wurzel', () => {
    const steps = buildCombatTurnSteps(tokenRows, items, [], 1)
    expect(steps[0]).toEqual({ kind: 'roundStart', id: ROUND_START_STEP_ID })
    expect(steps[steps.length - 1]).toEqual({
      kind: 'roundEnd',
      id: ROUND_END_STEP_ID,
    })
    const heroAToken = steps.filter((s) => s.kind === 'token' && s.id === 'hero-a')
    expect(heroAToken).toEqual([{ kind: 'token', id: 'hero-a', sub: 'action' }])
    const heroAZao = steps.filter(
      (s) =>
        s.kind === 'phase' && s.ownerId === 'hero-a' && s.linkId === 'zao1'
    )
    expect(heroAZao).toEqual([
      {
        kind: 'phase',
        ownerId: 'hero-a',
        linkId: 'zao1',
        sub: 'action',
      },
    ])
    expect(steps.filter((s) => s.kind === 'roundStart' || s.kind === 'roundEnd')).toHaveLength(2)
  })

  it('findCombatStepIndex: legacy reaction mappt auf action-Schritt', () => {
    const steps = buildCombatTurnSteps(tokenRows, items, [], 1)
    const actionIdx = findCombatStepIndex(steps, {
      currentItemId: 'hero-a',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'action',
    })
    const legacyReactionIdx = findCombatStepIndex(steps, {
      currentItemId: 'hero-a',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'reaction',
    })
    expect(actionIdx).toBeGreaterThanOrEqual(0)
    expect(legacyReactionIdx).toBe(actionIdx)
    expect(steps[actionIdx]).toMatchObject({
      kind: 'token',
      id: 'hero-a',
      sub: 'action',
    })
  })

  it('combatPatchForStep setzt currentTurnSubStep action', () => {
    expect(
      combatPatchForStep({ kind: 'token', id: 'hero-a', sub: 'action' })
    ).toMatchObject({
      currentItemId: 'hero-a',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'action',
    })
    expect(
      combatPatchForStep({ kind: 'roundStart', id: ROUND_START_STEP_ID })
    ).toMatchObject({ currentTurnSubStep: null })
  })

  it('isStampableCombatStep erkennt Token und ZAO-Wurzel', () => {
    expect(isStampableCombatStep({ kind: 'token', id: 'x', sub: 'action' })).toBe(
      true
    )
    expect(
      isStampableCombatStep({
        kind: 'phase',
        ownerId: 'x',
        linkId: 'zao1',
        sub: 'action',
      })
    ).toBe(true)
    expect(isStampableCombatStep({ kind: 'roundStart', id: ROUND_START_STEP_ID })).toBe(
      false
    )
  })
})
