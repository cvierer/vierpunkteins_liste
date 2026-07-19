import { describe, expect, it } from 'vitest'
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
} from './lhMeta.js'
import { hookIniForLink, normalizePhases } from './phaseLinks.js'
import { ensureZaoRootsForIni } from './krZaoRootEnsure.js'

function baseMeta(overrides = {}) {
  return {
    initiative: '11',
    [HERO_SECOND_AO_PHASE_OFFSET]: 8,
    [HERO_ACTION_POOL_ANG]: 2,
    [HERO_ACTION_POOL_ABW]: 0,
    [HERO_ACTION_POOL_MAX]: 2,
    phases: { links: [] },
    [KR_ZAO_SLOTS]: {},
    ...overrides,
  }
}

describe('ensureZaoRootsForIni', () => {
  it('INI 11, Offset 8, Pool ang 2 → genau eine Wurzel Hook 3, Slot uo ohne lodgedAbw', () => {
    const m = baseMeta()
    expect(ensureZaoRootsForIni(m)).toBe(true)
    const links = normalizePhases(m.phases).links
    const roots = links.filter(
      (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
    )
    expect(roots).toHaveLength(1)
    expect(hookIniForLink(roots[0].id, '11', links)).toBe(3)
    const slot = m[KR_ZAO_SLOTS][roots[0].id]
    expect(slot).toEqual({ kind: 'uo', marks: 0 })
    expect(slot.lodgedAbw).toBeUndefined()
  })

  it('INI 7 → keine Wurzel (Ziel negativ)', () => {
    const m = baseMeta({ initiative: '7' })
    expect(ensureZaoRootsForIni(m)).toBe(false)
    const roots = normalizePhases(m.phases).links.filter(
      (l) => l.parentId === null && !l.heroExtra
    )
    expect(roots).toHaveLength(0)
  })

  it('Wurzel existiert schon → kein Duplikat', () => {
    const existingId = 'zao-existing'
    const m = baseMeta({
      phases: {
        links: [{ id: existingId, parentId: null, offset: 8 }],
      },
      [KR_ZAO_SLOTS]: {
        [existingId]: { kind: 'uo', marks: 0, lodgedAbw: true },
      },
    })
    expect(ensureZaoRootsForIni(m)).toBe(false)
    const roots = normalizePhases(m.phases).links.filter(
      (l) => l.parentId === null && !l.heroExtra
    )
    expect(roots).toHaveLength(1)
    expect(roots[0].id).toBe(existingId)
  })

  it('laufende L.H. (ohne Round) → unverändert', () => {
    const m = baseMeta({
      [LH_MAX]: 2,
      [LH_REM]: 1,
    })
    const before = structuredClone(m)
    expect(ensureZaoRootsForIni(m)).toBe(false)
    expect(m.phases).toEqual(before.phases)
    expect(m[KR_ZAO_SLOTS]).toEqual(before[KR_ZAO_SLOTS])
  })

  it('Ang-Budget 0 → unverändert', () => {
    const m = baseMeta({
      [HERO_ACTION_POOL_ANG]: 0,
      [HERO_ACTION_POOL_ABW]: 2,
      [HERO_ACTION_POOL_MAX]: 2,
    })
    expect(ensureZaoRootsForIni(m)).toBe(false)
    const roots = normalizePhases(m.phases).links.filter(
      (l) => l.parentId === null && !l.heroExtra
    )
    expect(roots).toHaveLength(0)
  })

  it('L.H. Mutter-Ende in aktueller KR → Wurzel wird angelegt', () => {
    // max 3, ap 2, step -8, commitIni 11 → Mutter-Ende in KR 2
    const m = baseMeta({
      [LH_MAX]: 3,
      [LH_REM]: 1,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 11,
    })
    expect(ensureZaoRootsForIni(m, 2)).toBe(true)
    const links = normalizePhases(m.phases).links
    const roots = links.filter(
      (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
    )
    expect(roots).toHaveLength(1)
    expect(hookIniForLink(roots[0].id, '11', links)).toBe(3)
    expect(m[KR_ZAO_SLOTS][roots[0].id]).toEqual({ kind: 'uo', marks: 0 })
  })

  it('L.H. sperrend (nicht End-KR) → no-op', () => {
    const m = baseMeta({
      [LH_MAX]: 3,
      [LH_REM]: 2,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 11,
    })
    const before = structuredClone(m)
    expect(ensureZaoRootsForIni(m, 1)).toBe(false)
    expect(m.phases).toEqual(before.phases)
    expect(m[KR_ZAO_SLOTS]).toEqual(before[KR_ZAO_SLOTS])
  })

  it('L.H. Ende an 2.A. (nicht Mutter) → no-op', () => {
    // max 2, ap 2, step -8, commitIni 11 → Ende in KR 1 an INI 3 (2.A.)
    const m = baseMeta({
      [LH_MAX]: 2,
      [LH_REM]: 1,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 11,
    })
    const before = structuredClone(m)
    expect(ensureZaoRootsForIni(m, 1)).toBe(false)
    expect(m.phases).toEqual(before.phases)
    expect(m[KR_ZAO_SLOTS]).toEqual(before[KR_ZAO_SLOTS])
  })
})
