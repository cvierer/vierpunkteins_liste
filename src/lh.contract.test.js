/**
 * L.H.-Vertrags-Tests (Golden Paths).
 * Laufen mit: npm run test:lh-contract
 *
 * Diese Suite dokumentiert feste Integrations-Szenarien, die bei Änderungen
 * am Heldenblock oder an der Kampfliste nicht regressieren dürfen.
 */
import { describe, expect, it } from 'vitest'
import {
  lhDisplayStepFromNav,
  lhEndsInRound,
} from './lhMeta.js'
import { hookIniForLink, normalizePhases } from './phaseLinks.js'
import {
  dedupeZaoRootsAtHookIni,
  ensureLhEndRootAtHook,
} from './krCounters.js'
import { KR_ZAO_SLOTS } from './krMetaKeys.js'

describe('L.H. contract — Golden Path: Zähler 2/4 in derselben KR (INI 11, Offset 8)', () => {
  const mechanics = { actionsPerKr: 2, triggerIniStep: -8 }
  const heroIni = 11
  const commitRound = 1
  const currentRound = 1
  const commitIni = 11
  const lhMax = 4
  const priorSpend = 0

  it('Mutter INI 11 → Schritt 1/4', () => {
    expect(
      lhDisplayStepFromNav(
        heroIni,
        mechanics,
        commitRound,
        currentRound,
        11,
        lhMax,
        commitIni,
        priorSpend
      )
    ).toBe(1)
  })

  it('Offset-INI 3 → Schritt 2/4 (gleiche KR)', () => {
    expect(
      lhDisplayStepFromNav(
        heroIni,
        mechanics,
        commitRound,
        currentRound,
        3,
        lhMax,
        commitIni,
        priorSpend
      )
    ).toBe(2)
  })
})

describe('L.H. contract — Golden Path: Ende an 2.A., genau eine Wurzel', () => {
  it('ensureLhEndRootAtHook dedupliziert regulär + lhEnd an Hook INI 3', () => {
    const meta = {
      initiative: '11',
      phases: {
        links: [
          { id: 'zao1', parentId: null, offset: 8 },
          { id: 'lhend1', parentId: null, offset: 8, lhEnd: true },
        ],
      },
      [KR_ZAO_SLOTS]: {
        zao1: { kind: 'uo', marks: 0, lodgedAbw: true },
        lhend1: { kind: 'lh', marks: 1 },
      },
    }
    ensureLhEndRootAtHook(meta, 3, 8)
    const links = normalizePhases(meta.phases).links
    const roots = links.filter((l) => l.parentId === null && !l.heroExtra)
    const atHook3 = roots.filter(
      (l) => hookIniForLink(l.id, '11', links) === 3
    )
    expect(atHook3).toHaveLength(1)
    expect(roots).toHaveLength(1)
    expect(atHook3[0].lhEnd).toBe(true)
  })

  it('dedupeZaoRootsAtHookIni entfernt Duplikat nach L.H.-Abschluss', () => {
    const meta = {
      initiative: '11',
      phases: {
        links: [
          { id: 'zao1', parentId: null, offset: 8 },
          { id: 'zao2', parentId: null, offset: 8 },
        ],
      },
      [KR_ZAO_SLOTS]: {},
    }
    dedupeZaoRootsAtHookIni(meta, 3, { preferRegular: true })
    const links = normalizePhases(meta.phases).links
    const roots = links.filter((l) => l.parentId === null)
    expect(roots).toHaveLength(1)
    expect(hookIniForLink(roots[0].id, '11', links)).toBe(3)
  })
})

describe('L.H. contract — Golden Path: lhEndsInRound End-INI', () => {
  it('max 2, Mutter-Start: endet in Commit-KR an berechneter End-INI', () => {
    const { endsInThisRound, endIni } = lhEndsInRound(
      2,
      1,
      1,
      11,
      2,
      -8,
      11,
      0
    )
    expect(endsInThisRound).toBe(true)
    expect(endIni).toBe(3)
  })
})
