import { describe, expect, it } from 'vitest'
import {
  aggregateLeBandModsByField,
  bandGaugeY,
  bandLabelTextForGauge,
  bandViewMode,
  cloneDefaultLeBandDefs,
  DEFAULT_LE_BAND_DEFS,
  defaultLeBandLabel,
  effectiveLeBandsForHero,
  HERO_EX_LE_BANDS_OVERRIDE,
  LE_BAND_MOD_FIELDS,
  leBandFieldOverridesFromDef,
  legacyTriggerSignatureForLeBand,
  matchAllStrikeSetBands,
  matchesThreshold,
  matchLeBand,
  matchLeDeltaBand,
  NEG_LE_KO_RANGE,
  normalizeLeBandDefs,
} from './leBandDefs.js'

describe('DEFAULT_LE_BAND_DEFS', () => {
  it('hat 8 Bänder in Reihenfolge schwer → mild', () => {
    expect(DEFAULT_LE_BAND_DEFS.length).toBe(8)
    expect(DEFAULT_LE_BAND_DEFS.map((d) => d.threshold.type)).toEqual([
      'negKoDepth',
      'negKoDepth',
      'negKoDepth',
      'absolute',
      'absolute',
      'fraction',
      'fraction',
      'fraction',
    ])
  })

  it('alle Default-Bänder inkl. Kampfunfähig (LE≤5) sind aktiv', () => {
    expect(DEFAULT_LE_BAND_DEFS.every((d) => d.active)).toBe(true)
  })

  it('unfähig-Band (LE≤5): strike at/pa/a/fk/tp + set gs=1', () => {
    const koDef = DEFAULT_LE_BAND_DEFS.find((d) => d.id === 'le-ko')
    expect(koDef).toBeDefined()
    expect(koDef.label).toBe('unfähig')
    expect(koDef.threshold).toEqual({ type: 'absolute', value: 5 })
    const strikeFields = koDef.mods
      .filter((m) => m.op === 'strike')
      .map((m) => m.field)
      .sort()
    expect(strikeFields).toEqual(['a', 'at', 'fk', 'pa', 'tp'])
    const setMod = koDef.mods.find((m) => m.op === 'set' && m.field === 'gs')
    expect(setMod).toBeDefined()
    expect(setMod.setValue).toBe(1)
    expect(koDef.mods.some((m) => (m.op ?? 'delta') === 'delta')).toBe(false)
  })

  it('<=0-Band ist wieder rein delta-basiert (wie vor V780)', () => {
    const z = DEFAULT_LE_BAND_DEFS.find((d) => d.id === 'le-zero')
    expect(z).toBeDefined()
    expect(z.mods.some((m) => m.op === 'strike')).toBe(false)
    expect(z.mods.some((m) => m.op === 'set')).toBe(false)
    const agg = aggregateLeBandModsByField(z)
    expect(agg).toEqual({ at: -3, pa: -3, a: -3, fk: -3 })
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
  it('enthält die Standard-Mod-Felder inklusive tp', () => {
    expect(LE_BAND_MOD_FIELDS).toContain('at')
    expect(LE_BAND_MOD_FIELDS).toContain('pa')
    expect(LE_BAND_MOD_FIELDS).toContain('a')
    expect(LE_BAND_MOD_FIELDS).toContain('fk')
    expect(LE_BAND_MOD_FIELDS).toContain('tp')
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

  it('LE = 5 / 40 → Kampfunfähig (LE≤5) vor Bruch-Band <1/4', () => {
    const m = matchLeBand({ le: '5', leMax: '40' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.id).toBe('le-ko')
    expect(m.def.threshold).toEqual({ type: 'absolute', value: 5 })
  })

  it('LE = 6 / 40 → Bruch-Band <1/4 (über LE≤5-Kampfunfähig)', () => {
    const m = matchLeBand({ le: '6', leMax: '40' }, defs)
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

describe('matchLeDeltaBand', () => {
  const defs = cloneDefaultLeBandDefs()

  it('überspringt rein optisches le-ko und liefert <1/4 bei LE 5/40', () => {
    const m = matchLeDeltaBand({ le: '5', leMax: '40' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toMatchObject({ type: 'fraction', num: 1, den: 4 })
  })

  it('liefert null im sicheren Band', () => {
    expect(matchLeDeltaBand({ le: '40', leMax: '40' }, defs)).toBeNull()
  })

  it('LE 15/40 → <1/2', () => {
    const m = matchLeDeltaBand({ le: '15', leMax: '40' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.threshold).toMatchObject({ type: 'fraction', num: 1, den: 2 })
  })

  it('LE 0/40 → le-zero (Delta-Band ≤0)', () => {
    const m = matchLeDeltaBand({ le: '0', leMax: '40' }, defs)
    expect(m).not.toBeNull()
    expect(m.def.id).toBe('le-zero')
  })

  it('Bänder ohne Delta werden übersprungen', () => {
    const list = [
      {
        id: 'optical',
        active: true,
        label: '',
        tooltip: '',
        threshold: { type: 'absolute', value: 5 },
        mods: [{ field: 'at', op: 'strike' }],
      },
      {
        id: 'delta',
        active: true,
        label: '',
        tooltip: '',
        threshold: { type: 'fraction', num: 1, den: 4 },
        mods: [{ field: 'at', delta: -3 }],
      },
    ]
    const m = matchLeDeltaBand({ le: '5', leMax: '40' }, list)
    expect(m).not.toBeNull()
    expect(m.def.id).toBe('delta')
  })
})

describe('matchAllStrikeSetBands', () => {
  const defs = cloneDefaultLeBandDefs()

  it('LE 5/40 → liefert le-ko', () => {
    const matches = matchAllStrikeSetBands({ le: '5', leMax: '40' }, defs)
    const ids = matches.map((m) => m.def.id)
    expect(ids).toContain('le-ko')
  })

  it('LE 15/40 → keine Strike/Set-Bänder', () => {
    const matches = matchAllStrikeSetBands({ le: '15', leMax: '40' }, defs)
    expect(matches).toEqual([])
  })

  it('LE 0/40 → kein Strike/Set-Band (le-zero ist delta-only)', () => {
    const matches = matchAllStrikeSetBands({ le: '0', leMax: '40' }, defs)
    const ids = matches.map((m) => m.def.id)
    expect(ids).not.toContain('le-zero')
  })

  it('liefert leeres Array ohne LE/leMax', () => {
    expect(matchAllStrikeSetBands({ le: '', leMax: '40' }, defs)).toEqual([])
    expect(matchAllStrikeSetBands({ le: '5', leMax: '0' }, defs)).toEqual([])
  })

  it('inaktive Bänder werden übersprungen', () => {
    const list = [
      {
        id: 'inactive-strike',
        active: false,
        label: '',
        tooltip: '',
        threshold: { type: 'absolute', value: 5 },
        mods: [{ field: 'at', op: 'strike' }],
      },
    ]
    expect(matchAllStrikeSetBands({ le: '5', leMax: '40' }, list)).toEqual([])
  })
})

describe('normalizeLeBandDefs', () => {
  it('leere/ungültige Eingaben liefern Defaults', () => {
    expect(normalizeLeBandDefs(null)).toEqual(cloneDefaultLeBandDefs())
    expect(normalizeLeBandDefs([])).toEqual(cloneDefaultLeBandDefs())
    expect(normalizeLeBandDefs('foo')).toEqual(cloneDefaultLeBandDefs())
  })

  it('reicht max 16 Einträge durch (zzgl. evtl. injiziertes le-ko)', () => {
    const big = Array.from({ length: 24 }, (_, i) => ({
      id: `b${i}`,
      threshold: { type: 'fraction', num: 1, den: 2 + (i % 5) },
      mods: [{ field: 'at', delta: -1 }],
    }))
    const res = normalizeLeBandDefs(big)
    /* slice(0,16) → 16 Einträge, plus 1 injiziertes le-ko (kein Doppel,
       weil keiner der `b*`-Einträge id le-ko oder absolute=5 trägt). */
    expect(res.length).toBe(17)
    expect(res.filter((b) => /^b\d+$/.test(b.id))).toHaveLength(16)
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
    const sameLike = res.filter((b) => b.id.startsWith('same'))
    expect(new Set(sameLike.map((d) => d.id)).size).toBe(2)
  })

  it('Reihenfolge der Eingabe bleibt erhalten (relativ; le-ko wird vor erstem fraction injiziert)', () => {
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
    const idxMild = res.findIndex((b) => b.id === 'mild')
    const idxHard = res.findIndex((b) => b.id === 'hard')
    const idxKo = res.findIndex((b) => b.id === 'le-ko')
    expect(idxMild).toBeGreaterThanOrEqual(0)
    expect(idxHard).toBeGreaterThanOrEqual(0)
    expect(idxKo).toBeGreaterThanOrEqual(0)
    expect(idxKo).toBeLessThan(idxMild)
    expect(idxMild).toBeLessThan(idxHard)
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
    const b = res.find((x) => x.id === 'b')
    expect(b).toBeDefined()
    expect(b.mods).toHaveLength(1)
    expect(b.mods[0]).toMatchObject({ field: 'at', delta: -1 })
  })

  it('Migration: persistierte Liste ohne le-ko bekommt Default le-ko vor erstem fraction-Band injiziert', () => {
    const persisted = [
      {
        id: 'le-zero',
        threshold: { type: 'absolute', value: 0 },
        mods: [{ field: 'at', delta: -3 }],
      },
      {
        id: 'le-half',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
    ]
    const res = normalizeLeBandDefs(persisted)
    const idxKo = res.findIndex((b) => b.id === 'le-ko')
    expect(idxKo).toBeGreaterThanOrEqual(0)
    const idxFraction = res.findIndex((b) => b.threshold.type === 'fraction')
    expect(idxKo).toBeLessThan(idxFraction)
    const koDef = res[idxKo]
    expect(koDef.threshold).toEqual({ type: 'absolute', value: 5 })
    expect(koDef.label).toBe('unfähig')
  })

  it('Migration: bestehendes le-ko bleibt unverändert (kein Doppel-Inject)', () => {
    const persisted = [
      {
        id: 'le-ko',
        threshold: { type: 'absolute', value: 5 },
        mods: [{ field: 'at', op: 'strike' }],
        label: 'mein-unfähig',
      },
      {
        id: 'le-half',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
    ]
    const res = normalizeLeBandDefs(persisted)
    const koEntries = res.filter((b) => b.id === 'le-ko')
    expect(koEntries).toHaveLength(1)
    expect(koEntries[0].label).toBe('mein-unfähig')
  })

  it('Migration: bestehendes absolute-Band mit value=5 verhindert Doppel-Inject', () => {
    const persisted = [
      {
        id: 'eigenes-band',
        threshold: { type: 'absolute', value: 5 },
        mods: [{ field: 'at', delta: -2 }],
      },
      {
        id: 'le-half',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
    ]
    const res = normalizeLeBandDefs(persisted)
    expect(res.find((b) => b.id === 'le-ko')).toBeUndefined()
    expect(
      res.filter(
        (b) => b.threshold.type === 'absolute' && b.threshold.value === 5,
      ),
    ).toHaveLength(1)
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
    expect(res.find((b) => b.id === 'bad')).toBeUndefined()
    expect(res.find((b) => b.id === 'good')).toBeDefined()
  })
})

describe('effectiveLeBandsForHero', () => {
  it('ohne Override: Raum-Default (Migration injiziert le-ko)', () => {
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
    expect(eff.find((b) => b.id === 'r')).toBeDefined()
    expect(eff.find((b) => b.id === 'le-ko')).toBeDefined()
    const idxKo = eff.findIndex((b) => b.id === 'le-ko')
    const idxR = eff.findIndex((b) => b.id === 'r')
    expect(idxKo).toBeLessThan(idxR)
  })

  it('ohne Override und ohne Raum: Default-Set', () => {
    const eff = effectiveLeBandsForHero(undefined, undefined)
    expect(eff.length).toBe(DEFAULT_LE_BAND_DEFS.length)
  })

  it('Override schlägt Raum-Default (Migration injiziert le-ko in Override)', () => {
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
    expect(eff.find((b) => b.id === 'mine')).toBeDefined()
    expect(eff.find((b) => b.id === 'le-ko')).toBeDefined()
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

  it('Override + legacy: Override gewinnt, plus le-ko-Migration und legacy-Band', () => {
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
    expect(eff.find((b) => b.id === 'only')).toBeDefined()
    expect(eff.find((b) => b.id === 'le-ko')).toBeDefined()
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

describe('bandViewMode', () => {
  it('LE > 0 → positive', () => {
    expect(bandViewMode(10, 30, 12)).toBe('positive')
    expect(bandViewMode(1, 30, null)).toBe('positive')
  })

  it('LE <= 0 mit gültiger KO → negLe', () => {
    expect(bandViewMode(0, 30, 12)).toBe('negLe')
    expect(bandViewMode(-5, 30, 12)).toBe('negLe')
  })

  it('LE <= 0 ohne KO → dead', () => {
    expect(bandViewMode(0, 30, null)).toBe('dead')
    expect(bandViewMode(-3, 30, 0)).toBe('dead')
  })

  it('LE unbekannt → idle', () => {
    expect(bandViewMode(null, 30, 12)).toBe('idle')
    expect(bandViewMode(undefined, 30, 12)).toBe('idle')
  })
})

describe('bandGaugeY', () => {
  it('Bruch im positiven Modus → num/den * 100', () => {
    const half = bandGaugeY(
      { threshold: { type: 'fraction', num: 1, den: 2 } },
      { leMax: 30, ko: 12, mode: 'positive' }
    )
    expect(half).toEqual({ y: 50, mode: 'positive' })
    const quarter = bandGaugeY(
      { threshold: { type: 'fraction', num: 1, den: 4 } },
      { leMax: 30, ko: 12, mode: 'positive' }
    )
    expect(quarter).toEqual({ y: 25, mode: 'positive' })
  })

  it('absolute im positiven Modus → value/leMax * 100', () => {
    const r = bandGaugeY(
      { threshold: { type: 'absolute', value: 5 } },
      { leMax: 30, ko: 12, mode: 'positive' }
    )
    expect(r?.mode).toBe('positive')
    expect(r?.y).toBeCloseTo(16.666_67, 4)
  })

  it('absolute ≥ leMax oder ≤ 0 → null (positiv)', () => {
    expect(
      bandGaugeY(
        { threshold: { type: 'absolute', value: 30 } },
        { leMax: 30, mode: 'positive' }
      )
    ).toBe(null)
    expect(
      bandGaugeY(
        { threshold: { type: 'absolute', value: 99 } },
        { leMax: 30, mode: 'positive' }
      )
    ).toBe(null)
    expect(
      bandGaugeY(
        { threshold: { type: 'absolute', value: 0 } },
        { leMax: 30, mode: 'positive' }
      )
    ).toBe(null)
  })

  it('negKoDepth im negLe-Modus → 100 - factor/range*100', () => {
    const r = bandGaugeY(
      { threshold: { type: 'negKoDepth', factor: 1.0 } },
      { leMax: 30, ko: 12, mode: 'negLe' }
    )
    expect(r?.mode).toBe('negKo')
    expect(r?.y).toBeCloseTo(100 - (1 / NEG_LE_KO_RANGE) * 100, 4)
    expect(r?.y).toBeCloseTo(37.5, 3)
  })

  it('negKoDepth Faktor außerhalb Skala → null', () => {
    expect(
      bandGaugeY(
        { threshold: { type: 'negKoDepth', factor: NEG_LE_KO_RANGE } },
        { ko: 12, mode: 'negLe' }
      )
    ).toBe(null)
    expect(
      bandGaugeY(
        { threshold: { type: 'negKoDepth', factor: 0 } },
        { ko: 12, mode: 'negLe' }
      )
    ).toBe(null)
  })

  it('falscher Modus → null', () => {
    expect(
      bandGaugeY(
        { threshold: { type: 'fraction', num: 1, den: 2 } },
        { leMax: 30, mode: 'negLe' }
      )
    ).toBe(null)
    expect(
      bandGaugeY(
        { threshold: { type: 'negKoDepth', factor: 1 } },
        { ko: 12, mode: 'positive' }
      )
    ).toBe(null)
    expect(
      bandGaugeY(
        { threshold: { type: 'absolute', value: 5 } },
        { leMax: 30, mode: 'negLe' }
      )
    ).toBe(null)
  })

  it('absolute ohne leMax → null', () => {
    expect(
      bandGaugeY(
        { threshold: { type: 'absolute', value: 5 } },
        { mode: 'positive' }
      )
    ).toBe(null)
  })
})

describe('bandLabelTextForGauge', () => {
  it('Bruch mit leMax → "n/d = round(leMax*n/d)"', () => {
    const r = bandLabelTextForGauge(
      { threshold: { type: 'fraction', num: 1, den: 2 } },
      { leMax: 30 }
    )
    expect(r).toEqual({ text: '1/2 = 15', value: 15 })
  })

  it('Bruch ohne leMax → "n/d = —"', () => {
    const r = bandLabelTextForGauge(
      { threshold: { type: 'fraction', num: 1, den: 4 } },
      {}
    )
    expect(r).toEqual({ text: '1/4 = —', value: null })
  })

  it('absolute → "<=value"', () => {
    expect(
      bandLabelTextForGauge({ threshold: { type: 'absolute', value: 5 } }, {})
    ).toEqual({ text: '<=5', value: 5 })
    expect(
      bandLabelTextForGauge({ threshold: { type: 'absolute', value: 0 } }, {})
    ).toEqual({ text: '<=0', value: 0 })
  })

  it('negKoDepth mit ko → "<-KO (n)"', () => {
    const r = bandLabelTextForGauge(
      { label: '', threshold: { type: 'negKoDepth', factor: 1.0 } },
      { ko: 12 }
    )
    expect(r).toEqual({ text: '<-KO (12)', value: 12 })
  })

  it('negKoDepth ohne ko → reines Label', () => {
    const r = bandLabelTextForGauge(
      { label: '', threshold: { type: 'negKoDepth', factor: 0.5 } },
      {}
    )
    expect(r).toEqual({ text: '<-1/2KO', value: null })
  })

  it('benutzerdefiniertes def.label gewinnt bei negKoDepth', () => {
    const r = bandLabelTextForGauge(
      { label: 'Halb-KO', threshold: { type: 'negKoDepth', factor: 0.5 } },
      { ko: 14 }
    )
    expect(r).toEqual({ text: 'Halb-KO (7)', value: 7 })
  })
})

describe('matchesThreshold (export)', () => {
  it('Fraktion vergleicht le*den < leMax*num', () => {
    expect(
      matchesThreshold({ type: 'fraction', num: 1, den: 2 }, 14, 30, null)
    ).toBe(true)
    expect(
      matchesThreshold({ type: 'fraction', num: 1, den: 2 }, 16, 30, null)
    ).toBe(false)
  })

  it('absolute prüft le <= value', () => {
    expect(matchesThreshold({ type: 'absolute', value: 5 }, 5, 30, null)).toBe(
      true
    )
    expect(matchesThreshold({ type: 'absolute', value: 5 }, 6, 30, null)).toBe(
      false
    )
  })

  it('negKoDepth prüft -le > factor*ko', () => {
    expect(
      matchesThreshold({ type: 'negKoDepth', factor: 1 }, -13, 30, 12)
    ).toBe(true)
    expect(
      matchesThreshold({ type: 'negKoDepth', factor: 1 }, -10, 30, 12)
    ).toBe(false)
  })
})

describe('LeBandMod op (delta/set/strike)', () => {
  it('normalizeLeBandDefs: op=delta ohne Angabe (Backward-Compat)', () => {
    const res = normalizeLeBandDefs([
      {
        id: 'b',
        threshold: { type: 'fraction', num: 1, den: 2 },
        mods: [{ field: 'at', delta: -1 }],
      },
    ])
    const b = res.find((x) => x.id === 'b')
    expect(b).toBeDefined()
    expect(b.mods[0]).toEqual({ field: 'at', op: 'delta', delta: -1 })
  })

  it('normalizeLeBandDefs: op=set übernimmt setValue', () => {
    const res = normalizeLeBandDefs([
      {
        id: 'absx',
        threshold: { type: 'absolute', value: 5 },
        mods: [{ field: 'gs', op: 'set', setValue: 1 }],
      },
    ])
    /* `absolute=5` verhindert die le-ko-Migration. */
    const b = res.find((x) => x.id === 'absx')
    expect(b).toBeDefined()
    expect(b.mods).toHaveLength(1)
    expect(b.mods[0]).toEqual({ field: 'gs', op: 'set', setValue: 1 })
  })

  it('normalizeLeBandDefs: op=strike braucht keinen Wert', () => {
    const res = normalizeLeBandDefs([
      {
        id: 'absx',
        threshold: { type: 'absolute', value: 5 },
        mods: [{ field: 'at', op: 'strike' }],
      },
    ])
    const b = res.find((x) => x.id === 'absx')
    expect(b).toBeDefined()
    expect(b.mods).toHaveLength(1)
    expect(b.mods[0]).toEqual({ field: 'at', op: 'strike' })
  })

  it('normalizeLeBandDefs: op=set clamped auf 0..9999', () => {
    const res = normalizeLeBandDefs([
      {
        id: 'absx',
        threshold: { type: 'absolute', value: 5 },
        mods: [
          { field: 'gs', op: 'set', setValue: -10 },
          { field: 'kk', op: 'set', setValue: 99999 },
        ],
      },
    ])
    const b = res.find((x) => x.id === 'absx')
    expect(b).toBeDefined()
    expect(b.mods[0].setValue).toBe(0)
    expect(b.mods[1].setValue).toBe(9999)
  })
})

describe('aggregateLeBandModsByField (delta-only)', () => {
  it('berücksichtigt nur op=delta, ignoriert set/strike', () => {
    const def = {
      id: 'b',
      active: true,
      label: '',
      tooltip: '',
      threshold: { type: 'absolute', value: 5 },
      mods: [
        { field: 'at', op: 'delta', delta: -1 },
        { field: 'pa', op: 'strike' },
        { field: 'gs', op: 'set', setValue: 1 },
      ],
    }
    const agg = aggregateLeBandModsByField(def)
    expect(agg).toEqual({ at: -1 })
  })
})

describe('leBandFieldOverridesFromDef', () => {
  it('liefert Strike-Felder und Set-Werte', () => {
    const def = {
      id: 'b',
      active: true,
      label: '',
      tooltip: '',
      threshold: { type: 'absolute', value: 5 },
      mods: [
        { field: 'at', op: 'strike' },
        { field: 'pa', op: 'strike' },
        { field: 'fk', op: 'strike' },
        { field: 'gs', op: 'set', setValue: 1 },
        { field: 'mu', op: 'delta', delta: -2 },
      ],
    }
    const ov = leBandFieldOverridesFromDef(def)
    expect(ov.strikeFields.sort()).toEqual(['at', 'fk', 'pa'])
    expect(ov.setValues).toEqual({ gs: 1 })
  })

  it('leeres Band → leere Listen', () => {
    expect(leBandFieldOverridesFromDef(null)).toEqual({
      strikeFields: [],
      setValues: {},
    })
    expect(leBandFieldOverridesFromDef({ mods: null })).toEqual({
      strikeFields: [],
      setValues: {},
    })
  })

  it('mehrfache Strike-Einträge auf gleichem Feld werden dedupliziert', () => {
    const def = {
      mods: [
        { field: 'at', op: 'strike' },
        { field: 'at', op: 'strike' },
      ],
    }
    expect(leBandFieldOverridesFromDef(def).strikeFields).toEqual(['at'])
  })
})
