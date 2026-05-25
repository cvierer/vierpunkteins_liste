import { describe, expect, it } from 'vitest'
import {
  combatOverlayKey,
  MAP_PRIMARY_ICON_H,
  MAP_PRIMARY_ICON_W,
  primaryKindSvgMarkup,
  resolvePrimaryKindForNav,
} from './krPrimaryKindIcons.js'

describe('resolvePrimaryKindForNav', () => {
  it('Mutter: krFirstSlotKind ang', () => {
    expect(resolvePrimaryKindForNav({ krFirstSlotKind: 'ang' }, null)).toBe(
      'ang'
    )
  })

  it('2.AO: Slot uo', () => {
    expect(
      resolvePrimaryKindForNav(
        {
          phases: { links: [{ id: 'zao1', parentId: null }] },
          krZaoSlots: { zao1: { kind: 'uo', marks: 1 } },
        },
        'zao1'
      )
    ).toBe('uo')
  })

  it('z.AT heroExtra ang', () => {
    expect(
      resolvePrimaryKindForNav(
        {
          phases: {
            links: [{ id: 'zat1', parentId: null, heroExtra: 'ang' }],
          },
        },
        'zat1'
      )
    ).toBe('ang')
  })
})

describe('primaryKindSvgMarkup', () => {
  it('ang enthält Schwert-Klasse', () => {
    expect(primaryKindSvgMarkup('ang')).toContain(
      'init-kr-primary-kind__svg--ang'
    )
  })

  it('sra enthält Aktions-Stern-Klasse', () => {
    expect(primaryKindSvgMarkup('sra')).toContain(
      'init-kr-primary-kind__svg--sra'
    )
  })

  it('lh enthält L.H.-Stern-Klasse', () => {
    expect(primaryKindSvgMarkup('lh')).toContain('init-kr-primary-kind__svg--lh')
  })

  it('uo enthält UO-Pfeil-Klasse', () => {
    expect(primaryKindSvgMarkup('uo')).toContain('init-kr-uo-convert-arrow')
  })
})

describe('MAP_PRIMARY_ICON dimensions', () => {
  it('entspricht viewBox 24:34 skaliert', () => {
    expect(MAP_PRIMARY_ICON_W).toBe(48)
    expect(MAP_PRIMARY_ICON_H).toBe(68)
  })
})

describe('combatOverlayKey', () => {
  it('ändert sich bei currentItemId', () => {
    const a = combatOverlayKey({
      currentItemId: 'h1',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'action',
    })
    const b = combatOverlayKey({
      currentItemId: 'h2',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'action',
    })
    expect(a).not.toBe(b)
  })

  it('ändert sich bei currentTurnSubStep', () => {
    const a = combatOverlayKey({
      currentItemId: 'h1',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'action',
    })
    const b = combatOverlayKey({
      currentItemId: 'h1',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'reaction',
    })
    expect(a).not.toBe(b)
  })
})
