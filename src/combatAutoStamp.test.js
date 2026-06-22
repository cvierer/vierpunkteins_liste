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
  getCombat: vi.fn(() => ({
    started: true,
    round: 1,
    roundIntroPending: false,
    currentItemId: 'hero-a',
    currentPhaseLinkId: null,
    currentTurnSubStep: 'action',
  })),
  getIniTieOrder: vi.fn(() => []),
}))

vi.mock('./manualIniTieOverrides.js', () => ({
  getManualIniTieOverridePairs: vi.fn(() => []),
}))

vi.mock('./participants.js', () => ({
  collectSortedParticipants: vi.fn(() => [
    { id: 'hero-a', initiative: '17' },
  ]),
  TRACKER_ITEM_META_KEY: 'vierpunkteins_kampf.tracker/metadata',
}))

vi.mock('./phaseLinks.js', () => ({
  normalizePhases: vi.fn((p) => p ?? { links: [] }),
  resolveCurrentNavIniForCombat: vi.fn(() => 17),
}))

vi.mock('./lhMeta.js', () => ({
  isLhActive: vi.fn(() => false),
  isLhLockingActions: vi.fn(() => false),
  lhCompletionStampReady: vi.fn(() => false),
}))

vi.mock('./krCounters.js', () => ({
  readKrFirstSlotKind: vi.fn(() => 'ang'),
  primaryFieldForKind: vi.fn(() => 'krAng'),
  readZaoSlot: vi.fn(() => ({ kind: 'ang', marks: 1 })),
  motherHasTransferablePrimaryCharge: vi.fn(() => true),
  patchKrCounterByDelta: vi.fn(async () => true),
  patchZaoSlotStampPrimary: vi.fn(async () => true),
  stampLhCompletion: vi.fn(async () => true),
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
import { lhCompletionStampReady, isLhActive } from './lhMeta.js'
import { resolveCurrentNavIniForCombat } from './phaseLinks.js'
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
    vi.clearAllMocks()
    vi.mocked(isLhActive).mockReturnValue(false)
    vi.mocked(lhCompletionStampReady).mockReturnValue(false)
    vi.mocked(resolveCurrentNavIniForCombat).mockReturnValue(17)
  })

  it('false bei uo', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('uo')
    expect(
      await canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        {},
        null,
        17
      )
    ).toBe(false)
  })

  it('false ohne transferable charge', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('ang')
    vi.mocked(motherHasTransferablePrimaryCharge).mockReturnValue(false)
    expect(
      await canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        { krAng: 0 },
        null,
        17
      )
    ).toBe(false)
  })

  it('true bei Mutter-L.H. wenn Pie stempelbar', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(isLhActive).mockReturnValue(true)
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    expect(
      await canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        { lhMax: 1 },
        null,
        17
      )
    ).toBe(true)
    expect(lhCompletionStampReady).toHaveBeenCalledWith(
      { lhMax: 1 },
      1,
      17,
      { zaoLhSlot: false }
    )
  })

  it('false bei Mutter-L.H. wenn Pie noch nicht voll', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(isLhActive).mockReturnValue(true)
    vi.mocked(lhCompletionStampReady).mockReturnValue(false)
    expect(
      await canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        { lhMax: 3 },
        null,
        17
      )
    ).toBe(false)
  })

  it('false bei Mutter-L.H. ohne Nav-INI', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(isLhActive).mockReturnValue(true)
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    expect(
      await canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        { lhMax: 1 },
        null,
        null
      )
    ).toBe(false)
    expect(lhCompletionStampReady).not.toHaveBeenCalled()
  })

  it('false bei Mutter-L.H. nur Umwandel ohne laufende L.H.', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(isLhActive).mockReturnValue(false)
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    expect(
      await canAutoStampForCombatStep(
        { kind: 'token', id: 'a', sub: 'action' },
        { krFirstSlotKind: 'lh' },
        null,
        17
      )
    ).toBe(false)
    expect(lhCompletionStampReady).not.toHaveBeenCalled()
  })

  it('true bei ZAO-L.H.-Wurzel wenn Pie stempelbar', async () => {
    vi.mocked(readZaoSlot).mockReturnValue({ kind: 'lh', marks: 1 })
    vi.mocked(isLhActive).mockReturnValue(true)
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    expect(
      await canAutoStampForCombatStep(
        { kind: 'phase', ownerId: 'a', linkId: 'zao-lh', sub: 'action' },
        { lhMax: 1 },
        { parentId: null },
        9
      )
    ).toBe(true)
    expect(lhCompletionStampReady).toHaveBeenCalledWith(
      { lhMax: 1 },
      1,
      9,
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
    vi.mocked(resolveCurrentNavIniForCombat).mockReturnValue(17)
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
    vi.mocked(isLhActive).mockReturnValue(true)
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
    vi.mocked(isLhActive).mockReturnValue(true)
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

  it('überspringt Mutter-L.H. wenn Kampf-Nav-INI fehlt', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(isLhActive).mockReturnValue(true)
    vi.mocked(resolveCurrentNavIniForCombat).mockReturnValue(null)
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
    expect(lhCompletionStampReady).not.toHaveBeenCalled()
  })

  it('überspringt Mutter-L.H. nur Umwandel ohne laufende L.H.', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(isLhActive).mockReturnValue(false)
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
    expect(ok).toBe(false)
    expect(stampLhCompletion).not.toHaveBeenCalled()
    expect(lhCompletionStampReady).not.toHaveBeenCalled()
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
    vi.mocked(isLhActive).mockReturnValue(true)
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

  it('stempelt lhEnd-Phasenschritt (sub action) über stampLhCompletion', async () => {
    vi.mocked(isLhActive).mockReturnValue(true)
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    vi.mocked(readZaoSlot).mockReturnValue({ kind: 'lh', marks: 1 })
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': {
            phases: {
              links: [
                { id: 'lh-end-1', parentId: null, offset: 8, lhEnd: true },
              ],
            },
            krZaoSlots: { 'lh-end-1': { kind: 'lh', marks: 1 } },
          },
        },
      },
    ])
    const ok = await autoStampForCombatStep({
      kind: 'phase',
      ownerId: 'hero-a',
      linkId: 'lh-end-1',
      sub: 'action',
    })
    expect(ok).toBe(true)
    expect(stampLhCompletion).toHaveBeenCalledWith('hero-a', 'lh-end-1')
    expect(patchZaoSlotStampPrimary).not.toHaveBeenCalled()
  })

  it('gibt false wenn patchKrCounterByDelta no-op (L.H.-Lock)', async () => {
    vi.mocked(patchKrCounterByDelta).mockResolvedValue(false)
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
  })

  it('Held B stempelt ang während Held A L.H.-Lock hat', async () => {
    vi.mocked(patchKrCounterByDelta).mockResolvedValue(true)
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': {
            krFirstSlotKind: 'lh',
            lhActive: true,
            lhMax: 3,
          },
        },
      },
      {
        id: 'hero-b',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': { krFirstSlotKind: 'ang' },
        },
      },
    ])
    const ok = await autoStampForCombatStep({
      kind: 'token',
      id: 'hero-b',
      sub: 'action',
    })
    expect(ok).toBe(true)
    expect(patchKrCounterByDelta).toHaveBeenCalledWith(
      'hero-b',
      'krAng',
      1,
      expect.objectContaining({
        stampAnchor: { rowId: 'hero-b', phaseLinkId: null },
      })
    )
  })

  it('gibt false wenn stampLhCompletion fehlschlägt', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('lh')
    vi.mocked(isLhActive).mockReturnValue(true)
    vi.mocked(lhCompletionStampReady).mockReturnValue(true)
    vi.mocked(stampLhCompletion).mockResolvedValue(false)
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
  })
})
