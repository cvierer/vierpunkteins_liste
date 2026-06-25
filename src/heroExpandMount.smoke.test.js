// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountHeroExpandBlock } from './iniModMeta.js'

// Smoke-/Regressions-Wächter: stellt sicher, dass der Heldenblock in einem
// DOM mountet, die erwartete Grundstruktur erzeugt und dabei nicht wirft.
// Verhaltensdetails werden bewusst NICHT geprüft (kein Pixel-Layout); Zweck ist
// ein schnelles Sicherheitsnetz für die spätere Zerlegung von mountHeroExpandBlock.

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
    ...overrides,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('mountHeroExpandBlock (smoke)', () => {
  it('mountet im Viewer-Modus ohne Fehler und erzeugt die Wurzel', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    expect(() =>
      mountHeroExpandBlock(container, {
        itemId: 'item-1',
        meta: makeMeta(),
        canEdit: false,
        displayName: 'Held',
      })
    ).not.toThrow()

    expect(container.querySelector('.init-hero-ex')).not.toBeNull()
  })

  it('mountet im Edit-Modus ohne Fehler und erzeugt Eingabefelder', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    expect(() =>
      mountHeroExpandBlock(container, {
        itemId: 'item-2',
        meta: makeMeta(),
        canEdit: true,
        displayName: 'Held',
      })
    ).not.toThrow()

    expect(container.querySelector('.init-hero-ex')).not.toBeNull()
    expect(container.querySelectorAll('input').length).toBeGreaterThan(0)
  })

  it('ist robust gegen leere Meta', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    expect(() =>
      mountHeroExpandBlock(container, {
        itemId: 'item-3',
        meta: {},
        canEdit: true,
      })
    ).not.toThrow()
  })
})
