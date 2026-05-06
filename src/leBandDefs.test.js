import { describe, expect, it } from 'vitest'
import {
  aggregateLeBandModsByField,
  cloneDefaultLeBandDefs,
  DEFAULT_LE_BAND_DEFS,
  defaultLeBandLabel,
  effectiveLeBandsForHero,
  HERO_EX_LE_BANDS_OVERRIDE,
  LE_BAND_MOD_FIELDS,
  legacyTriggerSignatureForLeBand,
  matchLeBand,
  normalizeLeBandDefs,
} from './leBandDefs.js'

describe('DEFAULT_LE_BAND_DEFS', () => {
  it('hat 7 Bänder in Reihenfolge schwer → mild', () => {
    expect(DEFAULT_LE_BAND_DEFS.length).toBe(7)
    expect(DEFAULT_LE_BAND_DEFS.map((d) => d.threshold.type)).toEqual([
      'negKoDepth',
      'negKoDepth',
      'negKoDepth',
      'absolute',
      'fraction',
      'fraction',
      'fraction',
    ])
  })

  it('alle Default-Bänder sind aktiv', () => {
    expect(DEFAULT_LE_BAND_DEFS.every((d) => d.active)).toBe(true)
  })

  it('Bruch-Bänder reproduzieren das alte Schema (-1, -2, -3)', () => {
    const half = DEFAULT_LE_BAND_DEFS.find(
      (d) =>
        d.threshold.type === 'fraction' &&
        d.threshold.num === 1 &&
        d.threshold.den === 2
    )
    expect(half).toBeDefined()
    const halfMods = aggregateLeBandModsByField(half)
    expect(halfMods.at).toBe(-1)
    expect(halfMods.pa).toBe(-1)
    expect(halfMods.a).toBe(-1)
    expect(halfMods.fk).toBe(-1)

    const third = DEFAULT_LE_BAND_DEFS.find(
      (d) =>
        d.threshold.type === 'fraction' &&
        d.threshold.num === 1 &&
        d.threshold.den === 3
    )
    const thirdMods = aggregateLeBandModsByField(third)
    expect(thirdMods.at).toBe(-2)

    const quarter = DEFAULT_LE_BAND_DEFS.find(
      (d) =>
        d.threshold.type === 'fraction' &&
        d.threshold.num === 1 &&
        d.threshold.den === 4
    )
    const quarterMods = aggregateLeBandModsByField(quarter)
    expect(quarterMods.at).toBe(-3)
  })
})

describe('LE_BAND_MOD_FIELDS', () => {
  it('enthält die Standard-Mod-Felder', () => {
    expect(LE_BAND_MOD_FIELDS).toContain('at')
    expect(LE_BAND_MOD_FIELDS).toContain('pa')
    expect(LE_BAND_MOD_FIELDS).toContain('a')
    expect(LE_BAND_MOD_FIELDS).toContain('fk')
    expect(LE_BAND_MOD_FIELDS).toContain('mu')
  })
})

describe('matchLeBand', () => {
  const defs = cloneDefaultLeBandDefs()

  it('liefert null ohne LE/leMax', () => {
    expect(matchLeBand({ le: '', leMax: '' }, defs)).toBeNull()
    expect(matchLeBand({ le: '20', leMax: '0' }, defs)).toBeNull()
  })

  it('liefert null im sicheren Band (LE ≥ 1/2 LEmax)', () => {
    expect(matchLeBand({ le: '20', leMax: '40' }, defs)).toBeNull()
    expect(matchLeBand({ le: '40', leMax: '40' }, defs)).toBeNull()
  })

  it('LE = 15 / 40 → Bruch-Band <1/2', () => {
    const m = matchLeBand({ le: '15', leMax: '40' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toMatchObject({ type: 'fraction', num: 1, den: 2 })
  })

  it('LE = 10 / 40 → Bruch-Band <1/3', () => {
    const m = matchLeBand({ le: '10', leMax: '40' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toMatchObject({ type: 'fraction', num: 1, den: 3 })
  })

  it('LE = 5 / 40 → Bruch-Band <1/4', () => {
    const m = matchLeBand({ le: '5', leMax: '40' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toMatchObject({ type: 'fraction', num: 1, den: 4 })
  })

  it('LE = 0 → absolutes Band (≤0)', () => {
    const m = matchLeBand({ le: '0', leMax: '40' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toEqual({ type: 'absolute', value: 0 })
  })

  it('LE = -3 mit KO=10 → Negativ-KO-Tiefe (depth=3 < 0,5×10=5 → ≤0)', () => {
    const m = matchLeBand({ le: '-3', leMax: '40', ko: '10' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold.type).toBe('absolute')
  })

  it('LE = -6 mit KO=10 → <-1/2KO (depth 6 > 5)', () => {
    const m = matchLeBand({ le: '-6', leMax: '40', ko: '10' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toEqual({ type: 'negKoDepth', factor: 0.5 })
  })

  it('LE = -11 mit KO=10 → <-KO (depth 11 > 10)', () => {
    const m = matchLeBand({ le: '-11', leMax: '40', ko: '10' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toEqual({ type: 'negKoDepth', factor: 1.0 })
  })

  it('LE = -16 mit KO=10 → <-1,5KO (depth 16 > 15)', () => {
    const m = matchLeBand({ le: '-16', leMax: '40', ko: '10' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toEqual({ type: 'negKoDepth', factor: 1.5 })
  })

  it('Reihenfolge entscheidet: erstes passendes Band gewinnt', () => {
    const list = [
      {
        id: 'fst',
        active: true,
        label: 'first',
        tooltip: '',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -5 }],
      },
      {
        id: 'snd',
        active: true,
        label: 'second',
        tooltip: '',
        threshold: { type: 'fraction', num: 1, den: 4 },
        mods: [{ field: 'at', delta: -3 }],
      },
    ]
    const m = matchLeBand({ le: '5', leMax: '40' }, list)
    expect(m.def.id).toBe('fst')
  })

  it('inaktive Bänder werden übersprungen', () => {
    const list = [
      {
        id: 'inactive',
        active: false,
        label: '',
        tooltip: '',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
      {
        id: 'active',
        active: true,
        label: '',
        tooltip: '',
        threshold: { type: 'fraction', num: 1, den: 3 },
        mods: [{ field: 'at', delta: -2 }],
      },
    ]
    const m = matchLeBand({ le: '15', leMax: '40' }, list)
    expect(m).toBeNull() // 15/40 ist <1/2 aber nicht <1/3
    const m2 = matchLeBand({ le: '10', leMax: '40' }, list)
    expect(m2.def.id).toBe('active')
  })
})

describe('normalizeLeBandDefs', () => {
  it('leere/ungültige Eingaben liefern Defaults', () => {
    expect(normalizeLeBandDefs(null)).toEqual(cloneDefaultLeBandDefs())
    expect(normalizeLeBandDefs([])).toEqual(cloneDefaultLeBandDefs())
    expect(normalizeLeBandDefs('foo')).toEqual(cloneDefaultLeBandDefs())
  })

  it('reicht max 16 Einträge durch', () => {
    const big = Array.from({ length: 24 }, (_, i) => ({
      id: `b${i}`,
      threshold: { type: 'fraction', num: 1, den: 2 + (i % 5) },
      mods: [{ field: 'at', delta: -1 }],
    }))
    const res = normalizeLeBandDefs(big)
    expect(res.length).toBe(16)
  })

  it('macht doppelte IDs eindeutig', () => {
    const res = normalizeLeBandDefs([
      {
        id: 'same',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
      {
        id: 'same',
        threshold: { type: 'fraction', num: 1, den: 3 },
        mods: [{ field: 'at', delta: -2 }],
      },
    ])
    expect(new Set(res.map((d) => d.id)).size).toBe(2)
  })

  it('Reihenfolge bleibt erhalten', () => {
    const res = normalizeLeBandDefs([
      {
        id: 'mild',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
      {
        id: 'hard',
        threshold: { type: 'absolute', value: 0 },
        mods: [{ field: 'at', delta: -3 }],
      },
    ])
    expect(res[0].id).toBe('mild')
    expect(res[1].id).toBe('hard')
  })

  it('filtert ungültige Mods raus (delta=0, ohne Feld)', () => {
    const res = normalizeLeBandDefs([
      {
        id: 'b',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [
          { field: '', delta: -1 },
          { field: 'at', delta: 0 },
          { field: 'at', delta: -1 },
        ],
      },
    ])
    expect(res[0].mods).toHaveLength(1)
    expect(res[0].mods[0]).toMatchObject({ field: 'at', delta: -1 })
  })

  it('filtert Bänder mit ungültiger Schwelle (z. B. fraction num >= den)', () => {
    const res = normalizeLeBandDefs([
      {
        id: 'bad',
        threshold: { type: 'fraction', num: 3, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
      {
        id: 'good',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
    ])
    expect(res.length).toBe(1)
    expect(res[0].id).toBe('good')
  })
})

describe('effectiveLeBandsForHero', () => {
  it('ohne Override: Raum-Default', () => {
    const customRoom = {
      leBandDefs: [
        {
          id: 'r',
          threshold: { type: 'fraction', num: 1, den: 2 },
          mods: [{ field: 'at', delta: -1 }],
        },
      ],
    }
    const eff = effectiveLeBandsForHero({}, customRoom)
    expect(eff.length).toBe(1)
    expect(eff[0].id).toBe('r')
  })

  it('ohne Override und ohne Raum: Default-Set', () => {
    const eff = effectiveLeBandsForHero(undefined, undefined)
    expect(eff.length).toBe(DEFAULT_LE_BAND_DEFS.length)
  })

  it('Override schlägt Raum-Default', () => {
    const meta = {
      [HERO_EX_LE_BANDS_OVERRIDE]: [
        {
          id: 'mine',
          threshold: { type: 'fraction', num: 1, den: 5 },
          mods: [{ field: 'at', delta: -7 }],
        },
      ],
    }
    const eff = effectiveLeBandsForHero(meta, {
      leBandDefs: cloneDefaultLeBandDefs(),
    })
    expect(eff.length).toBe(1)
    expect(eff[0].id).toBe('mine')
  })

  it('legacy heroExLeThreshold injiziert ein zusätzliches absolute-Band', () => {
    const meta = { heroExLeThreshold: '5' }
    const eff = effectiveLeBandsForHero(meta, undefined)
    const legacyBand = eff.find((b) => b.id === 'legacy-le-threshold')
    expect(legacyBand).toBeDefined()
    expect(legacyBand.threshold).toEqual({ type: 'absolute', value: 5 })
    // Eingefügt vor den Bruch-Bändern, hinter dem ≤0-Band
    const idxLegacy = eff.findIndex((b) => b.id === 'legacy-le-threshold')
    const idxFraction = eff.findIndex((b) => b.threshold.type === 'fraction')
    expect(idxLegacy).toBeLessThan(idxFraction)
  })

  it('legacy heroExLeThreshold = 0 / off / leer ändert nichts', () => {
    const e1 = effectiveLeBandsForHero({ heroExLeThreshold: '0' }, undefined)
    expect(e1.find((b) => b.id === 'legacy-le-threshold')).toBeUndefined()
    const e2 = effectiveLeBandsForHero({ heroExLeThreshold: 'off' }, undefined)
    expect(e2.find((b) => b.id === 'legacy-le-threshold')).toBeUndefined()
    const e3 = effectiveLeBandsForHero({ heroExLeThreshold: '' }, undefined)
    expect(e3.find((b) => b.id === 'legacy-le-threshold')).toBeUndefined()
  })

  it('Override + legacy: Override gewinnt, kein synthetisches Band wenn Override gesetzt', () => {
    const meta = {
      heroExLeThreshold: '5',
      [HERO_EX_LE_BANDS_OVERRIDE]: [
        {
          id: 'only',
          threshold: { type: 'absolute', value: 3 },
          mods: [{ field: 'at', delta: -1 }],
        },
      ],
    }
    const eff = effectiveLeBandsForHero(meta, undefined)
    // Override hat 1 Eintrag, plus injiziertes Legacy-Band (vor fraction; aber es gibt kein fraction → wird angefügt)
    expect(eff.length).toBe(2)
    expect(eff.find((b) => b.id === 'legacy-le-threshold')).toBeDefined()
  })
})

describe('legacyTriggerSignatureForLeBand', () => {
  it('Bruch-Bänder bilden auf 0/1/2 ab', () => {
    expect(
      legacyTriggerSignatureForLeBand({
        threshold: { type: 'fraction', num: 1, den: 2 },
      })
    ).toBe(0)
    expect(
      legacyTriggerSignatureForLeBand({
        threshold: { type: 'fraction', num: 1, den: 3 },
      })
    ).toBe(1)
    expect(
      legacyTriggerSignatureForLeBand({
        threshold: { type: 'fraction', num: 1, den: 4 },
      })
    ).toBe(2)
  })

  it('absolute > 0 bildet auf 3 ab; absolute 0 auf 400', () => {
    expect(
      legacyTriggerSignatureForLeBand({
        threshold: { type: 'absolute', value: 5 },
      })
    ).toBe(3)
    expect(
      legacyTriggerSignatureForLeBand({
        threshold: { type: 'absolute', value: 0 },
      })
    ).toBe(400)
  })

  it('negKoDepth bildet auf 401/402/403 ab', () => {
    expect(
      legacyTriggerSignatureForLeBand({
        threshold: { type: 'negKoDepth', factor: 0.5 },
      })
    ).toBe(401)
    expect(
      legacyTriggerSignatureForLeBand({
        threshold: { type: 'negKoDepth', factor: 1.0 },
      })
    ).toBe(402)
    expect(
      legacyTriggerSignatureForLeBand({
        threshold: { type: 'negKoDepth', factor: 1.5 },
      })
    ).toBe(403)
  })
})

describe('defaultLeBandLabel', () => {
  it('verwendet def.label, wenn gesetzt', () => {
    expect(defaultLeBandLabel({ label: 'Mein Band', threshold: null })).toBe(
      'Mein Band'
    )
  })

  it('Fraktion → <num/den', () => {
    expect(
      defaultLeBandLabel({
        label: '',
        threshold: { type: 'fraction', num: 1, den: 4 },
      })
    ).toBe('<1/4')
  })

  it('absolute → <=value', () => {
    expect(
      defaultLeBandLabel({
        label: '',
        threshold: { type: 'absolute', value: 0 },
      })
    ).toBe('<=0')
    expect(
      defaultLeBandLabel({
        label: '',
        threshold: { type: 'absolute', value: 5 },
      })
    ).toBe('<=5')
  })

  it('negKoDepth → bekannte Faktoren liefern stabile Labels', () => {
    expect(
      defaultLeBandLabel({
        label: '',
        threshold: { type: 'negKoDepth', factor: 0.5 },
      })
    ).toBe('<-1/2KO')
    expect(
      defaultLeBandLabel({
        label: '',
        threshold: { type: 'negKoDepth', factor: 1.0 },
      })
    ).toBe('<-KO')
    expect(
      defaultLeBandLabel({
        label: '',
        threshold: { type: 'negKoDepth', factor: 1.5 },
      })
    ).toBe('<-1,5KO')
  })
})
