// @vitest-environment happy-dom
/**
 * Regressions-Wächter: GM-Navigation ohne L.H.-Mutation nutzt den inkrementellen
 * syncListNavFromCombat-Pfad (kein element.replaceChildren pro Schritt).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const roomMeta = vi.hoisted(() => ({}))

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
        getMetadata: vi.fn(async () => ({ ...roomMeta })),
        setMetadata: vi.fn(async (patch) => {
          Object.assign(roomMeta, patch)
        }),
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

/** @param {number} n @param {string} metaKey */
function buildHeroes(n, metaKey) {
  return Array.from({ length: n }, (_, i) => ({
    id: `hero-${i + 1}`,
    name: `Held ${i + 1}`,
    visible: true,
    metadata: {
      [metaKey]: {
        initiative: String(20 - i * 2),
        phases: { links: [] },
        krAbw: 1,
        krAng: 1,
      },
    },
  }))
}

function buildListScaffold() {
  const scroll = document.createElement('div')
  scroll.className = 'initiative-list-scroll'
  const content = document.createElement('div')
  content.className = 'initiative-list-content'
  const ul = document.createElement('ul')
  ul.className = 'initiative-list'
  content.appendChild(ul)
  scroll.appendChild(content)
  document.body.appendChild(scroll)
  return ul
}

/** @type {(() => void) | null} */
let listTeardown = null
let rafSpy

async function flushAll() {
  for (let i = 0; i < 32; i++) await Promise.resolve()
}

/**
 * @param {number} heroCount
 * @param {string} activeHeroId
 */
async function mountListInCombat(heroCount, activeHeroId) {
  const { TRACKER_ITEM_META_KEY } = await import('./participants.js')
  const { initCombatRoom, patchCombat } = await import('./combatRoom.js')
  const { setupInitiativeList } = await import('./initiativeList.js')

  obr.items.length = 0
  obr.items.push(...buildHeroes(heroCount, TRACKER_ITEM_META_KEY))

  await initCombatRoom()
  const ul = buildListScaffold()
  listTeardown = setupInitiativeList(ul)
  await flushAll()

  await patchCombat({
    started: true,
    round: 1,
    currentItemId: activeHeroId,
    currentPhaseLinkId: null,
    roundIntroPending: false,
  })
  await flushAll()

  return { ul, patchCombat }
}

beforeEach(() => {
  vi.resetModules()
  for (const k of Object.keys(roomMeta)) delete roomMeta[k]
  obr.items.length = 0
  listTeardown = null
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(performance.now())
    return 0
  })
})

afterEach(() => {
  listTeardown?.()
  listTeardown = null
  rafSpy?.mockRestore()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('GM-Navigations-Performance', () => {
  it('reine Positions-Navigation: kein Full-Render (replaceChildren)', async () => {
    const { ul, patchCombat } = await mountListInCombat(6, 'hero-1')
    const replaceChildrenSpy = vi.spyOn(ul, 'replaceChildren')

    expect(ul.querySelectorAll('li.init-row').length).toBeGreaterThan(0)

    obr.default.scene.items.getItems.mockClear()
    replaceChildrenSpy.mockClear()

    const t0 = performance.now()
    await patchCombat({ currentItemId: 'hero-2', round: 1 })
    await flushAll()
    const navMs = performance.now() - t0

    const getItemsCalls = obr.default.scene.items.getItems.mock.calls.length
    const fullRenders = replaceChildrenSpy.mock.calls.length

    const { getCombat } = await import('./combatRoom.js')
    expect(getCombat().currentItemId).toBe('hero-2')
    expect(
      ul.querySelector('li.init-row--active[data-item-id="hero-2"]')
    ).not.toBeNull()

    expect(
      fullRenders,
      `replaceChildren ${fullRenders}x — erwartet 0 bei inkrementeller Nav`
    ).toBe(0)

    expect(
      getItemsCalls,
      `getItems ${getItemsCalls}x — ohne L.H./Mods kein OBR-Roundtrip`
    ).toBe(0)

    expect(navMs, `Nav-Schritt dauerte ${navMs.toFixed(0)} ms`).toBeLessThan(500)
  })

  it('syncListNavFromCombat allein: kein Full-Render, Highlight sofort', async () => {
    const { ul, patchCombat } = await mountListInCombat(4, 'hero-1')
    const replaceChildrenSpy = vi.spyOn(ul, 'replaceChildren')
    replaceChildrenSpy.mockClear()

    const { syncListNavFromCombat } = await import('./initiativeList.js')
    await patchCombat({ currentItemId: 'hero-2' })

    syncListNavFromCombat(ul, obr.items)

    expect(replaceChildrenSpy.mock.calls.length).toBe(0)
    expect(
      ul.querySelector('li.init-row--active[data-item-id="hero-2"]')
    ).not.toBeNull()
  })

  it('8 Token: Positions-Nav bleibt ohne Full-Render', async () => {
    const { ul, patchCombat } = await mountListInCombat(8, 'hero-1')
    const replaceChildrenSpy = vi.spyOn(ul, 'replaceChildren')

    replaceChildrenSpy.mockClear()
    obr.default.scene.items.getItems.mockClear()

    await patchCombat({ currentItemId: 'hero-2' })
    await flushAll()

    expect(replaceChildrenSpy.mock.calls.length).toBe(0)
    expect(obr.default.scene.items.getItems.mock.calls.length).toBe(0)
  })
})
