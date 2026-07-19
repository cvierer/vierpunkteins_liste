/**
 * End-KR: L.H. endet am Mutterobjekt → reguläres 2.AO muss sichtbar/navigierbar sein.
 * Sequenz wie live: clearEphemeral → resetAllKrCounters → applyLhKrStartObjects.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { itemMetaRef, getItems, updateItems } = vi.hoisted(() => {
  /** @type {{ current: Record<string, unknown> }} */
  const itemMetaRef = { current: {} }
  const metaKey = 'vierpunkteins_kampf.tracker/metadata'
  const makeItem = () => ({
    id: 'hero-a',
    name: 'A',
    metadata: { [metaKey]: itemMetaRef.current },
  })
  const getItems = vi.fn(async (predicate) => {
    const items = [makeItem()]
    return typeof predicate === 'function' ? items.filter(predicate) : items
  })
  const updateItems = vi.fn(async (_ids, fn) => {
    const drafts = [
      {
        id: 'hero-a',
        metadata: { [metaKey]: structuredClone(itemMetaRef.current) },
      },
    ]
    fn(drafts)
    itemMetaRef.current = /** @type {Record<string, unknown>} */ (
      drafts[0].metadata[metaKey]
    )
  })
  return { itemMetaRef, getItems, updateItems }
})

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: { items: { getItems, updateItems } },
    room: {
      getMetadata: vi.fn(async () => ({})),
      setMetadata: vi.fn(async () => {}),
    },
  },
}))

vi.mock('./editAccess.js', () => ({
  isGmSync: vi.fn(() => true),
  canEditSceneItem: vi.fn(() => true),
}))

vi.mock('./roomSettings.js', () => ({
  getRoomSettings: vi.fn(() => ({ convertLockState: 'open' })),
  faMaxForInitiative: vi.fn(() => 0),
}))

import { TRACKER_ITEM_META_KEY } from './participants.js'
import {
  buildCombatTurnSteps,
  clearEphemeralExtraIniRows,
  hookIniForLink,
  normalizePhases,
} from './phaseLinks.js'
import {
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  KR_ZAO_SLOTS,
} from './krMetaKeys.js'
import {
  HERO_SECOND_AO_PHASE_OFFSET,
  LH_ACTIONS_PER_KR,
  LH_COMMIT_INI,
  LH_COMMIT_ROUND,
  LH_MAX,
  LH_REM,
  LH_TRIGGER_INI_STEP,
  isHeroAtLhMotherEndInRound,
} from './lhMeta.js'
import { applyLhKrStartObjects } from './longHandlung.js'
import { resetAllKrCountersInScene } from './krCounters.js'

function item(id, meta = {}) {
  return { id, name: id, metadata: { [TRACKER_ITEM_META_KEY]: meta } }
}

function regularPhaseSteps(steps, ownerId) {
  return steps.filter((s) => s.kind === 'phase' && s.ownerId === ownerId)
}

function regularRoots(meta) {
  const links = normalizePhases(meta.phases).links
  return links.filter(
    (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
  )
}

describe('End-KR Mutter-Ende (INI 11, Offset 8): 2.AO nach KR-Einstieg', () => {
  const tokenRows = [{ id: 'hero-a', initiative: '11', name: 'A' }]

  beforeEach(() => {
    // ownerIni 11, ap 2, step -8, L.H. auf Mutter (commitIni 11), max 3:
    // endet in KR 2 am Mutterobjekt (endIni === 11). Ephemere 2.AO vorhanden.
    itemMetaRef.current = {
      initiative: '11',
      krFirstSlotKind: 'lh',
      [HERO_SECOND_AO_PHASE_OFFSET]: 8,
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      [LH_MAX]: 3,
      [LH_REM]: 1,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 11,
      phases: {
        links: [
          { id: 'zao-old', parentId: null, offset: 8, expiresNextRound: true },
        ],
      },
      [KR_ZAO_SLOTS]: {
        'zao-old': { kind: 'uo', marks: 0, lodgedAbw: true },
      },
    }
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('isHeroAtLhMotherEndInRound in KR 2 → true', () => {
    expect(isHeroAtLhMotherEndInRound(itemMetaRef.current, 2)).toBe(true)
  })

  it('clearEphemeral → reset → applyLhKrStart: eine Wurzel Hook 3 + Turn-Schritt', async () => {
    await clearEphemeralExtraIniRows()
    expect(regularRoots(itemMetaRef.current)).toHaveLength(0)

    await resetAllKrCountersInScene({ targetRound: 2, resetStamps: false })
    await applyLhKrStartObjects(2)

    const meta = itemMetaRef.current
    const links = normalizePhases(meta.phases).links
    const roots = regularRoots(meta)
    expect(roots).toHaveLength(1)
    expect(hookIniForLink(roots[0].id, '11', links)).toBe(3)
    expect(meta[KR_ZAO_SLOTS][roots[0].id]).toEqual({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })

    const steps = buildCombatTurnSteps(tokenRows, [item('hero-a', meta)], [], 2)
    expect(
      regularPhaseSteps(steps, 'hero-a').some((s) => s.sub === 'action')
    ).toBe(true)
  })
})

describe('End-KR Mutter-Ende: L.H. von 2.A. gestartet (commitIni 3)', () => {
  const tokenRows = [{ id: 'hero-a', initiative: '11', name: 'A' }]

  beforeEach(() => {
    // Start auf 2.A. (INI 3), max 2 → Ende am Mutterobjekt in KR 2 (endIni 11).
    itemMetaRef.current = {
      initiative: '11',
      krFirstSlotKind: 'lh',
      [HERO_SECOND_AO_PHASE_OFFSET]: 8,
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      [LH_MAX]: 2,
      [LH_REM]: 1,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 3,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: {},
    }
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('isHeroAtLhMotherEndInRound in KR 2 → true', () => {
    expect(isHeroAtLhMotherEndInRound(itemMetaRef.current, 2)).toBe(true)
  })

  it('nach KR-Einstieg: reguläre 2.AO-Wurzel Hook 3 vorhanden', async () => {
    await clearEphemeralExtraIniRows()
    await resetAllKrCountersInScene({ targetRound: 2, resetStamps: false })
    await applyLhKrStartObjects(2)

    const meta = itemMetaRef.current
    const links = normalizePhases(meta.phases).links
    const roots = regularRoots(meta)
    expect(roots).toHaveLength(1)
    expect(hookIniForLink(roots[0].id, '11', links)).toBe(3)
    expect(meta[KR_ZAO_SLOTS][roots[0].id]).toEqual({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })

    const steps = buildCombatTurnSteps(tokenRows, [item('hero-a', meta)], [], 2)
    expect(
      regularPhaseSteps(steps, 'hero-a').some((s) => s.sub === 'action')
    ).toBe(true)
  })
})
