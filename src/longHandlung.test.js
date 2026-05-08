import { describe, expect, it } from 'vitest'
import { isRoundBoundaryMergedKind } from './longHandlung.js'

describe('isRoundBoundaryMergedKind', () => {
  it('true für KR-Grenz-Zeilen', () => {
    expect(isRoundBoundaryMergedKind('roundStart')).toBe(true)
    expect(isRoundBoundaryMergedKind('roundEnd')).toBe(true)
  })
  it('false für normale Schritte', () => {
    expect(isRoundBoundaryMergedKind('token')).toBe(false)
    expect(isRoundBoundaryMergedKind('phase')).toBe(false)
    expect(isRoundBoundaryMergedKind(undefined)).toBe(false)
  })
})
