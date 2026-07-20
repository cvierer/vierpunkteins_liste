import { describe, expect, it } from 'vitest'
import {
  applyIbBeModsForIniCompute,
  computeIniFromIbBeW6,
} from './iniCompute.js'

describe('computeIniFromIbBeW6', () => {
  it('IB − BE + W6', () => {
    expect(computeIniFromIbBeW6('10', '2', '3')).toBe(11)
    expect(computeIniFromIbBeW6('10+2', '0', '1')).toBe(13)
  })
})

describe('applyIbBeModsForIniCompute', () => {
  it('zieht IB-Mod ab wie integriertes Kästchen; INI-Rechnung nutzt 8', () => {
    const adj = (_m, field) => (field === 'ib' ? -2 : 0)
    const { ib, be } = applyIbBeModsForIniCompute(
      {},
      '10',
      '0',
      12,
      1,
      Number.POSITIVE_INFINITY,
      adj
    )
    expect(ib).toBe('8')
    expect(be).toBe('0')
    expect(computeIniFromIbBeW6(ib, be, '4')).toBe(12)
  })

  it('ohne Owner-INI: Basis unverändert', () => {
    const { ib, be } = applyIbBeModsForIniCompute(
      {},
      '10',
      '1',
      null,
      1,
      Number.POSITIVE_INFINITY,
      () => -2
    )
    expect(ib).toBe('10')
    expect(be).toBe('1')
  })
})
