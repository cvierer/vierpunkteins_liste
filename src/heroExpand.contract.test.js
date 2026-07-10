// @vitest-environment happy-dom
/**
 * Heldenblock-Vertrag: mountHeroExpandBlock darf keine L.H./KR/Phasen-Felder schreiben.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TRACKER_ITEM_META_KEY } from './participants.js'
import {
  KR_ZAO_SLOTS,
  LH_MAX,
  LH_REM,
} from './krMetaKeys.js'

const { updateItems } = vi.hoisted(() => ({
  updateItems: vi.fn(),
}))

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      items: {
        getItems: vi.fn(async () => []),
        updateItems,
      },
    },
    room: { getMetadata: vi.fn(async () => ({})), setMetadata: vi.fn(async () => {}) },
    player: { getRole: vi.fn(() => 'PLAYER') },
    onReady: vi.fn(),
  },
}))

vi.mock('./combatRoom.js', () => ({
  getCombat: vi.fn(() => ({ started: false, round: 1 })),
  getIniTieOrder: vi.fn(() => []),
}))

vi.mock('./editAccess.js', () => ({
  canEditSceneItem: vi.fn(() => true),
  isGmSync: vi.fn(() => false),
}))

vi.mock('./roomSettings.js', () => ({
  getRoomSettings: vi.fn(() => ({})),
  faMaxForInitiative: vi.fn(() => 0),
}))

const { mountHeroExpandBlock } = await import('./iniModMeta.js')

const FORBIDDEN_KEYS = new Set([
  'phases',
  KR_ZAO_SLOTS,
  LH_MAX,
  LH_REM,
  'krFirstSlotKind',
  'krAng',
  'krAbw',
])

function snapshotForbidden(meta) {
  /** @type {Record<string, unknown>} */
  const snap = {}
  if (!meta || typeof meta !== 'object') return snap
  for (const k of Object.keys(meta)) {
    if (FORBIDDEN_KEYS.has(k) || k.startsWith('kr') && k !== 'krZaoSlots') {
      snap[k] = meta[k]
    }
  }
  if (meta.phases) snap.phases = structuredClone(meta.phases)
  if (meta[KR_ZAO_SLOTS]) snap[KR_ZAO_SLOTS] = structuredClone(meta[KR_ZAO_SLOTS])
  return snap
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('Heldenblock contract — mountHeroExpandBlock', () => {
  it('schreibt beim Mount keine phases/LH_/krZaoSlots (nur Lesen/Mount)', () => {
    const meta = {
      heroExAt: '12',
      heroExPa: '10',
      heroExLe: '30',
      heroExLeMax: '30',
      phases: { links: [{ id: 'z1', parentId: null, offset: 8 }] },
      [KR_ZAO_SLOTS]: { z1: { kind: 'uo', marks: 0 } },
      [LH_MAX]: 2,
      [LH_REM]: 1,
      krFirstSlotKind: 'lh',
    }
    const before = snapshotForbidden(meta)
    const container = document.createElement('div')
    document.body.appendChild(container)

    mountHeroExpandBlock(container, {
      itemId: 'hero-contract',
      meta,
      canEdit: true,
      displayName: 'Held',
    })

    const after = snapshotForbidden(meta)
    expect(after).toEqual(before)
  })

  it('applyHeroExpandFields nutzt patchHeroExpandMeta-Choke-Point', async () => {
    updateItems.mockImplementation(async (_ids, fn) => {
      const drafts = [
        {
          id: 'hero-contract',
          metadata: {
            [TRACKER_ITEM_META_KEY]: {
              heroExAt: '10',
              phases: { links: [] },
              [KR_ZAO_SLOTS]: {},
            },
          },
        },
      ]
      fn(drafts)
      return drafts
    })

    const { applyHeroExpandFields, readHeroExpandSnapshot } = await import(
      './iniModMeta.js'
    )
    const snap = readHeroExpandSnapshot({ heroExAt: '12', heroExPa: '8' })
    await applyHeroExpandFields('hero-contract', snap)

    expect(updateItems).toHaveBeenCalled()
    const mutator = updateItems.mock.calls[0][1]
    const metaRef = {
      id: 'hero-contract',
      metadata: {
        [TRACKER_ITEM_META_KEY]: {
          heroExAt: '10',
          phases: { links: [] },
          [KR_ZAO_SLOTS]: {},
        },
      },
    }
    mutator([metaRef])
    const m = metaRef.metadata[TRACKER_ITEM_META_KEY]
    expect(m.phases).toEqual({ links: [] })
    expect(m[KR_ZAO_SLOTS]).toEqual({})
    expect(m.heroExAt).toBe('12')
  })
})
