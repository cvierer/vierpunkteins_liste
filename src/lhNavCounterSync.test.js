import { describe, expect, it } from 'vitest'
import { LH_MAX, LH_REM } from './lhMeta.js'
import { shouldRemountLhRunningCounter } from './lhNavCounterSync.js'

describe('shouldRemountLhRunningCounter', () => {
  it('false ohne laufende L.H.', () => {
    expect(
      shouldRemountLhRunningCounter(
        { [LH_MAX]: 3, [LH_REM]: 0 },
        false
      )
    ).toBe(false)
  })

  it('false wenn readOnly-Counter bereits aktiv', () => {
    expect(
      shouldRemountLhRunningCounter(
        { [LH_MAX]: 3, [LH_REM]: 2 },
        true
      )
    ).toBe(false)
  })

  it('true nach L.H.-Start ohne readOnly-Counter (Setup-Feld)', () => {
    expect(
      shouldRemountLhRunningCounter(
        { [LH_MAX]: 3, [LH_REM]: 3 },
        false
      )
    ).toBe(true)
  })

  it('false bei max=0 auch mit rem>0', () => {
    expect(
      shouldRemountLhRunningCounter({ [LH_MAX]: 0, [LH_REM]: 1 }, false)
    ).toBe(false)
  })
})
