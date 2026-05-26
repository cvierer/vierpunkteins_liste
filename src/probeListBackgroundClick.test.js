import { describe, expect, it } from 'vitest'
import { isProbePointerFromListRows } from './probeListBackgroundClick.js'

describe('isProbePointerFromListRows', () => {
  it('true fuer Klick auf Listen-Zeile', () => {
    const li = { tag: 'li' }
    const ul = { contains: (t) => t === li }
    expect(isProbePointerFromListRows(ul, li)).toBe(true)
  })

  it('false fuer Klick auf Scroll-Hintergrund ausserhalb ul', () => {
    const scroll = { tag: 'scroll' }
    const ul = { contains: () => false }
    expect(isProbePointerFromListRows(ul, scroll)).toBe(false)
  })

  it('false bei null target', () => {
    const ul = { contains: () => true }
    expect(isProbePointerFromListRows(ul, null)).toBe(false)
  })
})
