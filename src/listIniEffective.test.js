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
  it('gibt den gespeicherten Rohwert unverändert zurück', () => {
    const meta = {
      initiative: '12',
      heroExIb: '12',
      heroExBe: '0',
      heroExW6: '0',
      [HERO_EX_MODS]: [ibMod(-2)],
    }
    expect(
      effectiveListInitiativeString(meta, '12', null, Number.POSITIVE_INFINITY)
    ).toBe('12')
  })
})

describe('collectSortedParticipants ohne Live-IB-Resolver', () => {
  afterEach(() => {
    registerEffectiveListIniResolver(null)
  })

  it('sortiert nach gespeicherter INI; IB-Mods ändern die Position nicht', () => {
    registerEffectiveListIniResolver(null)
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
            initiative: '11',
            heroExIb: '11',
            heroExBe: '0',
            heroExW6: '0',
          },
        },
      },
    ]
    const rows = collectSortedParticipants(items, [], [])
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(rows[0].initiative).toBe('12')
    expect(rows[1].initiative).toBe('11')
  })
})
