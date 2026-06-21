import { describe, expect, it } from 'vitest'
import { KR_ABW, KR_ANG, KR_SRA } from './krCounters.js'
import {
  hasPrimaryActionStampAtCombatStep,
  isPrimaryActionStampField,
  stampEntryMatchesCombatStep,
} from './krCounters.js'
import { ROUND_START_STEP_ID } from './combatStepIds.js'

describe('combat primary stamp gate', () => {
  const combat = {
    started: true,
    roundIntroPending: false,
    currentItemId: 'hero-a',
    currentPhaseLinkId: null,
    round: 1,
  }

  it('isPrimaryActionStampField erkennt Primärfelder', () => {
    expect(isPrimaryActionStampField(KR_ANG)).toBe(true)
    expect(isPrimaryActionStampField(KR_SRA)).toBe(true)
    expect(isPrimaryActionStampField(KR_ABW)).toBe(false)
  })

  it('Schild-Stempel am Anker blockiert Primär-Check nicht', () => {
    const entries = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: KR_ABW,
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: null,
      },
    ]
    expect(stampEntryMatchesCombatStep(entries[0], combat)).toBe(true)
    expect(hasPrimaryActionStampAtCombatStep(combat, entries)).toBe(false)
  })

  it('Ang-Stempel am Anker erkannt', () => {
    const entries = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: KR_ANG,
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: null,
      },
    ]
    expect(hasPrimaryActionStampAtCombatStep(combat, entries)).toBe(true)
  })

  it('ignoriert Stempel an round start', () => {
    const entries = [
      {
        id: 's1',
        itemId: 'hero-a',
        field: KR_ANG,
        anchorRowId: 'hero-a',
        anchorPhaseLinkId: null,
      },
    ]
    expect(
      stampEntryMatchesCombatStep(entries[0], {
        ...combat,
        currentItemId: ROUND_START_STEP_ID,
      })
    ).toBe(false)
  })
})
