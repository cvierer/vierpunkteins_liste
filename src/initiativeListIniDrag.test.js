import { describe, expect, it } from 'vitest'
import {
  clampIniContinuous,
  composeProposedIniFromDragIntPart,
  formatHookDisplay,
  formatIniStorage,
  iniBaseIntFromLerp,
  intPartFromIniStr,
  parseIniNumber,
  pickNearestValidSlot,
  roundHalfUp,
} from './initiativeListIniDrag.js'

describe('parseIniNumber', () => {
  it('parst Punkt- und Komma-Dezimalzahlen', () => {
    expect(parseIniNumber('12')).toBe(12)
    expect(parseIniNumber('12,5')).toBe(12.5)
    expect(parseIniNumber('  -3.25 ')).toBe(-3.25)
  })

  it('liefert null fuer nicht-numerische Eingaben', () => {
    expect(parseIniNumber('abc')).toBeNull()
    expect(parseIniNumber('1,2,3')).toBeNull()
  })

  it('behandelt Leereingaben wie 0 (bestehendes Verhalten)', () => {
    expect(parseIniNumber('')).toBe(0)
    expect(parseIniNumber(null)).toBe(0)
  })
})

describe('roundHalfUp', () => {
  it('rundet .5 konsistent aufwaerts', () => {
    expect(roundHalfUp(2.5)).toBe(3)
    expect(roundHalfUp(3.5)).toBe(4)
    expect(roundHalfUp(-2.5)).toBe(-2)
  })

  it('liefert null fuer NaN', () => {
    expect(roundHalfUp(Number.NaN)).toBeNull()
  })
})

describe('iniBaseIntFromLerp', () => {
  it('entspricht roundHalfUp', () => {
    expect(iniBaseIntFromLerp(7.5)).toBe(8)
    expect(iniBaseIntFromLerp(7.49)).toBe(7)
  })
})

describe('clampIniContinuous', () => {
  it('reicht endliche Werte durch, sonst null', () => {
    expect(clampIniContinuous(5.5)).toBe(5.5)
    expect(clampIniContinuous(null)).toBeNull()
    expect(clampIniContinuous(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('formatIniStorage', () => {
  it('schneidet ueberfluessige Nullen ab', () => {
    expect(formatIniStorage(12)).toBe('12')
    expect(formatIniStorage(12.5)).toBe('12.5')
    expect(formatIniStorage(0)).toBe('0')
    expect(formatIniStorage(Number.NaN)).toBe('0')
  })
})

describe('formatHookDisplay', () => {
  it('liefert leeren String fuer null', () => {
    expect(formatHookDisplay(null)).toBe('')
    expect(formatHookDisplay(7)).toBe('7')
  })
})

describe('intPartFromIniStr', () => {
  it('liefert den ganzzahligen Anteil', () => {
    expect(intPartFromIniStr('12')).toBe(12)
    expect(intPartFromIniStr('12,5')).toBe(12)
  })
})

describe('composeProposedIniFromDragIntPart', () => {
  it('ersetzt den Ganzzahlanteil und behaelt den Nachkommaanteil', () => {
    expect(composeProposedIniFromDragIntPart(8, '12,5')).toBe('8.5')
    expect(composeProposedIniFromDragIntPart(3, '12')).toBe('3')
  })
})

describe('pickNearestValidSlot', () => {
  it('waehlt den naechstgelegenen gueltigen Slot', () => {
    expect(pickNearestValidSlot(2, [0, 1, 4])).toBe(1)
    expect(pickNearestValidSlot(3, [0, 2, 4])).toBe(2)
    expect(pickNearestValidSlot(0, [])).toBeNull()
  })
})
