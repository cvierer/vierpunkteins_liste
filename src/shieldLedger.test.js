import { describe, expect, it } from 'vitest'
import {
  reconcileShieldLedger,
  shouldDebitLodgedShieldOnLeave,
} from './shieldLedger.js'
import { chargeValueFromMarks, marksFromChargeValue } from './krDigit.js'
import {
  KR_ABW,
  KR_ANG,
  KR_FIRST_SLOT_KIND,
  KR_ZAO_SLOTS,
} from './krMetaKeys.js'

// Helfer: Meta mit Mutter-Angriff (geladen) und einer regulaeren 2.AO-Wurzel.
function metaWithMotherAngAndZao(zaoSlot, abwMarks) {
  return {
    initiative: '12',
    [KR_FIRST_SLOT_KIND]: 'ang',
    [KR_ANG]: chargeValueFromMarks(1), // geladenes Schwert an der Mutter
    [KR_ABW]: chargeValueFromMarks(abwMarks),
    phases: { links: [{ id: 'zao-1', parentId: null, offset: 8 }] },
    [KR_ZAO_SLOTS]: { 'zao-1': zaoSlot },
  }
}

describe('reconcileShieldLedger', () => {
  it('zwei Schwerter (Mutter + 2.AO ang) -> Schild wird auf 0 gezwungen', () => {
    const m = metaWithMotherAngAndZao({ kind: 'ang', marks: 1 }, 1)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(1)
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(true)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(0)
  })

  it('bereits 0 Schild bei zwei Schwertern -> kein Change', () => {
    const m = metaWithMotherAngAndZao({ kind: 'ang', marks: 1 }, 0)
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(0)
  })

  it('Mutter Schwert, 2.AO leer (uo/lodgedAbw) -> Schild bleibt erhalten', () => {
    const m = metaWithMotherAngAndZao({ kind: 'uo', marks: 0, lodgedAbw: true }, 2)
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(2)
  })

  it('2.AO Schwert, Mutter aber S.R.A. -> kein Dual-Schwert, Schild bleibt', () => {
    const m = metaWithMotherAngAndZao({ kind: 'ang', marks: 1 }, 3)
    m[KR_FIRST_SLOT_KIND] = 'sra'
    const changed = reconcileShieldLedger(m)
    expect(changed).toBe(false)
    expect(marksFromChargeValue(m[KR_ABW])).toBe(3)
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
