/**
 * Kontrakttest: Listen-Flush vor Remount nutzt ein stabiles Symbol auf dem Panel-Body.
 */
import { describe, expect, it } from 'vitest'
import { HERO_EXPAND_BODY_FLUSH } from './iniModMeta.js'

describe('HERO_EXPAND_BODY_FLUSH', () => {
  it('ist ein eindeutiges Symbol (Registrierung der Flush-Funktion pro Helden-Panel)', () => {
    expect(typeof HERO_EXPAND_BODY_FLUSH).toBe('symbol')
  })
})
