import { describe, expect, it } from 'vitest'
import { combatOverlayKey, primaryKindSvgDataUrl } from './krPrimaryKindIcons.js'
import {
  KIND_LABEL,
  resolveTurnActionLabelTarget,
  resolveTurnActionLabelText,
} from './heroActionLabel.js'
import { ROUND_START_STEP_ID } from './phaseLinks.js'

describe('resolveTurnActionLabelText', () => {
  it('Mutter: krFirstSlotKind ang', () => {
    expect(
      resolveTurnActionLabelText({ krFirstSlotKind: 'ang' }, null)
    ).toBe(KIND_LABEL.ang)
  })

  it('2.AO: Slot uo', () => {
    expect(
      resolveTurnActionLabelText(
        {
          phases: { links: [{ id: 'zao1', parentId: null }] },
          krZaoSlots: { zao1: { kind: 'uo', marks: 1 } },
        },
        'zao1'
      )
    ).toBe(KIND_LABEL.uo)
  })

  it('z.AT heroExtra ang', () => {
    expect(
      resolveTurnActionLabelText(
        {
          phases: {
            links: [{ id: 'zat1', parentId: null, heroExtra: 'ang' }],
          },
        },
        'zat1'
      )
    ).toBe(KIND_LABEL.ang)
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

describe('resolveTurnActionLabelTarget', () => {
  it('null wenn Kampf nicht läuft', () => {
    expect(resolveTurnActionLabelTarget({ started: false })).toBeNull()
  })

  it('null an roundStart', () => {
    expect(
      resolveTurnActionLabelTarget({
        started: true,
        roundIntroPending: false,
        currentItemId: ROUND_START_STEP_ID,
        currentPhaseLinkId: null,
      })
    ).toBeNull()
  })

  it('liefert owner bei aktivem Token', () => {
    const t = resolveTurnActionLabelTarget({
      started: true,
      roundIntroPending: false,
      currentItemId: 'hero-a',
      currentPhaseLinkId: null,
      currentTurnSubStep: 'action',
    })
    expect(t).toMatchObject({ ownerId: 'hero-a', phaseLinkId: null })
  })
})

describe('combatOverlayKey (Nav-Refresh)', () => {
  it('unterscheidet Phase-Link', () => {
    const a = combatOverlayKey({
      currentItemId: 'h1',
      currentPhaseLinkId: 'z1',
      currentTurnSubStep: 'action',
    })
    const b = combatOverlayKey({
      currentItemId: 'h1',
      currentPhaseLinkId: 'z2',
      currentTurnSubStep: 'action',
    })
    expect(a).not.toBe(b)
  })
})
