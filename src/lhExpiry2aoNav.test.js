import { describe, expect, it, vi } from 'vitest'

vi.mock('./editAccess.js', () => ({
  isGmSync: vi.fn(() => true),
  canEditSceneItem: vi.fn(() => true),
}))

vi.mock('./roomSettings.js', () => ({
  getRoomSettings: vi.fn(() => ({ convertLockState: 'open' })),
  faMaxForInitiative: vi.fn(() => 0),
}))

import { TRACKER_ITEM_META_KEY } from './participants.js'
import { buildCombatTurnSteps, hookIniForLink, normalizePhases } from './phaseLinks.js'
import { restoreRegularSecondActionRootAfterLh } from './krCounters.js'
import {
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
} from './krMetaKeys.js'

function item(id, meta = {}) {
  return { id, name: id, metadata: { [TRACKER_ITEM_META_KEY]: meta } }
}

function regularPhaseSteps(steps, ownerId) {
  return steps.filter((s) => s.kind === 'phase' && s.ownerId === ownerId)
}

// Reproduktion: L.H. lief auf der Mutter (INI 12) und endet am Mutterobjekt
// (kein lhEnd-Objekt). Die regulaere 2.AO-Wurzel (offset 8 -> INI 4) wurde
// waehrend der L.H. ueber `clearEphemeralExtraIniRows` entfernt und NICHT neu
// aufgebaut. Beim Vorbei-Navigieren wird die L.H. zurueckgesetzt — danach soll
// das normale 2.AO des Helden wieder navigierbar sein.
describe('L.H. abgelaufen -> normales 2.AO wieder navigierbar', () => {
  const tokenRows = [{ id: 'hero-a', initiative: '12', name: 'A' }]

  it('vor Fix: 2.AO-Schritt fehlt im post-Reset-State', () => {
    const meta = { initiative: '12', phases: { links: [] }, krZaoSlots: {} }
    const steps = buildCombatTurnSteps(tokenRows, [item('hero-a', meta)], [], 2)
    expect(regularPhaseSteps(steps, 'hero-a')).toHaveLength(0)
  })

  it('restoreRegularSecondActionRootAfterLh legt die 2.AO-Wurzel an -> Schritt vorhanden', () => {
    const meta = { initiative: '12', phases: { links: [] }, krZaoSlots: {} }
    const created = restoreRegularSecondActionRootAfterLh(meta)
    expect(created).toBe(true)

    const links = normalizePhases(meta.phases).links
    const roots = links.filter((l) => l.parentId === null)
    expect(roots).toHaveLength(1)
    expect(hookIniForLink(roots[0].id, '12', links)).toBe(4)

    const steps = buildCombatTurnSteps(tokenRows, [item('hero-a', meta)], [], 2)
    const phaseSteps = regularPhaseSteps(steps, 'hero-a')
    expect(phaseSteps.some((s) => s.sub === 'action')).toBe(true)
  })

  it('no-op wenn bereits eine navigierbare regulaere 2.AO-Wurzel existiert', () => {
    const meta = {
      initiative: '12',
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'ang', marks: 1 } },
    }
    const created = restoreRegularSecondActionRootAfterLh(meta)
    expect(created).toBe(false)
    expect(normalizePhases(meta.phases).links.filter((l) => l.parentId === null)).toHaveLength(1)
  })

  it('lhEnd-Wurzel zaehlt nicht als regulaere 2.AO -> Wurzel wird zusaetzlich angelegt', () => {
    const meta = {
      initiative: '12',
      phases: {
        links: [{ id: 'lhend1', parentId: null, offset: 8, lhEnd: true }],
      },
      krZaoSlots: { lhend1: { kind: 'lh', marks: 1 } },
    }
    const created = restoreRegularSecondActionRootAfterLh(meta)
    expect(created).toBe(true)
    const roots = normalizePhases(meta.phases).links.filter(
      (l) => l.parentId === null
    )
    expect(roots).toHaveLength(2)
    expect(roots.some((l) => l.lhEnd === true)).toBe(true)
    expect(roots.some((l) => l.lhEnd !== true)).toBe(true)
  })

  it('Budget-Guard: ohne Angriffs-Anteil (ang=0) keine 2.AO-Wurzel', () => {
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 0,
      [HERO_ACTION_POOL_ABW]: 2,
      [HERO_ACTION_POOL_MAX]: 2,
      phases: { links: [] },
      krZaoSlots: {},
    }
    expect(restoreRegularSecondActionRootAfterLh(meta)).toBe(false)
  })

  it('INI-Guard: 2.AO-Ziel-INI negativ -> keine Wurzel', () => {
    const meta = { initiative: '5', phases: { links: [] }, krZaoSlots: {} }
    expect(restoreRegularSecondActionRootAfterLh(meta)).toBe(false)
  })
})
