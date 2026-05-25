import { describe, expect, it } from 'vitest'
import {
  filterItemsForListViewer,
  isSceneItemVisibleOnMap,
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
