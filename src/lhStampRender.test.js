import { describe, expect, it } from 'vitest'
import {
  groupStampsByMergedAnchor,
  mergedListEntryAnchorKey,
} from './actionStampMerge.js'
import { LH_DONE_STEP_ID } from './phaseLinks.js'

const tokenRow = (id) => ({ kind: 'token', row: { id } })
const phaseRow = (ownerId, linkId) => ({
  kind: 'phase',
  ownerId,
  link: { id: linkId },
})

describe('mergedListEntryAnchorKey', () => {
  it('Token-Zeile ohne Phase-Link', () => {
    expect(mergedListEntryAnchorKey(tokenRow('hero-a'))).toBe('hero-a|')
  })

  it('Phase-Zeile mit Link-ID', () => {
    expect(mergedListEntryAnchorKey(phaseRow('hero-a', 'zao-1'))).toBe(
      'hero-a|zao-1'
    )
  })

  it('lhDone-Zeile nutzt LH_DONE_STEP_ID', () => {
    expect(
      mergedListEntryAnchorKey({ kind: 'lhDone', ownerId: 'hero-a' })
    ).toBe(`hero-a|${LH_DONE_STEP_ID}`)
  })
})

describe('groupStampsByMergedAnchor', () => {
  it('ordnet Abwehr-Stempel der Token-Zeile zu wenn Phase fehlt (L.H.)', () => {
    const merged = [tokenRow('hero-a')]
    const stamps = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: 'krAbw',
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: 'zao-gone',
      },
    ]
    const byKey = groupStampsByMergedAnchor(merged, stamps)
    expect(byKey.get('hero-a|')).toHaveLength(1)
    expect(byKey.get('hero-a|')[0].id).toBe('s1')
  })

  it('ordnet F.A.-Stempel exakt an Phasenzeile', () => {
    const merged = [tokenRow('hero-a'), phaseRow('hero-a', 'zao-1')]
    const stamps = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: 'krFreeAction',
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: 'zao-1',
      },
    ]
    const byKey = groupStampsByMergedAnchor(merged, stamps)
    expect(byKey.get('hero-a|zao-1')).toHaveLength(1)
  })
})
