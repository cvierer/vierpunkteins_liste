import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  isKrSlotPatchSuppressingRenderList,
  noteDeferredRenderListItems,
  registerKrSlotPatchRenderFlush,
  registerKrSwitchSessionActiveGuard,
  runWithKrSlotPatchSuppressed,
} from './krSlotPatchGate.js'

describe('krSlotPatchGate', () => {
  beforeEach(() => {
    registerKrSwitchSessionActiveGuard(() => false)
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
    noteDeferredRenderListItems([{ id: 'x' }])
    await runWithKrSlotPatchSuppressed(async () => {})
    expect(flushed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(flushed).toHaveBeenCalledOnce()
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
