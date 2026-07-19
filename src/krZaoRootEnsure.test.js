import { describe, expect, it } from 'vitest'
import {
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  KR_ZAO_SLOTS,
} from './krMetaKeys.js'
import {
  HERO_SECOND_AO_PHASE_OFFSET,
  LH_MAX,
  LH_REM,
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

  it('laufende L.H. → unverändert', () => {
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
})
