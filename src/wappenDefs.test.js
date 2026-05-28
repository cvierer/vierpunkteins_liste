import { describe, expect, it } from 'vitest'
import {
  HIT_ZONE_WOUND_ONCE_PENALTIES,
  zoneStageFromWounds,
} from './heroBlockAutoMod.js'
import { HIT_ZONE_DEFS } from './hitZoneMeta.js'
import {
  autoModDeltasForWappen,
  autoModMultiplier,
  buildTrefferzoneInputTooltip,
  cleanupOrphanHitZoneKeys,
  cloneDefaultWappenDefs,
  cloneVierbeinerWappenDefs,
  DEFAULT_VIERBEINER_DEFS,
  DEFAULT_WAPPEN_DEFS,
  effectiveWappenForHero,
  findWappenById,
  formatWappenW20RangeText,
  HERO_EX_WAPPEN_OVERRIDE,
  HERO_EX_WAPPEN_SLOT9,
  HERO_EX_WAPPEN_TEMPLATE,
  MAX_WAPPEN,
  mergeEffectiveWappenWithSlot9,
  normalizeWappenDefs,
  TZ_ZONE_INPUT_TOOLTIP_FOOTER,
  validateSlot9W20Overlap,
  validateW20Coverage,
  validateW20CoverageCore,
} from './wappenDefs.js'

describe('DEFAULT_WAPPEN_DEFS', () => {
  it('liefert genau 8 aktive Wappen mit den gleichen IDs wie HIT_ZONE_DEFS', () => {
    expect(DEFAULT_WAPPEN_DEFS.length).toBe(8)
    const ids = DEFAULT_WAPPEN_DEFS.map((d) => d.id)
    const legacyIds = HIT_ZONE_DEFS.map((z) => z.id)
    expect(ids).toEqual(legacyIds)
    expect(DEFAULT_WAPPEN_DEFS.every((d) => d.active)).toBe(true)
  })

  it('alle 1..20 W20-Werte sind eindeutig auf Default-Wappen verteilt', () => {
    const v = validateW20Coverage(DEFAULT_WAPPEN_DEFS)
    expect(v.ok).toBe(true)
    expect(v.missing).toEqual([])
    expect(v.overlaps).toEqual([])
  })

  it('reproduziert die HIT_ZONE_WOUND_ONCE_PENALTIES für jedes Default-Wappen (W=1)', () => {
    for (const z of HIT_ZONE_DEFS) {
      const def = findWappenById(DEFAULT_WAPPEN_DEFS, z.id)
      expect(def, `Wappen ${z.id} fehlt`).not.toBeNull()
      const deltas = autoModDeltasForWappen(def, 1)
      const once = HIT_ZONE_WOUND_ONCE_PENALTIES[z.id]
      for (const [field, perStage] of Object.entries(once)) {
        expect(deltas[field], `${z.id}.${field} W=1`).toBe(-perStage)
      }
    }
  })

  it('reproduziert die Stage-Multiplikation bis zur 3. Wunde', () => {
    const kopf = findWappenById(DEFAULT_WAPPEN_DEFS, 'kopf')
    expect(autoModDeltasForWappen(kopf, 1).mu).toBe(-2)
    expect(autoModDeltasForWappen(kopf, 2).mu).toBe(-4)
    expect(autoModDeltasForWappen(kopf, 3).mu).toBe(-6)
    expect(autoModDeltasForWappen(kopf, 4).mu).toBe(-6)
  })

  it('reproduziert FK-Malus −2*w für jede Default-Wunde (perWound, max 4)', () => {
    const brust = findWappenById(DEFAULT_WAPPEN_DEFS, 'brust')
    expect(autoModDeltasForWappen(brust, 1).fk).toBe(-2)
    expect(autoModDeltasForWappen(brust, 2).fk).toBe(-4)
    expect(autoModDeltasForWappen(brust, 3).fk).toBe(-6)
    expect(autoModDeltasForWappen(brust, 4).fk).toBe(-8)
  })

  it('Brust hat frontalSplit auf ruecken', () => {
    const brust = findWappenById(DEFAULT_WAPPEN_DEFS, 'brust')
    expect(brust.w20Range?.frontalSplit).toBe('ruecken')
    const ruecken = findWappenById(DEFAULT_WAPPEN_DEFS, 'ruecken')
    expect(ruecken.w20Range).toBeNull()
  })
})

describe('autoModMultiplier', () => {
  it('perStage clamped 0..3', () => {
    expect(autoModMultiplier('perStage', 0)).toBe(0)
    expect(autoModMultiplier('perStage', 1)).toBe(1)
    expect(autoModMultiplier('perStage', 3)).toBe(3)
    expect(autoModMultiplier('perStage', 4)).toBe(3)
  })

  it('perWound clamped 0..4', () => {
    expect(autoModMultiplier('perWound', 0)).toBe(0)
    expect(autoModMultiplier('perWound', 4)).toBe(4)
    expect(autoModMultiplier('perWound', 9)).toBe(4)
  })

  it('once entweder 0 oder 1', () => {
    expect(autoModMultiplier('once', 0)).toBe(0)
    expect(autoModMultiplier('once', 1)).toBe(1)
    expect(autoModMultiplier('once', 5)).toBe(1)
  })

  it('Stufenmodi sind kompatibel mit zoneStageFromWounds', () => {
    for (let w = 0; w <= 4; w++) {
      expect(autoModMultiplier('perStage', w)).toBe(zoneStageFromWounds(w))
    }
  })
})

describe('normalizeWappenDefs', () => {
  it('leere/ungültige Eingaben liefern Defaults', () => {
    expect(normalizeWappenDefs(null).length).toBe(DEFAULT_WAPPEN_DEFS.length)
    expect(normalizeWappenDefs([]).length).toBe(DEFAULT_WAPPEN_DEFS.length)
    expect(normalizeWappenDefs('foo').length).toBe(DEFAULT_WAPPEN_DEFS.length)
  })

  it('clamped abbr auf max 2 Zeichen', () => {
    const res = normalizeWappenDefs([
      { id: 'x', slot: 1, abbr: 'XYZ', label: '', tooltip: '' },
    ])
    expect(res[0].abbr).toBe('XY')
  })

  it('begrenzt auf 9 Einträge', () => {
    const big = Array.from({ length: 12 }, (_, i) => ({
      id: `w${i}`,
      slot: i + 1,
      abbr: 'AA',
    }))
    const res = normalizeWappenDefs(big)
    expect(res.length).toBe(9)
  })

  it('macht doppelte IDs eindeutig', () => {
    const res = normalizeWappenDefs([
      { id: 'kopf', slot: 1, abbr: 'A1' },
      { id: 'kopf', slot: 2, abbr: 'A2' },
    ])
    expect(new Set(res.map((d) => d.id)).size).toBe(2)
  })

  it('filtert ungültige autoMods raus', () => {
    const res = normalizeWappenDefs([
      {
        id: 'k',
        slot: 1,
        abbr: 'KK',
        autoMods: [
          { field: '', delta: -1, perStufe: 'perStage' }, // raus: kein Feld
          { field: 'mu', delta: 0, perStufe: 'perStage' }, // raus: delta 0
          { field: 'mu', delta: -2, perStufe: 'perStage' }, // bleibt
          { field: 'fk', delta: -2 }, // perStufe default perStage, bleibt
          'kein-objekt',
        ],
      },
    ])
    expect(res[0].autoMods).toHaveLength(2)
    expect(res[0].autoMods[0]).toMatchObject({ field: 'mu', delta: -2 })
  })
})

describe('validateW20Coverage', () => {
  it('erkennt Lücken', () => {
    const list = cloneDefaultWappenDefs().map((d) =>
      d.id === 'bauch' ? { ...d, active: false } : d
    )
    const v = validateW20Coverage(list)
    expect(v.ok).toBe(false)
    expect(v.missing).toEqual([7, 8])
  })

  it('erkennt Überlappungen', () => {
    const list = cloneDefaultWappenDefs()
    list.push({
      id: 'extra',
      active: true,
      slot: 8,
      abbr: 'EX',
      label: '',
      tooltip: '',
      woundTooltip: '',
      w20Range: { from: 19, to: 20, parity: 'all', frontalSplit: null },
      autoMods: [],
    })
    const v = validateW20Coverage(list)
    expect(v.ok).toBe(false)
    expect(v.overlaps.length).toBeGreaterThan(0)
    expect(v.overlaps[0].ids).toContain('kopf')
    expect(v.overlaps[0].ids).toContain('extra')
  })
})

describe('effectiveWappenForHero', () => {
  it('ohne Override: room.wappenDefs + Slot-9-Platzhalter', () => {
    const room = { wappenDefs: [{ id: 'a', slot: 1, abbr: 'AA' }] }
    const eff = effectiveWappenForHero({}, room)
    expect(eff.length).toBe(2)
    expect(eff[0].id).toBe('a')
    expect(eff[1].slot).toBe(9)
    expect(eff[1].active).toBe(false)
  })

  it('ohne Override und ohne room: Defaults + Slot 9', () => {
    const eff = effectiveWappenForHero(undefined, undefined)
    expect(eff.length).toBe(DEFAULT_WAPPEN_DEFS.length + 1)
    expect(eff.some((d) => d.slot === 9)).toBe(true)
  })

  it('mit Override-Liste im Helden-Meta + Slot 9', () => {
    const meta = {
      [HERO_EX_WAPPEN_OVERRIDE]: [
        { id: 'solo', slot: 1, abbr: 'SO' },
      ],
    }
    const eff = effectiveWappenForHero(meta, { wappenDefs: [] })
    expect(eff.length).toBe(2)
    expect(eff[0].id).toBe('solo')
    expect(eff[1].slot).toBe(9)
  })

  it('Override leer → fällt auf Raum bzw. Default zurück + Slot 9', () => {
    const meta = { [HERO_EX_WAPPEN_OVERRIDE]: [] }
    const eff = effectiveWappenForHero(meta, undefined)
    expect(eff.length).toBe(DEFAULT_WAPPEN_DEFS.length + 1)
  })

  it('Template "vierbeiner" liefert die Vierbeiner-Vorlage + Slot 9', () => {
    const meta = { [HERO_EX_WAPPEN_TEMPLATE]: 'vierbeiner' }
    const eff = effectiveWappenForHero(meta, {
      wappenDefs: cloneDefaultWappenDefs(),
    })
    expect(eff.length).toBe(DEFAULT_VIERBEINER_DEFS.length + 1)
    expect(eff.slice(0, 4).map((d) => d.id)).toEqual([
      'kopf',
      'rumpf',
      'beine',
      'schwanz',
    ])
    expect(eff.every((d) => d.active || d.slot === 9)).toBe(true)
  })

  it('Override schlägt Template "vierbeiner" + Slot 9', () => {
    const meta = {
      [HERO_EX_WAPPEN_TEMPLATE]: 'vierbeiner',
      [HERO_EX_WAPPEN_OVERRIDE]: [{ id: 'solo', slot: 1, abbr: 'SO' }],
    }
    const eff = effectiveWappenForHero(meta, undefined)
    expect(eff.length).toBe(2)
    expect(eff[0].id).toBe('solo')
  })
})

describe('formatWappenW20RangeText', () => {
  it('formatiert Ungerade-Spanne', () => {
    expect(
      formatWappenW20RangeText({
        from: 9,
        to: 14,
        parity: 'odd',
        frontalSplit: null,
      })
    ).toBe('9, 11, 13')
  })
})

describe('buildTrefferzoneInputTooltip', () => {
  it('vierbeiner: Profil + Kopf-W20-Bereich + Footer', () => {
    const t = buildTrefferzoneInputTooltip(
      { [HERO_EX_WAPPEN_TEMPLATE]: 'vierbeiner' },
      {}
    )
    expect(t).toContain('Vierbeiner')
    expect(t).toMatch(/17[–-]19/)
    expect(t).toContain(TZ_ZONE_INPUT_TOOLTIP_FOOTER)
  })

  it('Default Mensch ohne Abweichung: kein Trefferprofil, aber Kopf/Zahl', () => {
    const t = buildTrefferzoneInputTooltip({}, undefined)
    expect(t).not.toContain('Vierbeiner')
    expect(t).not.toContain('individuelle')
    expect(t).not.toContain('Raum-Vorgabe')
    expect(t).toContain('KF')
    expect(t).toMatch(/19[–-]20/)
    expect(t).toContain(TZ_ZONE_INPUT_TOOLTIP_FOOTER)
  })

  it('Held-Override: Profil Hinweis', () => {
    const t = buildTrefferzoneInputTooltip(
      {
        [HERO_EX_WAPPEN_OVERRIDE]: [
          {
            id: 'solo',
            slot: 1,
            abbr: 'SO',
            label: 'Solo',
            tooltip: '',
            woundTooltip: '',
            active: true,
            w20Range: {
              from: 20,
              to: 20,
              parity: 'all',
              frontalSplit: null,
            },
            autoMods: [],
          },
        ],
      },
      {}
    )
    expect(t).toContain('individuelle')
    expect(t).toContain('SO')
    expect(t).toContain('20')
  })
})

describe('DEFAULT_VIERBEINER_DEFS', () => {
  it('deckt W20 1–20 lückenlos und überschneidungsfrei ab', () => {
    const v = validateW20Coverage(DEFAULT_VIERBEINER_DEFS)
    expect(v.ok).toBe(true)
    expect(v.missing).toEqual([])
    expect(v.overlaps).toEqual([])
  })

  it('hat genau vier aktive Slots in Reihenfolge KF/RU/BE/SW auf 5–8', () => {
    expect(DEFAULT_VIERBEINER_DEFS.length).toBe(4)
    expect(DEFAULT_VIERBEINER_DEFS.map((d) => d.id)).toEqual([
      'kopf',
      'rumpf',
      'beine',
      'schwanz',
    ])
    expect(DEFAULT_VIERBEINER_DEFS.map((d) => d.abbr)).toEqual([
      'KF',
      'RU',
      'BE',
      'SW',
    ])
    expect(DEFAULT_VIERBEINER_DEFS.map((d) => d.slot)).toEqual([5, 6, 7, 8])
    expect(DEFAULT_VIERBEINER_DEFS.every((d) => d.active)).toBe(true)
  })

  it('Auto-Mods entsprechen der Spec (Schwanz ohne Mods)', () => {
    const list = cloneVierbeinerWappenDefs()
    const rumpf = findWappenById(list, 'rumpf')
    const dRumpf = autoModDeltasForWappen(rumpf, 1)
    expect(dRumpf).toEqual({ at: -1, pa: -1, ko: -1, kk: -1 })

    const beine = findWappenById(list, 'beine')
    expect(autoModDeltasForWappen(beine, 1)).toEqual({
      at: -2,
      pa: -2,
      ge: -2,
      gs: -2,
    })

    const kopf = findWappenById(list, 'kopf')
    expect(autoModDeltasForWappen(kopf, 1)).toEqual({
      at: -2,
      pa: -2,
      ib: -2,
    })

    const schwanz = findWappenById(list, 'schwanz')
    expect(autoModDeltasForWappen(schwanz, 1)).toEqual({})
    expect(autoModDeltasForWappen(schwanz, 3)).toEqual({})
  })
})

describe('cleanupOrphanHitZoneKeys', () => {
  it('entfernt hz<id>Rs/W für IDs außerhalb der effektiven Wappen-Liste', () => {
    const meta = {
      hzKopfRs: '4',
      hzKopfW: 1,
      hzObsoleteRs: '3',
      hzObsoleteW: 2,
      hzKampfnotiz: 'Notiz bleibt',
      anderesFeld: 'bleibt',
    }
    const removed = cleanupOrphanHitZoneKeys(meta, undefined)
    expect(removed).toBe(2)
    expect(meta.hzKopfRs).toBe('4')
    expect(meta.hzKopfW).toBe(1)
    expect(meta.hzObsoleteRs).toBeUndefined()
    expect(meta.hzObsoleteW).toBeUndefined()
    expect(meta.hzKampfnotiz).toBe('Notiz bleibt')
    expect(meta.anderesFeld).toBe('bleibt')
  })

  it('respektiert Held-Override-Liste', () => {
    const meta = {
      [HERO_EX_WAPPEN_OVERRIDE]: [{ id: 'solo', slot: 1, abbr: 'SO' }],
      hzSoloRs: '5',
      hzKopfRs: '4',
    }
    cleanupOrphanHitZoneKeys(meta, undefined)
    expect(meta.hzSoloRs).toBe('5')
    expect(meta.hzKopfRs).toBeUndefined()
  })

  it('berücksichtigt auch inaktive Wappen (Daten bleiben erhalten)', () => {
    const room = {
      wappenDefs: cloneDefaultWappenDefs().map((d) =>
        d.id === 'bauch' ? { ...d, active: false } : d
      ),
    }
    const meta = { hzBauchRs: '2', hzBauchW: 1 }
    const removed = cleanupOrphanHitZoneKeys(meta, room)
    expect(removed).toBe(0)
    expect(meta.hzBauchRs).toBe('2')
    expect(meta.hzBauchW).toBe(1)
  })

  it('lässt nicht-Wappen hz-Keys unangetastet', () => {
    const meta = {
      hzKampfnotiz: 'X',
      hzAnyOtherKey: 'Y',
      hzFooBaz: 'Z',
    }
    const removed = cleanupOrphanHitZoneKeys(meta, undefined)
    expect(removed).toBe(0)
    expect(meta.hzKampfnotiz).toBe('X')
    expect(meta.hzAnyOtherKey).toBe('Y')
    expect(meta.hzFooBaz).toBe('Z')
  })
})

describe('Slot 9 (optionale Trefferzone)', () => {
  it('MAX_WAPPEN ist 9', () => {
    expect(MAX_WAPPEN).toBe(9)
  })

  it('effectiveWappenForHero ergänzt inaktiven Slot-9-Platzhalter', () => {
    const list = effectiveWappenForHero({}, {})
    expect(list.some((d) => d.slot === 9)).toBe(true)
    const slot9 = list.find((d) => d.slot === 9)
    expect(slot9?.abbr).toBe('SW')
    expect(slot9?.active).toBe(false)
  })

  it('mergeEffectiveWappenWithSlot9 übernimmt heroExWappenSlot9', () => {
    const base = cloneDefaultWappenDefs()
    const merged = mergeEffectiveWappenWithSlot9(base, {
      id: 'extra',
      slot: 9,
      abbr: 'X9',
      label: 'Extra',
      active: true,
      w20Range: null,
      autoMods: [],
    })
    const slot9 = merged.find((d) => d.slot === 9)
    expect(slot9?.active).toBe(true)
    expect(slot9?.abbr).toBe('X9')
  })

  it('validateW20CoverageCore prüft nur Slots 1–8', () => {
    const core = validateW20CoverageCore(DEFAULT_WAPPEN_DEFS)
    expect(core.ok).toBe(true)
  })

  it('validateSlot9W20Overlap meldet Überlappung mit Kernzonen', () => {
    const defs = [
      ...cloneDefaultWappenDefs(),
      {
        id: 'slot9',
        slot: 9,
        abbr: 'S9',
        label: 'Neun',
        active: true,
        tooltip: '',
        woundTooltip: '',
        w20Range: { from: 20, to: 20, parity: 'all', frontalSplit: null },
        autoMods: [],
      },
    ]
    const ov = validateSlot9W20Overlap(defs)
    expect(ov.ok).toBe(false)
    expect(ov.overlaps).toContain(20)
  })

  it('effectiveWappenForHero liest heroExWappenSlot9', () => {
    const list = effectiveWappenForHero(
      {
        [HERO_EX_WAPPEN_SLOT9]: {
          id: 'schmerz',
          slot: 9,
          abbr: 'SW',
          label: 'Schmerz',
          active: true,
          autoMods: [],
        },
      },
      {}
    )
    const slot9 = list.find((d) => d.slot === 9)
    expect(slot9?.active).toBe(true)
    expect(slot9?.id).toBe('schmerz')
  })
})
