import { describe, expect, it } from 'vitest'
import {
  classifyDistance,
  computeSchritt,
  formatSchritt,
  formatSchrittWithClass,
  tokenCenter,
} from './tokenDistance.js'

describe('classifyDistance', () => {
  it('ordnet Schwellen H/N/S/P zu', () => {
    expect(classifyDistance(0)).toBe('H')
    expect(classifyDistance(0.8)).toBe('H')
    expect(classifyDistance(0.81)).toBe('N')
    expect(classifyDistance(1.5)).toBe('N')
    expect(classifyDistance(1.51)).toBe('S')
    expect(classifyDistance(3)).toBe('S')
    expect(classifyDistance(3.01)).toBe('P')
    expect(classifyDistance(4.5)).toBe('P')
    expect(classifyDistance(4.51)).toBe('')
    expect(classifyDistance(10)).toBe('')
  })

  it('gibt leer bei ungueltigen Werten zurueck', () => {
    expect(classifyDistance(NaN)).toBe('')
    expect(classifyDistance(-1)).toBe('')
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

describe('formatSchritt', () => {
  it('formatiert mit einer Nachkommastelle und Komma', () => {
    expect(formatSchritt(0)).toBe('0,0')
    expect(formatSchritt(1.45)).toBe('1,5')
    expect(formatSchritt(1.44)).toBe('1,4')
  })

  it('gibt leer bei NaN zurueck', () => {
    expect(formatSchritt(NaN)).toBe('')
  })
})

describe('formatSchrittWithClass', () => {
  it('haengt Klasse direkt an den Wert', () => {
    expect(formatSchrittWithClass(1.2)).toBe('1,2N')
    expect(formatSchrittWithClass(0.5)).toBe('0,5H')
    expect(formatSchrittWithClass(10)).toBe('10,0')
  })

  it('gibt leer bei NaN zurueck', () => {
    expect(formatSchrittWithClass(NaN)).toBe('')
  })
})
