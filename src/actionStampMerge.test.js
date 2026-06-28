import { describe, expect, it } from 'vitest'
import {
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
})
