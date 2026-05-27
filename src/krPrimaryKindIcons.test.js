import { describe, expect, it } from 'vitest'
import {
  combatOverlayKey,
  primaryKindMapStyle,
  primaryKindMapSymbol,
  primaryKindSvgMarkup,
  primaryKindSvgDataUrl,
  resolvePrimaryKindForNav,
  shouldShowTurnActionMapBadge,
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

describe('primaryKindSvgDataUrl', () => {
  it('liefert data-URL für ang', () => {
    const url = primaryKindSvgDataUrl('ang')
    expect(url.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decodeURIComponent(url.slice('data:image/svg+xml,'.length))).toContain(
      'init-kr-primary-kind__svg--ang'
    )
  })
})

describe('primaryKindMapSymbol', () => {
  it('liefert je kind ein nicht-leeres Zeichen', () => {
    for (const k of ['ang', 'sra', 'lh', 'uo', 'par']) {
      expect(primaryKindMapSymbol(k).length).toBeGreaterThan(0)
    }
  })

  it('ang ist Dolch-Symbol', () => {
    expect(primaryKindMapSymbol('ang')).toBe('\u{1F5E1}')
  })

  it('lh teilt Stern mit sra', () => {
    expect(primaryKindMapSymbol('lh')).toBe(primaryKindMapSymbol('sra'))
    expect(primaryKindMapSymbol('lh')).toBe('\u2605')
  })
})

describe('shouldShowTurnActionMapBadge', () => {
  it('uo blendet kein Badge ein', () => {
    expect(shouldShowTurnActionMapBadge('uo')).toBe(false)
  })

  it('andere Kinds zeigen Badge', () => {
    for (const k of ['ang', 'sra', 'lh', 'par']) {
      expect(shouldShowTurnActionMapBadge(k)).toBe(true)
    }
  })
})

describe('primaryKindMapStyle', () => {
  it('liefert Farben für ang', () => {
    const s = primaryKindMapStyle('ang')
    expect(s.fillColor).toMatch(/^#/)
    expect(s.backgroundColor).toMatch(/^#/)
    expect(s.backgroundOpacity).toBeGreaterThan(0)
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
