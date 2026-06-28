import { describe, expect, it } from 'vitest'
import {
  actionStampsSignature,
  matchesMergedEntryActive,
  mergeActionStampsIntoMerged,
} from './actionStampMerge.js'

const tokenRow = (id) => ({ kind: 'token', row: { id } })
const phaseRow = (ownerId, linkId) => ({
  kind: 'phase',
  ownerId,
  link: { id: linkId },
})

describe('matchesMergedEntryActive', () => {
  it('Token-Zeile trifft nur ohne Phase-Link-ID', () => {
    expect(matchesMergedEntryActive(tokenRow('hero-a'), 'hero-a', null)).toBe(
      true
    )
    expect(matchesMergedEntryActive(tokenRow('hero-a'), 'hero-a', 'zao-1')).toBe(
      false
    )
  })

  it('Phase-Zeile trifft bei Owner + exakter Link-ID', () => {
    expect(
      matchesMergedEntryActive(phaseRow('hero-a', 'zao-1'), 'hero-a', 'zao-1')
    ).toBe(true)
    expect(
      matchesMergedEntryActive(phaseRow('hero-a', 'zao-1'), 'hero-a', 'zao-2')
    ).toBe(false)
  })
})

describe('mergeActionStampsIntoMerged', () => {
  it('Stempel mit veralteter Phase-Link-ID landet an der 2.AO-Phasenzeile', () => {
    const merged = [tokenRow('hero-a'), phaseRow('hero-a', 'zao-new')]
    const stamps = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: 'krAbw',
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: 'zao-stale',
      },
    ]
    const out = mergeActionStampsIntoMerged(merged, stamps)
    const stampIdx = out.findIndex((e) => e.kind === 'actionStamp')
    const phaseIdx = out.findIndex((e) => e.kind === 'phase')
    // Stempel folgt direkt der Phasenzeile, nicht der Token-Zeile.
    expect(stampIdx).toBe(phaseIdx + 1)
  })

  it('Stempel von der Mutter-Zeile (anchorPhaseLinkId null) bleibt an der Token-Zeile', () => {
    const merged = [tokenRow('hero-a'), phaseRow('hero-a', 'zao-new')]
    const stamps = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: 'krAbw',
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: null,
      },
    ]
    const out = mergeActionStampsIntoMerged(merged, stamps)
    const tokenIdx = out.findIndex((e) => e.kind === 'token')
    expect(out[tokenIdx + 1].kind).toBe('actionStamp')
  })

  it('exakter Phase-Treffer wird bevorzugt (kein Fallback noetig)', () => {
    const merged = [
      tokenRow('hero-a'),
      phaseRow('hero-a', 'zao-1'),
      phaseRow('hero-a', 'zao-2'),
    ]
    const stamps = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: 'krFreeAction',
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: 'zao-2',
      },
    ]
    const out = mergeActionStampsIntoMerged(merged, stamps)
    const stampIdx = out.findIndex((e) => e.kind === 'actionStamp')
    // direkt hinter zao-2 (Index 2), also Index 3
    expect(out[stampIdx - 1]).toMatchObject({
      kind: 'phase',
      link: { id: 'zao-2' },
    })
  })

  it('ohne passende Phasenzeile faellt der Stempel auf die Token-Zeile zurueck', () => {
    const merged = [tokenRow('hero-a')]
    const stamps = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: 'krAbw',
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: 'zao-stale',
      },
    ]
    const out = mergeActionStampsIntoMerged(merged, stamps)
    expect(out[1].kind).toBe('actionStamp')
  })

  it('L.H. entfernt 2.AO-Phasenzeile: Stempel landet auf der Token-Zeile von anchorRowId, NICHT von stamp.itemId', () => {
    // Reaktion: anchorRowId = platzierender Held (hero-a), stamp.itemId =
    // Verteidiger (hero-b). hero-a hat keine Phasenzeile mehr (L.H. hat sie
    // entfernt). Der Stempel muss am Mutter-Token von hero-a bleiben.
    const merged = [tokenRow('hero-a'), tokenRow('hero-b')]
    const stamps = [
      {
        id: 's1',
        itemId: 'hero-b',
        field: 'krAbw',
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: 'zao-gone',
      },
    ]
    const out = mergeActionStampsIntoMerged(merged, stamps)
    const aIdx = out.findIndex((e) => e.kind === 'token' && e.row.id === 'hero-a')
    const bIdx = out.findIndex((e) => e.kind === 'token' && e.row.id === 'hero-b')
    // Stempel direkt hinter hero-a, vor hero-b.
    expect(out[aIdx + 1].kind).toBe('actionStamp')
    expect(bIdx).toBe(aIdx + 2)
  })

  it('ohne anchorRowId-Token faellt der Stempel weiterhin auf stamp.itemId zurueck', () => {
    const merged = [tokenRow('hero-b')]
    const stamps = [
      {
        id: 's1',
        itemId: 'hero-b',
        field: 'krAbw',
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: 'zao-gone',
      },
    ]
    const out = mergeActionStampsIntoMerged(merged, stamps)
    const bIdx = out.findIndex((e) => e.kind === 'token' && e.row.id === 'hero-b')
    expect(out[bIdx + 1].kind).toBe('actionStamp')
  })
})

describe('actionStampsSignature', () => {
  const stamp = (over = {}) => ({
    id: 's1',
    field: 'krAbw',
    anchorRowId: 'hero-a',
    anchorPhaseLinkId: null,
    ...over,
  })

  it('leer/ungueltig -> leere Signatur', () => {
    expect(actionStampsSignature(null)).toBe('')
    expect(actionStampsSignature(undefined)).toBe('')
    expect(actionStampsSignature({})).toBe('')
    expect(actionStampsSignature({ entries: [] })).toBe('')
  })

  it('gleiche Stempel -> gleiche Signatur', () => {
    const a = { entries: [stamp()] }
    const b = { entries: [stamp()] }
    expect(actionStampsSignature(a)).toBe(actionStampsSignature(b))
  })

  it('geaenderter Anker -> geaenderte Signatur', () => {
    const before = { entries: [stamp({ anchorPhaseLinkId: 'zao-1' })] }
    const after = { entries: [stamp({ anchorPhaseLinkId: 'zao-2' })] }
    expect(actionStampsSignature(before)).not.toBe(actionStampsSignature(after))
  })

  it('zusaetzlicher Stempel -> geaenderte Signatur', () => {
    const before = { entries: [stamp()] }
    const after = { entries: [stamp(), stamp({ id: 's2' })] }
    expect(actionStampsSignature(before)).not.toBe(actionStampsSignature(after))
  })

  it('geaendertes Feld -> geaenderte Signatur', () => {
    const before = { entries: [stamp({ field: 'krAbw' })] }
    const after = { entries: [stamp({ field: 'krFreeAction' })] }
    expect(actionStampsSignature(before)).not.toBe(actionStampsSignature(after))
  })
})
