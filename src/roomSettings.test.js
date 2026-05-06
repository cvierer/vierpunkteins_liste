import { describe, expect, it } from 'vitest'
import {
  faMaxForInitiative,
  nextConvertLockState,
} from './roomSettings.js'

describe('faMaxForInitiative', () => {
  it('liefert 2, wenn Hausregel deaktiviert ist', () => {
    expect(faMaxForInitiative('25', false)).toBe(2)
    expect(faMaxForInitiative('50', false)).toBe(2)
    expect(faMaxForInitiative('NaN', false)).toBe(2)
  })

  it('liefert 2 für nicht-numerische Eingabe trotz aktivierter Regel', () => {
    expect(faMaxForInitiative('', true)).toBe(2)
    expect(faMaxForInitiative('abc', true)).toBe(2)
  })

  it('vergibt zusätzliche F.A. erst strikt über 20/30/40', () => {
    expect(faMaxForInitiative('20', true)).toBe(2)
    expect(faMaxForInitiative('20.0001', true)).toBe(3)
    expect(faMaxForInitiative('30', true)).toBe(3)
    expect(faMaxForInitiative('30.5', true)).toBe(4)
    expect(faMaxForInitiative('40', true)).toBe(4)
    expect(faMaxForInitiative('40.5', true)).toBe(4)
  })

  it('akzeptiert Komma als Dezimaltrenner', () => {
    expect(faMaxForInitiative('20,5', true)).toBe(3)
  })
})

describe('nextConvertLockState', () => {
  it('zyklus open -> auto -> closed -> open', () => {
    expect(nextConvertLockState('open')).toBe('auto')
    expect(nextConvertLockState('auto')).toBe('closed')
    expect(nextConvertLockState('closed')).toBe('open')
  })

  it('unbekannte Werte werden auf open zurückgesetzt', () => {
    expect(nextConvertLockState('xxx')).toBe('open')
    expect(nextConvertLockState(undefined)).toBe('open')
  })
})
