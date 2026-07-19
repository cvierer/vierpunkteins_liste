import { describe, expect, it } from 'vitest'
import { DERIVED_RECALC_FIELDS } from './heroExpandDerivedRecalc.js'
import {
  readBaseAttrsForDerived,
  syncDerivedRecalcDeltasInMeta,
} from './heroDerivedRecalcSync.js'
import { HERO_EX_MODS } from './heroExMods.js'
import {
  HERO_EX_FF,
  HERO_EX_GE,
  HERO_EX_IN,
  HERO_EX_KK,
  HERO_EX_KL,
  HERO_EX_KO,
  HERO_EX_MU,
} from './heroExMetaKeys.js'

function baseMeta(overrides = {}) {
  return {
    [HERO_EX_MU]: '25',
    [HERO_EX_KL]: '11',
    [HERO_EX_IN]: '13',
    [HERO_EX_FF]: '14',
    [HERO_EX_GE]: '10',
    [HERO_EX_KK]: '15',
    [HERO_EX_KO]: '11',
    heroExAt: '12',
    heroExIb: '10',
    initiative: '12',
    ...overrides,
  }
}

function mkMod(overrides = {}) {
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    field: 'mu',
    delta: -15,
    duration: 5,
    permanent: true,
    addedRound: 1,
    addedNavIni: Number.POSITIVE_INFINITY,
    ...overrides,
  }
}

function mkDerivedBundle(parentBid, derivedBid, deltas = {}) {
  return DERIVED_RECALC_FIELDS.map((field) =>
    mkMod({
      id: `d-${field}`,
      field,
      delta: deltas[field] ?? 0,
      permanent: true,
      duration: 1,
      derivedDynamic: true,
      bundleId: derivedBid,
      parentBundleId: parentBid,
      absolute: false,
    })
  )
}

describe('readBaseAttrsForDerived', () => {
  it('liest Meta-Eigenschaften', () => {
    const a = readBaseAttrsForDerived(baseMeta())
    expect(a.mu).toBe('25')
    expect(a.inn).toBe('13')
  })
})

describe('syncDerivedRecalcDeltasInMeta', () => {
  const ctx = {
    ownerIni: 12,
    currentRound: 1,
    currentNavIni: Number.POSITIVE_INFINITY,
  }

  it('schreibt AT −3 bei MU-Senkung Formel 10→7', () => {
    // Formel vorher AT=10, nach MU−15 (25→10) AT=7
    const parentBid = 'bun-parent'
    const derivedBid = 'bun-derived'
    const m = /** @type {Record<string, unknown>} */ (
      baseMeta({
        [HERO_EX_MODS]: [
          mkMod({
            id: 'parent',
            field: 'mu',
            delta: -15,
            bundleId: parentBid,
          }),
          ...mkDerivedBundle(parentBid, derivedBid),
        ],
      })
    )
    expect(syncDerivedRecalcDeltasInMeta(m, ctx)).toBe(true)
    const mods = /** @type {any[]} */ (m[HERO_EX_MODS])
    const at = mods.find((x) => x.field === 'at' && x.derivedDynamic)
    expect(at.delta).toBe(-3)
    expect(at.absolute).toBeUndefined()
  })

  it('lässt bestehende AT-Delta-Mods separat (nicht in Ableitung einrechnen)', () => {
    const parentBid = 'bun-parent'
    const derivedBid = 'bun-derived'
    const m = /** @type {Record<string, unknown>} */ (
      baseMeta({
        [HERO_EX_MODS]: [
          mkMod({
            id: 'existing-at',
            field: 'at',
            delta: 1,
            bundleId: 'bun-other',
          }),
          mkMod({
            id: 'parent',
            field: 'mu',
            delta: -15,
            bundleId: parentBid,
          }),
          ...mkDerivedBundle(parentBid, derivedBid),
        ],
      })
    )
    syncDerivedRecalcDeltasInMeta(m, ctx)
    const mods = /** @type {any[]} */ (m[HERO_EX_MODS])
    expect(mods.find((x) => x.id === 'existing-at')?.delta).toBe(1)
    expect(
      mods.find((x) => x.field === 'at' && x.derivedDynamic)?.delta
    ).toBe(-3)
  })

  it('summiert mehrere Mutter-Pakete in Reihenfolge', () => {
    const p1 = 'bun-p1'
    const p2 = 'bun-p2'
    const d1 = 'bun-d1'
    const d2 = 'bun-d2'
    const m = /** @type {Record<string, unknown>} */ (
      baseMeta({
        [HERO_EX_MODS]: [
          mkMod({ id: 'm1', field: 'mu', delta: -5, bundleId: p1 }),
          ...mkDerivedBundle(p1, d1),
          mkMod({ id: 'm2', field: 'mu', delta: -10, bundleId: p2 }),
          ...mkDerivedBundle(p2, d2),
        ],
      })
    )
    syncDerivedRecalcDeltasInMeta(m, ctx)
    const mods = /** @type {any[]} */ (m[HERO_EX_MODS])
    const at1 = mods.find((x) => x.bundleId === d1 && x.field === 'at')
    const at2 = mods.find((x) => x.bundleId === d2 && x.field === 'at')
    // Gesamt MU 25→10 = −15 → AT 10→7 = −3; Summe der Teildeltas
    expect(at1.delta + at2.delta).toBe(-3)
  })

  it('aktualisiert bei Aktion-Akkumulation (effektiver Beitrag steigt)', () => {
    const parentBid = 'bun-parent'
    const derivedBid = 'bun-derived'
    const m = /** @type {Record<string, unknown>} */ (
      baseMeta({
        [HERO_EX_MODS]: [
          mkMod({
            id: 'parent',
            field: 'mu',
            delta: -5,
            duration: 10,
            permanent: false,
            accrual: 'action',
            bundleId: parentBid,
            addedRound: 1,
            addedNavIni: Number.POSITIVE_INFINITY,
          }),
          ...mkDerivedBundle(parentBid, derivedBid),
        ],
      })
    )
    // roundStart: 0 ticks → Effekt 0
    syncDerivedRecalcDeltasInMeta(m, {
      ...ctx,
      currentNavIni: Number.POSITIVE_INFINITY,
    })
    let mods = /** @type {any[]} */ (m[HERO_EX_MODS])
    expect(mods.find((x) => x.field === 'at' && x.derivedDynamic)?.delta).toBe(0)

    // Heldenzug: 1 Tick → MU −5
    syncDerivedRecalcDeltasInMeta(m, {
      ...ctx,
      currentNavIni: 12,
    })
    mods = /** @type {any[]} */ (m[HERO_EX_MODS])
    const atAfter = mods.find((x) => x.field === 'at' && x.derivedDynamic)
    expect(atAfter.delta).not.toBe(0)
  })

  it('stellt entferntes Ableitungspaket nicht wieder her', () => {
    const parentBid = 'bun-parent'
    const m = /** @type {Record<string, unknown>} */ (
      baseMeta({
        [HERO_EX_MODS]: [
          mkMod({
            id: 'parent',
            field: 'mu',
            delta: -15,
            bundleId: parentBid,
          }),
          // kein Kind
        ],
      })
    )
    expect(syncDerivedRecalcDeltasInMeta(m, ctx)).toBe(false)
    const mods = /** @type {any[]} */ (m[HERO_EX_MODS])
    expect(mods.every((x) => x.derivedDynamic !== true)).toBe(true)
  })
})
