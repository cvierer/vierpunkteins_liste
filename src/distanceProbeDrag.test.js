import { describe, expect, it } from 'vitest'
import {
  advanceProbeMapDragState,
  PROBE_MAP_DRAG_MOVE_EPS,
} from './distanceProbeDrag.js'

describe('advanceProbeMapDragState', () => {
  const a = { x: 100, y: 100 }
  const b = { x: 110, y: 100 }

  it('ohne lastCenter: kein Drag, Anker null', () => {
    const got = advanceProbeMapDragState(null, a, false, null)
    expect(got.dragActive).toBe(false)
    expect(got.movementAnchor).toBeNull()
    expect(got.lastCenter).toEqual(a)
  })

  it('erste Bewegung: Anker = lastCenter (Abhebepunkt)', () => {
    const got = advanceProbeMapDragState(a, b, false, null)
    expect(got.dragActive).toBe(true)
    expect(got.dragAnchor).toEqual(a)
    expect(got.movementAnchor).toEqual(a)
    expect(got.lastCenter).toEqual(b)
  })

  it('weitere Bewegung: Anker bleibt', () => {
    const c = { x: 120, y: 100 }
    const got = advanceProbeMapDragState(b, c, true, a)
    expect(got.dragActive).toBe(true)
    expect(got.dragAnchor).toEqual(a)
    expect(got.movementAnchor).toEqual(a)
  })

  it('unter Schwellwert: Drag endet', () => {
    const near = { x: 110.1, y: 100.05 }
    const got = advanceProbeMapDragState(
      b,
      near,
      true,
      a,
      PROBE_MAP_DRAG_MOVE_EPS
    )
    expect(got.dragActive).toBe(false)
    expect(got.movementAnchor).toBeNull()
  })

  it('neuer Drag nach Ruhe: neuer Anker', () => {
    const rest = { x: 110.05, y: 100 }
    const afterRest = advanceProbeMapDragState(b, rest, true, a)
    expect(afterRest.dragActive).toBe(false)

    const moved = { x: 130, y: 100 }
    const got = advanceProbeMapDragState(
      afterRest.lastCenter,
      moved,
      afterRest.dragActive,
      afterRest.dragAnchor
    )
    expect(got.dragActive).toBe(true)
    expect(got.movementAnchor).toEqual(rest)
  })
})
