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
})
