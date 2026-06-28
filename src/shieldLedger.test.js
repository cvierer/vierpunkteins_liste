import { describe, expect, it } from 'vitest'
import {
  reconcileShieldLedger,
  shieldLedgerCap,
  shouldDebitLodgedShieldOnLeave,
} from './shieldLedger.js'
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

const UO = { kind: 'uo', marks: 0, lodgedAbw: true }
const ANG = { kind: 'ang', marks: 1 }
const SRA = { kind: 'sra', marks: 1 }
const LH = { kind: 'lh', marks: 1 }

/**
 * Baut Helden-Meta fuer den Schild-Deckel-Test.
 * @param {object} opts
 * @param {'ang'|'sra'|'lh'|'uo'} [opts.motherKind] Primaer-Kind der Mutter ('uo' = Schild)
 * @param {number} opts.abwMarks Aktuelle Schild-Marken in KR_ABW
 * @param {Array<{ slot: object, heroExtra?: 'ang'|'par' }>} [opts.zaos] regulaere/heroExtra 2.AO
 * @param {number} [opts.poolAng] konfigurierte Aktionen (default 1/1)
 * @param {number} [opts.poolAbw] konfigurierte Reaktionen (default 1/1)
 */
function buildMeta({ motherKind = 'ang', abwMarks, zaos = [], poolAng, poolAbw }) {
  const links = []
  const slots = {}
  zaos.forEach((z, i) => {
    const id = `zao-${i + 1}`
    const link = { id, parentId: null, offset: 8 + i }
    if (z.heroExtra) link.heroExtra = z.heroExtra
    links.push(link)
    slots[id] = z.slot
  })
  const m = {
    initiative: '12',
    [KR_FIRST_SLOT_KIND]: motherKind,
    [KR_ABW]: chargeValueFromMarks(abwMarks),
    phases: { links },
    [KR_ZAO_SLOTS]: slots,
  }
  if (motherKind === 'ang') m[KR_ANG] = chargeValueFromMarks(1)
  if (poolAng != null && poolAbw != null) {
    m[HERO_ACTION_POOL_ANG] = poolAng
    m[HERO_ACTION_POOL_ABW] = poolAbw
    m[HERO_ACTION_POOL_MAX] = poolAng + poolAbw
  }
  return m
}

describe('reconcileShieldLedger - Erhaltungs-Deckel (budget-bewusst)', () => {
  // --- Standardheld ang=1 / abw=1 ---
  it('ang=1/abw=1: Mutter Schwert + 2.AO leer -> 1 Schild bleibt', () => {
    const m = buildMeta({ motherKind: 'ang', abwMarks: 1, zaos: [{ slot: UO }] })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(1)
  })

  it('ang=1/abw=1: zwei Schwerter (Mutter + 2.AO ang) -> 0 Schild', () => {
    const m = buildMeta({ motherKind: 'ang', abwMarks: 1, zaos: [{ slot: ANG }] })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(true)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(0)
  })

  it('ang=1/abw=1: bereits 0 bei zwei Schwertern -> kein Change', () => {
    const m = buildMeta({ motherKind: 'ang', abwMarks: 0, zaos: [{ slot: ANG }] })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(0)
  })

  it('ang=1/abw=1: Mutter leer (Schild) + 2.AO leer -> 2 Schilde', () => {
    const m = buildMeta({ motherKind: 'uo', abwMarks: 2, zaos: [{ slot: UO }] })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(2)
  })

  it('ang=1/abw=1: Mutter Schwert + 2.AO leer aber 2 Schilde (Drift) -> auf 1 gedeckelt', () => {
    const m = buildMeta({ motherKind: 'ang', abwMarks: 2, zaos: [{ slot: UO }] })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(true)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(1)
  })

  // --- Held mit >2 Aktionen: ang=3 / abw=2 (V1292-Regression) ---
  it('ang=3/abw=2: Mutter Schwert + zao1 Schwert + zao2 leer -> 1 Schild bleibt (Regression)', () => {
    const m = buildMeta({
      motherKind: 'ang',
      abwMarks: 1,
      zaos: [{ slot: ANG }, { slot: UO }],
      poolAng: 3,
      poolAbw: 2,
    })
    expect(shieldLedgerCap(m)).toBe(1)
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(1)
  })

  it('ang=3/abw=2: Mutter Schwert + zao1 Schwert + zao2 leer, Drift 2 -> auf 1 gedeckelt', () => {
    const m = buildMeta({
      motherKind: 'ang',
      abwMarks: 2,
      zaos: [{ slot: ANG }, { slot: UO }],
      poolAng: 3,
      poolAbw: 2,
    })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(true)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(1)
  })

  it('ang=3/abw=2: beide 2.AO Schwert -> 0 Schilde', () => {
    const m = buildMeta({
      motherKind: 'ang',
      abwMarks: 2,
      zaos: [{ slot: ANG }, { slot: ANG }],
      poolAng: 3,
      poolAbw: 2,
    })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(true)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(0)
  })

  it('ang=3/abw=2: beide 2.AO leer -> 2 Schilde bleiben', () => {
    const m = buildMeta({
      motherKind: 'ang',
      abwMarks: 2,
      zaos: [{ slot: UO }, { slot: UO }],
      poolAng: 3,
      poolAbw: 2,
    })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(2)
  })

  // --- sra / lh am 2.AO zaehlen wie eine Aktion (ziehen je 1 Schild) ---
  it('ang=3/abw=2: zao1 S.R.A. + zao2 leer -> 1 Schild', () => {
    const m = buildMeta({
      motherKind: 'ang',
      abwMarks: 2,
      zaos: [{ slot: SRA }, { slot: UO }],
      poolAng: 3,
      poolAbw: 2,
    })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(true)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(1)
  })

  it('ang=3/abw=2: zao1 S.R.A. + zao2 L.H. -> 0 Schilde', () => {
    const m = buildMeta({
      motherKind: 'ang',
      abwMarks: 2,
      zaos: [{ slot: SRA }, { slot: LH }],
      poolAng: 3,
      poolAbw: 2,
    })
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(true)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(0)
  })

  // --- heroExtra-Slots zaehlen NICHT gegen das Reaktions-Budget ---
  it('heroExtra-2.AO mit Schwert zieht kein Reaktions-Schild', () => {
    const m = buildMeta({
      motherKind: 'ang',
      abwMarks: 1,
      zaos: [{ slot: ANG, heroExtra: 'ang' }, { slot: UO }],
    })
    expect(shieldLedgerCap(m)).toBe(1)
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(1)
  })

  it('null/ungueltig -> kein Throw, kein Change', () => {
    expect(reconcileShieldLedger(null)).toBe(false)
    expect(reconcileShieldLedger(undefined)).toBe(false)
    expect(reconcileShieldLedger(/** @type {any} */ (42))).toBe(false)
  })
})

describe('shouldDebitLodgedShieldOnLeave', () => {
  it('leeres uo/lodgedAbw -> geladene Aktion (lh): Schild abbuchen', () => {
    expect(
      shouldDebitLodgedShieldOnLeave({ kind: 'uo', lodgedAbw: true }, 'lh', false)
    ).toBe(true)
    expect(
      shouldDebitLodgedShieldOnLeave({ kind: 'uo', lodgedAbw: true }, 'ang', false)
    ).toBe(true)
  })

  it('lodgedAbw ohne kind uo (Halbzustand) -> ebenfalls abbuchen', () => {
    expect(
      shouldDebitLodgedShieldOnLeave({ kind: 'ang', lodgedAbw: true }, 'sra', false)
    ).toBe(true)
  })

  it('Ziel bleibt eingelagert (uo / nextLodged) -> NICHT abbuchen', () => {
    expect(
      shouldDebitLodgedShieldOnLeave({ kind: 'uo', lodgedAbw: true }, 'uo', true)
    ).toBe(false)
    expect(
      shouldDebitLodgedShieldOnLeave({ kind: 'uo', lodgedAbw: true }, 'ang', true)
    ).toBe(false)
  })

  it('Aktion->Aktion (vorher kein Schild eingelagert) -> NICHT abbuchen', () => {
    expect(shouldDebitLodgedShieldOnLeave({ kind: 'ang', marks: 1 }, 'lh', false)).toBe(
      false
    )
    expect(shouldDebitLodgedShieldOnLeave(null, 'lh', false)).toBe(false)
    expect(shouldDebitLodgedShieldOnLeave(undefined, 'ang', false)).toBe(false)
  })
})
