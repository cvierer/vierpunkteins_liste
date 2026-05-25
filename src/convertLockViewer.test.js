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
})
