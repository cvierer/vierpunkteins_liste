import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ROUND_START_STEP_ID } from './phaseLinks.js'

vi.mock('./editAccess.js', () => ({
  isGmSync: vi.fn(() => false),
}))

vi.mock('./roomSettings.js', () => ({
  getRoomSettings: vi.fn(() => ({ convertLockState: 'auto' })),
}))

import { isGmSync } from './editAccess.js'
import { getRoomSettings } from './roomSettings.js'
import {
  buildConvertListVisibilityCtx,
  hasPassedHeroMotherTurnStep,
  isHeroConvertAllowedForViewer,
  isRegularZaoUnset,
  shouldHideEmptySecondActionRow,
  shouldShowKrPrimaryConvertSwitch,
} from './convertLockViewer.js'

describe('shouldShowKrPrimaryConvertSwitch', () => {
  it('true wenn Umwandlung erlaubt und nicht technisch gesperrt', () => {
    expect(shouldShowKrPrimaryConvertSwitch(true, false)).toBe(true)
  })

  it('false wenn Umwandlung gesperrt', () => {
    expect(shouldShowKrPrimaryConvertSwitch(false, false)).toBe(false)
  })

  it('false bei heroExtra/lhEnd (switchLocked)', () => {
    expect(shouldShowKrPrimaryConvertSwitch(true, true)).toBe(false)
  })
})

describe('isHeroConvertAllowedForViewer', () => {
  beforeEach(() => {
    vi.mocked(isGmSync).mockReturnValue(false)
    vi.mocked(getRoomSettings).mockReturnValue({ convertLockState: 'auto' })
  })

  it('SL: immer erlaubt', () => {
    vi.mocked(isGmSync).mockReturnValue(true)
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowFirstPhase: false },
        'hero-1',
        null,
        5
      )
    ).toBe(true)
  })

  it('Schloss geschlossen: Spieler nicht erlaubt', () => {
    vi.mocked(getRoomSettings).mockReturnValue({ convertLockState: 'closed' })
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowEntireRound: true, initiative: 10 },
        'hero-1',
        null,
        12
      )
    ).toBe(false)
  })

  it('Schloss offen: Spieler erlaubt', () => {
    vi.mocked(getRoomSettings).mockReturnValue({ convertLockState: 'open' })
    expect(
      isHeroConvertAllowedForViewer(
        { initiative: 10 },
        'hero-1',
        'phase-link',
        5
      )
    ).toBe(true)
  })

  it('auto + erste Phase + Navigation hinter Helden-INI: nicht erlaubt', () => {
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowFirstPhase: true, initiative: 10 },
        'hero-1',
        'phase-link',
        8
      )
    ).toBe(false)
  })

  it('auto + erste Phase + Navigation vor Helden-INI: erlaubt', () => {
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowFirstPhase: true, initiative: 10 },
        'hero-1',
        'phase-link',
        12
      )
    ).toBe(true)
  })

  it('auto + Kampfrundenanfang: erlaubt', () => {
    expect(
      isHeroConvertAllowedForViewer(
        { initiative: 10 },
        ROUND_START_STEP_ID,
        null,
        5
      )
    ).toBe(true)
  })

  it('auto + erste Phase: auf 2.AO-Zug trotz gleicher INI nicht erlaubt', () => {
    const ctx = buildConvertListVisibilityCtx({
      turnSteps: [
        { kind: 'token', id: 'hero-A', sub: 'action' },
        { kind: 'token', id: 'hero-A', sub: 'reaction' },
        { kind: 'phase', ownerId: 'hero-A', linkId: 'zao1', sub: 'action' },
        { kind: 'phase', ownerId: 'hero-A', linkId: 'zao1', sub: 'reaction' },
      ],
      combatStepIndex: 2,
    })
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowFirstPhase: true, initiative: 15 },
        'hero-A',
        'zao1',
        15,
        { ownerItemId: 'hero-A', visibilityCtx: ctx }
      )
    ).toBe(false)
  })

  it('auto + erste Phase: auf Mutter-Reaktion noch erlaubt', () => {
    const ctx = buildConvertListVisibilityCtx({
      turnSteps: [
        { kind: 'token', id: 'hero-A', sub: 'action' },
        { kind: 'token', id: 'hero-A', sub: 'reaction' },
        { kind: 'phase', ownerId: 'hero-A', linkId: 'zao1', sub: 'action' },
      ],
      combatStepIndex: 1,
    })
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowFirstPhase: true, initiative: 15 },
        'hero-A',
        null,
        15,
        { ownerItemId: 'hero-A', visibilityCtx: ctx }
      )
    ).toBe(true)
  })

  it('auto + erste Phase: auf Mutter-Aktion erlaubt', () => {
    const ctx = buildConvertListVisibilityCtx({
      turnSteps: [
        { kind: 'token', id: 'hero-A', sub: 'action' },
        { kind: 'token', id: 'hero-A', sub: 'reaction' },
        { kind: 'phase', ownerId: 'hero-A', linkId: 'zao1', sub: 'action' },
      ],
      combatStepIndex: 0,
    })
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowFirstPhase: true, initiative: 15 },
        'hero-A',
        null,
        15,
        { ownerItemId: 'hero-A', visibilityCtx: ctx }
      )
    ).toBe(true)
  })

  it('auto + erste Phase: ohne Zugindex Fallback INI-Vergleich', () => {
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowFirstPhase: true, initiative: 10 },
        'hero-1',
        'phase-link',
        12
      )
    ).toBe(true)
    expect(
      isHeroConvertAllowedForViewer(
        { convertAllowFirstPhase: true, initiative: 10 },
        'hero-1',
        'phase-link',
        8
      )
    ).toBe(false)
  })
})

describe('hasPassedHeroMotherTurnStep', () => {
  const splitSteps = [
    { kind: 'token', id: 'hero-A', sub: 'action' },
    { kind: 'token', id: 'hero-A', sub: 'reaction' },
    { kind: 'phase', ownerId: 'hero-A', linkId: 'zao1', sub: 'action' },
  ]

  it('false auf Mutter-Reaktion, true ab 2.AO-Aktion', () => {
    const ctxReaction = buildConvertListVisibilityCtx({
      turnSteps: splitSteps,
      combatStepIndex: 1,
    })
    const ctxZao = buildConvertListVisibilityCtx({
      turnSteps: splitSteps,
      combatStepIndex: 2,
    })
    expect(hasPassedHeroMotherTurnStep('hero-A', ctxReaction)).toBe(false)
    expect(hasPassedHeroMotherTurnStep('hero-A', ctxZao)).toBe(true)
    expect(
      hasPassedHeroMotherTurnStep('hero-A', { ...ctxReaction, combatStepIndex: 0 })
    ).toBe(false)
  })
})

describe('shouldHideEmptySecondActionRow', () => {
  const regLink = { id: 'zao-1', parentId: null }
  const runningCtx = buildConvertListVisibilityCtx({
    combatStarted: true,
    roundIntroPending: false,
    rowActiveId: 'hero-1',
    rowActivePhaseLinkId: null,
    currentNavIni: 8,
  })
  const introCtx = buildConvertListVisibilityCtx({
    combatStarted: true,
    roundIntroPending: true,
    rowActiveId: 'hero-1',
    rowActivePhaseLinkId: null,
    currentNavIni: null,
  })

  beforeEach(() => {
    vi.mocked(isGmSync).mockReturnValue(false)
    vi.mocked(getRoomSettings).mockReturnValue({ convertLockState: 'auto' })
  })

  it('unset UO-Slot gilt als leer', () => {
    expect(isRegularZaoUnset({}, regLink)).toBe(true)
    expect(
      isRegularZaoUnset(
        { krZaoSlots: { 'zao-1': { kind: 'ang', marks: 0 } } },
        regLink
      )
    ).toBe(false)
  })

  it('Schloss offen: unset bleibt sichtbar', () => {
    vi.mocked(getRoomSettings).mockReturnValue({ convertLockState: 'open' })
    expect(shouldHideEmptySecondActionRow({}, regLink, runningCtx)).toBe(false)
  })

  it('geschlossen + laufende KR: unset ausblenden', () => {
    vi.mocked(getRoomSettings).mockReturnValue({ convertLockState: 'closed' })
    expect(shouldHideEmptySecondActionRow({}, regLink, runningCtx)).toBe(true)
    expect(shouldHideEmptySecondActionRow({}, regLink, introCtx)).toBe(false)
  })

  it('auto + gesamte KR: unset sichtbar trotz hinter INI', () => {
    expect(
      shouldHideEmptySecondActionRow(
        { convertAllowEntireRound: true, initiative: 10 },
        regLink,
        runningCtx
      )
    ).toBe(false)
  })

  it('auto + erste Phase + Navigation hinter Held: unset ausblenden', () => {
    expect(
      shouldHideEmptySecondActionRow(
        { convertAllowFirstPhase: true, initiative: 10 },
        regLink,
        runningCtx
      )
    ).toBe(true)
  })

  it('auto + erste Phase: auf 2.AO-Zug sofort ausblenden (gleiche INI)', () => {
    const ctx = buildConvertListVisibilityCtx({
      combatStarted: true,
      roundIntroPending: false,
      rowActiveId: 'hero-A',
      rowActivePhaseLinkId: 'zao1',
      currentNavIni: 15,
      turnSteps: [
        { kind: 'token', id: 'hero-A', sub: 'action' },
        { kind: 'token', id: 'hero-A', sub: 'reaction' },
        { kind: 'phase', ownerId: 'hero-A', linkId: 'zao1', sub: 'action' },
        { kind: 'phase', ownerId: 'hero-A', linkId: 'zao1', sub: 'reaction' },
      ],
      combatStepIndex: 2,
    })
    expect(
      shouldHideEmptySecondActionRow(
        { convertAllowFirstPhase: true, initiative: 15 },
        regLink,
        ctx,
        'hero-A'
      )
    ).toBe(true)
  })

  it('aktives Navigationsziel nie ausblenden (auto)', () => {
    const ctx = buildConvertListVisibilityCtx({
      combatStarted: true,
      roundIntroPending: false,
      rowActiveId: 'hero-1',
      rowActivePhaseLinkId: 'zao-1',
      currentNavIni: 8,
    })
    expect(
      shouldHideEmptySecondActionRow(
        { convertAllowFirstPhase: true, initiative: 10 },
        regLink,
        ctx,
        'hero-1'
      )
    ).toBe(false)
  })

  it('aktives Navigationsziel nie ausblenden (geschlossen)', () => {
    vi.mocked(getRoomSettings).mockReturnValue({ convertLockState: 'closed' })
    const ctx = buildConvertListVisibilityCtx({
      combatStarted: true,
      roundIntroPending: false,
      rowActiveId: 'hero-1',
      rowActivePhaseLinkId: 'zao-1',
      currentNavIni: 8,
    })
    expect(
      shouldHideEmptySecondActionRow({}, regLink, ctx, 'hero-1')
    ).toBe(false)
    // Anderes leeres 2.AO (nicht aktives Ziel) bleibt geschlossen ausgeblendet.
    expect(
      shouldHideEmptySecondActionRow(
        {},
        { id: 'zao-2', parentId: null },
        ctx,
        'hero-1'
      )
    ).toBe(true)
  })

  it('auto + erste Phase: auf Mutter-Zug unset sichtbar', () => {
    const ctx = buildConvertListVisibilityCtx({
      combatStarted: true,
      roundIntroPending: false,
      rowActiveId: 'hero-A',
      rowActivePhaseLinkId: null,
      currentNavIni: 15,
      turnSteps: [
        { kind: 'token', id: 'hero-A', sub: 'action' },
        { kind: 'token', id: 'hero-A', sub: 'reaction' },
        { kind: 'phase', ownerId: 'hero-A', linkId: 'zao1', sub: 'action' },
      ],
      combatStepIndex: 0,
    })
    expect(
      shouldHideEmptySecondActionRow(
        { convertAllowFirstPhase: true, initiative: 15 },
        regLink,
        ctx,
        'hero-A'
      )
    ).toBe(false)
  })
})
