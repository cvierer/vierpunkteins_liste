import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { gridApi, localApi, lastMovementLabelText, lastSpokeLineStart } = vi.hoisted(() => ({
  lastMovementLabelText: { value: '' },
  lastSpokeLineStart: { value: null },
  gridApi: {
    getDistance: vi.fn(async () => 8),
    getDpi: vi.fn(async () => 100),
    getMeasurement: vi.fn(async () => 'CHEBYSHEV'),
    getType: vi.fn(async () => 'SQUARE'),
  },
  localApi: {
    addItems: vi.fn(async () => {}),
    deleteItems: vi.fn(async () => {}),
    updateItems: vi.fn(async () => {}),
  },
}))

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      grid: gridApi,
      items: {
        getItemBounds: vi.fn(async (ids) => {
          const id = ids[0]
          if (id === 'probe') return { center: { x: 200, y: 200 } }
          if (id === 'other') return { center: { x: 300, y: 200 } }
          if (id === 'vierpunkteins/dist-probe-anchor') {
            return { center: { x: 200, y: 200 } }
          }
          return { center: { x: 0, y: 0 } }
        }),
      },
      local: localApi,
    },
  },
  buildLabel: vi.fn(() => ({
    id: vi.fn().mockReturnThis(),
    plainText: vi.fn(function (text) {
      lastMovementLabelText.value = text
      return this
    }),
    position: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    backgroundColor: vi.fn().mockReturnThis(),
    backgroundOpacity: vi.fn().mockReturnThis(),
    layer: vi.fn().mockReturnThis(),
    locked: vi.fn().mockReturnThis(),
    disableHit: vi.fn().mockReturnThis(),
    zIndex: vi.fn().mockReturnThis(),
    name: vi.fn().mockReturnThis(),
    build: vi.fn(() => ({})),
  })),
  buildLine: vi.fn(() => {
    /** @type {{ start?: { x: number, y: number }, end?: { x: number, y: number } }} */
    const state = {}
    const chain = {
      id: vi.fn().mockReturnThis(),
      startPosition: vi.fn((p) => {
        state.start = p
        return chain
      }),
      endPosition: vi.fn((p) => {
        state.end = p
        return chain
      }),
      strokeColor: vi.fn().mockReturnThis(),
      strokeOpacity: vi.fn().mockReturnThis(),
      strokeWidth: vi.fn().mockReturnThis(),
      layer: vi.fn().mockReturnThis(),
      locked: vi.fn().mockReturnThis(),
      disableHit: vi.fn().mockReturnThis(),
      zIndex: vi.fn().mockReturnThis(),
      name: vi.fn().mockReturnThis(),
      build: vi.fn(() => {
        lastSpokeLineStart.value = state.start ?? null
        return {}
      }),
    }
    return chain
  }),
}))

import { TRACKER_ITEM_META_KEY } from './participants.js'
import {
  MOVEMENT_MIN_SCHRITT,
  MOVEMENT_SPOKE_LABEL_ID,
  MOVEMENT_SPOKE_LINE_ID,
  PROBE_ANCHOR_SPOKE_LABEL_ID,
  PROBE_ANCHOR_SPOKE_LINE_ID,
  resetDistanceSpokeOverlayStateForTests,
  resolveSpokeColor,
  shouldShowMovementSpoke,
  showDistanceSpokesFor,
  SPOKE_COLOR_FALLBACK,
  spokeItemId,
  spokeLabelPosition,
  syncDistanceMovementLine,
  syncProbeAnchorSpoke,
} from './distanceSpokesOverlay.js'
import {
  PROBE_ANCHOR_TOKEN_ID,
  setProbeAnchorStateForTests,
} from './probeAnchorToken.js'

describe('spokeItemId', () => {
  it('stabile IDs für Linie und Label', () => {
    expect(spokeItemId('hero-b', 'line')).toBe(
      'vierpunkteins/dist-spoke/line/hero-b'
    )
    expect(spokeItemId('hero-b', 'label')).toBe(
      'vierpunkteins/dist-spoke/label/hero-b'
    )
  })
})

describe('spokeLabelPosition', () => {
  it('Mittelpunkt zwischen zwei Token-Zentren', () => {
    expect(spokeLabelPosition({ x: 0, y: 0 }, { x: 100, y: 200 })).toEqual({
      x: 50,
      y: 100,
    })
  })
})

describe('shouldShowMovementSpoke', () => {
  it('zeigt Linie ab Mindest-Schritt', () => {
    expect(shouldShowMovementSpoke(MOVEMENT_MIN_SCHRITT)).toBe(true)
    expect(shouldShowMovementSpoke(1.2)).toBe(true)
    expect(shouldShowMovementSpoke(0.04)).toBe(false)
    expect(shouldShowMovementSpoke(NaN)).toBe(false)
  })
})

describe('resolveSpokeColor', () => {
  it('liest heroBgColor aus Meta', () => {
    expect(resolveSpokeColor({ heroBgColor: '#ff5722' })).toBe('#ff5722')
  })

  it('nutzt Fallback ohne Farbe', () => {
    expect(resolveSpokeColor({})).toBe(SPOKE_COLOR_FALLBACK)
    expect(resolveSpokeColor(null)).toBe(SPOKE_COLOR_FALLBACK)
  })
})

describe('showDistanceSpokesFor update path', () => {
  const probe = {
    id: 'probe',
    position: { x: 0, y: 0 },
    metadata: { [TRACKER_ITEM_META_KEY]: {} },
  }
  const other = {
    id: 'other',
    position: { x: 0, y: 0 },
    metadata: { [TRACKER_ITEM_META_KEY]: { heroBgColor: '#112233' } },
  }

  beforeEach(() => {
    resetDistanceSpokeOverlayStateForTests()
    localApi.addItems.mockClear()
    localApi.updateItems.mockClear()
    localApi.deleteItems.mockClear()
  })

  afterEach(() => {
    resetDistanceSpokeOverlayStateForTests()
  })

  it('zweiter Aufruf nutzt updateItems statt erneutes addItems', async () => {
    await showDistanceSpokesFor(probe, [other])
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(localApi.updateItems).not.toHaveBeenCalled()

    await showDistanceSpokesFor(probe, [other])
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(localApi.updateItems).toHaveBeenCalledTimes(1)
    expect(localApi.updateItems.mock.calls[0][0]).toEqual([
      spokeItemId('other', 'line'),
      spokeItemId('other', 'label'),
    ])
  })

  it('Spieler: unsichtbares Ziel ohne Spoke', async () => {
    const hidden = {
      id: 'hidden',
      visible: false,
      position: { x: 0, y: 0 },
      metadata: { [TRACKER_ITEM_META_KEY]: {} },
    }
    await showDistanceSpokesFor(probe, [other, hidden], null, { isGm: false })
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(localApi.addItems.mock.calls[0][0]).toHaveLength(2)
    expect(localApi.deleteItems).not.toHaveBeenCalled()
  })

  it('Spieler: entfernt Spoke wenn Ziel unsichtbar wird', async () => {
    await showDistanceSpokesFor(probe, [other], null, { isGm: false })
    expect(localApi.addItems).toHaveBeenCalledTimes(1)

    localApi.deleteItems.mockClear()
    const hiddenOther = { ...other, visible: false }
    await showDistanceSpokesFor(probe, [hiddenOther], null, { isGm: false })
    expect(localApi.deleteItems).toHaveBeenCalledWith([
      spokeItemId('other', 'line'),
      spokeItemId('other', 'label'),
    ])
  })

  it('GM: unsichtbares Ziel behält Spoke', async () => {
    const hidden = {
      id: 'hidden',
      visible: false,
      position: { x: 0, y: 0 },
      metadata: { [TRACKER_ITEM_META_KEY]: {} },
    }
    await showDistanceSpokesFor(probe, [hidden], null, { isGm: true })
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(localApi.addItems.mock.calls[0][0]).toHaveLength(2)
  })
})

describe('syncDistanceMovementLine update path', () => {
  const probe = {
    id: 'probe',
    position: { x: 0, y: 0 },
    metadata: { [TRACKER_ITEM_META_KEY]: {} },
  }

  beforeEach(() => {
    resetDistanceSpokeOverlayStateForTests()
    localApi.addItems.mockClear()
    localApi.updateItems.mockClear()
    lastMovementLabelText.value = ''
    gridApi.getDistance.mockResolvedValue(800)
  })

  it('Bewegungslabel ohne Distanzklasse HNSP', async () => {
    gridApi.getDistance.mockResolvedValue(8)
    const start = { x: 200, y: 200 }
    await syncDistanceMovementLine(probe, start)
    expect(lastMovementLabelText.value).toBe('8')
    expect(lastMovementLabelText.value).not.toMatch(/[HNSPX]$/)
  })

  it('zweiter Aufruf aktualisiert Bewegungslinie per updateItems', async () => {
    const start = { x: 200, y: 200 }
    await syncDistanceMovementLine(probe, start)
    expect(localApi.addItems).toHaveBeenCalledTimes(1)

    await syncDistanceMovementLine(probe, start)
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(localApi.updateItems).toHaveBeenCalledTimes(1)
    expect(localApi.updateItems.mock.calls[0][0]).toEqual([
      MOVEMENT_SPOKE_LINE_ID,
      MOVEMENT_SPOKE_LABEL_ID,
    ])
  })
})

describe('syncProbeAnchorSpoke', () => {
  const anchorCenter = { x: 100, y: 100 }
  const anchor = {
    id: PROBE_ANCHOR_TOKEN_ID,
    position: { x: 150, y: 150 },
    width: 100,
    height: 100,
  }
  const hero = {
    id: 'other',
    position: { x: 250, y: 150 },
    width: 100,
    height: 100,
    metadata: { [TRACKER_ITEM_META_KEY]: {} },
  }

  beforeEach(() => {
    resetDistanceSpokeOverlayStateForTests()
    setProbeAnchorStateForTests(anchorCenter, 'probe', anchor)
    localApi.addItems.mockClear()
    localApi.updateItems.mockClear()
    localApi.deleteItems.mockClear()
    lastMovementLabelText.value = ''
    lastSpokeLineStart.value = null
    gridApi.getDistance.mockResolvedValue(8)
  })

  afterEach(() => {
    setProbeAnchorStateForTests(null)
  })

  it('zeichnet Spoke mit Distanzklassen-Label wie zu anderem Token', async () => {
    gridApi.getDistance.mockResolvedValue(2)
    await syncProbeAnchorSpoke(anchor, hero, null)
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(lastMovementLabelText.value).toBe('2,0(S)')
  })

  it('nutzt gecachten Anker-Mittelpunkt statt getItemBounds auf Pseudo-ID', async () => {
    gridApi.getDistance.mockResolvedValue(2)
    await syncProbeAnchorSpoke(anchor, hero, null)
    expect(lastSpokeLineStart.value).toEqual(anchorCenter)
  })

  it('zweiter Aufruf aktualisiert per updateItems', async () => {
    await syncProbeAnchorSpoke(anchor, hero, null)
    await syncProbeAnchorSpoke(anchor, hero, null)
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(localApi.updateItems).toHaveBeenCalledTimes(1)
    expect(localApi.updateItems.mock.calls[0][0]).toEqual([
      PROBE_ANCHOR_SPOKE_LINE_ID,
      PROBE_ANCHOR_SPOKE_LABEL_ID,
    ])
  })

  it('leerer Distanztext blendet Spoke nicht aus', async () => {
    await syncProbeAnchorSpoke(anchor, hero, null)
    localApi.deleteItems.mockClear()
    localApi.updateItems.mockClear()
    gridApi.getDistance.mockResolvedValue(NaN)
    await syncProbeAnchorSpoke(anchor, hero, null)
    expect(localApi.deleteItems).not.toHaveBeenCalled()
    expect(localApi.updateItems).toHaveBeenCalledTimes(1)
  })

  it('Spieler: unsichtbarer Held blendet Anchor-Spoke aus', async () => {
    const hiddenHero = { ...hero, visible: false }
    await syncProbeAnchorSpoke(anchor, hiddenHero, null, { isGm: false })
    expect(localApi.addItems).not.toHaveBeenCalled()
  })
})
