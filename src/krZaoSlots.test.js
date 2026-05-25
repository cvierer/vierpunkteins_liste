import { describe, expect, it } from 'vitest'
import { KR_ZAO_SLOTS, pruneOrphanZaoSlots, readZaoSlots } from './krCounters.js'

describe('pruneOrphanZaoSlots', () => {
  it('entfernt Slots ohne Phasen-Link', () => {
    const meta = {
      phases: {
        links: [{ id: 'link-a', parentId: null, phaseNum: 2 }],
      },
      [KR_ZAO_SLOTS]: {
        'link-a': { kind: 'ang', marks: 1 },
        orphan: { kind: 'ang', marks: 0 },
      },
    }
    expect(pruneOrphanZaoSlots(meta)).toBe(true)
    expect(readZaoSlots(meta)).toEqual({ 'link-a': { kind: 'ang', marks: 1 } })
  })

  it('liefert false wenn nichts zu tun', () => {
    const meta = {
      phases: { links: [{ id: 'x', parentId: null, phaseNum: 2 }] },
      [KR_ZAO_SLOTS]: { x: { kind: 'uo', marks: 0, lodgedAbw: true } },
    }
    expect(pruneOrphanZaoSlots(meta)).toBe(false)
  })
})
