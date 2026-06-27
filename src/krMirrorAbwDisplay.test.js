import { describe, expect, it } from 'vitest'
import {
  abwShieldCountFromKrValue,
  isMirrorAbwUiActive,
  resolveMirrorAbwKrValue,
} from './krMirrorAbwDisplay.js'

describe('resolveMirrorAbwKrValue', () => {
  it('inaktiver Spiegel (marks=0) liefert 1 → keine Schild-Icons', () => {
    const v = resolveMirrorAbwKrValue(
      true,
      { kind: 'uo', marks: 0 },
      0
    )
    expect(v).toBe(1)
    expect(abwShieldCountFromKrValue(v)).toBe(0)
  })

  it('aktiver Spiegel (marks=1) übernimmt Mutter-krAbw', () => {
    expect(resolveMirrorAbwKrValue(true, { kind: 'ang', marks: 1 }, 0)).toBe(0)
    expect(abwShieldCountFromKrValue(0)).toBe(1)
  })

  it('ohne Spiegel-UI immer Mutter-wert', () => {
    expect(resolveMirrorAbwKrValue(false, { marks: 0 }, 2)).toBe(2)
  })
})

describe('isMirrorAbwUiActive', () => {
  it('Spiegel nur bei marks===1', () => {
    expect(isMirrorAbwUiActive(true, { marks: 1 })).toBe(true)
    expect(isMirrorAbwUiActive(true, { marks: 0 })).toBe(false)
    expect(isMirrorAbwUiActive(true, null)).toBe(false)
  })

  it('Kampfstart-Default uo/lodgedAbw (marks:0) -> Spiegel inaktiv -> Schilde NICHT auf 2.AO-Zeile', () => {
    // Nach L.H.-Ablauf soll das 2.AO den Kampfstart-Default haben.
    // marks:0 haelt den Spiegel inaktiv -> Schilde bleiben am Mutterobjekt.
    const slot = { kind: 'uo', marks: 0, lodgedAbw: true }
    expect(isMirrorAbwUiActive(true, slot)).toBe(false)
    expect(resolveMirrorAbwKrValue(true, slot, 0)).toBe(1) // 1 = leer, keine Schilde
  })
})
