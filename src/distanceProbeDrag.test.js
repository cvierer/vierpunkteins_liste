import { describe, expect, it } from 'vitest'
import {
  createProbePlacementState,
  detectTrackerCenterMoves,
  latchProbeMapDrag,
  PROBE_MAP_DRAG_MOVE_EPS,
  PROBE_PLACE_STABLE_MS,
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

  it('erneute Bewegung nach Ruhe: Linie wieder moeglich', () => {
    const far = { x: 200, y: 100 }
    expect(latchProbeMapDrag(false, clickRef, far)).toEqual({
      mapDragging: true,
      showLine: true,
    })
  })
})

describe('detectTrackerCenterMoves', () => {
  it('erkennt Bewegung ueber Schwellwert', () => {
    const prev = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 10, y: 0 }],
    ])
    const scene = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 11, y: 0 }],
    ])
    const r = detectTrackerCenterMoves(prev, scene)
    expect(r.anyMoved).toBe(true)
    expect(r.nextCenters.get('b')).toEqual({ x: 11, y: 0 })
  })

  it('ignoriert Jitter unter epsilon', () => {
    const prev = new Map([['a', { x: 0, y: 0 }]])
    const scene = new Map([['a', { x: 0.2, y: 0.2 }]])
    expect(detectTrackerCenterMoves(prev, scene).anyMoved).toBe(false)
  })

  it('keine Bewegung bei erstem Snapshot', () => {
    const scene = new Map([['a', { x: 1, y: 2 }]])
    expect(detectTrackerCenterMoves(null, scene).anyMoved).toBe(false)
  })
})

describe('trackProbePlacementCenter', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 0 }
  const c = { x: 10, y: 0 }
  const fast = { stableMs: 0 }

  it('erkennt Ruheposition nach Bewegung', () => {
    let state = createProbePlacementState()
    state = trackProbePlacementCenter(a, state, { now: 0, ...fast }).nextState
    state = trackProbePlacementCenter(b, state, { now: 0, ...fast }).nextState
    const r = trackProbePlacementCenter(c, state, { now: 1, ...fast })
    expect(r.placed).toBe(true)
    expect(r.mapDragging).toBe(true)
  })

  it('kurze Pause waehrend Drag: kein placed', () => {
    let state = createProbePlacementState()
    state = trackProbePlacementCenter(a, state, { now: 0 }).nextState
    state = trackProbePlacementCenter(b, state, { now: 100 }).nextState
    const r = trackProbePlacementCenter(c, state, {
      now: 100 + PROBE_PLACE_STABLE_MS - 1,
    })
    expect(r.placed).toBe(false)
    expect(r.mapDragging).toBe(true)
  })

  it('Ruhe >= stableMs: placed', () => {
    let state = createProbePlacementState()
    state = trackProbePlacementCenter(a, state, { now: 0 }).nextState
    state = trackProbePlacementCenter(b, state, { now: 100 }).nextState
    const r = trackProbePlacementCenter(c, state, {
      now: 100 + PROBE_PLACE_STABLE_MS,
    })
    expect(r.placed).toBe(true)
  })
})
