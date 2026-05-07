import { describe, expect, it } from 'vitest'
import { HIT_ZONE_DEFS, hzWKey } from './hitZoneMeta.js'
import {
  aggregateHeroAutoPenaltyDeltasFromExpandSnapshot,
  applyBundleRemovalCleanup,
  AUTO_MOD_BUNDLE_PREFIX,
  buildHeroAutoModRecords,
  computeAutoTriggerSignature,
  HERO_EX_AUTO_SUPPRESSED,
  HERO_EX_BUNDLE_ORIGIN,
  HERO_EX_LAST_SAFE_LE,
  patchHeroExModsWithAutoBundles,
  relabelAutoBundleInMods,
  updateLastSafeLeIfSafe,
} from './heroAutoMods.js'
import { HERO_EX_MODS } from './heroExMods.js'

/** @returns {Record<string, { rs: string, w: number }>} */
function emptyZones() {
  return Object.fromEntries(HIT_ZONE_DEFS.map((z) => [z.id, { rs: '0', w: 0 }]))
}

/**
 * @param {Record<string, unknown>} overrides
 */
function snap(overrides = {}) {
  return {
    le: '20',
    leMax: '40',
    gs: '10',
    hitZones: { notiz: '', zones: emptyZones() },
    ...overrides,
  }
}

describe('buildHeroAutoModRecords', () => {
  const ctx = { round: 1, navIni: Number.POSITIVE_INFINITY }

  it('Brust W1 → auto-zone-brust mit AT/PA/KO/KK/AW −1 und FK −2', () => {
    const zones = { ...emptyZones(), brust: { rs: '0', w: 1 } }
    const mods = buildHeroAutoModRecords(snap({ hitZones: { notiz: '', zones: zones } }), ctx)
    const bids = new Set(mods.map((m) => m.bundleId))
    expect(bids.has(`${AUTO_MOD_BUNDLE_PREFIX}zone-brust`)).toBe(true)
    const byField = Object.fromEntries(
      mods
        .filter((m) => m.bundleId === `${AUTO_MOD_BUNDLE_PREFIX}zone-brust`)
        .map((m) => [m.field, m.delta])
    )
    expect(byField.at).toBe(-1)
    expect(byField.pa).toBe(-1)
    expect(byField.ko).toBe(-1)
    expect(byField.kk).toBe(-1)
    expect(byField.a).toBe(-1)
    expect(byField.fk).toBe(-2)
  })

  it('Kopf W2 → MU/KL/IN/IB je −4 und FK −4', () => {
    const zones = { ...emptyZones(), kopf: { rs: '0', w: 2 } }
    const mods = buildHeroAutoModRecords(snap({ hitZones: { notiz: '', zones: zones } }), ctx)
    const zmods = mods.filter((m) => m.bundleId === `${AUTO_MOD_BUNDLE_PREFIX}zone-kopf`)
    const byField = Object.fromEntries(zmods.map((m) => [m.field, m.delta]))
    expect(byField.mu).toBe(-4)
    expect(byField.kl).toBe(-4)
    expect(byField.inn).toBe(-4)
    expect(byField.ib).toBe(-4)
    expect(byField.fk).toBe(-4)
  })

  it('LE-Band <1/2 → auto-le-band AT/PA/AW/FK je −1', () => {
    const mods = buildHeroAutoModRecords(snap({ le: '15', leMax: '40' }), ctx)
    const leb = mods.filter((m) => m.bundleId === 'auto-le-band')
    expect(leb.length).toBe(4)
    for (const f of ['at', 'pa', 'a', 'fk']) {
      const row = leb.find((m) => m.field === f)
      expect(row?.delta).toBe(-1)
    }
    expect(mods.some((m) => m.bundleId === 'auto-le-unfaehig')).toBe(false)
  })

  it('unfähig-UI-Bundle wird bei LE<=Schwelle erzeugt (ohne Zahlenänderung)', () => {
    const mods = buildHeroAutoModRecords(
      snap({ le: '4', leMax: '40', unfaehigThreshold: '5' }),
      ctx
    )
    const u = mods.filter((m) => m.bundleId === 'auto-le-unfaehig')
    expect(u.length).toBe(1)
    expect(u[0].label).toBe('unfähig')
    expect(u[0].field).toBe('le')
    expect(u[0].delta).toBe(0)
  })

  it('GS-Clamp: heroExGs-Basis 1 und Bauch W1 → gs-Delta 0', () => {
    const zones = { ...emptyZones(), bauch: { rs: '0', w: 1 } }
    const mods = buildHeroAutoModRecords(
      snap({ gs: '1', hitZones: { notiz: '', zones: zones } }),
      ctx
    )
    const gsRows = mods.filter(
      (m) => m.bundleId === `${AUTO_MOD_BUNDLE_PREFIX}zone-bauch` && m.field === 'gs'
    )
    expect(gsRows.length).toBe(0)
  })

  it('gemischt: Wunde + LE liefert beide Bündel; patch ersetzt alte auto-*', () => {
    const zones = { ...emptyZones(), brust: { rs: '0', w: 1 } }
    const s = snap({ le: '15', leMax: '40', hitZones: { notiz: '', zones: zones } })
    const m = {
      [HERO_EX_MODS]: [
        {
          id: 'old1',
          field: 'at',
          delta: -9,
          duration: 1,
          addedRound: 1,
          addedNavIni: Number.POSITIVE_INFINITY,
          bundleId: `${AUTO_MOD_BUNDLE_PREFIX}zone-brust`,
        },
        {
          id: 'keep',
          field: 'mu',
          delta: 1,
          duration: 3,
          addedRound: 1,
          addedNavIni: Number.POSITIVE_INFINITY,
          bundleId: 'bun-manual',
        },
      ],
    }
    patchHeroExModsWithAutoBundles(m, s, ctx)
    const kept = /** @type {any[]} */ (m[HERO_EX_MODS])
    expect(kept.some((x) => x.id === 'keep')).toBe(true)
    expect(kept.some((x) => x.id === 'old1')).toBe(false)
    expect(kept.some((x) => x.bundleId === `${AUTO_MOD_BUNDLE_PREFIX}zone-brust`)).toBe(true)
    expect(kept.some((x) => x.bundleId === 'auto-le-band')).toBe(true)
  })
})

describe('aggregateHeroAutoPenaltyDeltasFromExpandSnapshot', () => {
  it('summiert Zonen- und LE-Malus konsistent mit Bündeln', () => {
    const zones = { ...emptyZones(), brust: { rs: '0', w: 1 } }
    const s = snap({ le: '15', leMax: '40', hitZones: { notiz: '', zones: zones } })
    const agg = aggregateHeroAutoPenaltyDeltasFromExpandSnapshot(s)
    expect(agg.at).toBe(-2)
    expect(agg.fk).toBe(-3)
  })
})

describe('patchHeroExModsWithAutoBundles + heroExAutoSuppressed', () => {
  const ctx = { round: 1, navIni: Number.POSITIVE_INFINITY }
  const zoneBrust = `${AUTO_MOD_BUNDLE_PREFIX}zone-brust`

  it('unterdrückt auto-zone-brust bei gleicher Wundsignatur', () => {
    const zones = { ...emptyZones(), brust: { rs: '0', w: 1 } }
    const s = snap({ hitZones: { notiz: '', zones: zones } })
    const m = {
      [HERO_EX_AUTO_SUPPRESSED]: { [zoneBrust]: 1 },
      [HERO_EX_MODS]: [],
    }
    patchHeroExModsWithAutoBundles(m, s, ctx)
    const mods = /** @type {any[]} */ (m[HERO_EX_MODS] ?? [])
    expect(mods.some((x) => x.bundleId === zoneBrust)).toBe(false)
    expect(m[HERO_EX_AUTO_SUPPRESSED][zoneBrust]).toBe(1)
  })

  it('hebt Unterdrückung auf, wenn Wundzahl steigt', () => {
    const zones = { ...emptyZones(), brust: { rs: '0', w: 2 } }
    const s = snap({ hitZones: { notiz: '', zones: zones } })
    const m = {
      [HERO_EX_AUTO_SUPPRESSED]: { [zoneBrust]: 1 },
      [HERO_EX_MODS]: [],
    }
    patchHeroExModsWithAutoBundles(m, s, ctx)
    const mods = /** @type {any[]} */ (m[HERO_EX_MODS])
    expect(mods.some((x) => x.bundleId === zoneBrust)).toBe(true)
    expect(m[HERO_EX_AUTO_SUPPRESSED]?.[zoneBrust]).toBeUndefined()
  })

  it('entfernt Suppression, wenn Zone keine Wunden mehr hat', () => {
    const s = snap({ hitZones: { notiz: '', zones: emptyZones() } })
    const m = {
      [HERO_EX_AUTO_SUPPRESSED]: { [zoneBrust]: 1 },
      [HERO_EX_MODS]: [],
    }
    patchHeroExModsWithAutoBundles(m, s, ctx)
    expect(m[HERO_EX_AUTO_SUPPRESSED]?.[zoneBrust]).toBeUndefined()
  })

  it('unterdrückt auto-le-band bei gleicher LE-Band-Signatur', () => {
    const s = snap({ le: '15', leMax: '40' })
    expect(computeAutoTriggerSignature(s, 'auto-le-band')).toBe(0)
    const m = {
      [HERO_EX_AUTO_SUPPRESSED]: { 'auto-le-band': 0 },
      [HERO_EX_MODS]: [],
    }
    patchHeroExModsWithAutoBundles(m, s, ctx)
    const mods = /** @type {any[]} */ (m[HERO_EX_MODS] ?? [])
    expect(mods.some((x) => x.bundleId === 'auto-le-band')).toBe(false)
    expect(m[HERO_EX_AUTO_SUPPRESSED]['auto-le-band']).toBe(0)
  })

  it('hebt LE-Suppression auf, wenn LE-Band wechselt', () => {
    const s = snap({ le: '10', leMax: '40' })
    expect(computeAutoTriggerSignature(s, 'auto-le-band')).toBe(1)
    const m = {
      [HERO_EX_AUTO_SUPPRESSED]: { 'auto-le-band': 0 },
      [HERO_EX_MODS]: [],
    }
    patchHeroExModsWithAutoBundles(m, s, ctx)
    const mods = /** @type {any[]} */ (m[HERO_EX_MODS])
    expect(mods.some((x) => x.bundleId === 'auto-le-band')).toBe(true)
    expect(m[HERO_EX_AUTO_SUPPRESSED]?.['auto-le-band']).toBeUndefined()
  })

  it('auto-le-unfaehig Signatur aktiv nur unter/gleich Schwelle', () => {
    const sOn = snap({ le: '0', unfaehigThreshold: '0' })
    const sOff = snap({ le: '6', unfaehigThreshold: '5' })
    expect(computeAutoTriggerSignature(sOn, 'auto-le-unfaehig')).toBe(0)
    expect(computeAutoTriggerSignature(sOff, 'auto-le-unfaehig')).toBeNull()
  })
})

describe('relabelAutoBundleInMods', () => {
  it('ändert nur die passende bundleId', () => {
    const mods = [
      { id: 'a', bundleId: 'auto-zone-brust', field: 'at', delta: -1 },
      { id: 'b', bundleId: 'bun-x', field: 'mu', delta: 1 },
    ]
    relabelAutoBundleInMods(mods, 'auto-zone-brust', 'bun-neu')
    expect(mods[0].bundleId).toBe('bun-neu')
    expect(mods[1].bundleId).toBe('bun-x')
  })
})

describe('applyBundleRemovalCleanup', () => {
  const ctx = { round: 1, navIni: Number.POSITIVE_INFINITY }
  const zoneBrust = `${AUTO_MOD_BUNDLE_PREFIX}zone-brust`
  const kBrustW = hzWKey('brust')

  it('entfernt auto-zone-brust und Wundmarker hzBrustW', () => {
    const zones = { ...emptyZones(), brust: { rs: '0', w: 2 } }
    const s = snap({ hitZones: { notiz: '', zones: zones } })
    const mods = buildHeroAutoModRecords(s, ctx)
    const m = /** @type {Record<string, unknown>} */ ({
      [kBrustW]: 2,
      [HERO_EX_MODS]: mods,
    })
    applyBundleRemovalCleanup(m, zoneBrust, ctx)
    expect(m[kBrustW]).toBeUndefined()
    const out = /** @type {any[]} */ (m[HERO_EX_MODS] ?? [])
    expect(out.some((x) => x.bundleId === zoneBrust)).toBe(false)
  })

  it('entfernt konvertiertes bun mit Origin und Wundmarker', () => {
    const zones = { ...emptyZones(), brust: { rs: '0', w: 2 } }
    const s = snap({ hitZones: { notiz: '', zones: zones } })
    const autoMods = buildHeroAutoModRecords(s, ctx)
    const newBid = 'bun-conv'
    for (const row of autoMods) {
      if (String(row.bundleId) === zoneBrust) row.bundleId = newBid
    }
    const m = /** @type {Record<string, unknown>} */ ({
      [kBrustW]: 2,
      [HERO_EX_MODS]: autoMods,
      [HERO_EX_BUNDLE_ORIGIN]: { [newBid]: zoneBrust },
    })
    applyBundleRemovalCleanup(m, newBid, ctx)
    expect(m[kBrustW]).toBeUndefined()
    expect(m[HERO_EX_BUNDLE_ORIGIN]).toBeUndefined()
  })

  it('setzt LE aus lastSafe beim Entfernen von auto-le-band', () => {
    const zones = emptyZones()
    const s = snap({ le: '3', leMax: '40', hitZones: { notiz: '', zones: zones } })
    const mods = buildHeroAutoModRecords(s, ctx)
    const m = /** @type {Record<string, unknown>} */ ({
      heroExLe: '3',
      heroExLeMax: '40',
      [HERO_EX_LAST_SAFE_LE]: '20',
      [HERO_EX_MODS]: mods,
    })
    applyBundleRemovalCleanup(m, 'auto-le-band', ctx)
    expect(m.heroExLe).toBe('20')
    expect(m[HERO_EX_AUTO_SUPPRESSED]?.['auto-le-band']).toBeUndefined()
  })

  it('setzt LE auf leMax ohne lastSafe beim Entfernen von auto-le-band', () => {
    const zones = emptyZones()
    const s = snap({ le: '3', leMax: '40', hitZones: { notiz: '', zones: zones } })
    const mods = buildHeroAutoModRecords(s, ctx)
    const m = /** @type {Record<string, unknown>} */ ({
      heroExLe: '3',
      heroExLeMax: '40',
      [HERO_EX_MODS]: mods,
    })
    applyBundleRemovalCleanup(m, 'auto-le-band', ctx)
    expect(m.heroExLe).toBe('40')
  })

  it('setzt LE aus lastSafe beim Entfernen von auto-le-unfaehig', () => {
    const zones = emptyZones()
    const s = snap({ le: '4', leMax: '40', hitZones: { notiz: '', zones: zones } })
    const mods = buildHeroAutoModRecords(s, ctx)
    const m = /** @type {Record<string, unknown>} */ ({
      heroExLe: '4',
      heroExLeMax: '40',
      [HERO_EX_LAST_SAFE_LE]: '21',
      [HERO_EX_MODS]: mods,
    })
    applyBundleRemovalCleanup(m, 'auto-le-unfaehig', ctx)
    expect(m.heroExLe).toBe('21')
    expect(m[HERO_EX_AUTO_SUPPRESSED]?.['auto-le-unfaehig']).toBeUndefined()
  })

  it('setzt LE auf leMax ohne lastSafe beim Entfernen von auto-le-unfaehig', () => {
    const zones = emptyZones()
    const s = snap({ le: '5', leMax: '40', hitZones: { notiz: '', zones: zones } })
    const mods = buildHeroAutoModRecords(s, ctx)
    const m = /** @type {Record<string, unknown>} */ ({
      heroExLe: '5',
      heroExLeMax: '40',
      [HERO_EX_MODS]: mods,
    })
    applyBundleRemovalCleanup(m, 'auto-le-unfaehig', ctx)
    expect(m.heroExLe).toBe('40')
  })

  it('reines manuelles Bündel: nur Mods, keine Nebenwirkungen', () => {
    const m = /** @type {Record<string, unknown>} */ ({
      [HERO_EX_MODS]: [
        {
          id: 'm1',
          field: 'mu',
          delta: 1,
          duration: 3,
          addedRound: 1,
          addedNavIni: Number.POSITIVE_INFINITY,
          bundleId: 'bun-manual',
        },
      ],
    })
    applyBundleRemovalCleanup(m, 'bun-manual', ctx)
    expect(m[HERO_EX_MODS]).toBeUndefined()
  })
})

describe('updateLastSafeLeIfSafe', () => {
  it('speichert LE bei Band -1', () => {
    const m = /** @type {Record<string, unknown>} */ ({
      heroExLe: '40',
      heroExLeMax: '40',
    })
    updateLastSafeLeIfSafe(m)
    expect(m[HERO_EX_LAST_SAFE_LE]).toBe('40')
  })

  it('ändert nichts bei LE im Malus-Band', () => {
    const m = /** @type {Record<string, unknown>} */ ({
      heroExLe: '1',
      heroExLeMax: '10',
      [HERO_EX_LAST_SAFE_LE]: '7',
    })
    updateLastSafeLeIfSafe(m)
    expect(m[HERO_EX_LAST_SAFE_LE]).toBe('7')
  })

  it('überschreibt lastSafe nicht beim Absinken unter 1/2', () => {
    const m = /** @type {Record<string, unknown>} */ ({
      heroExLe: '20',
      heroExLeMax: '40',
    })
    updateLastSafeLeIfSafe(m)
    expect(m[HERO_EX_LAST_SAFE_LE]).toBe('20')
    m.heroExLe = '5'
    updateLastSafeLeIfSafe(m)
    expect(m[HERO_EX_LAST_SAFE_LE]).toBe('20')
  })
})
