import { describe, expect, it } from 'vitest'
import {
  KR_ANG,
  KR_ABW,
  KR_FIRST_SLOT_KIND,
  KR_LH_ACTION,
  KR_SRA,
  KR_ZAO_SLOTS,
  motherPrimarySelfStamped,
  lhEndKrConvertArrowGates,
  readZaoSlots,
  readEffectiveZaoSlotKind,
  readKrFirstSlotKind,
  defaultZaoSlotForPhaseNum,
  metaHasPendingLoadedNonHeroExtraZao,
  rebuildKrActionPoolVisualsFromAngAbw,
  krTransferMarkPresent,
  motherHasChargedAng,
  hasChargedRegularZaoAng,
  syncReactionShieldForDualAng,
} from './krCounters.js'
import { normalizePhases } from './phaseLinks.js'
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

  describe('readZaoSlots lodgedAbw / uo', () => {
    const linkId = 'z-root'

    it('liest lodgedAbw aus krZaoSlots', () => {
      const meta = {
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
          [linkId]: { kind: 'ang', marks: 0, lodgedAbw: true },
        },
      }
      expect(readZaoSlots(meta)[linkId]).toEqual({
        kind: 'ang',
        marks: 0,
        lodgedAbw: true,
      })
      expect(readEffectiveZaoSlotKind(readZaoSlots(meta)[linkId])).toBe('uo')
    })

    it('liest kind uo aus krZaoSlots', () => {
      const meta = {
        [KR_ZAO_SLOTS]: {
          [linkId]: { kind: 'uo', marks: 0, lodgedAbw: true },
        },
      }
      expect(readZaoSlots(meta)[linkId]).toEqual({
        kind: 'uo',
        marks: 0,
        lodgedAbw: true,
      })
    })

    it('lodged ohne marks=1 zählt nicht als pending-loaded ZAO', () => {
      const meta = {
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
          [linkId]: { kind: 'ang', marks: 0, lodgedAbw: true },
        },
      }
      expect(metaHasPendingLoadedNonHeroExtraZao(meta)).toBe(false)
    })
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

describe('defaultZaoSlotForPhaseNum', () => {
  it('2.Akt. startet mit UO (Schild-Ladung)', () => {
    expect(defaultZaoSlotForPhaseNum(2)).toEqual({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })
  })

  it('3.Akt.+ startet mit UO (Schild-Ladung)', () => {
    expect(defaultZaoSlotForPhaseNum(3)).toEqual({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })
  })

  it('4.Akt.+ startet ebenfalls mit UO', () => {
    expect(defaultZaoSlotForPhaseNum(4)).toEqual({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })
  })
})

describe('rebuildKrActionPoolVisualsFromAngAbw nAO roots', () => {
  function regularRootCount(m) {
    return normalizePhases(m.phases).links.filter(
      (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
    ).length
  }

  function baseMeta() {
    return {
      initiative: '10',
      phases: { links: [], rowPanelOpen: false },
      [KR_ZAO_SLOTS]: {},
      [KR_FIRST_SLOT_KIND]: 'ang',
    }
  }

  it('ang=1 legt mindestens eine 2.AO-Wurzel mit UO an', () => {
    const m = baseMeta()
    rebuildKrActionPoolVisualsFromAngAbw(m, 1, 1)
    expect(regularRootCount(m)).toBe(1)
    expect(m.phases.rowPanelOpen).toBe(true)
    const rootId = normalizePhases(m.phases).links.find(
      (l) => l.parentId === null && !l.heroExtra
    )?.id
    expect(rootId).toBeTruthy()
    expect(readZaoSlots(m)[rootId]).toEqual({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })
  })

  it('ang=1 abw=1: Mutter-Schwert und genau ein Speicher-Schild (kein Doppel-Count)', () => {
    const m = baseMeta()
    rebuildKrActionPoolVisualsFromAngAbw(m, 1, 1)
    expect(readKrFirstSlotKind(m)).toBe('ang')
    expect(krTransferMarkPresent(m[KR_ANG])).toBe(true)
    expect(krTransferMarkPresent(m[KR_ABW])).toBe(true)
    expect(m[KR_ABW]).toBe(0)
  })

  it('ang=3 abw=1: nur erste UO-Wurzel mit lodgedAbw', () => {
    const m = { ...baseMeta(), initiative: '20' }
    rebuildKrActionPoolVisualsFromAngAbw(m, 3, 1)
    const roots = normalizePhases(m.phases).links.filter(
      (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
    )
    const slots = readZaoSlots(m)
    const lodgedCount = roots.filter((l) => slots[l.id]?.lodgedAbw).length
    expect(lodgedCount).toBe(1)
    expect(krTransferMarkPresent(m[KR_ABW])).toBe(true)
  })

  it('UO→Ang auf ZAO entfernt Speicher-Ladung', () => {
    const m = baseMeta()
    rebuildKrActionPoolVisualsFromAngAbw(m, 1, 1)
    const rootId = normalizePhases(m.phases).links.find(
      (l) => l.parentId === null && !l.heroExtra
    )?.id
    expect(rootId).toBeTruthy()
    expect(krTransferMarkPresent(m[KR_ABW])).toBe(true)
    m[KR_ABW] = 1
    const s = readZaoSlots(m)
    s[rootId] = { kind: 'ang', marks: 1 }
    m[KR_ZAO_SLOTS] = s
    expect(krTransferMarkPresent(m[KR_ABW])).toBe(false)
    expect(readZaoSlots(m)[rootId]).toEqual({ kind: 'ang', marks: 1 })
  })

  it('ang=2 legt eine Wurzel an (Regression)', () => {
    const m = baseMeta()
    rebuildKrActionPoolVisualsFromAngAbw(m, 2, 0)
    expect(regularRootCount(m)).toBe(1)
  })

  it('ang=3 legt zwei Wurzeln an (Regression)', () => {
    const m = { ...baseMeta(), initiative: '20' }
    rebuildKrActionPoolVisualsFromAngAbw(m, 3, 0)
    expect(regularRootCount(m)).toBe(2)
  })

  it('ang=0 legt keine Wurzel an', () => {
    const m = baseMeta()
    rebuildKrActionPoolVisualsFromAngAbw(m, 0, 2)
    expect(regularRootCount(m)).toBe(0)
  })
})

describe('dualAng mother and 2AO', () => {
  function baseMeta() {
    return {
      initiative: '10',
      phases: { links: [], rowPanelOpen: false },
      [KR_ZAO_SLOTS]: {},
      [KR_FIRST_SLOT_KIND]: 'ang',
    }
  }

  function regularRootId(m) {
    return normalizePhases(m.phases).links.find(
      (l) => l.parentId === null && !l.heroExtra
    )?.id
  }

  it('Dual-Schwert: sync leert Speicher wenn Mutter und 2AO ang geladen', () => {
    const m = baseMeta()
    rebuildKrActionPoolVisualsFromAngAbw(m, 1, 1)
    const rootId = regularRootId(m)
    expect(rootId).toBeTruthy()
    m[KR_ABW] = 1
    const s = readZaoSlots(m)
    s[rootId] = { kind: 'ang', marks: 1 }
    m[KR_ZAO_SLOTS] = s
    syncReactionShieldForDualAng(m)
    expect(motherHasChargedAng(m)).toBe(true)
    expect(hasChargedRegularZaoAng(m)).toBe(true)
    expect(krTransferMarkPresent(m[KR_ABW])).toBe(false)
  })

  it('Mutter uo + 2AO ang: nach Mutter-ang bleibt Speicher leer', () => {
    const m = baseMeta()
    rebuildKrActionPoolVisualsFromAngAbw(m, 1, 1)
    const rootId = regularRootId(m)
    expect(rootId).toBeTruthy()
    m[KR_FIRST_SLOT_KIND] = 'uo'
    m[KR_ANG] = 1
    m[KR_ABW] = 1
    const s = readZaoSlots(m)
    s[rootId] = { kind: 'ang', marks: 1 }
    m[KR_ZAO_SLOTS] = s
    m[KR_FIRST_SLOT_KIND] = 'ang'
    m[KR_ANG] = 0
    syncReactionShieldForDualAng(m)
    expect(krTransferMarkPresent(m[KR_ABW])).toBe(false)
  })

  it('2AO ang → UO: Speicher-Mark wieder da, Phasen-Zeile bleibt', () => {
    const m = baseMeta()
    rebuildKrActionPoolVisualsFromAngAbw(m, 1, 1)
    const rootId = regularRootId(m)
    expect(rootId).toBeTruthy()
    const s = readZaoSlots(m)
    s[rootId] = { kind: 'ang', marks: 1 }
    m[KR_ZAO_SLOTS] = s
    m[KR_ABW] = 1
    syncReactionShieldForDualAng(m)
    expect(krTransferMarkPresent(m[KR_ABW])).toBe(false)
    m[KR_ABW] = 0
    s[rootId] = { kind: 'uo', marks: 0, lodgedAbw: true }
    m[KR_ZAO_SLOTS] = s
    expect(krTransferMarkPresent(m[KR_ABW])).toBe(true)
    expect(
      normalizePhases(m.phases).links.some((l) => l.id === rootId)
    ).toBe(true)
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

  it('End-KR + pendelnde ZAO + convertAnytimeEnabled: keine Reihenfolge-Sperren', () => {
    const linkId = 'zao-a'
    const meta = {
      ...baseMeta,
      convertAnytimeEnabled: true,
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
    expect(lhEndKrConvertArrowGates(meta, 2)).toEqual({
      blockUpperLhMotherNoZao: false,
      blockLowerPendingZao: false,
    })
  })

  it('End-KR + pendelnde ZAO + convertAllowEntireRound: keine Reihenfolge-Sperren', () => {
    const linkId = 'zao-a'
    const meta = {
      ...baseMeta,
      convertAllowEntireRound: true,
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
    expect(lhEndKrConvertArrowGates(meta, 2)).toEqual({
      blockUpperLhMotherNoZao: false,
      blockLowerPendingZao: false,
    })
  })

  it('End-KR ohne ZAO + convertAnytimeEnabled: keine Reihenfolge-Sperren', () => {
    expect(
      lhEndKrConvertArrowGates(
        { ...baseMeta, convertAnytimeEnabled: true },
        2
      )
    ).toEqual({
      blockUpperLhMotherNoZao: false,
      blockLowerPendingZao: false,
    })
  })

  it('End-KR ohne ZAO + convertAllowEntireRound: keine Reihenfolge-Sperren', () => {
    expect(
      lhEndKrConvertArrowGates(
        { ...baseMeta, convertAllowEntireRound: true },
        2
      )
    ).toEqual({
      blockUpperLhMotherNoZao: false,
      blockLowerPendingZao: false,
    })
  })
})
