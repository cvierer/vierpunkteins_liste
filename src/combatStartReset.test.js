import { describe, expect, it } from 'vitest'
import {
  applyCombatStartDefaultsToMeta,
  DEFAULT_TRACKER_KR_COUNTERS,
  KR_ANG,
  KR_FIRST_SLOT_KIND,
  KR_PAIR_MODE,
  KR_PRIMARY_LADUNG,
  KR_ZAO_SLOTS,
  restoreRegularSecondActionRootAfterLh,
  stripNonHeroExtraPhaseLinksFromMeta,
} from './krCounters.js'
import {
  LH_COMMIT_INI,
  LH_COMMIT_ROUND,
  LH_MAX,
  LH_REBASE_ROUND,
  LH_REBASE_TICKS,
  LH_REM,
} from './lhMeta.js'

describe('applyCombatStartDefaultsToMeta', () => {
  it('setzt Zähler/L.H. auf Kampfstart-Defaults und leert Rebase', () => {
    const m = {
      initiative: '11',
      [KR_ANG]: 1,
      [KR_PRIMARY_LADUNG]: 1,
      [KR_FIRST_SLOT_KIND]: 'lh',
      [KR_PAIR_MODE]: 'lh_abw',
      [LH_MAX]: 4,
      [LH_REM]: 2,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 11,
      [LH_REBASE_ROUND]: 3,
      [LH_REBASE_TICKS]: 2,
      [KR_ZAO_SLOTS]: { 'zao-1': { kind: 'uo', marks: 0 } },
      krExtraChoiceUsed: 'par',
      phases: { links: [], rowPanelOpen: false },
    }
    applyCombatStartDefaultsToMeta(m, { restoreHeroExtraZat: false })
    expect(m[KR_ANG]).toBe(DEFAULT_TRACKER_KR_COUNTERS[KR_ANG])
    expect(m[KR_PRIMARY_LADUNG]).toBe(
      DEFAULT_TRACKER_KR_COUNTERS[KR_PRIMARY_LADUNG]
    )
    expect(m[KR_FIRST_SLOT_KIND]).toBe('ang')
    expect(m[KR_PAIR_MODE]).toBe('ang_abw')
    expect(m[LH_MAX]).toBe(0)
    expect(m[LH_REM]).toBe(0)
    expect(m[LH_COMMIT_ROUND]).toBeUndefined()
    expect(m[LH_REBASE_ROUND]).toBeUndefined()
    expect(m[LH_REBASE_TICKS]).toBeUndefined()
    expect(m.krExtraChoiceUsed).toBeUndefined()
  })
})

describe('stripNonHeroExtraPhaseLinksFromMeta', () => {
  it('behält nur heroExtra-Roots (ang/par), entfernt reguläre 2.AO', () => {
    const heroAng = {
      id: 'hex-ang',
      parentId: null,
      offset: 4,
      heroExtra: 'ang',
    }
    const heroPar = {
      id: 'hex-par',
      parentId: null,
      offset: 2,
      heroExtra: 'par',
    }
    const regular = {
      id: 'zao-reg',
      parentId: null,
      offset: 8,
      expiresNextRound: true,
    }
    const child = {
      id: 'child-1',
      parentId: 'zao-reg',
      offset: 1,
    }
    const m = {
      phases: {
        links: [heroAng, regular, heroPar, child],
        rowPanelOpen: true,
      },
    }
    stripNonHeroExtraPhaseLinksFromMeta(m)
    const ids = m.phases.links.map((l) => l.id)
    expect(ids).toEqual(['hex-ang', 'hex-par'])
    expect(m.phases.rowPanelOpen).toBe(true)
  })
})

describe('reset-Pfad stellt reguläre 2.AO wieder her', () => {
  it('legt nach Strip eine uo/lodgedAbw-Wurzel am Offset an (INI 15)', () => {
    const m = {
      initiative: '15',
      phases: {
        links: [
          {
            id: 'zao-old',
            parentId: null,
            offset: 8,
            expiresNextRound: true,
          },
        ],
        rowPanelOpen: true,
      },
      [KR_ZAO_SLOTS]: { 'zao-old': { kind: 'ang', marks: 1 } },
    }
    applyCombatStartDefaultsToMeta(m, { restoreHeroExtraZat: false })
    stripNonHeroExtraPhaseLinksFromMeta(m)
    expect(
      m.phases.links.filter(
        (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
      )
    ).toHaveLength(0)
    expect(restoreRegularSecondActionRootAfterLh(m)).toBe(true)
    const regular = m.phases.links.filter(
      (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
    )
    expect(regular).toHaveLength(1)
    expect(regular[0].offset).toBe(8)
    const slot = m[KR_ZAO_SLOTS][regular[0].id]
    expect(slot).toMatchObject({ kind: 'uo', marks: 0, lodgedAbw: true })
  })
})
