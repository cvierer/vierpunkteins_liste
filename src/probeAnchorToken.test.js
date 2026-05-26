import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { localApi, shapeBuilderState } = vi.hoisted(() => ({
  localApi: {
    addItems: vi.fn(),
    deleteItems: vi.fn(),
  },
  shapeBuilderState: {
    lastPosition: null,
    lastVisible: null,
    lastWidth: null,
    lastHeight: null,
  },
}))

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      local: localApi,
    },
  },
  buildShape: vi.fn(() => ({
    id: vi.fn().mockReturnThis(),
    shapeType: vi.fn().mockReturnThis(),
    position: vi.fn(function (pos) {
      shapeBuilderState.lastPosition = pos
      return this
    }),
    width: vi.fn(function (w) {
      shapeBuilderState.lastWidth = w
      return this
    }),
    height: vi.fn(function (h) {
      shapeBuilderState.lastHeight = h
      return this
    }),
    strokeOpacity: vi.fn().mockReturnThis(),
    fillOpacity: vi.fn().mockReturnThis(),
    visible: vi.fn(function (v) {
      shapeBuilderState.lastVisible = v
      return this
    }),
    locked: vi.fn().mockReturnThis(),
    disableHit: vi.fn().mockReturnThis(),
    layer: vi.fn().mockReturnThis(),
    zIndex: vi.fn().mockReturnThis(),
    name: vi.fn().mockReturnThis(),
    metadata: vi.fn().mockReturnThis(),
    build: vi.fn(() => ({ id: 'vierpunkteins/dist-probe-anchor' })),
  })),
}))

vi.mock('./gridDistance.js', () => ({
  getGridContext: vi.fn(async () => ({ dpi: 100, measurement: 'EUCLIDEAN', type: 'SQUARE' })),
}))

import {
  buildAnchorPseudoItem,
  ensureProbeAnchorToken,
  getProbeAnchorCenter,
  getProbeAnchorPseudoItem,
  hasProbeAnchorToken,
  PROBE_ANCHOR_TOKEN_ID,
  removeProbeAnchorToken,
  setProbeAnchorStateForTests,
} from './probeAnchorToken.js'
import { tokenCenterScene } from './heroOrientationRingsOverlay.js'

const heroItem = {
  id: 'hero-1',
  position: { x: 40, y: 50 },
  width: 100,
  height: 100,
  image: { width: 100, height: 100 },
  grid: { dpi: 100, offset: { x: 0, y: 0 } },
  scale: { x: 1, y: 1 },
}

describe('probeAnchorToken', () => {
  beforeEach(async () => {
    setProbeAnchorStateForTests(null, null, null)
    localApi.addItems.mockClear()
    localApi.deleteItems.mockClear()
    shapeBuilderState.lastPosition = null
    shapeBuilderState.lastVisible = null
    shapeBuilderState.lastWidth = null
    shapeBuilderState.lastHeight = null
  })

  afterEach(async () => {
    await removeProbeAnchorToken()
  })

  it('legt unsichtbaren Anker mit Helden-Maßen an', async () => {
    await ensureProbeAnchorToken({ x: 50, y: 60 }, 'hero-1', heroItem)
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(shapeBuilderState.lastPosition).toEqual({ x: 50, y: 60 })
    expect(shapeBuilderState.lastWidth).toBe(100)
    expect(shapeBuilderState.lastHeight).toBe(100)
    expect(shapeBuilderState.lastVisible).toBe(false)
    expect(hasProbeAnchorToken()).toBe(true)
    expect(getProbeAnchorCenter()).toEqual({ x: 50, y: 60 })
    expect(getProbeAnchorPseudoItem()?.width).toBe(100)
  })

  it('buildAnchorPseudoItem zentriert wie Held', () => {
    const gridContext = { dpi: 100, measurement: 'EUCLIDEAN', type: 'SQUARE' }
    const pseudo = buildAnchorPseudoItem(heroItem, { x: 90, y: 100 }, gridContext)
    const center = tokenCenterScene(pseudo, gridContext.dpi)
    expect(center.x).toBeCloseTo(90, 5)
    expect(center.y).toBeCloseTo(100, 5)
  })

  it('ensure ist idempotent bei gleicher Position', async () => {
    await ensureProbeAnchorToken({ x: 10, y: 20 }, 'hero-1', heroItem)
    localApi.addItems.mockClear()
    localApi.deleteItems.mockClear()
    await ensureProbeAnchorToken({ x: 10, y: 20 }, 'hero-1', heroItem)
    expect(localApi.addItems).not.toHaveBeenCalled()
    expect(localApi.deleteItems).not.toHaveBeenCalled()
  })

  it('remove loescht Anker und leert Cache', async () => {
    await ensureProbeAnchorToken({ x: 1, y: 2 }, 'hero-1', heroItem)
    await removeProbeAnchorToken()
    expect(localApi.deleteItems).toHaveBeenCalledWith([PROBE_ANCHOR_TOKEN_ID])
    expect(hasProbeAnchorToken()).toBe(false)
    expect(getProbeAnchorCenter()).toBeNull()
    expect(getProbeAnchorPseudoItem()).toBeNull()
  })

  it('wechsel des Owners ersetzt Anker', async () => {
    await ensureProbeAnchorToken({ x: 0, y: 0 }, 'hero-a', heroItem)
    await ensureProbeAnchorToken({ x: 5, y: 5 }, 'hero-b', heroItem)
    expect(localApi.deleteItems).toHaveBeenCalled()
    expect(localApi.addItems).toHaveBeenCalledTimes(2)
    expect(getProbeAnchorCenter()).toEqual({ x: 5, y: 5 })
  })
})
