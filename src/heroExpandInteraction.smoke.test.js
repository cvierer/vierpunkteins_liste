// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Charakterisierungs-/Regressions-Wächter für das interaktive Verhalten von
// mountHeroExpandBlock (Etappe 4/Phase 2-Gate): Gauge-Live-Update bei LE-Eingabe
// und Persist (commit → applyHeroExpandFields → OBR updateItems) nach Blur.
// Diese Tests sichern das Verhalten ab, BEVOR die inneren Closures (Gauge/Persist)
// in eigene Module gezogen werden. Kein Pixel-Layout, nur beobachtbares Verhalten.

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

vi.mock('@owlbear-rodeo/sdk', () => ({ default: obr.default }))

const { mountHeroExpandBlock } = await import('./iniModMeta.js')

let rafSpy

beforeEach(() => {
  // rAF synchron: der Gauge-Refresh (scheduleGaugeRefresh) läuft deterministisch.
  rafSpy = vi
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((cb) => {
      cb(performance.now())
      return 0
    })
})

afterEach(() => {
  rafSpy?.mockRestore()
  vi.useRealTimers()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

function makeMeta(overrides = {}) {
  return {
    heroExAt: '12',
    heroExPa: '10',
    heroExLe: '30',
    heroExLeMax: '30',
    heroExKo: '14',
    heroExWs: '7',
    heroExMu: '13',
    heroExGs: '8',
    initiative: '15',
    ...overrides,
  }
}

function mountEdit(itemId, meta = makeMeta()) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  mountHeroExpandBlock(container, {
    itemId,
    meta,
    canEdit: true,
    displayName: 'Held',
  })
  return container
}

describe('mountHeroExpandBlock – interaktives Verhalten', () => {
  it('aktualisiert das LE-Gauge bei LE-Eingabe (neg-le ab LE≤0 mit gültigem KO)', () => {
    const itemId = 'gauge-1'
    const container = mountEdit(itemId)

    const leInp = container.querySelector(`#hero-ex-${itemId}-le`)
    const host = container.querySelector('.init-hero-ex__le-threshold')
    expect(leInp).toBeInstanceOf(HTMLInputElement)
    expect(host).not.toBeNull()

    // Ausgangslage 30/30 → kein Negativ-Band.
    expect(host.dataset.leBand).not.toBe('neg-le')

    leInp.value = '0'
    leInp.dispatchEvent(new Event('input', { bubbles: true }))

    expect(host.dataset.leBand).toBe('neg-le')
  })

  it('persistiert eine Feldänderung nach Blur (commit → applyHeroExpandFields → updateItems)', async () => {
    const itemId = 'persist-1'
    const container = mountEdit(itemId)
    const atInp = container.querySelector(`#hero-ex-${itemId}-at`)
    expect(atInp).toBeInstanceOf(HTMLInputElement)

    // Ab hier deterministische Zeit: großer Systemzeit-Offset, damit der
    // Blur-Commit-Guard (Date.now() - lastPointerDownInsideAt < 180) nicht greift.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    atInp.value = '9'
    atInp.dispatchEvent(new Event('input', { bubbles: true }))
    atInp.dispatchEvent(new Event('blur', { bubbles: true }))

    // Blur: setTimeout(45) → commit → schedulePersistHeroExpand setTimeout(320).
    vi.advanceTimersByTime(60)
    vi.advanceTimersByTime(360)

    // Async-IIFE in flushPersistHeroExpand (getItems → updateItems) abarbeiten.
    for (let i = 0; i < 12; i++) await Promise.resolve()

    expect(obr.default.scene.items.updateItems).toHaveBeenCalledWith(
      [itemId],
      expect.any(Function)
    )
  })
})
