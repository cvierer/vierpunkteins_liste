import { describe, expect, it } from 'vitest'
import {
  latchProbeMapDrag,
  PROBE_MAP_DRAG_MOVE_EPS,
} from './distanceProbeDrag.js'

describe('latchProbeMapDrag', () => {
  const clickRef = { x: 100, y: 100 }
  const moved = { x: 110, y: 100 }
  const jitter = { x: 100.1, y: 100.05 }

  it('ohne Referenz: keine Linie', () => {
    expect(latchProbeMapDrag(false, null, moved)).toEqual({
      mapDragging: false,
      showLine: false,
    })
  })

  it('vor Bewegung: keine Linie', () => {
    expect(latchProbeMapDrag(false, clickRef, clickRef)).toEqual({
      mapDragging: false,
      showLine: false,
    })
  })

  it('erste Bewegung ab Referenz: Linie an', () => {
    expect(latchProbeMapDrag(false, clickRef, moved)).toEqual({
      mapDragging: true,
      showLine: true,
    })
  })

  it('latched: Linie bleibt bei kleinem Frame-Sprung', () => {
    expect(latchProbeMapDrag(true, clickRef, jitter)).toEqual({
      mapDragging: true,
      showLine: true,
    })
  })

  it('Referenz bleibt Klick-Position (nicht aktuelles Zentrum)', () => {
    const first = latchProbeMapDrag(false, clickRef, moved)
    expect(first.showLine).toBe(true)
    const far = { x: 200, y: 100 }
    const second = latchProbeMapDrag(true, clickRef, far)
    expect(second.showLine).toBe(true)
    expect(second.mapDragging).toBe(true)
  })

  it('unter Schwellwert ohne latch: keine Linie', () => {
    expect(
      latchProbeMapDrag(false, clickRef, jitter, PROBE_MAP_DRAG_MOVE_EPS)
    ).toEqual({
      mapDragging: false,
      showLine: false,
    })
  })
})
