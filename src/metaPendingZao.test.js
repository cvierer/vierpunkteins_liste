import { describe, expect, it } from 'vitest'
import {
  KR_ABW,
  KR_ZAO_SLOTS,
  KR_ANG,
  metaHasPendingLoadedNonHeroExtraZao,
} from './krCounters.js'

describe('metaHasPendingLoadedNonHeroExtraZao', () => {
  it('ist true bei geladenem regulären ZAO-Slot', () => {
    const linkId = 'root-zao-1'
    const m = {
      initiative: '8',
      phases: {
        links: [{ id: linkId, parentId: null, offset: 8 }],
        rowPanelOpen: true,
      },
      [KR_ZAO_SLOTS]: { [linkId]: { kind: 'ang', marks: 1 } },
      [KR_ABW]: 2,
      [KR_ANG]: 1,
    }
    expect(metaHasPendingLoadedNonHeroExtraZao(m)).toBe(true)
  })

  it('ist false bei heroExtra-Wurzel', () => {
    const linkId = 'hero-ex-1'
    const m = {
      initiative: '8',
      phases: {
        links: [{ id: linkId, parentId: null, offset: 8, heroExtra: 'ang' }],
        rowPanelOpen: true,
      },
      [KR_ZAO_SLOTS]: { [linkId]: { kind: 'ang', marks: 1 } },
    }
    expect(metaHasPendingLoadedNonHeroExtraZao(m)).toBe(false)
  })

  it('ist false wenn nur marks 0 (gestempelt)', () => {
    const linkId = 'root-zao-1'
    const m = {
      initiative: '8',
      phases: {
        links: [{ id: linkId, parentId: null, offset: 8 }],
        rowPanelOpen: true,
      },
      [KR_ZAO_SLOTS]: { [linkId]: { kind: 'ang', marks: 0 } },
    }
    expect(metaHasPendingLoadedNonHeroExtraZao(m)).toBe(false)
  })

  it('ist false ohne Meta', () => {
    expect(metaHasPendingLoadedNonHeroExtraZao(null)).toBe(false)
    expect(metaHasPendingLoadedNonHeroExtraZao(undefined)).toBe(false)
  })
})
