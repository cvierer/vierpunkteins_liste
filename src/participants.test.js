import { describe, expect, it } from 'vitest'
import {
  filterItemsForListViewer,
  isSceneItemVisibleOnMap,
  mergeSceneItemSnapshots,
  TRACKER_ITEM_META_KEY,
} from './participants.js'

describe('isSceneItemVisibleOnMap', () => {
  it('lehnt visible false ab', () => {
    expect(isSceneItemVisibleOnMap({ visible: false })).toBe(false)
    expect(isSceneItemVisibleOnMap({ visible: true })).toBe(true)
    expect(isSceneItemVisibleOnMap({ visible: undefined })).toBe(true)
  })
})

describe('filterItemsForListViewer', () => {
  const items = [
    { id: 'a', visible: true },
    { id: 'b', visible: false },
  ]

  it('SL behält alle Items', () => {
    expect(filterItemsForListViewer(items, true)).toEqual(items)
  })

  it('Spieler ohne unsichtbare Tokens', () => {
    expect(filterItemsForListViewer(items, false)).toEqual([items[0]])
  })
})

describe('mergeSceneItemSnapshots', () => {
  it('behält Tracker-Meta wenn Refetch metadatenlos ist', () => {
    const incoming = [
      {
        id: 'hero-a',
        metadata: {
          [TRACKER_ITEM_META_KEY]: { initiative: '12' },
        },
      },
    ]
    const refetched = [{ id: 'hero-a', metadata: {} }]
    const merged = mergeSceneItemSnapshots(incoming, refetched)
    expect(merged).toHaveLength(1)
    expect(merged[0].metadata[TRACKER_ITEM_META_KEY]).toEqual({
      initiative: '12',
    })
  })

  it('bevorzugt Refetch wenn nur dieser Tracker-Meta hat', () => {
    const incoming = [{ id: 'hero-a', metadata: {} }]
    const refetched = [
      {
        id: 'hero-a',
        metadata: {
          [TRACKER_ITEM_META_KEY]: { initiative: '8' },
        },
      },
    ]
    const merged = mergeSceneItemSnapshots(incoming, refetched)
    expect(merged[0].metadata[TRACKER_ITEM_META_KEY]).toEqual({
      initiative: '8',
    })
  })
})
