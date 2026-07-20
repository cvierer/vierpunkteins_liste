import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {},
  isImage: () => false,
  isLabel: () => false,
}))

import { HERO_EX_MODS } from './heroExMods.js'
import { effectiveListInitiativeString } from './listIniEffective.js'
import {
  collectSortedParticipants,
  registerEffectiveListIniResolver,
  TRACKER_ITEM_META_KEY,
} from './participants.js'

const META = TRACKER_ITEM_META_KEY

function ibMod(delta) {
  return {
    id: `ib-${delta}`,
    field: 'ib',
    delta,
    duration: 99,
    addedRound: 1,
    addedNavIni: Number.POSITIVE_INFINITY,
    permanent: true,
  }
}

describe('effectiveListInitiativeString', () => {
  it('Rohwert ohne IB-Mods unverändert', () => {
    const meta = {
      initiative: '12',
      heroExIb: '12',
      heroExBe: '0',
      heroExW6: '0',
    }
    expect(
      effectiveListInitiativeString(meta, '12', null, Number.POSITIVE_INFINITY)
    ).toBe('12')
  })

  it('addiert permanente IB-Mods wie das Listen-INI-Feld', () => {
    const meta = {
      initiative: '12',
      heroExIb: '12',
      heroExBe: '0',
      heroExW6: '0',
      [HERO_EX_MODS]: [ibMod(-2)],
    }
    expect(
      effectiveListInitiativeString(meta, '12', null, Number.POSITIVE_INFINITY)
    ).toBe('10')
  })
})

describe('collectSortedParticipants + initiativeForSort', () => {
  afterEach(() => {
    registerEffectiveListIniResolver(null)
  })

  it('sortiert nach effektiver INI (IB-Mod), nicht nur Rohwert', () => {
    registerEffectiveListIniResolver((meta, stored) =>
      effectiveListInitiativeString(meta, stored, null, Number.POSITIVE_INFINITY)
    )
    const items = [
      {
        id: 'a',
        name: 'Alpha',
        metadata: {
          [META]: {
            initiative: '12',
            heroExIb: '12',
            heroExBe: '0',
            heroExW6: '0',
            [HERO_EX_MODS]: [ibMod(-2)],
          },
        },
      },
      {
        id: 'b',
        name: 'Beta',
        metadata: {
          [META]: {
            initiative: '12',
            heroExIb: '12',
            heroExBe: '0',
            heroExW6: '0',
          },
        },
      },
    ]
    const rows = collectSortedParticipants(items, [])
    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
    expect(rows[0].initiative).toBe('12')
    expect(rows[0].initiativeForSort).toBe('12')
    expect(rows[1].initiative).toBe('12')
    expect(rows[1].initiativeForSort).toBe('10')
  })
})
