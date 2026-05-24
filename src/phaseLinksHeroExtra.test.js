import { describe, expect, it } from 'vitest'
import { shouldShowHeroExtraLink } from './phaseLinks.js'

const zatLink = { id: 'zat-1', parentId: null, heroExtra: 'ang' }

describe('shouldShowHeroExtraLink', () => {
  const baseMeta = { heroExtraAngCount: 1, krAbw: 1 }

  it('zeigt z.AT bei Mutter ang', () => {
    expect(
      shouldShowHeroExtraLink({ ...baseMeta, krFirstSlotKind: 'ang' }, zatLink)
    ).toBe(true)
  })

  it('zeigt z.AT bei Mutter sra und leerem Schild (Regression Mutter-Umtausch)', () => {
    expect(
      shouldShowHeroExtraLink({ ...baseMeta, krFirstSlotKind: 'sra' }, zatLink)
    ).toBe(true)
  })

  it('zeigt z.AT bei Mutter lh und leerem Schild', () => {
    expect(
      shouldShowHeroExtraLink({ ...baseMeta, krFirstSlotKind: 'lh' }, zatLink)
    ).toBe(true)
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

  it('gibt für nicht-heroExtra-Links immer true zurück', () => {
    expect(
      shouldShowHeroExtraLink(baseMeta, { id: 'reg', parentId: null })
    ).toBe(true)
  })
})
