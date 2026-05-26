import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { localApi, shapeBuilderState } = vi.hoisted(() => ({
  localApi: {
    addItems: vi.fn(),
    deleteItems: vi.fn(),
  },
  shapeBuilderState: { lastPosition: null, lastVisible: null },
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
    width: vi.fn().mockReturnThis(),
    height: vi.fn().mockReturnThis(),
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

import {
  ensureProbeAnchorToken,
  getProbeAnchorCenter,
  hasProbeAnchorToken,
  PROBE_ANCHOR_TOKEN_ID,
  removeProbeAnchorToken,
  setProbeAnchorStateForTests,
} from './probeAnchorToken.js'

describe('probeAnchorToken', () => {
  beforeEach(async () => {
    setProbeAnchorStateForTests(null, null)
    localApi.addItems.mockClear()
    localApi.deleteItems.mockClear()
    shapeBuilderState.lastPosition = null
    shapeBuilderState.lastVisible = null
  })

  afterEach(async () => {
    await removeProbeAnchorToken()
  })

  it('legt unsichtbaren Anker an der Greifposition an', async () => {
    await ensureProbeAnchorToken({ x: 50, y: 60 }, 'hero-1')
    expect(localApi.addItems).toHaveBeenCalledTimes(1)
    expect(localApi.addItems).toHaveBeenCalledWith([
      expect.objectContaining({ id: PROBE_ANCHOR_TOKEN_ID }),
    ])
    expect(shapeBuilderState.lastPosition).toEqual({ x: 50, y: 60 })
    expect(shapeBuilderState.lastVisible).toBe(false)
    expect(hasProbeAnchorToken()).toBe(true)
    expect(getProbeAnchorCenter()).toEqual({ x: 50, y: 60 })
  })

  it('ensure ist idempotent bei gleicher Position', async () => {
    await ensureProbeAnchorToken({ x: 10, y: 20 }, 'hero-1')
    localApi.addItems.mockClear()
    localApi.deleteItems.mockClear()
    await ensureProbeAnchorToken({ x: 10, y: 20 }, 'hero-1')
    expect(localApi.addItems).not.toHaveBeenCalled()
    expect(localApi.deleteItems).not.toHaveBeenCalled()
  })

  it('remove loescht Anker und leert Cache', async () => {
    await ensureProbeAnchorToken({ x: 1, y: 2 }, 'hero-1')
    await removeProbeAnchorToken()
    expect(localApi.deleteItems).toHaveBeenCalledWith([PROBE_ANCHOR_TOKEN_ID])
    expect(hasProbeAnchorToken()).toBe(false)
    expect(getProbeAnchorCenter()).toBeNull()
  })

  it('wechsel des Owners ersetzt Anker', async () => {
    await ensureProbeAnchorToken({ x: 0, y: 0 }, 'hero-a')
    await ensureProbeAnchorToken({ x: 5, y: 5 }, 'hero-b')
    expect(localApi.deleteItems).toHaveBeenCalled()
    expect(localApi.addItems).toHaveBeenCalledTimes(2)
    expect(getProbeAnchorCenter()).toEqual({ x: 5, y: 5 })
  })
})
