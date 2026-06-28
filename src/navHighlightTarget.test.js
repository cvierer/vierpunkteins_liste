import { describe, expect, it } from 'vitest'
import { ROUND_END_STEP_ID, ROUND_START_STEP_ID } from './combatStepIds.js'
import { resolveNavHighlightSelector } from './navHighlightTarget.js'

describe('resolveNavHighlightSelector', () => {
  it('null wenn Kampf nicht gestartet', () => {
    expect(resolveNavHighlightSelector(null)).toBeNull()
    expect(resolveNavHighlightSelector({ started: false })).toBeNull()
  })

  it('roundStart wenn aktiver Schritt der KR-Beginn ist (ohne phaseId)', () => {
    expect(
      resolveNavHighlightSelector({
        started: true,
        currentItemId: ROUND_START_STEP_ID,
        currentPhaseLinkId: null,
      })
    ).toEqual({ kind: 'roundStart' })
  })

  it('roundEnd wenn aktiver Schritt das KR-Ende ist (ohne phaseId)', () => {
    expect(
      resolveNavHighlightSelector({
        started: true,
        currentItemId: ROUND_END_STEP_ID,
        currentPhaseLinkId: null,
      })
    ).toEqual({ kind: 'roundEnd' })
  })

  it('phase wenn owner + phaseLinkId gesetzt sind (2.AO)', () => {
    expect(
      resolveNavHighlightSelector({
        started: true,
        currentItemId: 'hero-a',
        currentPhaseLinkId: 'zao-1',
      })
    ).toEqual({ kind: 'phase', activeId: 'hero-a', phaseId: 'zao-1' })
  })

  it('token wenn nur owner gesetzt ist (Mutterzug)', () => {
    expect(
      resolveNavHighlightSelector({
        started: true,
        currentItemId: 'hero-a',
        currentPhaseLinkId: null,
      })
    ).toEqual({ kind: 'token', activeId: 'hero-a' })
  })

  it('null wenn gestartet aber kein aktiver Token', () => {
    expect(
      resolveNavHighlightSelector({
        started: true,
        currentItemId: null,
        currentPhaseLinkId: null,
      })
    ).toBeNull()
  })
})
