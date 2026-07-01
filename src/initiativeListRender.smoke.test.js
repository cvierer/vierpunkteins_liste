// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Regressions-Wächter für die Render-/Wiring-Orchestrierung in setupInitiativeList
// (Etappe 5). Geprüft wird nur: mountet/rendert/teardown ohne Throw und erzeugt
// die erwartete Listen-Grundstruktur. Kein Pixel-Layout, keine Verhaltensdetails.

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
    },
  }
})

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: obr.default,
  isImage: () => false,
  isLabel: () => false,
}))

let rafSpy
let flushPromises

beforeEach(() => {
  // rAF synchron ausführen, damit der Render-Queue-Drain deterministisch läuft.
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(performance.now())
    return 0
  })
  flushPromises = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve()
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
  const content = document.createElement('div')
  content.className = 'initiative-list-content'
  const ul = document.createElement('ul')
  ul.className = 'initiative-list'
  content.appendChild(ul)
  scroll.appendChild(content)
  document.body.appendChild(scroll)
  return ul
}

describe('setupInitiativeList (smoke)', () => {
  it('wired sich auf, rendert initial und teardownt ohne Fehler', async () => {
    const { setupInitiativeList } = await import('./initiativeList.js')
    const ul = buildListScaffold()

    let teardown
    expect(() => {
      teardown = setupInitiativeList(ul)
    }).not.toThrow()

    await flushPromises()

    expect(obr.default.scene.items.getItems).toHaveBeenCalled()
    expect(typeof teardown).toBe('function')

    expect(() => teardown()).not.toThrow()
  })

  it('rendert Teilnehmer-Zeilen wenn die Szene Tracker-Tokens hat', async () => {
    const { TRACKER_ITEM_META_KEY } = await import('./participants.js')
    obr.items.length = 0
    obr.items.push({
      id: 'hero-smoke-1',
      name: 'Testheld',
      visible: true,
      metadata: {
        [TRACKER_ITEM_META_KEY]: { initiative: '12', phases: { links: [] } },
      },
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { setupInitiativeList } = await import('./initiativeList.js')
    const ul = buildListScaffold()
    const teardown = setupInitiativeList(ul)

    for (let i = 0; i < 12; i++) await flushPromises()

    const renderErrors = consoleError.mock.calls.filter((c) =>
      String(c[0]).includes('renderList failed')
    )

    const rows = ul.querySelectorAll('li.init-row')
    expect(renderErrors.length, renderErrors.map((c) => c.join(' ')).join('\n')).toBe(0)
    expect(rows.length).toBeGreaterThan(0)

    consoleError.mockRestore()
    teardown()
  })

  it('erzeugt das Hero-Settings-Panel (Backdrop + Dialog) und räumt es beim Teardown ab', async () => {
    const { setupInitiativeList } = await import('./initiativeList.js')
    const ul = buildListScaffold()

    const teardown = setupInitiativeList(ul)
    await flushPromises()

    const backdrop = document.querySelector('.kampf-hero-settings-backdrop')
    expect(backdrop).not.toBeNull()
    expect(backdrop.querySelector('.kampf-settings-panel')).not.toBeNull()

    teardown()
    expect(document.querySelector('.kampf-hero-settings-backdrop')).toBeNull()
  })
})
