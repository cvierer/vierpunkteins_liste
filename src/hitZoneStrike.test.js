import { describe, expect, it } from 'vitest'
import { applyHitZoneStrikeFromSpTz, resolveTrefferZoneId } from './hitZoneStrike.js'
import { HIT_ZONE_DEFS } from './hitZoneMeta.js'

/** @returns {Record<string, { rs: string, w: number }>} */
function emptyZones() {
  return Object.fromEntries(HIT_ZONE_DEFS.map((z) => [z.id, { rs: '0', w: 0 }]))
}

/**
 * @param {Record<string, unknown>} overrides
 * @returns {Record<string, unknown>}
 */
function minimalBase(overrides = {}) {
  const zones = emptyZones()
  return {
    frontal: true,
    sp: '5',
    tz: 'BR',
    le: '20',
    leMax: '40',
    ws: '99',
    ko: '0',
    at: '10',
    pa: '10',
    a: '10',
    fk: '10',
    ib: '10',
    ge: '10',
    gs: '10',
    mu: '10',
    kl: '10',
    inn: '10',
    kk: '10',
    ff: '10',
    hitZones: { notiz: '', zones: { ...zones, brust: { rs: '2', w: 0 } } },
    ...overrides,
  }
}

describe('resolveTrefferZoneId', () => {
  it('maps W20 15–18 to brust when frontal', () => {
    expect(resolveTrefferZoneId('16', { frontal: true })).toBe('brust')
  })

  it('maps W20 15–18 to ruecken when not frontal', () => {
    expect(resolveTrefferZoneId('16', { frontal: false })).toBe('ruecken')
  })

  it('maps aliases case-insensitively', () => {
    expect(resolveTrefferZoneId('  KF ', { frontal: true })).toBe('kopf')
    expect(resolveTrefferZoneId('ba', { frontal: true })).toBe('bauch')
  })
})

describe('applyHitZoneStrikeFromSpTz', () => {
  it('returns null when SP is not a non-negative integer', () => {
    expect(applyHitZoneStrikeFromSpTz(minimalBase({ sp: '' }))).toBeNull()
    expect(applyHitZoneStrikeFromSpTz(minimalBase({ sp: 'x' }))).toBeNull()
  })

  it('subtracts RS from SP then LE without new wounds when WS blocks', () => {
    const r = applyHitZoneStrikeFromSpTz(
      minimalBase({ sp: '4', ws: '99', le: '20', leMax: '40' })
    )
    expect(r).not.toBeNull()
    expect(r.next.le).toBe('18')
    expect(r.next.hitZones.zones.brust.w).toBe(0)
    expect(r.logLines.some((l) => l.includes('SP2'))).toBe(true)
  })

  it('applies FK −2 per new wound mark and zone stage on brust', () => {
    const r = applyHitZoneStrikeFromSpTz(
      minimalBase({
        sp: '3',
        ws: '1',
        leMax: '40',
        le: '30',
        hitZones: {
          notiz: '',
          zones: { ...emptyZones(), brust: { rs: '0', w: 0 } },
        },
      })
    )
    expect(r).not.toBeNull()
    expect(r.next.hitZones.zones.brust.w).toBe(1)
    expect(r.next.fk).toBe('10')
    expect(r.next.at).toBe('10')
    expect(r.next.pa).toBe('10')
    expect(r.next.a).toBe('10')
  })

  it('lässt GS-Basis unverändert (GS-Clamp nur in Auto-Mods)', () => {
    const r = applyHitZoneStrikeFromSpTz(
      minimalBase({
        tz: 'BA',
        sp: '3',
        ws: '1',
        gs: '1',
        hitZones: {
          notiz: '',
          zones: { ...emptyZones(), bauch: { rs: '0', w: 0 } },
        },
      })
    )
    expect(r).not.toBeNull()
    expect(r.next.hitZones.zones.bauch.w).toBe(1)
    expect(r.next.gs).toBe('1')
    expect(r.logLines.some((l) => l.includes('auto-Mod'))).toBe(true)
  })

  it('ändert bei LE-Schwelle nicht die Basisfelder AT/PA/AW/FK', () => {
    const r = applyHitZoneStrikeFromSpTz(
      minimalBase({
        sp: '10',
        ws: '99',
        le: '22',
        leMax: '40',
        hitZones: {
          notiz: '',
          zones: { ...emptyZones(), brust: { rs: '0', w: 0 } },
        },
      })
    )
    expect(r).not.toBeNull()
    expect(r.next.le).toBe('12')
    expect(r.next.at).toBe('10')
    expect(r.next.pa).toBe('10')
    expect(r.next.a).toBe('10')
    expect(r.next.fk).toBe('10')
    expect(r.flashKeys).not.toContain('fk')
    expect(r.logLines.some((l) => l.includes('auto-Mod'))).toBe(true)
  })
})
