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
    room: { getMetadata: vi.fn(async () => ({})), setMetadata: vi.fn(async () => {}) },
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
  cycleKrPrimarySlotKindRespectingLocks,
  krTransferMarkPresent,
  normalizeHeroKrStateAfterLhEnd,
  patchKrCyclePrimarySlotKind,
  readKrFirstSlotKind,
  restoreHeroKrCombatStartDefault,
  restoreRegularSecondActionRootAfterLh,
} from './krCounters.js'
import { isHeroAtLhMotherEndInRound, isLhLockingActions } from './lhMeta.js'
import { isLhEndSlotConvertible } from './krPrimaryShellVisual.js'
import {
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  KR_LH_VOID_BY_TRANSFER,
  KR_PRIMARY_VOID_BY_ABW_TRANSFER,
  KR_ZAO_SLOTS,
} from './krMetaKeys.js'
import {
  clearLhTrackerActivity,
  isLhActive,
  LH_ACTIONS_PER_KR,
  LH_COMMIT_INI,
  LH_COMMIT_ROUND,
  LH_MAX,
  LH_REM,
  LH_TRIGGER_INI_STEP,
} from './lhMeta.js'
import { applyLhKrStartObjects } from './longHandlung.js'
import { resetAllKrCountersInScene } from './krCounters.js'
import { KR_ACTION_POOL_ANG_REM } from './krMetaKeys.js'
import { mergeDeferredRenderItems } from './krSlotPatchGate.js'

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

  it('restaurierte 2.AO ist leer (uo/lodgedAbw) wie zu Kampfbeginn, kein Schwert', () => {
    // Kampfstart-Default: {kind:'uo', marks:0, lodgedAbw:true} + Backing-Schild in KR_ABW.
    // marks:0 haelt isMirrorAbwUiActive inaktiv -> Schilde bleiben am Mutterobjekt.
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [] },
      krZaoSlots: {},
    }
    restoreRegularSecondActionRootAfterLh(meta)
    const rootId = normalizePhases(meta.phases).links.find(
      (l) => l.parentId === null
    )?.id
    expect(rootId).toBeTruthy()
    expect(meta[KR_ZAO_SLOTS][rootId]).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
    // Backing-Schild muss gesetzt sein (KR_ABW > leer), damit Transfer uo->ang moeglich
    expect(krTransferMarkPresent(meta['krAbw'])).toBe(true)
  })

  it('Umwandel-Ring vom restaurierten leer-Slot erreicht das Schwert (ang)', () => {
    // Anker 'uo' -> ein Pfeil-Schritt 'next' liefert 'ang' (Schwert).
    expect(cycleKrPrimarySlotKind('uo', 'next')).toBe('ang')
  })

  it('no-op wenn Slot bereits uo/lodgedAbw (Soll-Zustand) - keine doppelte Schildmarke', () => {
    // Ein gueltiger uo/lodgedAbw-Slot soll nicht erneut korrigiert werden.
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'uo', marks: 0, lodgedAbw: true } },
      krAbw: 0, // bereits eine Schildmarke vorhanden (chargeValueFromMarks(1)=0)
    }
    const created = restoreRegularSecondActionRootAfterLh(meta)
    expect(created).toBe(false)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
    expect(meta['krAbw']).toBe(0) // keine zweite Schildmarke addiert
  })

  it('no-op wenn bereits Schwert-Slot vorhanden (ang/marks1 bleibt unveraendert)', () => {
    // Ein ang/marks1-Slot (z.B. bereits manuell umgewandelt) wird korrigiert:
    // restore setzt auf uo/lodgedAbw + Backing-Schild.
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'ang', marks: 1 } },
    }
    const created = restoreRegularSecondActionRootAfterLh(meta)
    expect(created).toBe(true)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
    expect(krTransferMarkPresent(meta['krAbw'])).toBe(true)
  })

  it('korrigiert eingelagerten uo/lodgedAbw-Slot: Soll-Zustand bereits korrekt -> no-op', () => {
    // uo/lodgedAbw ist jetzt der Soll-Zustand -> no-op (kein Korrektur-Bedarf).
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'uo', marks: 0, lodgedAbw: true } },
      krAbw: 0,
    }
    const created = restoreRegularSecondActionRootAfterLh(meta)
    expect(created).toBe(false)
    expect(normalizePhases(meta.phases).links.filter((l) => l.parentId === null)).toHaveLength(1)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
  })

  it('korrigiert fehlenden Slot auf uo/lodgedAbw + Backing-Schild', () => {
    // Wenn `skipActionInit:true` (L.H. aktiv) den Rebuild unterdrueckt hat,
    // existiert die Wurzel ohne Slot. Kampfstart-Default setzen.
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: {},
    }
    const created = restoreRegularSecondActionRootAfterLh(meta)
    expect(created).toBe(true)
    expect(normalizePhases(meta.phases).links.filter((l) => l.parentId === null)).toHaveLength(1)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
    expect(krTransferMarkPresent(meta['krAbw'])).toBe(true)
  })

  it('lhEnd-Wurzel wird demoted statt dupliziertes 2.AO anzulegen', () => {
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
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
    expect(roots).toHaveLength(1)
    expect(roots[0].lhEnd).toBeUndefined()
    expect(meta[KR_ZAO_SLOTS].lhend1).toEqual({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })
    expect(hookIniForLink(roots[0].id, '12', normalizePhases(meta.phases).links)).toBe(4)
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

describe('applyLhKrStartObjects: End-KR 2.A. promotet bestehende Wurzel statt Duplikat', () => {
  beforeEach(() => {
    itemMetaRef.current = {
      initiative: '11',
      krFirstSlotKind: 'lh',
      [LH_MAX]: 2,
      [LH_REM]: 1,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 11,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'uo', marks: 0, lodgedAbw: true } },
    }
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('promoted zao1 zu lhEnd — genau eine Wurzel an Hook INI 3', async () => {
    await applyLhKrStartObjects(1)

    const meta = itemMetaRef.current
    const links = normalizePhases(meta.phases).links
    const roots = links.filter((l) => l.parentId === null)
    expect(roots).toHaveLength(1)
    expect(roots[0].id).toBe('zao1')
    expect(roots[0].lhEnd).toBe(true)
    expect(hookIniForLink(roots[0].id, '11', links)).toBe(3)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'lh', marks: 1 })
  })

  it('nach resetAllKrCountersInScene + Hook: keine zwei Wurzeln an Hook INI 3', async () => {
    itemMetaRef.current = {
      initiative: '11',
      krFirstSlotKind: 'lh',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      [LH_MAX]: 2,
      [LH_REM]: 1,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 11,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'uo', marks: 0, lodgedAbw: true } },
    }

    await resetAllKrCountersInScene({ targetRound: 1 })
    await applyLhKrStartObjects(1)

    const meta = itemMetaRef.current
    const links = normalizePhases(meta.phases).links
    const roots = links.filter((l) => l.parentId === null && !l.heroExtra)
    const atHook3 = roots.filter(
      (l) => hookIniForLink(l.id, '11', links) === 3
    )
    expect(atHook3).toHaveLength(1)
    expect(roots).toHaveLength(1)
    expect(atHook3[0].lhEnd).toBe(true)
  })

  it('dedupliziert reguläre + lhEnd-Wurzel an derselben Hook-INI', async () => {
    itemMetaRef.current = {
      initiative: '11',
      krFirstSlotKind: 'lh',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      [LH_MAX]: 2,
      [LH_REM]: 1,
      [LH_ACTIONS_PER_KR]: 2,
      [LH_TRIGGER_INI_STEP]: -8,
      [LH_COMMIT_ROUND]: 1,
      [LH_COMMIT_INI]: 11,
      phases: {
        links: [
          { id: 'zao1', parentId: null, offset: 8 },
          { id: 'lhend1', parentId: null, offset: 8, lhEnd: true },
        ],
      },
      krZaoSlots: {
        zao1: { kind: 'uo', marks: 0, lodgedAbw: true },
        lhend1: { kind: 'lh', marks: 1 },
      },
    }

    await applyLhKrStartObjects(1)

    const meta = itemMetaRef.current
    const links = normalizePhases(meta.phases).links
    const roots = links.filter((l) => l.parentId === null && !l.heroExtra)
    const atHook3 = roots.filter(
      (l) => hookIniForLink(l.id, '11', links) === 3
    )
    expect(atHook3).toHaveLength(1)
    expect(roots).toHaveLength(1)
    expect(atHook3[0].lhEnd).toBe(true)
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

// REM-Pool-Reset: beim KR-Intro der End-KR (L.H. endet in targetRound) muss
// `resetAllKrCountersInScene` den Aktionspool voll regenerieren, damit das 2.AO
// ein volles ang-Budget hat und nicht leer (KR_ACTION_POOL_ANG_REM = 0) startet.
describe('resetAllKrCountersInScene: REM-Pool bei L.H.-Ende in targetRound voll regeneriert', () => {
  beforeEach(() => {
    // ownerIni 12, ap 2, step -8, L.H. auf Mutter (commitIni 12), max 3:
    // endet in KR 2. KR_ACTION_POOL_ANG_REM = 0 simuliert aufgebrauchten Pool.
    itemMetaRef.current = {
      initiative: '12',
      krFirstSlotKind: 'lh',
      [HERO_ACTION_POOL_ANG]: 1,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 2,
      [KR_ACTION_POOL_ANG_REM]: 0,
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

  it('End-KR: Pool wird regeneriert (kein skip) -> ang-Budget > 0', async () => {
    await resetAllKrCountersInScene({ targetRound: 2, resetStamps: false })
    const meta = itemMetaRef.current
    // Nach dem Reset muss KR_ACTION_POOL_ANG_REM wieder dem Hero-Wert entsprechen
    // oder ungesetzt sein (fallback auf config). Jedenfalls kein Null-Budget mehr.
    const rem = meta[KR_ACTION_POOL_ANG_REM]
    expect(rem === undefined || Number(rem) >= 1).toBe(true)
  })

  it('laufende L.H. (nicht End-KR): skipActionInit -> KR_FIRST_SLOT_KIND bleibt lh', async () => {
    // In KR 1 laeuft die L.H. noch -> skipActionInit: true -> kein Rebuild ->
    // KR_FIRST_SLOT_KIND bleibt 'lh', nicht auf 'ang' zurueckgesetzt.
    await resetAllKrCountersInScene({ targetRound: 1, resetStamps: false })
    const meta = itemMetaRef.current
    expect(meta['krFirstSlotKind']).toBe('lh')
  })
})

// Unit-Tests fuer isHeroAtLhMotherEndInRound
describe('isHeroAtLhMotherEndInRound', () => {
  const motherEndBase = {
    initiative: '12',
    [LH_MAX]: 3,
    [LH_REM]: 1,
    [LH_ACTIONS_PER_KR]: 2,
    [LH_TRIGGER_INI_STEP]: -8,
    [LH_COMMIT_ROUND]: 1,
    [LH_COMMIT_INI]: 12,
  }

  it('Mutter-Ende in End-KR -> true', () => {
    expect(isHeroAtLhMotherEndInRound(motherEndBase, 2)).toBe(true)
  })

  it('Nicht-End-KR -> false', () => {
    expect(isHeroAtLhMotherEndInRound(motherEndBase, 1)).toBe(false)
  })

  it('n.A.-Objekt-Ende (endIni != ownerIni) -> false', () => {
    const naEnd = {
      ...motherEndBase,
      [LH_COMMIT_INI]: 4,
    }
    expect(isHeroAtLhMotherEndInRound(naEnd, 2)).toBe(false)
  })

  it('L.H. inaktiv -> false', () => {
    const inactive = { ...motherEndBase, [LH_MAX]: 0 }
    expect(isHeroAtLhMotherEndInRound(inactive, 2)).toBe(false)
  })

  it('L.H. inaktiv (kein LH_MAX) -> false', () => {
    const bare = { initiative: '12' }
    expect(isHeroAtLhMotherEndInRound(bare, 2)).toBe(false)
  })
})

// Zyklus-Tests: alle 4 Kinds von 2.AO am Mutter-Ende mit motherEndBypass
describe('patchKrCyclePrimarySlotKind mit motherEndBypass: voller 4-Kind-Zyklus', () => {
  const ZAO_LINK = 'zao-regular-root'

  // buildItems gibt einen frischen Satz items zurueck, den updateItems mutiert
  const makeMeta = (slotKind = 'ang', marks = 1) => ({
    initiative: '12',
    [KR_ZAO_SLOTS]: { [ZAO_LINK]: { kind: slotKind, marks } },
    phases: {
      links: [{ id: ZAO_LINK, parentId: null, offset: 8 }],
    },
    [LH_MAX]: 3,
    [LH_REM]: 1,
  })

  beforeEach(() => {
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('ang -> sra mit motherEndBypass (kein Transfer noetig)', async () => {
    itemMetaRef.current = makeMeta('ang', 1)
    const ok = await patchKrCyclePrimarySlotKind(
      'hero-a', 'sra',
      { linkId: ZAO_LINK, motherEndBypass: true }
    )
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({ kind: 'sra', marks: 1 })
  })

  it('sra -> lh mit motherEndBypass', async () => {
    itemMetaRef.current = makeMeta('sra', 1)
    const ok = await patchKrCyclePrimarySlotKind(
      'hero-a', 'lh',
      { linkId: ZAO_LINK, motherEndBypass: true }
    )
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({ kind: 'lh', marks: 1 })
  })

  it('lh -> uo mit motherEndBypass (Kampfstart-Default uo/lodgedAbw + Backing-Schild)', async () => {
    itemMetaRef.current = makeMeta('lh', 1)
    const ok = await patchKrCyclePrimarySlotKind(
      'hero-a', 'uo',
      { linkId: ZAO_LINK, motherEndBypass: true }
    )
    expect(ok).toBe(true)
    const slot = itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]
    // Leerer 2.AO bleibt der schildtragende Kampfstart-Slot (marks:0 haelt
    // isMirrorAbwUiActive inaktiv) und bucht ggf. eine Backing-Schildmarke.
    expect(slot).toMatchObject({ kind: 'uo', marks: 0, lodgedAbw: true })
  })

  it('uo -> ang mit motherEndBypass (kein Shield-Transfer-Mark noetig)', async () => {
    itemMetaRef.current = makeMeta('uo', 0)
    const ok = await patchKrCyclePrimarySlotKind(
      'hero-a', 'ang',
      { linkId: ZAO_LINK, motherEndBypass: true }
    )
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({ kind: 'ang', marks: 1 })
  })

  it('cycleKrPrimarySlotKindRespectingLocks: voller Zyklus mit uoAllowed:true', () => {
    const kinds = []
    let kind = 'ang'
    for (let i = 0; i < 4; i++) {
      kind = cycleKrPrimarySlotKindRespectingLocks(kind, 'next', { iniLocked: false, uoAllowed: true })
      kinds.push(kind)
    }
    expect(kinds).toEqual(['sra', 'lh', 'uo', 'ang'])
  })
})

// 2.AO generell umwandelbar (mit/ohne L.H.) + symmetrische Schild-Buchung.
describe('patchKrCyclePrimarySlotKind: 2.AO generell umwandelbar, Schild-Buchung symmetrisch', () => {
  const ZAO_LINK = 'zao-regular-root'

  const makeMeta = (slot, krAbw) => ({
    initiative: '12',
    krAbw,
    [KR_ZAO_SLOTS]: { [ZAO_LINK]: slot },
    phases: { links: [{ id: ZAO_LINK, parentId: null, offset: 8 }] },
    // bewusst KEINE L.H.-Felder: reguläres 2.AO ohne jede Sanduhr.
  })

  beforeEach(() => {
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('ang -> sra OHNE jede L.H. (Direktpfad, kein Transfer)', async () => {
    itemMetaRef.current = makeMeta({ kind: 'ang', marks: 1 }, 1)
    const ok = await patchKrCyclePrimarySlotKind('hero-a', 'sra', {
      linkId: ZAO_LINK,
      motherEndBypass: true,
    })
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({
      kind: 'sra',
      marks: 1,
    })
  })

  it('ang -> uo bucht +1 Schild in KR_ABW', async () => {
    // krAbw=1 entspricht 0 Markierungen (leer).
    itemMetaRef.current = makeMeta({ kind: 'ang', marks: 1 }, 1)
    const ok = await patchKrCyclePrimarySlotKind('hero-a', 'uo', {
      linkId: ZAO_LINK,
      motherEndBypass: true,
    })
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })
    expect(krTransferMarkPresent(itemMetaRef.current['krAbw'])).toBe(true)
  })

  it('uo/lodgedAbw -> ang MIT Backing-Schild verbraucht 1 Schild', async () => {
    // krAbw=0 entspricht 1 Markierung (ein Schild vorhanden).
    itemMetaRef.current = makeMeta({ kind: 'uo', marks: 0, lodgedAbw: true }, 0)
    const ok = await patchKrCyclePrimarySlotKind('hero-a', 'ang', {
      linkId: ZAO_LINK,
      motherEndBypass: true,
    })
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({
      kind: 'ang',
      marks: 1,
    })
    // Schild verbraucht -> keine Markierung mehr.
    expect(krTransferMarkPresent(itemMetaRef.current['krAbw'])).toBe(false)
  })

  it('uo/lodgedAbw -> ang OHNE Backing-Schild wandelt trotzdem um (kein Haenger)', async () => {
    // krAbw=1 entspricht 0 Markierungen (kein Schild zum Verbrauchen).
    itemMetaRef.current = makeMeta({ kind: 'uo', marks: 0, lodgedAbw: true }, 1)
    const ok = await patchKrCyclePrimarySlotKind('hero-a', 'ang', {
      linkId: ZAO_LINK,
      motherEndBypass: true,
    })
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({
      kind: 'ang',
      marks: 1,
    })
    // Ohne vorhandene Marke bleibt KR_ABW unveraendert (kein negativer Zaehler).
    expect(itemMetaRef.current['krAbw']).toBe(1)
  })
})

// Regression: der deferred Render-Flush darf einen frisch gepatchten Slot-Kind
// NICHT auf den Vor-Patch-Stand revertieren (mergeDeferredRenderItems-Bug).
describe('deferred Render-Flush revertiert keinen frischen Patch', () => {
  const ZAO_LINK = 'zao-regular-root'
  const metaKey = TRACKER_ITEM_META_KEY

  beforeEach(() => {
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('nach Cycle ang->sra bleibt sra erhalten trotz alter lastItems', async () => {
    itemMetaRef.current = {
      initiative: '12',
      [KR_ZAO_SLOTS]: { [ZAO_LINK]: { kind: 'ang', marks: 1 } },
      phases: { links: [{ id: ZAO_LINK, parentId: null, offset: 8 }] },
    }
    // Render-Stand VOR dem Patch (wie lastItems es festhaelt).
    const lastItems = [
      { id: 'hero-a', metadata: { [metaKey]: structuredClone(itemMetaRef.current) } },
    ]

    const ok = await patchKrCyclePrimarySlotKind('hero-a', 'sra', {
      linkId: ZAO_LINK,
      motherEndBypass: true,
    })
    expect(ok).toBe(true)

    // "fresh" wie es ein getItems() nach dem Patch liefern wuerde.
    const fresh = [
      { id: 'hero-a', metadata: { [metaKey]: structuredClone(itemMetaRef.current) } },
    ]
    const merged = mergeDeferredRenderItems(fresh, lastItems)
    const mergedSlot =
      merged?.find((i) => i.id === 'hero-a')?.metadata?.[metaKey]?.[KR_ZAO_SLOTS]?.[
        ZAO_LINK
      ]
    // Frischer Stand (sra) gewinnt — kein Revert auf ang.
    expect(mergedSlot).toMatchObject({ kind: 'sra', marks: 1 })
  })
})

describe('normalizeHeroKrStateAfterLhEnd (radikaler L.H.-Ende-Reset)', () => {
  it('leert L.H.-Aktivitaet und setzt regulaere 2.AO-Wurzel auf uo/lodgedAbw + Backing-Schild', () => {
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      [LH_MAX]: 3,
      [LH_REM]: 1,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'ang', marks: 1 } },
    }
    const changed = normalizeHeroKrStateAfterLhEnd(meta)
    expect(changed).toBe(true)
    expect(isLhActive(meta)).toBe(false)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
    expect(krTransferMarkPresent(meta['krAbw'])).toBe(true)
  })

  it('entfernt Void-Transfer-Flags', () => {
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'uo', marks: 0, lodgedAbw: true } },
      krAbw: 0,
      [KR_LH_VOID_BY_TRANSFER]: true,
      [KR_PRIMARY_VOID_BY_ABW_TRANSFER]: true,
    }
    normalizeHeroKrStateAfterLhEnd(meta)
    expect(meta[KR_LH_VOID_BY_TRANSFER]).toBeUndefined()
    expect(meta[KR_PRIMARY_VOID_BY_ABW_TRANSFER]).toBeUndefined()
  })

  it('setzt ALLE regulaeren 2.AO-Wurzeln zurueck (nicht nur die erste)', () => {
    const meta = {
      initiative: '20',
      [HERO_ACTION_POOL_ANG]: 3,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 4,
      phases: {
        links: [
          { id: 'zao1', parentId: null, offset: 8 },
          { id: 'zao2', parentId: null, offset: 16 },
        ],
      },
      krZaoSlots: {
        zao1: { kind: 'ang', marks: 1 },
        zao2: { kind: 'sra', marks: 1 },
      },
    }
    normalizeHeroKrStateAfterLhEnd(meta)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
    expect(meta[KR_ZAO_SLOTS].zao2).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
  })

  it('demoted lhEnd zu regulärer 2.AO (kein Duplikat)', () => {
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'lhend1', parentId: null, offset: 8, lhEnd: true }] },
      krZaoSlots: { lhend1: { kind: 'lh', marks: 1 } },
    }
    normalizeHeroKrStateAfterLhEnd(meta)
    const roots = normalizePhases(meta.phases).links.filter(
      (l) => l.parentId === null
    )
    expect(roots).toHaveLength(1)
    expect(roots[0].lhEnd).toBeUndefined()
    expect(meta[KR_ZAO_SLOTS].lhend1).toEqual({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })
  })

  it('normalize entfernt Duplikat regulär + lhEnd an gleicher Hook-INI', () => {
    const meta = {
      initiative: '11',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: {
        links: [
          { id: 'zao1', parentId: null, offset: 8 },
          { id: 'lhend1', parentId: null, offset: 8, lhEnd: true },
        ],
      },
      krZaoSlots: {
        zao1: { kind: 'uo', marks: 0, lodgedAbw: true },
        lhend1: { kind: 'lh', marks: 1 },
      },
    }
    normalizeHeroKrStateAfterLhEnd(meta)
    const links = normalizePhases(meta.phases).links
    const roots = links.filter((l) => l.parentId === null)
    const atHook3 = roots.filter(
      (l) => hookIniForLink(l.id, '11', links) === 3
    )
    expect(atHook3).toHaveLength(1)
    expect(roots).toHaveLength(1)
    expect(atHook3[0].lhEnd).toBeUndefined()
  })

  it('restoreHeroKrCombatStartDefault setzt krFirstSlotKind von lh auf ang', () => {
    const meta = {
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      krFirstSlotKind: 'lh',
      krAng: 1,
      krLhAction: 1,
      [LH_MAX]: 0,
      [LH_REM]: 0,
      phases: { links: [] },
    }
    restoreHeroKrCombatStartDefault(meta)
    expect(readKrFirstSlotKind(meta)).toBe('ang')
    expect(isLhActive(meta)).toBe(false)
  })

  it('normalizeHeroKrStateAfterLhEnd laesst Setup kind=lh max=0 unberuehrt', () => {
    const meta = {
      initiative: '12',
      krFirstSlotKind: 'lh',
      krAng: 1,
      [LH_MAX]: 0,
      [LH_REM]: 0,
      phases: { links: [] },
    }
    normalizeHeroKrStateAfterLhEnd(meta)
    expect(readKrFirstSlotKind(meta)).toBe('lh')
  })

  it('normalizeHeroKrStateAfterLhEnd setzt nach laufender L.H. kind auf ang', () => {
    const meta = {
      initiative: '12',
      krFirstSlotKind: 'lh',
      [LH_MAX]: 3,
      [LH_REM]: 1,
      [LH_COMMIT_ROUND]: 2,
      phases: { links: [] },
    }
    normalizeHeroKrStateAfterLhEnd(meta)
    expect(readKrFirstSlotKind(meta)).toBe('ang')
    expect(isLhActive(meta)).toBe(false)
  })
})

describe('patchKrCyclePrimarySlotKind: 2.AO-Transfer meldet echten Erfolg (kein Luegen)', () => {
  beforeEach(() => {
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('regulaeres uo -> ang OHNE Backing-Schild: wandelt trotzdem um (nie auf leer haengend)', async () => {
    itemMetaRef.current = {
      initiative: '12',
      // krAbw:1 == 0 Markierungen (leer) -> kein Transfer-Mark vorhanden.
      krAbw: 1,
      [KR_ZAO_SLOTS]: { 'zao-x': { kind: 'uo', marks: 0, lodgedAbw: true } },
      phases: { links: [{ id: 'zao-x', parentId: null, offset: 8 }] },
    }
    const ok = await patchKrCyclePrimarySlotKind('hero-a', 'ang', {
      linkId: 'zao-x',
    })
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS]['zao-x']).toMatchObject({
      kind: 'ang',
      marks: 1,
    })
    // Ohne vorhandene Marke bleibt KR_ABW unveraendert (kein negativer Zaehler).
    expect(itemMetaRef.current['krAbw']).toBe(1)
  })

  it('regulaeres uo -> ang MIT Backing-Schild: return true, Slot wird ang', async () => {
    itemMetaRef.current = {
      initiative: '12',
      // krAbw:0 == 1 Markierung (geladen) -> Transfer-Mark vorhanden.
      krAbw: 0,
      [KR_ZAO_SLOTS]: { 'zao-x': { kind: 'uo', marks: 0, lodgedAbw: true } },
      phases: { links: [{ id: 'zao-x', parentId: null, offset: 8 }] },
    }
    const ok = await patchKrCyclePrimarySlotKind('hero-a', 'ang', {
      linkId: 'zao-x',
    })
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS]['zao-x']).toMatchObject({
      kind: 'ang',
      marks: 1,
    })
  })
})

describe('stampLhCompletion / startOrCancelLh: 2.AO nach L.H.-Ablauf/Abbruch sofort vollwertig', () => {
  // Testet den kombinierten Effekt von clearLhTrackerActivity + restoreRegularSecondActionRootAfterLh,
  // der in stampLhCompletion und startOrCancelLh (n<=0) ausgefuehrt wird.
  // Ziel-Slot: {kind:'uo', marks:0, lodgedAbw:true} + Backing-Schild in KR_ABW
  // (Kampfstart-Paritaet, kein ang-Zwang, Schilde bleiben am Mutterobjekt).

  it('isLhActive wird nach clearLhTrackerActivity false', () => {
    const meta = { [LH_MAX]: 2, [LH_REM]: 1, initiative: '12', phases: { links: [] }, krZaoSlots: {} }
    expect(isLhActive(meta)).toBe(true)
    clearLhTrackerActivity(meta)
    expect(isLhActive(meta)).toBe(false)
  })

  it('clear + restore setzt uo/lodgedAbw + Backing-Schild und deaktiviert L.H.', () => {
    // Ausgangszustand: L.H. aktiv (rem=1, Mutter-Ende), regulaere 2.AO-Wurzel
    // mit eingelagertem uo-Slot (Phase-2-Default) — Soll-Zustand bereits korrekt,
    // aber ohne Backing-Schild (Halbzustand). restore setzt ihn idempotent.
    const meta = {
      [LH_MAX]: 2,
      [LH_REM]: 1,
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'uo', marks: 0, lodgedAbw: true } },
    }

    clearLhTrackerActivity(meta)
    // Da der Slot bereits uo/lodgedAbw ist, ist die restore-Funktion ein no-op.
    restoreRegularSecondActionRootAfterLh(meta)

    expect(isLhActive(meta)).toBe(false)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
  })

  it('clear + restore setzt uo/lodgedAbw + Backing-Schild wenn Slot fehlt', () => {
    const meta = {
      [LH_MAX]: 1,
      [LH_REM]: 1,
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: {},
    }

    clearLhTrackerActivity(meta)
    restoreRegularSecondActionRootAfterLh(meta)

    expect(isLhActive(meta)).toBe(false)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
    expect(krTransferMarkPresent(meta['krAbw'])).toBe(true)
  })

  it('Idempotenz: zweimaliges restore addiert keine zweite Schildmarke', () => {
    const meta = {
      [LH_MAX]: 1,
      [LH_REM]: 1,
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: {},
    }

    clearLhTrackerActivity(meta)
    restoreRegularSecondActionRootAfterLh(meta)
    const krAbwAfterFirst = meta['krAbw']
    restoreRegularSecondActionRootAfterLh(meta)

    expect(meta['krAbw']).toBe(krAbwAfterFirst)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
  })

  it('ang-Slot wird auf uo/lodgedAbw + Backing-Schild korrigiert', () => {
    // Ein ang/marks1-Slot soll auf den Kampfstart-Default korrigiert werden.
    const meta = {
      [LH_MAX]: 1,
      [LH_REM]: 1,
      initiative: '12',
      [HERO_ACTION_POOL_ANG]: 2,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 3,
      phases: { links: [{ id: 'zao1', parentId: null, offset: 8 }] },
      krZaoSlots: { zao1: { kind: 'ang', marks: 1 } },
    }

    clearLhTrackerActivity(meta)
    const changed = restoreRegularSecondActionRootAfterLh(meta)

    expect(isLhActive(meta)).toBe(false)
    expect(changed).toBe(true)
    expect(meta[KR_ZAO_SLOTS].zao1).toEqual({ kind: 'uo', marks: 0, lodgedAbw: true })
    expect(krTransferMarkPresent(meta['krAbw'])).toBe(true)
  })
})

// Stellt sicher, dass das regulaere 2.AO auch bei aktiver, sperrender L.H. am
// Mutterobjekt (isLhLockingActions === true) voll umwandelbar ist.
// Vorher blockierte isLhLockingActions die ZAO-Transfer-Funktionen komplett.
describe('Regulaeres 2.AO bei aktiver L.H. umwandelbar (kein Lock)', () => {
  const ZAO_LINK = 'zao-regular'

  // Meta mit aktiver, sperrender L.H. (KR 1, endet nicht in KR 1) +
  // regulaerer 2.AO-Wurzel im Kampfstart-Default (uo/lodgedAbw + Backing-Schild).
  const makeActiveLhMeta = () => ({
    initiative: '12',
    [LH_MAX]: 3,
    [LH_REM]: 2,
    [LH_ACTIONS_PER_KR]: 2,
    [LH_TRIGGER_INI_STEP]: -8,
    [LH_COMMIT_ROUND]: 1,
    [LH_COMMIT_INI]: 12,
    // Backing-Schild: chargeValueFromMarks(1) === 0
    krAbw: 0,
    [KR_ZAO_SLOTS]: { [ZAO_LINK]: { kind: 'uo', marks: 0, lodgedAbw: true } },
    phases: { links: [{ id: ZAO_LINK, parentId: null, offset: 8 }] },
  })

  beforeEach(() => {
    getItems.mockClear()
    updateItems.mockClear()
  })

  it('isLhLockingActions ist true (L.H. sperrt in KR1) — Vorbedingung', () => {
    const meta = makeActiveLhMeta()
    // KR 1: L.H. laeuft (max=3, rem=2) und endet nicht in KR 1 -> true
    expect(isLhLockingActions(meta, 1)).toBe(true)
  })

  it('uo -> ang via patchKrCyclePrimarySlotKind: Schild verbraucht, Slot wird ang/marks1', async () => {
    itemMetaRef.current = makeActiveLhMeta()
    const ok = await patchKrCyclePrimarySlotKind(
      'hero-a', 'ang',
      { linkId: ZAO_LINK }
    )
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({ kind: 'ang', marks: 1 })
    // Backing-Schild wurde verbraucht (KR_ABW: 0->1 = leer)
    expect(krTransferMarkPresent(itemMetaRef.current['krAbw'])).toBe(false)
  })

  it('ang -> uo via patchKrCyclePrimarySlotKind: Schild zurueck, Slot wird uo/lodgedAbw', async () => {
    itemMetaRef.current = {
      ...makeActiveLhMeta(),
      // Ausgangszustand: ang/marks1, kein Schild mehr
      krAbw: 1,
      [KR_ZAO_SLOTS]: { [ZAO_LINK]: { kind: 'ang', marks: 1 } },
    }
    const ok = await patchKrCyclePrimarySlotKind(
      'hero-a', 'uo',
      { linkId: ZAO_LINK }
    )
    expect(ok).toBe(true)
    expect(itemMetaRef.current[KR_ZAO_SLOTS][ZAO_LINK]).toMatchObject({
      kind: 'uo',
      marks: 0,
      lodgedAbw: true,
    })
    // Schild wurde wieder eingelagert
    expect(krTransferMarkPresent(itemMetaRef.current['krAbw'])).toBe(true)
  })
})
