import { describe, expect, it, vi, beforeEach } from 'vitest'

const { itemMetaRef, updateItems } = vi.hoisted(() => {
  /** @type {{ current: Record<string, unknown> }} */
  const itemMetaRef = { current: {} }
  const updateItems = vi.fn(async (_ids, fn) => {
    const metaKey = 'vierpunkteins_kampf.tracker/metadata'
    const drafts = [
      {
        metadata: {
          [metaKey]: structuredClone(itemMetaRef.current),
        },
      },
    ]
    fn(drafts)
    itemMetaRef.current = /** @type {Record<string, unknown>} */ (
      drafts[0].metadata[metaKey]
    )
  })
  return { itemMetaRef, updateItems }
})

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      items: {
        getItems: vi.fn(async () => [
          {
            id: 'hero-1',
            metadata: {
              'vierpunkteins_kampf.tracker/metadata': itemMetaRef.current,
            },
          },
        ]),
        updateItems,
      },
    },
    room: {
      getMetadata: vi.fn(async () => ({})),
    },
  },
}))

vi.mock('./editAccess.js', () => ({
  canEditSceneItem: vi.fn(() => true),
}))

vi.mock('./combatRoom.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getCombat: vi.fn(() => ({ started: true, round: 1 })),
  }
})

vi.mock('./lhMeta.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isLhLockingActions: vi.fn(() => false),
    lhEndKrConvertMode: vi.fn(() => false),
  }
})

import {
  KR_ABW,
  KR_ANG,
  KR_FIRST_SLOT_KIND,
  KR_SRA,
  patchKrCyclePrimarySlotKind,
  patchKrTransferPrimaryToAbw,
} from './krCounters.js'
import { TRACKER_ITEM_META_KEY } from './participants.js'

describe('krConvertCyclePatch', () => {
  beforeEach(() => {
    itemMetaRef.current = {
      [KR_FIRST_SLOT_KIND]: 'uo',
      [KR_ABW]: 1,
      [KR_ANG]: 1,
    }
    updateItems.mockClear()
  })

  it('UO→lh ohne Schildladung: reiner Kind-Wechsel', async () => {
    const applied = await patchKrCyclePrimarySlotKind('hero-1', 'lh', {
      preloadedItem: {
        id: 'hero-1',
        metadata: { [TRACKER_ITEM_META_KEY]: itemMetaRef.current },
      },
    })
    expect(applied).toBe(true)
    expect(itemMetaRef.current[KR_FIRST_SLOT_KIND]).toBe('lh')
    expect(itemMetaRef.current[KR_ABW]).toBe(1)
  })

  it('patchKrTransferPrimaryToAbw false bei leerer Mutter-SRA', async () => {
    itemMetaRef.current = {
      [KR_FIRST_SLOT_KIND]: 'sra',
      [KR_SRA]: 1,
      [KR_ABW]: 1,
    }
    const applied = await patchKrTransferPrimaryToAbw('hero-1')
    expect(applied).toBe(false)
  })
})
