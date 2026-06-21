import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  KR_FIRST_SLOT_KIND,
  HERO_INI_NEG_ANG_MODE,
} from './krCounters.js'
import {
  clearKrPrimarySwitchSession,
  enqueueKrPrimarySwitchStep,
  getKrPrimarySwitchSessionKey,
  hasActiveKrPrimarySwitchSessions,
  processKrPrimarySwitchQueue,
  registerKrPrimarySwitchSync,
} from './krPrimarySwitchSession.js'

describe('krPrimarySwitchSession', () => {
  const itemId = 'token-1'
  const key = getKrPrimarySwitchSessionKey(itemId, null)
  const baseMeta = { [KR_FIRST_SLOT_KIND]: 'ang' }

  beforeEach(() => {
    clearKrPrimarySwitchSession(key)
  })

  it('enqueueKrPrimarySwitchStep zyklisiert AN → A → L.H. → UO', () => {
    expect(
      enqueueKrPrimarySwitchStep(key, 'next', {
        itemId,
        linkId: null,
        startKind: 'ang',
        baseMeta,
        canConvertToUo: true,
      })?.targetKind
    ).toBe('sra')
    expect(
      enqueueKrPrimarySwitchStep(key, 'next', {
        itemId,
        linkId: null,
        startKind: 'sra',
        baseMeta,
        canConvertToUo: true,
      })?.targetKind
    ).toBe('lh')
    expect(
      enqueueKrPrimarySwitchStep(key, 'next', {
        itemId,
        linkId: null,
        startKind: 'lh',
        baseMeta,
        canConvertToUo: true,
      })?.targetKind
    ).toBe('uo')
    expect(hasActiveKrPrimarySwitchSessions()).toBe(true)
  })

  it('blockiert UO wenn canConvertToUo false', () => {
    const step = enqueueKrPrimarySwitchStep(key, 'next', {
      itemId,
      linkId: null,
      startKind: 'lh',
      baseMeta: { [KR_FIRST_SLOT_KIND]: 'lh' },
      canConvertToUo: false,
    })
    expect(step).toBeNull()
    expect(hasActiveKrPrimarySwitchSessions()).toBe(false)
  })

  it('iniLocked überspringt AN im Zyklus', () => {
    const iniLockedMeta = {
      initiative: '-1',
      [HERO_INI_NEG_ANG_MODE]: 'no',
      [KR_FIRST_SLOT_KIND]: 'uo',
    }
    const step = enqueueKrPrimarySwitchStep(key, 'next', {
      itemId,
      linkId: null,
      startKind: 'uo',
      baseMeta: iniLockedMeta,
      canConvertToUo: true,
    })
    expect(step?.targetKind).toBe('sra')
  })

  it('processKrPrimarySwitchQueue leert Session und ruft sync', async () => {
    const synced = vi.fn()
    enqueueKrPrimarySwitchStep(key, 'next', {
      itemId,
      linkId: null,
      startKind: 'ang',
      baseMeta,
      canConvertToUo: true,
    })
    registerKrPrimarySwitchSync(key, synced)

    const patchFn = vi.fn(async () => ({
      applied: true,
      nextKind: /** @type {const} */ ('sra'),
    }))

    await processKrPrimarySwitchQueue(key, { patchFn })

    expect(patchFn).toHaveBeenCalledOnce()
    expect(synced).toHaveBeenCalled()
    expect(hasActiveKrPrimarySwitchSessions()).toBe(false)
  })

  it('processKrPrimarySwitchQueue bei Fehler leert Session', async () => {
    enqueueKrPrimarySwitchStep(key, 'next', {
      itemId,
      linkId: null,
      startKind: 'ang',
      baseMeta,
      canConvertToUo: true,
    })
    const onFailure = vi.fn()
    const patchFn = vi.fn(async () => ({ applied: false, nextKind: 'ang' }))

    await processKrPrimarySwitchQueue(key, { patchFn, onFailure })

    expect(onFailure).toHaveBeenCalledOnce()
    expect(hasActiveKrPrimarySwitchSessions()).toBe(false)
  })
})
