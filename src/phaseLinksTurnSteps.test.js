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
  findCombatStepIndexLoose,
  isStampableCombatStep,
  resolveCurrentNavIniForCombat,
  resolveNavIniFromCombatPosition,
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

  it('emittiert einen Token-Schritt und nur einen Aktions-Schritt pro 2.AO-Wurzel', () => {
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
    // Kein separater Reaktions-Substep mehr: Navigation springt direkt zum
    // naechsten Objekt.
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

  it('findCombatStepIndex: Token action und reaction teilen denselben Index', () => {
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
    const legacyNullIdx = findCombatStepIndex(steps, {
      currentItemId: 'hero-a',
      currentPhaseLinkId: null,
      currentTurnSubStep: null,
    })
    expect(actionIdx).toBeGreaterThanOrEqual(0)
    expect(reactionIdx).toBe(actionIdx)
    expect(legacyNullIdx).toBe(actionIdx)
    expect(steps[actionIdx]).toMatchObject({
      kind: 'token',
      id: 'hero-a',
      sub: 'action',
    })
  })

  it('findCombatStepIndex: 2.AO hat nur einen Aktions-Schritt (kein Reaktions-Schritt)', () => {
    const steps = buildCombatTurnSteps(tokenRows, items, [], 1)
    const actionIdx = findCombatStepIndex(steps, {
      currentItemId: 'hero-a',
      currentPhaseLinkId: 'zao1',
      currentTurnSubStep: 'action',
    })
    const reactionIdx = findCombatStepIndex(steps, {
      currentItemId: 'hero-a',
      currentPhaseLinkId: 'zao1',
      currentTurnSubStep: 'reaction',
    })
    expect(actionIdx).toBeGreaterThanOrEqual(0)
    // Reaktions-Substep existiert nicht mehr als eigener Schritt.
    expect(reactionIdx).toBe(-1)
    expect(
      steps.filter(
        (s) =>
          s.kind === 'phase' &&
          s.ownerId === 'hero-a' &&
          s.linkId === 'zao1'
      )
    ).toHaveLength(1)
  })

  it('combatPatchForStep setzt currentTurnSubStep action auf Token-Schritt', () => {
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

  it('isStampableCombatStep erkennt Token und ZAO-Wurzel nur bei action', () => {
    expect(isStampableCombatStep({ kind: 'token', id: 'x', sub: 'action' })).toBe(
      true
    )
    expect(isStampableCombatStep({ kind: 'token', id: 'x', sub: 'reaction' })).toBe(
      false
    )
    expect(
      isStampableCombatStep({
        kind: 'phase',
        ownerId: 'x',
        linkId: 'zao1',
        sub: 'action',
      })
    ).toBe(true)
    expect(
      isStampableCombatStep({
        kind: 'phase',
        ownerId: 'x',
        linkId: 'zao1',
        sub: 'reaction',
      })
    ).toBe(false)
    expect(isStampableCombatStep({ kind: 'roundStart', id: ROUND_START_STEP_ID })).toBe(
      false
    )
  })
})

describe('resolveNavIniFromCombatPosition', () => {
  const tokenRows = [{ id: 'hero-a', initiative: '17', name: 'A' }]
  const items = [
    item('hero-a', {
      initiative: '17',
      krFirstSlotKind: 'lh',
      phases: { links: [{ id: 'zao1', parentId: null }] },
      krZaoSlots: { zao1: { kind: 'lh', marks: 1 } },
    }),
  ]

  it('liefert Helden-INI auf Mutterzeile', () => {
    expect(
      resolveNavIniFromCombatPosition(tokenRows, items, {
        started: true,
        round: 1,
        currentItemId: 'hero-a',
        currentPhaseLinkId: null,
        currentTurnSubStep: 'action',
      })
    ).toBe(17)
  })

  it('resolveCurrentNavIniForCombat nutzt Fallback wenn Schritt nicht in steps', () => {
    const combat = {
      started: true,
      round: 1,
      roundIntroPending: false,
      currentItemId: 'hero-a',
      currentPhaseLinkId: 'zao1',
      currentTurnSubStep: 'action',
    }
    expect(
      resolveCurrentNavIniForCombat(tokenRows, items, [], 1, combat)
    ).toBe(17)
  })

  it('findCombatStepIndexLoose findet Phasen-Schritt ohne sub trotz action-Substep', () => {
    const steps = [
      { kind: 'roundStart', id: ROUND_START_STEP_ID },
      { kind: 'phase', ownerId: 'hero-a', linkId: 'zao-lhend' },
      { kind: 'roundEnd', id: ROUND_END_STEP_ID },
    ]
    const combat = {
      started: true,
      round: 1,
      currentItemId: 'hero-a',
      currentPhaseLinkId: 'zao-lhend',
      currentTurnSubStep: 'action',
    }
    expect(findCombatStepIndex(steps, combat)).toBe(1)
    const idxLoose = findCombatStepIndexLoose(steps, combat)
    expect(idxLoose).toBe(1)
    expect(steps[idxLoose]?.kind).toBe('phase')
  })

  it('resolveCurrentNavIniForCombat liefert -inf an roundEnd', () => {
    const combat = {
      started: true,
      round: 1,
      roundIntroPending: false,
      currentItemId: ROUND_END_STEP_ID,
      currentPhaseLinkId: null,
      currentTurnSubStep: null,
    }
    expect(
      resolveCurrentNavIniForCombat(tokenRows, items, [], 1, combat)
    ).toBe(Number.NEGATIVE_INFINITY)
  })
})

describe('lhEnd Kampf-Schritte', () => {
  const tokenRows = [{ id: 'hero-a', initiative: '17', name: 'A' }]
  const lhEndLinkId = 'lh-end-1'
  const items = [
    item('hero-a', {
      initiative: '17',
      krFirstSlotKind: 'lh',
      lhMax: 3,
      lhRem: 3,
      phases: {
        rowPanelOpen: true,
        links: [{ id: lhEndLinkId, parentId: null, offset: 8, lhEnd: true }],
      },
      krZaoSlots: { [lhEndLinkId]: { kind: 'lh', marks: 1 } },
    }),
  ]

  it('emittiert lhEnd mit sub action und ohne reaction-Schritt', () => {
    const steps = buildCombatTurnSteps(tokenRows, items, [], 1)
    const lhEndSteps = steps.filter(
      (s) =>
        s.kind === 'phase' &&
        s.ownerId === 'hero-a' &&
        s.linkId === lhEndLinkId
    )
    expect(lhEndSteps).toEqual([
      {
        kind: 'phase',
        ownerId: 'hero-a',
        linkId: lhEndLinkId,
        sub: 'action',
      },
    ])
  })

  it('findCombatStepIndex matcht lhEnd bei currentTurnSubStep null und action', () => {
    const steps = buildCombatTurnSteps(tokenRows, items, [], 1)
    const combatBase = {
      currentItemId: 'hero-a',
      currentPhaseLinkId: lhEndLinkId,
    }
    const idxNull = findCombatStepIndex(steps, {
      ...combatBase,
      currentTurnSubStep: null,
    })
    const idxAction = findCombatStepIndex(steps, {
      ...combatBase,
      currentTurnSubStep: 'action',
    })
    expect(idxNull).toBeGreaterThanOrEqual(0)
    expect(idxAction).toBe(idxNull)
    expect(steps[idxNull]).toMatchObject({
      kind: 'phase',
      linkId: lhEndLinkId,
      sub: 'action',
    })
  })

  it('isStampableCombatStep true für lhEnd action', () => {
    expect(
      isStampableCombatStep({
        kind: 'phase',
        ownerId: 'hero-a',
        linkId: lhEndLinkId,
        sub: 'action',
      })
    ).toBe(true)
  })

  it('resolveCurrentNavIniForCombat liefert Hook-INI der lhEnd-Zeile', () => {
    const combat = {
      started: true,
      round: 1,
      roundIntroPending: false,
      currentItemId: 'hero-a',
      currentPhaseLinkId: lhEndLinkId,
      currentTurnSubStep: null,
    }
    const navIni = resolveCurrentNavIniForCombat(tokenRows, items, [], 1, combat)
    expect(navIni).toBe(9)
  })
})
