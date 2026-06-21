import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      items: {
        getItems: vi.fn(async () => []),
      },
    },
  },
}))

vi.mock('./combatRoom.js', () => ({
  getCombat: vi.fn(() => ({ started: true, round: 1 })),
}))

vi.mock('./lhMeta.js', () => ({
  isLhLockingActions: vi.fn(() => false),
  lhCompletionStampReady: vi.fn(() => false),
}))

vi.mock('./krCounters.js', () => ({
  readKrFirstSlotKind: vi.fn(() => 'ang'),
  primaryFieldForKind: vi.fn(() => 'krAng'),
  readZaoSlot: vi.fn(() => ({ kind: 'ang', marks: 1 })),
  motherHasTransferablePrimaryCharge: vi.fn(() => true),
  patchKrCounterByDelta: vi.fn(async () => {}),
  patchZaoSlotStampPrimary: vi.fn(async () => {}),
  stampLhCompletion: vi.fn(async () => {}),
  KR_ANG: 'krAng',
  KR_SRA: 'krSra',
  KR_LH_ACTION: 'krLhAction',
}))

import {
  readKrFirstSlotKind,
  motherHasTransferablePrimaryCharge,
  patchKrCounterByDelta,
  patchZaoSlotStampPrimary,
  readZaoSlot,
  stampLhCompletion,
} from './krCounters.js'
import { lhCompletionStampReady } from './lhMeta.js'
import OBR from '@owlbear-rodeo/sdk'
import {
  autoStampForCombatStep,
  canAutoStampForCombatStep,
  shouldAutoStampActionToReaction,
} from './combatAutoStamp.js'

describe('shouldAutoStampActionToReaction', () => {
  it('true für gleichen Token action→reaction', () => {
    expect(
      shouldAutoStampActionToReaction(
        { kind: 'token', id: 'a', sub: 'action' },
        { kind: 'token', id: 'a', sub: 'reaction' }
      )
    ).toBe(true)
  })

  it('false bei unterschiedlichen Zeilen', () => {
    expect(
      shouldAutoStampActionToReaction(
        { kind: 'token', id: 'a', sub: 'action' },
        { kind: 'token', id: 'b', sub: 'reaction' }
      )
    ).toBe(false)
  })
})

describe('canAutoStampForCombatStep', () => {
  beforeEach(() => {
    vi.mocked(lhCompletionStampReady).mockReturnValue(false)
  })

  it('false bei uo', () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('uo')
    expect(
      canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        {}
      )
    ).toBe(false)
  })

  it('false ohne transferable charge', () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('ang')
    vi.mocked(motherHasTransferablePrimaryCharge).mockReturnValue(false)
    expect(
      canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        { krAng: 0 }
      )
    ).toBe(false)
  })

  it('true bei Mutter-L.H. wenn Pie stempelbar', () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    expect(
      canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        { lhMax: 1 }
      )
    ).toBe(true)
  })

  it('false bei Mutter-L.H. wenn Pie noch nicht voll', () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(lhCompletionStampReady).mockReturnValue(false)
    expect(
      canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        { lhMax: 3 }
      )
    ).toBe(false)
  })

  it('true bei ZAO-L.H.-Wurzel wenn Pie stempelbar', () => {
    vi.mocked(readZaoSlot).mockReturnValue({ kind: 'lh', marks: 1 })
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    expect(
      canAutoStampForCombatStep(
        { kind: 'phase', ownerId: 'a', linkId: 'zao-lh', sub: 'action' },
        { lhMax: 1 },
        { parentId: null }
      )
    ).toBe(true)
    expect(lhCompletionStampReady).toHaveBeenCalledWith(
      { lhMax: 1 },
      1,
      Number.POSITIVE_INFINITY,
      { zaoLhSlot: true }
    )
  })
})

describe('autoStampForCombatStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readKrFirstSlotKind).mockReturnValue('ang')
    vi.mocked(motherHasTransferablePrimaryCharge).mockReturnValue(true)
    vi.mocked(readZaoSlot).mockReturnValue({ kind: 'ang', marks: 1 })
    vi.mocked(lhCompletionStampReady).mockReturnValue(false)
  })

  it('stempelt Mutter-Primärfeld bei ang und gibt true zurück', async () => {
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': { krFirstSlotKind: 'ang' },
        },
      },
    ])
    const ok = await autoStampForCombatStep({
      kind: 'token',
      id: 'hero-a',
      sub: 'action',
    })
    expect(ok).toBe(true)
    expect(patchKrCounterByDelta).toHaveBeenCalledWith(
      'hero-a',
      'krAng',
      1,
      expect.objectContaining({
        stampAnchor: { rowId: 'hero-a', phaseLinkId: null },
      })
    )
  })

  it('stempelt Mutter-L.H. über stampLhCompletion', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': { krFirstSlotKind: 'lh' },
        },
      },
    ])
    const ok = await autoStampForCombatStep({
      kind: 'token',
      id: 'hero-a',
      sub: 'action',
    })
    expect(ok).toBe(true)
    expect(stampLhCompletion).toHaveBeenCalledWith('hero-a', null)
    expect(patchKrCounterByDelta).not.toHaveBeenCalled()
  })

  it('überspringt Mutter-L.H. ohne vollen Pie', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(lhCompletionStampReady).mockReturnValue(false)
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': { krFirstSlotKind: 'lh' },
        },
      },
    ])
    const ok = await autoStampForCombatStep({
      kind: 'token',
      id: 'hero-a',
      sub: 'action',
    })
    expect(ok).toBe(false)
    expect(stampLhCompletion).not.toHaveBeenCalled()
  })

  it('überspringt uo auf Mutter und gibt false zurück', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('uo')
    vi.mocked(motherHasTransferablePrimaryCharge).mockReturnValue(false)
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: { 'vierpunkteins_kampf.tracker/metadata': {} },
      },
    ])
    const ok = await autoStampForCombatStep({
      kind: 'token',
      id: 'hero-a',
      sub: 'action',
    })
    expect(ok).toBe(false)
    expect(patchKrCounterByDelta).not.toHaveBeenCalled()
  })

  it('gibt false ohne transferable charge', async () => {
    vi.mocked(motherHasTransferablePrimaryCharge).mockReturnValue(false)
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': { krFirstSlotKind: 'ang' },
        },
      },
    ])
    const ok = await autoStampForCombatStep({
      kind: 'token',
      id: 'hero-a',
      sub: 'action',
    })
    expect(ok).toBe(false)
    expect(patchKrCounterByDelta).not.toHaveBeenCalled()
  })

  it('stempelt 2.AO-Wurzel über patchZaoSlotStampPrimary', async () => {
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': {
            phases: { links: [{ id: 'zao1', parentId: null }] },
            krZaoSlots: { zao1: { kind: 'sra', marks: 1 } },
          },
        },
      },
    ])
    vi.mocked(readZaoSlot).mockReturnValue({ kind: 'sra', marks: 1 })
    const ok = await autoStampForCombatStep({
      kind: 'phase',
      ownerId: 'hero-a',
      linkId: 'zao1',
      sub: 'action',
    })
    expect(ok).toBe(true)
    expect(patchZaoSlotStampPrimary).toHaveBeenCalledWith('hero-a', 'zao1')
  })

  it('stempelt ZAO-L.H.-Wurzel über stampLhCompletion', async () => {
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    vi.mocked(readZaoSlot).mockReturnValue({ kind: 'lh', marks: 1 })
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': {
            phases: { links: [{ id: 'zao-lh', parentId: null }] },
            krZaoSlots: { 'zao-lh': { kind: 'lh', marks: 1 } },
          },
        },
      },
    ])
    const ok = await autoStampForCombatStep({
      kind: 'phase',
      ownerId: 'hero-a',
      linkId: 'zao-lh',
      sub: 'action',
    })
    expect(ok).toBe(true)
    expect(stampLhCompletion).toHaveBeenCalledWith('hero-a', 'zao-lh')
    expect(patchZaoSlotStampPrimary).not.toHaveBeenCalled()
  })
})
