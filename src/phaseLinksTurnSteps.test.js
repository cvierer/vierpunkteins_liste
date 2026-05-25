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
} from './phaseLinks.js'

function item(id, meta = {}) {
  return {
    id,
    name: id,
    metadata: { [TRACKER_ITEM_META_KEY]: meta },
  }
}

describe('buildCombatTurnSteps action/reaction split', () => {
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

  it('emittiert action/reaction-Paare für Token und 2.AO-Wurzel', () => {
    const steps = buildCombatTurnSteps(tokenRows, items, [], 1)
    expect(steps[0]).toEqual({ kind: 'roundStart', id: ROUND_START_STEP_ID })
    expect(steps[steps.length - 1]).toEqual({
      kind: 'roundEnd',
      id: ROUND_END_STEP_ID,
    })
    const heroAToken = steps.filter((s) => s.kind === 'token' && s.id === 'hero-a')
    expect(heroAToken).toEqual([
      { kind: 'token', id: 'hero-a', sub: 'action' },
      { kind: 'token', id: 'hero-a', sub: 'reaction' },
    ])
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
      {
        kind: 'phase',
        ownerId: 'hero-a',
        linkId: 'zao1',
        sub: 'reaction',
      },
    ])
    expect(steps.filter((s) => s.kind === 'roundStart' || s.kind === 'roundEnd')).toHaveLength(2)
    expect(steps.every((s) => s.sub === undefined || s.sub === 'action' || s.sub === 'reaction')).toBe(
      true
    )
  })

  it('findCombatStepIndex matcht currentTurnSubStep', () => {
    const steps = buildCombatTurnSteps(tokenRows, items, [], 1)
    const actionIdx = findCombatStepIndex(steps, {
      currentItemId: 'hero-a',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'action',
    })
    const reactionIdx = findCombatStepIndex(steps, {
      currentItemId: 'hero-a',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'reaction',
    })
    expect(actionIdx).toBeGreaterThanOrEqual(0)
    expect(reactionIdx).toBe(actionIdx + 1)
    expect(steps[actionIdx]).toMatchObject({
      kind: 'token',
      id: 'hero-a',
      sub: 'action',
    })
    expect(steps[reactionIdx]).toMatchObject({
      kind: 'token',
      id: 'hero-a',
      sub: 'reaction',
    })
  })

  it('combatPatchForStep setzt currentTurnSubStep', () => {
    expect(
      combatPatchForStep({ kind: 'token', id: 'hero-a', sub: 'reaction' })
    ).toMatchObject({
      currentItemId: 'hero-a',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'reaction',
    })
    expect(
      combatPatchForStep({ kind: 'roundStart', id: ROUND_START_STEP_ID })
    ).toMatchObject({ currentTurnSubStep: null })
  })
})
