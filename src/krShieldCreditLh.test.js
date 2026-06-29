import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fokus-Tests fuer V1298: Schild-Erhaltung bleibt auch mit L.H. in der Liste
// intakt. Drei Wurzelfehler werden abgedeckt:
//  - patchZaoSlot creditiert ein Schild beim ECHTEN Uebergang in den
//    eingelagerten (uo/lodgedAbw) Zustand — und niemals beim wiederholten
//    Schreiben desselben Slots (kein Zurueckgeben verbrauchter Reaktionen).
//  - patchEnsureZaoSlotForLink creditiert den neu angelegten Default-Slot.
//  - initKrActionPoolsFromHeroDefaults stellt mit skipActionInit (laufende
//    L.H.) KR_ABW auf den Schild-Deckel wieder her statt es bei 0 zu lassen.

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

import {
  initKrActionPoolsFromHeroDefaults,
  patchEnsureZaoSlotForLink,
  patchZaoSlot,
} from './krCounters.js'
import { chargeValueFromMarks, marksFromChargeValue } from './krDigit.js'
import {
  HERO_ACTION_POOL_ABW,
  HERO_ACTION_POOL_ANG,
  HERO_ACTION_POOL_MAX,
  KR_ABW,
  KR_ANG,
  KR_FIRST_SLOT_KIND,
  KR_ZAO_SLOTS,
} from './krMetaKeys.js'

function setMeta(meta) {
  itemMetaRef.current = meta
}

beforeEach(() => {
  itemMetaRef.current = {}
  vi.clearAllMocks()
})

describe('patchZaoSlot - Schild-Gegenbuchung beim Uebergang in lodged', () => {
  it('ang -> uo creditiert genau ein Schild', async () => {
    setMeta({
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'ang',
      [KR_ANG]: chargeValueFromMarks(1),
      [KR_ABW]: chargeValueFromMarks(0),
      [HERO_ACTION_POOL_ANG]: 3,
      [HERO_ACTION_POOL_ABW]: 2,
      [HERO_ACTION_POOL_MAX]: 5,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: { 'zao-1': { kind: 'ang', marks: 1 } },
    })
    await patchZaoSlot('hero-a', 'zao-1', { kind: 'uo' })
    expect(itemMetaRef.current[KR_ZAO_SLOTS]['zao-1'].kind).toBe('uo')
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(1)
  })

  it('wiederholtes Schreiben von uo creditiert NICHT erneut (kein Stempel-Rueckgabe)', async () => {
    setMeta({
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'ang',
      [KR_ANG]: chargeValueFromMarks(1),
      [KR_ABW]: chargeValueFromMarks(0),
      [HERO_ACTION_POOL_ANG]: 3,
      [HERO_ACTION_POOL_ABW]: 2,
      [HERO_ACTION_POOL_MAX]: 5,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: { 'zao-1': { kind: 'ang', marks: 1 } },
    })
    await patchZaoSlot('hero-a', 'zao-1', { kind: 'uo' })
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(1)
    // Re-Patch desselben (bereits eingelagerten) Slots: kein zweites Schild.
    await patchZaoSlot('hero-a', 'zao-1', { kind: 'uo' })
    await patchZaoSlot('hero-a', 'zao-1', { kind: 'uo' })
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(1)
  })

  it('uo -> ang bucht das Schild wieder ab (symmetrisch)', async () => {
    setMeta({
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'ang',
      [KR_ANG]: chargeValueFromMarks(1),
      [KR_ABW]: chargeValueFromMarks(1),
      [HERO_ACTION_POOL_ANG]: 3,
      [HERO_ACTION_POOL_ABW]: 2,
      [HERO_ACTION_POOL_MAX]: 5,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: { 'zao-1': { kind: 'uo', marks: 0, lodgedAbw: true } },
    })
    await patchZaoSlot('hero-a', 'zao-1', { kind: 'ang', marks: 1 })
    expect(itemMetaRef.current[KR_ZAO_SLOTS]['zao-1'].kind).toBe('ang')
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(0)
  })

  it('uo -> lh ist schild-neutral (kein Abzug)', async () => {
    setMeta({
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'ang',
      [KR_ANG]: chargeValueFromMarks(1),
      [KR_ABW]: chargeValueFromMarks(1),
      [HERO_ACTION_POOL_ANG]: 3,
      [HERO_ACTION_POOL_ABW]: 2,
      [HERO_ACTION_POOL_MAX]: 5,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: { 'zao-1': { kind: 'uo', marks: 0, lodgedAbw: true } },
    })
    await patchZaoSlot('hero-a', 'zao-1', { kind: 'lh', marks: 1 })
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(1)
  })
})

describe('patchEnsureZaoSlotForLink - render-seitige Struktur-Reparatur ist schild-neutral', () => {
  it('legt uo/lodgedAbw fuer phaseNum>=2 an, creditiert aber KEIN Schild', async () => {
    setMeta({
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'uo',
      [KR_ABW]: chargeValueFromMarks(1),
      [HERO_ACTION_POOL_ANG]: 1,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 2,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: {},
    })
    await patchEnsureZaoSlotForLink('hero-a', 'zao-1', 2)
    expect(itemMetaRef.current[KR_ZAO_SLOTS]['zao-1']).toMatchObject({
      kind: 'uo',
      lodgedAbw: true,
    })
    // Render-Reparatur darf KR_ABW nicht erhoehen (sonst Re-Credit bei
    // ephemerem 2.AO-UUID-Churn waehrend L.H.). reconcile deckelt nur nach
    // unten; der Wert bleibt unveraendert bei 1.
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(1)
  })

  it('gibt ein vom Stempel verbrauchtes Schild NICHT zurueck (KR_ABW=0 bleibt 0)', async () => {
    // Szenario: Held hat sein einziges Reaktions-Schild gestempelt (KR_ABW=0).
    // Eine L.H.-bedingt churnende 2.AO-Wurzel laesst patchEnsureZaoSlotForLink
    // pro Render einen neuen Default-Slot anlegen. Das DARF kein Schild
    // zurueckgeben — sonst wirkt das Stempeln waehrend der L.H. nicht.
    setMeta({
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'lh',
      [KR_ABW]: chargeValueFromMarks(0),
      [HERO_ACTION_POOL_ANG]: 1,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 2,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: {},
    })
    await patchEnsureZaoSlotForLink('hero-a', 'zao-churn-1', 2)
    await patchEnsureZaoSlotForLink('hero-a', 'zao-churn-2', 2)
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(0)
  })

  it('Mutter-Default (phaseNum 1, ang) creditiert KEIN Schild', async () => {
    setMeta({
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'ang',
      [KR_ANG]: chargeValueFromMarks(1),
      [KR_ABW]: chargeValueFromMarks(0),
      [HERO_ACTION_POOL_ANG]: 1,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 2,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: {},
    })
    await patchEnsureZaoSlotForLink('hero-a', 'mother', 1)
    expect(itemMetaRef.current[KR_ZAO_SLOTS]['mother'].kind).toBe('ang')
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(0)
  })
})

describe('patchZaoSlot - skipShieldCredit fuer render-seitige Reparatur', () => {
  it('skipShieldCredit verhindert Schild-Gutschrift beim Uebergang in lodged', async () => {
    // L.H.-Mutter: render-seitige Auto-Anlage eines uo/lodged-Slots fuer eine
    // churnende Wurzel. Mit skipShieldCredit darf KR_ABW (hier 0 nach Stempel)
    // NICHT auf 1 zurueckspringen.
    setMeta({
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'lh',
      [KR_ABW]: chargeValueFromMarks(0),
      [HERO_ACTION_POOL_ANG]: 1,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 2,
      phases: { links: [] },
      [KR_ZAO_SLOTS]: {},
    })
    await patchZaoSlot(
      'hero-a',
      'zao-churn-1',
      { kind: 'uo', marks: 0, lodgedAbw: true },
      { skipShieldCredit: true }
    )
    expect(itemMetaRef.current[KR_ZAO_SLOTS]['zao-churn-1']).toMatchObject({
      kind: 'uo',
      lodgedAbw: true,
    })
    expect(marksFromChargeValue(itemMetaRef.current[KR_ABW])).toBe(0)
  })
})

describe('initKrActionPoolsFromHeroDefaults - skipActionInit stellt KR_ABW her', () => {
  it('Mutter leer + persistierter leerer 2.AO -> KR_ABW auf Deckel 2 (statt 0)', () => {
    const m = {
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'uo',
      [KR_ABW]: chargeValueFromMarks(0),
      [HERO_ACTION_POOL_ANG]: 1,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 2,
      phases: { links: [{ id: 'zao-1', parentId: null, offset: 8 }] },
      [KR_ZAO_SLOTS]: { 'zao-1': { kind: 'uo', marks: 0, lodgedAbw: true } },
    }
    initKrActionPoolsFromHeroDefaults(m, { skipActionInit: true })
    expect(marksFromChargeValue(m[KR_ABW])).toBe(2)
  })

  it('Mutter L.H. (kein Mutter-Schild) -> KR_ABW nur Abw-Budget', () => {
    const m = {
      initiative: '12',
      [KR_FIRST_SLOT_KIND]: 'lh',
      [KR_ABW]: chargeValueFromMarks(0),
      [HERO_ACTION_POOL_ANG]: 1,
      [HERO_ACTION_POOL_ABW]: 1,
      [HERO_ACTION_POOL_MAX]: 2,
      phases: { links: [{ id: 'zao-1', parentId: null, offset: 8 }] },
      [KR_ZAO_SLOTS]: { 'zao-1': { kind: 'uo', marks: 0, lodgedAbw: true } },
    }
    initKrActionPoolsFromHeroDefaults(m, { skipActionInit: true })
    expect(marksFromChargeValue(m[KR_ABW])).toBe(1)
  })
})
