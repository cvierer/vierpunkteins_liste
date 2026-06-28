import { describe, expect, it } from 'vitest'
import {
  KR_ZAO_SLOTS,
  chargedRegularZaoActionCount,
  pruneOrphanZaoSlots,
  readZaoSlots,
} from './krCounters.js'

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

describe('chargedRegularZaoActionCount', () => {
  const meta = (slots) => ({
    phases: {
      links: [
        { id: 'z1', parentId: null, phaseNum: 2 },
        { id: 'z2', parentId: null, phaseNum: 3 },
      ],
    },
    [KR_ZAO_SLOTS]: slots,
  })

  it('zaehlt Schwert und S.R.A.', () => {
    expect(
      chargedRegularZaoActionCount(
        meta({ z1: { kind: 'ang', marks: 1 }, z2: { kind: 'sra', marks: 1 } })
      )
    ).toBe(2)
  })

  it('L.H. ist schild-neutral und wird NICHT mitgezaehlt', () => {
    expect(
      chargedRegularZaoActionCount(
        meta({ z1: { kind: 'lh', marks: 1 }, z2: { kind: 'ang', marks: 1 } })
      )
    ).toBe(1)
    expect(
      chargedRegularZaoActionCount(
        meta({ z1: { kind: 'lh', marks: 1 }, z2: { kind: 'lh', marks: 1 } })
      )
    ).toBe(0)
  })

  it('leere/eingelagerte Slots zaehlen nicht', () => {
    expect(
      chargedRegularZaoActionCount(
        meta({
          z1: { kind: 'uo', marks: 0, lodgedAbw: true },
          z2: { kind: 'ang', marks: 1, lodgedAbw: true },
        })
      )
    ).toBe(0)
  })
})
