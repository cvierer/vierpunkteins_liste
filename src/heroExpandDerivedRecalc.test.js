import { describe, expect, it } from 'vitest'
import {
  applyAttrDeltasToSnap,
  computeDerivedRecalcDeltas,
  computeDerivedRecalcFixes,
  DERIVED_RECALC_FIELDS,
  isDerivedRecalcBundle,
  isDynamicDerivedRecalcBundle,
  nonZeroDerivedRecalcDeltas,
} from './heroExpandDerivedRecalc.js'

const ATTRS = {
  mu: 14,
  kl: 11,
  inn: 13,
  ff: 14,
  ge: 10,
  kk: 15,
  ko: 11,
}

describe('computeDerivedRecalcFixes', () => {
  it('berechnet DSA-Formeln und rundet', () => {
    const fixes = computeDerivedRecalcFixes({
      mu: 12,
      kl: 11,
      inn: 13,
      ff: 14,
      ge: 10,
      kk: 15,
      ko: 11,
    })
    expect(fixes).toEqual({
      at: Math.round((12 + 10 + 15) / 5), // 7.4 → 7
      pa: Math.round((13 + 10 + 15) / 5), // 7.6 → 8
      fk: Math.round((13 + 14 + 15) / 5), // 8.4 → 8
      ib: Math.round((12 + 12 + 13 + 10) / 5), // 9.4 → 9
      mr: Math.round((12 + 11 + 11) / 5), // 6.8 → 7
      ws: Math.round(11 / 2), // 5.5 → 6
    })
  })

  it('gibt null bei fehlendem Attribut', () => {
    expect(
      computeDerivedRecalcFixes({
        mu: 12,
        kl: 11,
        inn: 13,
        ff: 14,
        ge: 10,
        kk: 15,
        // ko fehlt
      })
    ).toBeNull()
  })

  it('klemmt auf -99…99', () => {
    const fixes = computeDerivedRecalcFixes({
      mu: 200,
      kl: 200,
      inn: 200,
      ff: 200,
      ge: 200,
      kk: 200,
      ko: 200,
    })
    expect(fixes?.at).toBe(99)
    expect(fixes?.ws).toBe(99)
  })
})

describe('computeDerivedRecalcDeltas', () => {
  it('Beispiel: Formel 10→7 ergibt AT −3 (Grundaufschlag bleibt separat)', () => {
    // Formel vorher: (14+10+15)/5 = 7.8 → 8 — wir brauchen Formel 10 vor MU-Senkung.
    // AT Formel 10: (MU+GE+KK)/5 = 10 → MU+GE+KK = 50, z.B. MU=25, GE=10, KK=15
    const before = { mu: 25, kl: 11, inn: 13, ff: 14, ge: 10, kk: 15, ko: 11 }
    expect(computeDerivedRecalcFixes(before)?.at).toBe(10)
    // MU so senken, dass Formel AT 7: (MU+10+15)/5 = 7 → MU+25 = 35 → MU=10
    const after = { ...before, mu: 10 }
    expect(computeDerivedRecalcFixes(after)?.at).toBe(7)
    const deltas = computeDerivedRecalcDeltas(before, after)
    expect(deltas?.at).toBe(-3)
    // Basis-AT 12 behält den +2-Abstand: 12 + (−3) = 9 = Formel 7 + Offset 2
  })

  it('liefert 0 für unveränderte Felder', () => {
    const before = ATTRS
    const after = { ...ATTRS, mu: ATTRS.mu - 5 }
    const deltas = computeDerivedRecalcDeltas(before, after)
    expect(deltas?.ws).toBe(0) // WS hängt nur von KO ab
    expect(nonZeroDerivedRecalcDeltas(deltas).ws).toBeUndefined()
    expect(nonZeroDerivedRecalcDeltas(deltas).at).toBeDefined()
  })
})

describe('applyAttrDeltasToSnap', () => {
  it('addiert Deltas auf Basis-Attribute', () => {
    const next = applyAttrDeltasToSnap(ATTRS, { mu: -5 })
    expect(next?.mu).toBe(9)
    expect(next?.ge).toBe(10)
  })
})

describe('isDerivedRecalcBundle', () => {
  it('erkennt genau die sechs absolute Felder (Legacy)', () => {
    const mods = DERIVED_RECALC_FIELDS.map((field) => ({
      field,
      absolute: true,
      delta: 1,
    }))
    expect(isDerivedRecalcBundle(mods)).toBe(true)
  })

  it('erkennt dynamische Ableitungspakete', () => {
    const mods = DERIVED_RECALC_FIELDS.map((field) => ({
      field,
      derivedDynamic: true,
      delta: 0,
    }))
    expect(isDerivedRecalcBundle(mods)).toBe(true)
    expect(isDynamicDerivedRecalcBundle(mods)).toBe(true)
  })

  it('lehnt fehlende absolute-Flags und falsche Felder ab', () => {
    expect(
      isDerivedRecalcBundle([
        { field: 'at', absolute: true },
        { field: 'pa', absolute: true },
      ])
    ).toBe(false)
    expect(
      isDerivedRecalcBundle(
        DERIVED_RECALC_FIELDS.map((field) => ({ field, absolute: false }))
      )
    ).toBe(false)
    expect(
      isDerivedRecalcBundle([
        ...DERIVED_RECALC_FIELDS.slice(0, 5).map((field) => ({
          field,
          absolute: true,
        })),
        { field: 'gs', absolute: true },
      ])
    ).toBe(false)
  })
})
