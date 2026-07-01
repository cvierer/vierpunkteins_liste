// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const combatState = vi.hoisted(() => ({
  started: true,
  round: 1,
  roundIntroPending: false,
  currentItemId: 'hero-b',
  currentPhaseLinkId: null,
}))

const actionStampsState = vi.hoisted(() => ({
  entries: [] /** @type {object[]} */,
}))

const stampListeners = vi.hoisted(() => new Set())

const obr = vi.hoisted(() => {
  const unsub = () => {}
  const items = []
  return {
    items,
    default: {
      scene: {
        items: {
          getItems: vi.fn(async () => items),
          onChange: vi.fn(() => unsub),
          updateItems: vi.fn(async () => {}),
        },
      },
      player: {
        id: 'player-1',
        onChange: vi.fn(() => unsub),
        getRole: vi.fn(async () => 'GM'),
        getSelection: vi.fn(async () => []),
        select: vi.fn(async () => {}),
      },
      action: {
        onOpenChange: vi.fn(() => unsub),
        isOpen: vi.fn(async () => false),
      },
      room: {
        getMetadata: vi.fn(async () => ({})),
        setMetadata: vi.fn(async () => {}),
        onMetadataChange: vi.fn(() => unsub),
      },
    },
  }
})

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: obr.default,
  isImage: () => false,
  isLabel: () => false,
}))

vi.mock('./krSlotPatchGate.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isKrSlotPatchSuppressingRenderList: vi.fn(() => true),
  }
})

vi.mock('./combatRoom.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getCombat: vi.fn(() => ({ ...combatState })),
    getActionStamps: vi.fn(() => ({ entries: [...actionStampsState.entries] })),
    getIniTieOrder: vi.fn(() => []),
    onCombatChange: vi.fn((fn) => {
      const unsub = () => {}
      return unsub
    }),
    onActionStampsChange: vi.fn((fn) => {
      stampListeners.add(fn)
      return () => stampListeners.delete(fn)
    }),
    onIniTieOrderChange: vi.fn(() => () => {}),
  }
})

let rafSpy
let flushPromises

beforeEach(() => {
  actionStampsState.entries = []
  combatState.currentItemId = 'hero-b'
  stampListeners.clear()
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(performance.now())
    return 0
  })
  flushPromises = async () => {
    for (let i = 0; i < 16; i++) await Promise.resolve()
  }
})

afterEach(() => {
  rafSpy?.mockRestore()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

function buildListScaffold() {
  const scroll = document.createElement('div')
  scroll.className = 'initiative-list-scroll'
  const inner = document.createElement('div')
  inner.className = 'initiative-list-scroll-inner'
  const ul = document.createElement('ul')
  ul.className = 'initiative-list'
  inner.appendChild(ul)
  scroll.appendChild(inner)
  document.body.appendChild(scroll)
  return ul
}

describe('L.H. + Reaktions-Stempel INI-Spalte', () => {
  it('zeigt Schild-Stempel neben INI wenn irgendwo L.H. und Suppress aktiv', async () => {
    const { TRACKER_ITEM_META_KEY } = await import('./participants.js')
    const { KR_FIRST_SLOT_KIND } = await import('./krMetaKeys.js')

    obr.items.length = 0
    obr.items.push(
      {
        id: 'hero-a',
        name: 'LH-Held',
        visible: true,
        metadata: {
          [TRACKER_ITEM_META_KEY]: {
            initiative: '20',
            phases: { links: [] },
            [KR_FIRST_SLOT_KIND]: 'lh',
            krAbw: 1,
          },
        },
      },
      {
        id: 'hero-b',
        name: 'Stempel-Held',
        visible: true,
        metadata: {
          [TRACKER_ITEM_META_KEY]: {
            initiative: '12',
            phases: { links: [] },
            krAbw: 1,
          },
        },
      }
    )

    const { setupInitiativeList } = await import('./initiativeList.js')
    const ul = buildListScaffold()
    const teardown = setupInitiativeList(ul)

    for (let i = 0; i < 16; i++) await flushPromises()

    expect(ul.querySelectorAll('li.init-row').length).toBeGreaterThan(0)

    actionStampsState.entries = [
      {
        id: 'stamp-abw-1',
        itemId: 'hero-b',
        field: 'krAbw',
        anchorRowId: 'hero-b',
        anchorPhaseLinkId: null,
        ownerName: 'Stempel-Held',
      },
    ]

    for (const fn of stampListeners) {
      fn()
    }
    for (let i = 0; i < 16; i++) await flushPromises()

    const stampSeg = ul.querySelector(
      'li[data-item-id="hero-b"] .init-col-abw-stamps .init-stamp-panel__seg--abw'
    )
    expect(stampSeg, 'Schild-Stempel neben INI fehlt').not.toBeNull()

    teardown()
  })
})
