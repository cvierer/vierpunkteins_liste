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

vi.mock('./krCounters.js', () => ({
  readKrFirstSlotKind: vi.fn(() => 'ang'),
  primaryFieldForKind: vi.fn(() => 'krAng'),
  readZaoSlot: vi.fn(() => ({ kind: 'ang', marks: 1 })),
  patchKrCounterByDelta: vi.fn(async () => {}),
  patchZaoSlotStampPrimary: vi.fn(async () => {}),
}))

import {
  readKrFirstSlotKind,
  patchKrCounterByDelta,
  patchZaoSlotStampPrimary,
} from './krCounters.js'
import OBR from '@owlbear-rodeo/sdk'
import {
  autoStampForCombatStep,
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

describe('autoStampForCombatStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stempelt Mutter-Primärfeld bei ang', async () => {
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: {
          'vierpunkteins_kampf.tracker/metadata': { krFirstSlotKind: 'ang' },
        },
      },
    ])
    await autoStampForCombatStep({ kind: 'token', id: 'hero-a', sub: 'action' })
    expect(patchKrCounterByDelta).toHaveBeenCalledWith(
      'hero-a',
      'krAng',
      1,
      expect.objectContaining({
        stampAnchor: { rowId: 'hero-a', phaseLinkId: null },
      })
    )
  })

  it('überspringt uo auf Mutter', async () => {
    vi.mocked(readKrFirstSlotKind).mockReturnValue('uo')
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: { 'vierpunkteins_kampf.tracker/metadata': {} },
      },
    ])
    await autoStampForCombatStep({ kind: 'token', id: 'hero-a', sub: 'action' })
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
    await autoStampForCombatStep({
      kind: 'phase',
      ownerId: 'hero-a',
      linkId: 'zao1',
      sub: 'action',
    })
    expect(patchZaoSlotStampPrimary).toHaveBeenCalledWith('hero-a', 'zao1')
  })
})
