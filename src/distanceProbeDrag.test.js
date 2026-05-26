import { describe, expect, it } from 'vitest'
import {
  createProbePlacementState,
  latchProbeMapDrag,
  PROBE_MAP_DRAG_MOVE_EPS,
  PROBE_PLACE_STABLE_FRAMES,
  trackProbePlacementCenter,
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

  it('nach Loslassen: keine erneute Linie trotz Abstand zur Referenz', () => {
    const far = { x: 200, y: 100 }
    expect(
      latchProbeMapDrag(false, clickRef, moved, PROBE_MAP_DRAG_MOVE_EPS, true)
    ).toEqual({
      mapDragging: false,
      showLine: false,
    })
    expect(
      latchProbeMapDrag(true, clickRef, far, PROBE_MAP_DRAG_MOVE_EPS, true)
    ).toEqual({
      mapDragging: false,
      showLine: false,
    })
  })
})

describe('trackProbePlacementCenter', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 0 }
  const c = { x: 10, y: 0 }

  it('erkennt Bewegung und Absetzen ohne document-Events', () => {
    let state = createProbePlacementState()
    let r = trackProbePlacementCenter(a, state)
    state = r.nextState
    expect(r.placed).toBe(false)
    expect(r.mapDragging).toBe(false)

    r = trackProbePlacementCenter(b, state)
    state = r.nextState
    expect(r.mapDragging).toBe(true)
    expect(r.placed).toBe(false)

    for (let i = 0; i < PROBE_PLACE_STABLE_FRAMES - 1; i++) {
      r = trackProbePlacementCenter(c, state)
      state = r.nextState
      expect(r.placed).toBe(false)
    }
    r = trackProbePlacementCenter(c, state)
    expect(r.placed).toBe(true)
    expect(r.mapDragging).toBe(false)
  })

  it('nach Absetzen kann erneute Bewegung erkannt werden', () => {
    let state = createProbePlacementState()
    state = trackProbePlacementCenter(a, state).nextState
    state = trackProbePlacementCenter(b, state).nextState
    let placed = false
    for (let i = 0; i < PROBE_PLACE_STABLE_FRAMES; i++) {
      const r = trackProbePlacementCenter(c, state)
      state = r.nextState
      placed = r.placed
    }
    expect(placed).toBe(true)

    const d = { x: 30, y: 0 }
    const drag = trackProbePlacementCenter(d, state)
    expect(drag.mapDragging).toBe(true)
    expect(drag.placed).toBe(false)
  })
})
