import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  flushKrSlotPatchRenderNow,
  forceKrSlotPatchRenderNow,
  isKrSlotPatchSuppressingRenderList,
  mergeDeferredRenderItems,
  noteDeferredRenderListItems,
  registerKrSlotPatchRenderFlush,
  registerKrSwitchSessionActiveGuard,
  runWithKrSlotPatchSuppressed,
} from './krSlotPatchGate.js'

describe('krSlotPatchGate', () => {
  beforeEach(() => {
    // Modul-State zwischen Tests sauber halten: einen evtl. aus einem Vortest
    // haengenden Flush-Timer leeren (sonst blockiert er das erneute Planen).
    vi.useRealTimers()
    registerKrSlotPatchRenderFlush(() => {})
    flushKrSlotPatchRenderNow()
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

  it('deferred flush läuft trotz aktiver Switch-Session-Guard', async () => {
    vi.useFakeTimers()
    const flushed = vi.fn()
    registerKrSlotPatchRenderFlush(flushed)
    registerKrSwitchSessionActiveGuard(() => true)
    noteDeferredRenderListItems([{ id: 'x' }])
    await runWithKrSlotPatchSuppressed(async () => {})
    vi.advanceTimersByTime(250)
    expect(flushed).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('verzoegerter Flush wird bei schnellen Suppress-Zyklen nicht ausgehungert', async () => {
    vi.useFakeTimers()
    const flushed = vi.fn()
    registerKrSlotPatchRenderFlush(flushed)
    // Erster Zyklus plant den Flush-Timer (200ms).
    await runWithKrSlotPatchSuppressed(async () => {
      noteDeferredRenderListItems([{ id: 'r', metadata: { t: { kind: 'ang' } } }])
    })
    // Weitere Zyklen alle 50ms duerfen den bereits laufenden Timer NICHT
    // zuruecksetzen (sonst Starvation: Reaktions-/F.A.-Render bliebe unsichtbar).
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(50)
      await runWithKrSlotPatchSuppressed(async () => {})
    }
    expect(flushed).toHaveBeenCalled()
    expect(flushed.mock.calls[0][0]?.[0]?.id).toBe('r')
    vi.useRealTimers()
  })

  it('forceKrSlotPatchRenderNow flushed trotz aktiver Switch-Session-Guard', () => {
    const flushed = vi.fn()
    registerKrSlotPatchRenderFlush(flushed)
    registerKrSwitchSessionActiveGuard(() => true)
    noteDeferredRenderListItems([{ id: 'z', metadata: { t: { kind: 'uo' } } }])
    forceKrSlotPatchRenderNow()
    expect(flushed).toHaveBeenCalledOnce()
    expect(flushed.mock.calls[0][0]?.[0]?.id).toBe('z')
  })

  it('flushKrSlotPatchRenderNow flushed sofort nach Session-Ende', () => {
    const flushed = vi.fn()
    registerKrSlotPatchRenderFlush(flushed)
    registerKrSwitchSessionActiveGuard(() => false)
    noteDeferredRenderListItems([{ id: 'y', metadata: { t: { kind: 'lh' } } }])
    flushKrSlotPatchRenderNow()
    expect(flushed).toHaveBeenCalledOnce()
    expect(flushed.mock.calls[0][0]?.[0]?.id).toBe('y')
  })
})
