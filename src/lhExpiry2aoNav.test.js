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
      { metadata: { [metaKey]: structuredClone(itemMetaRef.current) } },
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
    room: { getMetadata: vi.fn(async () => ({})) },
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
import { buildCombatTurnSteps, hookIniForLink, normalizePhases } from './phaseLinks.js'
import {
  cycleKrPrimarySlotKind,
  restoreRegularSecondActionRootAfterLh,
} from './krCounters.js'
import { isLhLockingActions } from './lhMeta.js'
import { isLhEndSlotConvertible } from './krPrimaryShellVisual.js'
import {
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  KR_ZAO_SLOTS,
} from './krMetaKeys.js'
import {
  LH_ACTIONS_PER_KR,
  LH_COMMIT_INI,
  LH_COMMIT_ROUND,
  LH_MAX,
  LH_REM,
  LH_TRIGGER_INI_STEP,
} from './lhMeta.js'
import { applyLhKrStartObjects } from './longHandlung.js'

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
// das normale 2.AO des Helden wieder navigierbar, umwandelbar UND stempelbar
// sein.
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

  it('restaurierte 2.AO ist ein stempelbares Schwert (ang/marks1), nicht uo', () => {
    const meta = { initiative: '12', phases: { links: [] }, krZaoSlots: {} }
    restoreRegularSecondActionRootAfterLh(meta)
    const rootId = normalizePhases(meta.phases).links.find(
      (l) => l.parentId === null
    )?.id
    expect(rootId).toBeTruthy()
    expect(meta[KR_ZAO_SLOTS][rootId]).toEqual({ kind: 'ang', marks: 1 })
  })

  it('Umwandel-Ring vom restaurierten Schwert erreicht den Stern (sra)', () => {
    // Anker 'ang' -> ein Pfeil-Schritt 'next' liefert 'sra' (Stern).
    expect(cycleKrPrimarySlotKind('ang', 'next')).toBe('sra')
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

  it('korrigiert eingelagerten uo/lodgedAbw-Slot der bestehenden 2.AO-Wurzel auf ang/marks1', () => {
    // L.H. endet am Mutterobjekt: rebuildKrActionPoolVisualsFromAngAbw hat die
    // regulaere 2.AO-Wurzel bereits mit einem eingelagerten uo-Slot angelegt.
    // Der bietet im Umwandel-Ring nur ang/lh und ist nicht stempelbar — die
    // Wurzel muss auf ein nutzbares Schwert korrigiert werden.
    const meta = {
      initiative: '12',
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'uo', marks: 0, lodgedAbw: true } },
    }
    const created = restoreRegularSecondActionRootAfterLh(meta)
    expect(created).toBe(true)
    expect(normalizePhases(meta.phases).links.filter((l) => l.parentId === null)).toHaveLength(1)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'ang', marks: 1 })
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

// Integrationstest: am End-KR-Start (L.H. endet am Mutterobjekt, endIni===ownerIni)
// stellt applyLhKrStartObjects die regulaere 2.AO-Wurzel wieder her, damit die
// Navigation sie nicht ueberspringt (Fix B: rechtzeitig, nicht erst im Reset).
describe('applyLhKrStartObjects: End-KR Mutter-Ende stellt 2.AO wieder her', () => {
  const tokenRows = [{ id: 'hero-a', initiative: '12', name: 'A' }]

  beforeEach(() => {
    // ownerIni 12, ap 2, step -8, L.H. auf der Mutter (commitIni 12), max 3:
    // endet in KR 2 am Mutterobjekt (endIni === 12). Regulaere 2.AO-Wurzel fehlt.
    itemMetaRef.current = {
      initiative: '12',
      krFirstSlotKind: 'lh',
      [LH_MAX]: 3,
      [LH_REM]: 1,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 12,
      phases: { links: [] },
      krZaoSlots: {},
    }
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('nach dem Hook existiert die 2.AO-Wurzel und buildCombatTurnSteps enthaelt sie', async () => {
    await applyLhKrStartObjects(2)

    const meta = itemMetaRef.current
    const links = normalizePhases(meta.phases).links
    const regularRoots = links.filter(
      (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
    )
    expect(regularRoots).toHaveLength(1)
    expect(hookIniForLink(regularRoots[0].id, '12', links)).toBe(4)
    expect(meta[KR_ZAO_SLOTS][regularRoots[0].id]).toEqual({
      kind: 'ang',
      marks: 1,
    })

    const steps = buildCombatTurnSteps(tokenRows, [item('hero-a', meta)], [], 2)
    expect(
      regularPhaseSteps(steps, 'hero-a').some((s) => s.sub === 'action')
    ).toBe(true)
  })
})

// In der End-KR (L.H. laeuft, sperrt aber keine Aktionen mehr) ist das
// n.A.-Objekt (lhEnd) wieder ein regulaeres 2.AO: die Umwandelpfeile duerfen
// nicht mehr gesperrt sein (switchLocked in der UI haengt an dieser Logik).
describe('lhEnd-2.AO in der End-KR ist umwandelbar (nicht switchLocked)', () => {
  // ownerIni 8, ap 2, step -8, L.H. (commitIni 8, max 3): endet in KR 2.
  const endKrMeta = {
    initiative: '8',
    [LH_MAX]: 3,
    [LH_REM]: 1,
    [LH_ACTIONS_PER_KR]: 2,
    [LH_TRIGGER_INI_STEP]: -8,
    [LH_COMMIT_ROUND]: 1,
    [LH_COMMIT_INI]: 8,
  }

  it('isLhLockingActions ist in der End-KR false -> lhEnd-Slot konvertierbar', () => {
    expect(isLhLockingActions(endKrMeta, 2)).toBe(false)
    expect(
      isLhEndSlotConvertible(true, isLhLockingActions(endKrMeta, 2))
    ).toBe(true)
  })

  it('vor der End-KR sperrt die L.H. -> lhEnd-Slot bleibt fest', () => {
    expect(isLhLockingActions(endKrMeta, 1)).toBe(true)
    expect(
      isLhEndSlotConvertible(true, isLhLockingActions(endKrMeta, 1))
    ).toBe(false)
  })
})
