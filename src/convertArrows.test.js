import { describe, expect, it } from 'vitest'
import {
  KR_ANG,
  KR_FIRST_SLOT_KIND,
  KR_LH_ACTION,
  KR_SRA,
  KR_ZAO_SLOTS,
  motherPrimarySelfStamped,
  lhEndKrConvertArrowGates,
} from './krCounters.js'
import {
  LH_ACTIONS_PER_KR,
  LH_COMMIT_ROUND,
  LH_COMMIT_INI,
  LH_MAX,
  LH_REM,
  LH_TRIGGER_INI_STEP,
} from './lhMeta.js'

describe('motherPrimarySelfStamped', () => {
  const itemId = 'hero-token'

  it('false ohne Einträge', () => {
    expect(motherPrimarySelfStamped([], itemId)).toBe(false)
  })

  it('true bei Ang-Stempel am Mutteranker (eigene Zeile)', () => {
    expect(
      motherPrimarySelfStamped(
        [
          {
            id: 's1',
            itemId,
            ownerName: '',
            field: KR_ANG,
            anchorRowId: itemId,
            anchorPhaseLinkId: null,
          },
        ],
        itemId
      )
    ).toBe(true)
  })

  it('false wenn anchorRowId auf anderer Navigationszeile lag', () => {
    expect(
      motherPrimarySelfStamped(
        [
          {
            id: 's1',
            itemId,
            ownerName: '',
            field: KR_ANG,
            anchorRowId: 'other-row',
            anchorPhaseLinkId: null,
          },
        ],
        itemId
      )
    ).toBe(false)
  })

  it('false bei ZAO-Stempel (Phasen-Link gesetzt)', () => {
    expect(
      motherPrimarySelfStamped(
        [
          {
            id: 's1',
            itemId,
            ownerName: '',
            field: KR_ANG,
            anchorRowId: itemId,
            anchorPhaseLinkId: 'link-zao',
          },
        ],
        itemId
      )
    ).toBe(false)
  })

  it('false bei Abwehr-/Parade-Stempel', () => {
    expect(
      motherPrimarySelfStamped(
        [
          {
            id: 's1',
            itemId,
            ownerName: '',
            field: 'krAbw',
            anchorPhaseLinkId: null,
            paradeExtra: true,
          },
        ],
        itemId
      )
    ).toBe(false)
  })
})

describe('lhEndKrConvertArrowGates', () => {
  const baseMeta = {
    [LH_MAX]: 3,
    [LH_REM]: 1,
    /** Commit KR1 → KR2 ist End-KR bei max 3, 2 Auslöser/KR (rechnerisch geprüft). */
    [LH_COMMIT_ROUND]: 1,
    [LH_ACTIONS_PER_KR]: 2,
    [LH_TRIGGER_INI_STEP]: -8,
    [KR_FIRST_SLOT_KIND]: 'lh',
    [KR_ZAO_SLOTS]: {},
    phases: { links: [], rowPanelOpen: false },
    initiative: '8',
    [LH_COMMIT_INI]: '8',
  }

  it('ohne End-KR-Modus: keine Zusatzsperren', () => {
    expect(
      lhEndKrConvertArrowGates(
        { ...baseMeta, [LH_REM]: 0 },
        2
      )
    ).toEqual({
      blockUpperLhMotherNoZao: false,
      blockLowerPendingZao: false,
    })
  })

  it('End-KR mit L.H. am Mutterfeld und ohne pendelnde ZAO: nur oberer Pfeil gesperrt', () => {
    const r = lhEndKrConvertArrowGates(baseMeta, 2)
    expect(r.blockUpperLhMotherNoZao).toBe(true)
    expect(r.blockLowerPendingZao).toBe(false)
  })

  it('End-KR mit pendelnder regulärer ZAO: nur unterer Pfeil gesperrt', () => {
    const linkId = 'zao-a'
    const meta = {
      ...baseMeta,
      phases: {
        links: [
          {
            id: linkId,
            parentId: null,
            offset: 8,
          },
        ],
        rowPanelOpen: false,
      },
      [KR_ZAO_SLOTS]: {
        [linkId]: { kind: 'ang', marks: 1 },
      },
    }
    const r = lhEndKrConvertArrowGates(meta, 2)
    expect(r.blockUpperLhMotherNoZao).toBe(false)
    expect(r.blockLowerPendingZao).toBe(true)
  })
})
