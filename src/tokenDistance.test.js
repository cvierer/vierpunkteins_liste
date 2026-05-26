import { describe, expect, it } from 'vitest'
import {
  classifyDistance,
  computeSchritt,
  computeSchrittFromCenters,
  formatDistClassLabel,
  formatSchritt,
  formatSchrittWithClass,
  tokenCenter,
} from './tokenDistance.js'

describe('classifyDistance', () => {
  it('H nur bei Schritt unter 0,9 (Maßband, ohne Berührungs-Override)', () => {
    expect(classifyDistance(0)).toBe('H')
    expect(classifyDistance(0.8)).toBe('H')
    expect(classifyDistance(0.89)).toBe('H')
    expect(classifyDistance(0.8, null, { isTouching: true })).toBe('H')
    expect(classifyDistance(1, null, { isTouching: true })).toBe('N')
    expect(classifyDistance(2, null, { isTouching: true })).toBe('S')
  })

  it('ordnet Schritt-Bänder N/S/P zu', () => {
    expect(classifyDistance(0.9)).toBe('N')
    expect(classifyDistance(1)).toBe('N')
    expect(classifyDistance(1.49)).toBe('N')
    expect(classifyDistance(1.5)).toBe('S')
    expect(classifyDistance(2)).toBe('S')
    expect(classifyDistance(2.99)).toBe('S')
    expect(classifyDistance(3)).toBe('P')
    expect(classifyDistance(4.5)).toBe('P')
    expect(classifyDistance(5)).toBe('P')
    expect(classifyDistance(5.01)).toBe('')
    expect(classifyDistance(10)).toBe('')
  })

  it('nutzt Klasse X bis zur konfigurierten Grenze', () => {
    expect(classifyDistance(5.01, 6)).toBe('X')
    expect(classifyDistance(6, 6)).toBe('X')
    expect(classifyDistance(6.01, 6)).toBe('')
    expect(classifyDistance(4.5, 6)).toBe('P')
    expect(classifyDistance(5, 6)).toBe('P')
  })

  it('gibt leer bei ungueltigen Werten zurueck', () => {
    expect(classifyDistance(NaN)).toBe('')
    expect(classifyDistance(-1)).toBe('')
  })
})

describe('formatDistClassLabel', () => {
  it('setzt Klasse in Klammern', () => {
    expect(formatDistClassLabel('N')).toBe('(N)')
    expect(formatDistClassLabel('H')).toBe('(H)')
  })
})

describe('tokenCenter', () => {
  it('berechnet Mittelpunkt aus position und Groesse', () => {
    expect(tokenCenter({ position: { x: 10, y: 20 }, width: 100, height: 50 })).toEqual({
      x: 60,
      y: 45,
    })
  })

  it('defaultet fehlende Werte auf 0', () => {
    expect(tokenCenter({})).toEqual({ x: 0, y: 0 })
  })
})

describe('computeSchritt', () => {
  const dpi = 100

  it('liefert 0 fuer gleichen Punkt', () => {
    const item = { position: { x: 0, y: 0 }, width: 50, height: 50 }
    expect(computeSchritt(item, item, dpi)).toBe(0)
  })

  it('liefert 1 Schritt fuer ein Feld horizontal', () => {
    const a = { position: { x: 0, y: 0 }, width: 0, height: 0 }
    const b = { position: { x: dpi, y: 0 }, width: 0, height: 0 }
    expect(computeSchritt(a, b, dpi)).toBe(1)
  })

  it('liefert ca. 1.414 fuer diagonales Nachbarfeld', () => {
    const a = { position: { x: 0, y: 0 }, width: 0, height: 0 }
    const b = { position: { x: dpi, y: dpi }, width: 0, height: 0 }
    expect(computeSchritt(a, b, dpi)).toBeCloseTo(Math.SQRT2, 5)
  })

  it('liefert NaN bei ungueltigem dpi', () => {
    const item = { position: { x: 0, y: 0 }, width: 0, height: 0 }
    expect(computeSchritt(item, item, 0)).toBeNaN()
    expect(computeSchritt(item, item, NaN)).toBeNaN()
  })
})

describe('computeSchrittFromCenters', () => {
  it('misst Abstand zwischen zwei Mittelpunkten in Schritt', () => {
    expect(computeSchrittFromCenters({ x: 0, y: 0 }, { x: 100, y: 0 }, 100)).toBe(
      1
    )
    expect(
      computeSchrittFromCenters({ x: 0, y: 0 }, { x: 100, y: 100 }, 100)
    ).toBeCloseTo(Math.SQRT2, 5)
  })
})

describe('formatSchritt', () => {
  it('formatiert bis 5 mit einer Nachkommastelle (Komma)', () => {
    expect(formatSchritt(0)).toBe('0,0')
    expect(formatSchritt(1.45)).toBe('1,4')
    expect(formatSchritt(1.44)).toBe('1,4')
    expect(formatSchritt(5)).toBe('5,0')
    expect(formatSchritt(5.01)).toBe('5')
  })

  it('formatiert ueber 5 als ganze Schritt', () => {
    expect(formatSchritt(99.9)).toBe('100')
    expect(formatSchritt(100)).toBe('100')
    expect(formatSchritt(123.4)).toBe('123')
  })

  it('gibt leer bei NaN zurueck', () => {
    expect(formatSchritt(NaN)).toBe('')
  })
})

describe('formatSchrittWithClass', () => {
  it('haengt Klasse in Klammern an den Wert', () => {
    expect(formatSchrittWithClass(1.2)).toBe('1,2(N)')
    expect(formatSchrittWithClass(0.5)).toBe('0,5(H)')
    expect(formatSchrittWithClass(0.5, null, { isTouching: true })).toBe('0,5(H)')
    expect(formatSchrittWithClass(10)).toBe('10')
    expect(formatSchrittWithClass(5.5, 8)).toBe('6(X)')
    expect(formatSchrittWithClass(105.2, 120)).toBe('105(X)')
  })

  it('gibt leer bei NaN zurueck', () => {
    expect(formatSchrittWithClass(NaN)).toBe('')
  })
})
