import { describe, expect, it } from 'vitest'
import {
  computeDerivedRecalcFixes,
  DERIVED_RECALC_FIELDS,
  isDerivedRecalcBundle,
} from './heroExpandDerivedRecalc.js'

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

describe('isDerivedRecalcBundle', () => {
  it('erkennt genau die sechs absolute Felder', () => {
    const mods = DERIVED_RECALC_FIELDS.map((field) => ({
      field,
      absolute: true,
      delta: 1,
    }))
    expect(isDerivedRecalcBundle(mods)).toBe(true)
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
