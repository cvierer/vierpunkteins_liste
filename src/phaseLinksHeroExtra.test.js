import { describe, expect, it, vi } from 'vitest'

vi.mock('./editAccess.js', () => ({
  isGmSync: vi.fn(() => false),
}))

vi.mock('./roomSettings.js', () => ({
  getRoomSettings: vi.fn(() => ({ convertLockState: 'closed' })),
}))

import { buildConvertListVisibilityCtx } from './convertLockViewer.js'
import {
  shouldShowHeroExtraLink,
  shouldShowPhaseLinkInList,
} from './phaseLinks.js'

const zatLink = { id: 'zat-1', parentId: null, heroExtra: 'ang' }

describe('shouldShowHeroExtraLink', () => {
  const baseMeta = { heroExtraAngCount: 1, krAbw: 1 }

  it('zeigt z.AT bei Mutter ang', () => {
    expect(
      shouldShowHeroExtraLink({ ...baseMeta, krFirstSlotKind: 'ang' }, zatLink)
    ).toBe(true)
  })

  it('blendet z.AT bei Mutter sra und leerem Schild aus', () => {
    expect(
      shouldShowHeroExtraLink({ ...baseMeta, krFirstSlotKind: 'sra' }, zatLink)
    ).toBe(false)
  })

  it('blendet z.AT bei Mutter lh und leerem Schild aus', () => {
    expect(
      shouldShowHeroExtraLink({ ...baseMeta, krFirstSlotKind: 'lh' }, zatLink)
    ).toBe(false)
  })

  it('blendet z.AT bei Mutter uo und leerem Schild aus', () => {
    expect(
      shouldShowHeroExtraLink({ ...baseMeta, krFirstSlotKind: 'uo' }, zatLink)
    ).toBe(false)
  })

  it('zeigt z.AT bei Mutter uo und geladenem Schild', () => {
    expect(
      shouldShowHeroExtraLink(
        { ...baseMeta, krFirstSlotKind: 'uo', krAbw: 0 },
        zatLink
      )
    ).toBe(true)
  })

  it('blendet z.AT bei Mutex schwarzes Schild aus', () => {
    expect(
      shouldShowHeroExtraLink(
        { ...baseMeta, krFirstSlotKind: 'ang', krExtraChoiceUsed: 'par' },
        zatLink
      )
    ).toBe(false)
  })

  it('zeigt z.AT bei Mutter uo ohne Schild über Fallback reguläres 2.AO-Schwert', () => {
    const regRootId = 'reg-2ao'
    expect(
      shouldShowHeroExtraLink(
        {
          ...baseMeta,
          krFirstSlotKind: 'uo',
          krAbw: 1,
          phases: {
            links: [
              { id: regRootId, parentId: null },
              { id: 'zat-1', parentId: null, heroExtra: 'ang' },
            ],
          },
          krZaoSlots: { [regRootId]: { kind: 'ang', marks: 1 } },
        },
        zatLink
      )
    ).toBe(true)
  })
})

describe('shouldShowPhaseLinkInList', () => {
  const baseMeta = { heroExtraAngCount: 1, krAbw: 1, krFirstSlotKind: 'sra' }

  it('zeigt reguläre 2.AO-Links immer', () => {
    expect(
      shouldShowPhaseLinkInList(baseMeta, { id: 'reg', parentId: null })
    ).toBe(true)
  })

  it('wendet z.AT-Regeln nur auf heroExtra an', () => {
    expect(
      shouldShowPhaseLinkInList(baseMeta, {
        id: 'zat',
        parentId: null,
        heroExtra: 'ang',
      })
    ).toBe(false)
  })

  it('blendet unset 2.AO bei geschlossenem Schloss aus (Spieler-Kontext)', () => {
    const ctx = buildConvertListVisibilityCtx({
      combatStarted: true,
      roundIntroPending: false,
      rowActiveId: 'x',
      rowActivePhaseLinkId: null,
      currentNavIni: 5,
    })
    expect(
      shouldShowPhaseLinkInList(
        {},
        { id: 'reg', parentId: null },
        ctx
      )
    ).toBe(false)
  })
})
