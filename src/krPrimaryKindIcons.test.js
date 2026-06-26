import { describe, expect, it } from 'vitest'
import {
  combatOverlayKey,
  primaryKindMapStyle,
  primaryKindMapSymbol,
  primaryKindMapFontWeight,
  primaryKindMapFontSize,
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

  it('ang ist Dolch-Emoji (U+1F5E1)', () => {
    expect(primaryKindMapSymbol('ang')).toBe('\u{1F5E1}')
  })

  it('ang: weisse Fuellung, gleiche Schriftgroesse wie Stern/Sanduhr', () => {
    // Schwert nutzt jetzt denselben Default wie sra/lh, damit Hintergrund-
    // flaeche und Position auf der Map uebereinstimmen (V1276).
    expect(primaryKindMapStyle('ang').fillColor).toBe('#ffffff')
    expect(primaryKindMapFontWeight('ang')).toBe(700)
    expect(primaryKindMapFontSize('ang')).toBe(26)
  })

  it('andere Kinds: Standard-Schriftgroesse', () => {
    for (const k of ['sra', 'lh', 'par']) {
      expect(primaryKindMapFontWeight(k)).toBe(700)
      expect(primaryKindMapFontSize(k)).toBe(26)
    }
  })

  it('lh ist Sanduhr (nicht mehr Stern wie sra)', () => {
    expect(primaryKindMapSymbol('lh')).toBe('\u231B')
    expect(primaryKindMapSymbol('lh')).not.toBe(primaryKindMapSymbol('sra'))
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

  it('Heldenfarbe ueberschreibt den Hintergrund (helles Symbol bleibt)', () => {
    const base = primaryKindMapStyle('ang')
    const tinted = primaryKindMapStyle('ang', '#3366cc')
    expect(tinted.backgroundColor).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(tinted.backgroundColor).not.toBe(base.backgroundColor)
    expect(tinted.fillColor).toBe(base.fillColor)
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
