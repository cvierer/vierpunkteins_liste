import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  isKrSlotPatchSuppressingRenderList,
  mergeDeferredRenderItems,
  noteDeferredRenderListItems,
  registerKrSlotPatchRenderFlush,
  registerKrSwitchSessionActiveGuard,
  runWithKrSlotPatchSuppressed,
} from './krSlotPatchGate.js'

describe('krSlotPatchGate', () => {
  beforeEach(() => {
    registerKrSwitchSessionActiveGuard(() => false)
  })

  it('mergeDeferredRenderItems bevorzugt lastItems pro Token', () => {
    const pending = [
      { id: 'a', metadata: { t: { krFirst: 'ang' } } },
      { id: 'b', metadata: { t: { krFirst: 'sra' } } },
    ]
    const lastItems = [
      { id: 'a', metadata: { t: { krFirst: 'lh' } } },
      { id: 'c', metadata: { t: { krFirst: 'uo' } } },
    ]
    const merged = mergeDeferredRenderItems(pending, lastItems)
    expect(merged?.[0]?.metadata?.t?.krFirst).toBe('lh')
    expect(merged?.[1]?.metadata?.t?.krFirst).toBe('sra')
  })

  it('unterdrückt renderList während Patch', async () => {
    expect(isKrSlotPatchSuppressingRenderList()).toBe(false)
    await runWithKrSlotPatchSuppressed(async () => {
      expect(isKrSlotPatchSuppressingRenderList()).toBe(true)
    })
    expect(isKrSlotPatchSuppressingRenderList()).toBe(false)
  })

  it('plant deferred flush nach Patch', async () => {
    vi.useFakeTimers()
    const flushed = vi.fn()
    registerKrSlotPatchRenderFlush(flushed)
    const stale = [{ id: 'x', metadata: { t: { kind: 'ang' } } }]
    const fresh = [{ id: 'x', metadata: { t: { kind: 'sra' } } }]
    noteDeferredRenderListItems(stale)
    await runWithKrSlotPatchSuppressed(async () => {
      noteDeferredRenderListItems(fresh)
    })
    expect(flushed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(flushed).toHaveBeenCalledOnce()
    expect(flushed.mock.calls[0][0]?.[0]?.metadata?.t?.kind).toBe('sra')
    vi.useRealTimers()
  })

  it('plant keinen deferred flush solange Switch-Session aktiv', async () => {
    vi.useFakeTimers()
    const flushed = vi.fn()
    registerKrSlotPatchRenderFlush(flushed)
    registerKrSwitchSessionActiveGuard(() => true)
    noteDeferredRenderListItems([{ id: 'x' }])
    await runWithKrSlotPatchSuppressed(async () => {})
    vi.advanceTimersByTime(250)
    expect(flushed).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
