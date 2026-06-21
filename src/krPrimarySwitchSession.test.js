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
        startKind: 'ang',
        baseMeta,
        canConvertToUo: true,
      })?.targetKind
    ).toBe('lh')
    expect(
      enqueueKrPrimarySwitchStep(key, 'next', {
        itemId,
        linkId: null,
        startKind: 'ang',
        baseMeta,
        canConvertToUo: true,
      })?.targetKind
    ).toBe('uo')
    expect(hasActiveKrPrimarySwitchSessions()).toBe(true)
  })

  it('überspringt UO wenn canConvertToUo false (lh+next → ang)', () => {
    const step = enqueueKrPrimarySwitchStep(key, 'next', {
      itemId,
      linkId: null,
      startKind: 'lh',
      baseMeta: { [KR_FIRST_SLOT_KIND]: 'lh' },
      canConvertToUo: false,
    })
    expect(step?.targetKind).toBe('ang')
    expect(hasActiveKrPrimarySwitchSessions()).toBe(true)
  })

  it('überspringt UO bei prev von ang wenn canConvertToUo false (ang+prev → lh)', () => {
    const step = enqueueKrPrimarySwitchStep(key, 'prev', {
      itemId,
      linkId: null,
      startKind: 'ang',
      baseMeta: { [KR_FIRST_SLOT_KIND]: 'ang' },
      canConvertToUo: false,
    })
    expect(step?.targetKind).toBe('lh')
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

  it('processKrPrimarySwitchQueue leert Session nach Erfolg', async () => {
    enqueueKrPrimarySwitchStep(key, 'next', {
      itemId,
      linkId: null,
      startKind: 'ang',
      baseMeta,
      canConvertToUo: true,
    })

    const patchFn = vi.fn(async () => ({
      applied: true,
      nextKind: /** @type {const} */ ('sra'),
    }))

    await processKrPrimarySwitchQueue(key, { patchFn })

    expect(patchFn).toHaveBeenCalledOnce()
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
