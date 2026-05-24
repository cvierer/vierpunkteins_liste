import { describe, expect, it } from 'vitest'
import {
  classifyDistance,
  computeSchritt,
  edgeGapPx,
  formatSchritt,
  formatSchrittWithClass,
  tokenBounds,
  tokenCenter,
} from './tokenDistance.js'

describe('classifyDistance', () => {
  it('ordnet Schwellen H/N/S/P zu', () => {
    expect(classifyDistance(0)).toBe('H')
    expect(classifyDistance(0.7)).toBe('H')
    expect(classifyDistance(0.71)).toBe('N')
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

describe('tokenBounds', () => {
  const dpi = 100

  it('defaultet fehlende Groesse auf ein Schritt-Feld', () => {
    expect(tokenBounds({ position: { x: 10, y: 20 } }, dpi)).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 100,
      x2: 110,
      y2: 120,
    })
  })
})

describe('edgeGapPx', () => {
  it('liefert 0 bei Beruehrung', () => {
    const a = { x: 0, y: 0, x2: 100, y2: 100 }
    const b = { x: 100, y: 0, x2: 200, y2: 100 }
    expect(edgeGapPx(a, b)).toBe(0)
  })

  it('liefert horizontalen Abstand zwischen getrennten Kaestchen', () => {
    const a = { x: 0, y: 0, x2: 100, y2: 100 }
    const b = { x: 200, y: 0, x2: 300, y2: 100 }
    expect(edgeGapPx(a, b)).toBe(100)
  })
})

describe('computeSchritt', () => {
  const dpi = 100

  it('liefert 0 fuer ueberlappende oder beruehrende 1x1-Felder', () => {
    const a = { position: { x: 0, y: 0 }, width: dpi, height: dpi }
    const b = { position: { x: dpi, y: 0 }, width: dpi, height: dpi }
    expect(computeSchritt(a, a, dpi)).toBe(0)
    expect(computeSchritt(a, b, dpi)).toBe(0)
  })

  it('liefert 1 Schritt fuer ein leeres Feld dazwischen', () => {
    const a = { position: { x: 0, y: 0 }, width: dpi, height: dpi }
    const b = { position: { x: 2 * dpi, y: 0 }, width: dpi, height: dpi }
    expect(computeSchritt(a, b, dpi)).toBe(1)
  })

  it('liefert ca. 1.414 fuer diagonale Luecke eines Feldes', () => {
    const a = { position: { x: 0, y: 0 }, width: dpi, height: dpi }
    const b = { position: { x: 2 * dpi, y: 2 * dpi }, width: dpi, height: dpi }
    expect(computeSchritt(a, b, dpi)).toBeCloseTo(Math.SQRT2, 5)
  })

  it('liefert NaN bei ungueltigem dpi', () => {
    const item = { position: { x: 0, y: 0 }, width: dpi, height: dpi }
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
