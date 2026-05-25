import { describe, expect, it } from 'vitest'
import { normalizeActionStamps, normalizeCombat } from './combatRoom.js'

describe('normalizeCombat', () => {
  it('normalisiert currentTurnSubStep', () => {
    expect(normalizeCombat({ currentTurnSubStep: 'action' }).currentTurnSubStep).toBe(
      'action'
    )
    expect(
      normalizeCombat({ currentTurnSubStep: 'reaction' }).currentTurnSubStep
    ).toBe('reaction')
    expect(normalizeCombat({ currentTurnSubStep: 'x' }).currentTurnSubStep).toBeNull()
  })
})

describe('normalizeActionStamps', () => {
  it('liefert leere Struktur bei null/undefined', () => {
    expect(normalizeActionStamps(null)).toEqual({ anchorId: null, entries: [] })
    expect(normalizeActionStamps(undefined)).toEqual({
      anchorId: null,
      entries: [],
    })
  })

  it('verwirft ungültige Einträge ohne id/itemId/field', () => {
    const out = normalizeActionStamps({
      anchorId: 'a1',
      entries: [
        { id: 's1', itemId: 'i1', field: 'ang' },
        { id: 's2' /* itemId fehlt */, field: 'ang' },
        null,
        'kein-objekt',
      ],
    })
    expect(out.anchorId).toBe('a1')
    expect(out.entries).toHaveLength(1)
    expect(out.entries[0]).toMatchObject({ id: 's1', itemId: 'i1', field: 'ang' })
  })

  it('default-Felder bleiben false / undefined wenn nicht gesetzt', () => {
    const out = normalizeActionStamps({
      entries: [{ id: 's1', itemId: 'i1', field: 'abw' }],
    })
    const e = out.entries[0]
    expect(e.paradeExtra).toBe(false)
    expect(e.abwFromSplit).toBe(false)
    expect(e.heroExtraStamp).toBe(false)
    expect(e.paradeExtraSlot).toBeUndefined()
    expect(e.ownerName).toBe('')
  })

  it('paradeExtraSlot wird nur bei paradeExtra=true übernommen', () => {
    const a = normalizeActionStamps({
      entries: [
        {
          id: 's1',
          itemId: 'i1',
          field: 'abw',
          paradeExtra: true,
          paradeExtraSlot: 2,
        },
      ],
    })
    expect(a.entries[0].paradeExtraSlot).toBe(2)

    const b = normalizeActionStamps({
      entries: [
        { id: 's1', itemId: 'i1', field: 'abw', paradeExtraSlot: 2 },
      ],
    })
    expect(b.entries[0].paradeExtraSlot).toBeUndefined()
  })
})
