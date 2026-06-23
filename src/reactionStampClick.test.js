import { describe, expect, it, vi, beforeEach } from 'vitest'

const {
  patchKrCounterByDelta,
  patchKrStampAbwFromCharge,
  patchKrStampParadeExtraFromCharge,
} = vi.hoisted(() => ({
  patchKrCounterByDelta: vi.fn(async () => true),
  patchKrStampAbwFromCharge: vi.fn(async () => {}),
  patchKrStampParadeExtraFromCharge: vi.fn(async () => {}),
}))

vi.mock('@owlbear-rodeo/sdk', () => ({
  default: {
    scene: {
      items: {
        getItems: vi.fn(async () => []),
      },
    },
  },
}))

vi.mock('./editAccess.js', () => ({
  canEditSceneItem: vi.fn(() => true),
}))

vi.mock('./combatRoom.js', () => ({
  getCombat: vi.fn(() => ({
    started: true,
    roundIntroPending: false,
    currentItemId: 'hero-a',
    currentPhaseLinkId: null,
    round: 1,
  })),
  getActionStamps: vi.fn(() => ({ entries: [] })),
}))

vi.mock('./lhMeta.js', () => ({
  isLhLockingActions: vi.fn(() => false),
}))

vi.mock('./roomSettings.js', () => ({
  getRoomSettings: vi.fn(() => ({ highIniFreeActions: false })),
}))

vi.mock('./krCounters.js', () => ({
  KR_ABW: 'krAbw',
  KR_FREE_ACTION: 'krFreeAction',
  normalizeKrDigit: (v) => Math.floor(Number(v)) || 0,
  patchKrCounterByDelta,
  patchKrStampAbwFromCharge,
  patchKrStampParadeExtraFromCharge,
  readKrAbw: vi.fn(() => 0),
  readKrFreeAction: vi.fn(() => 0),
  readHeroFaMax: vi.fn(() => 2),
  readKrParadeExtraSlots: vi.fn(() => []),
  undoKrActionStamp: vi.fn(async () => {}),
}))

vi.mock('./krAbwStampGates.js', () => ({
  liveAbwCombatAllowsStamp: vi.fn(() => true),
  liveAbwStampAnchor: vi.fn(() => ({ rowId: 'hero-a', phaseLinkId: null })),
  liveFaLadungAllowed: vi.fn(() => true),
}))

import OBR from '@owlbear-rodeo/sdk'
import { canEditSceneItem } from './editAccess.js'
import { isLhLockingActions } from './lhMeta.js'
import { readKrAbw, readKrFreeAction, readKrParadeExtraSlots } from './krCounters.js'
import { liveFaLadungAllowed } from './krAbwStampGates.js'
import {
  executeAbwStampClick,
  executeFaStampClick,
  handleReactionStampClick,
  reactionAbwStampAllowed,
  reactionFaStampAllowed,
  reactionStampAnchor,
  resolveReactionStampTarget,
} from './reactionStampClick.js'

const TRACKER_KEY = 'vierpunkteins_kampf.tracker/metadata'

describe('reactionStampClick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(canEditSceneItem).mockReturnValue(true)
    vi.mocked(isLhLockingActions).mockReturnValue(false)
    vi.mocked(liveFaLadungAllowed).mockReturnValue(true)
    vi.mocked(readKrAbw).mockReturnValue(0)
    vi.mocked(readKrFreeAction).mockReturnValue(0)
    vi.mocked(readKrParadeExtraSlots).mockReturnValue([])
  })

  it('reactionStampAnchor nutzt owner row im Reaktionsspeicher', () => {
    expect(
      reactionStampAnchor('hero-b', { currentItemId: 'hero-a' }, true)
    ).toEqual({
      rowId: 'hero-b',
      phaseLinkId: null,
    })
  })

  it('reactionAbwStampAllowed false bei L.H.-Lock', () => {
    vi.mocked(isLhLockingActions).mockReturnValue(true)
    expect(reactionAbwStampAllowed({})).toBe(false)
  })

  it('reactionFaStampAllowed true bei L.H.-Lock (F.A. nicht gesperrt)', () => {
    vi.mocked(isLhLockingActions).mockReturnValue(true)
    expect(reactionFaStampAllowed(null, { heroFaMax: 2 }, 1)).toBe(true)
  })

  it('resolveReactionStampTarget findet F.A.-Tap', () => {
    const tap = {
      closest(sel) {
        if (sel === '.init-kr-abw-split-shell--mirror-link') return null
        if (sel === '.init-fa-cell__tap') return tap
        if (sel === '.init-fa-cell[data-fa-link-group]') {
          return {
            getAttribute: (n) =>
              n === 'data-fa-link-group' ? 'hero-a' : null,
            closest: () => null,
          }
        }
        return null
      },
    }
    expect(resolveReactionStampTarget(tap)).toEqual({
      kind: 'fa',
      ownerItemId: 'hero-a',
      inReactionStore: false,
    })
  })

  it('resolveReactionStampTarget findet F.A. im Reaktionsspeicher', () => {
    const reactionStore = {}
    const tap = {
      closest(sel) {
        if (sel === '.init-kr-abw-split-shell--mirror-link') return null
        if (sel === '.init-fa-cell__tap') return tap
        if (sel === '.init-fa-cell[data-fa-link-group]') {
          return {
            getAttribute: (n) =>
              n === 'data-fa-link-group' ? 'hero-b' : null,
            closest: (s) =>
              s === '.init-kr-reaction-store' ? reactionStore : null,
          }
        }
        return null
      },
    }
    expect(resolveReactionStampTarget(tap)).toEqual({
      kind: 'fa',
      ownerItemId: 'hero-b',
      inReactionStore: true,
    })
  })

  it('resolveReactionStampTarget findet Abwehr-Schild im Reaktionsspeicher', () => {
    const reactionStore = { closest: () => null }
    const shell = {
      classList: { contains: () => false },
      getAttribute: (n) =>
        n === 'data-shield-link-group' ? 'hero-a' : null,
      closest: (sel) =>
        sel === '.init-kr-reaction-store' ? reactionStore : null,
    }
    const shield = {
      closest(sel) {
        if (sel === '.init-kr-abw-split-shell--mirror-link') return null
        if (sel === '.init-kr-abw-shield--parade-extra') return null
        if (sel === '.init-kr-abw-split-shell__exec') return { closest: () => shell }
        if (sel === '.init-kr-abw-split-shell[data-shield-link-group]') return shell
        return null
      },
    }
    expect(resolveReactionStampTarget(shield)).toEqual({
      kind: 'abw',
      ownerItemId: 'hero-a',
      inReactionStore: true,
    })
  })

  it('resolveReactionStampTarget ignoriert Mirror-Link', () => {
    const mirror = { classList: { contains: () => true } }
    const target = {
      closest(sel) {
        if (sel === '.init-kr-abw-split-shell--mirror-link') return mirror
        return null
      },
    }
    expect(resolveReactionStampTarget(target)).toBe(null)
  })

  it('executeFaStampClick ruft patchKrCounterByDelta auf', async () => {
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-a',
        metadata: { [TRACKER_KEY]: { heroFaMax: 2 } },
      },
    ])
    const ok = await executeFaStampClick('hero-a', 1)
    expect(ok).toBe(true)
    expect(patchKrCounterByDelta).toHaveBeenCalledWith(
      'hero-a',
      'krFreeAction',
      1,
      {}
    )
  })

  it('executeFaStampClick nutzt owner-Anker im Reaktionsspeicher', async () => {
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-b',
        metadata: { [TRACKER_KEY]: { heroFaMax: 2 } },
      },
    ])
    const ok = await executeFaStampClick('hero-b', 1, { inReactionStore: true })
    expect(ok).toBe(true)
    expect(patchKrCounterByDelta).toHaveBeenCalledWith(
      'hero-b',
      'krFreeAction',
      1,
      { stampAnchor: { rowId: 'hero-b', phaseLinkId: null } }
    )
  })

  it('executeAbwStampClick nutzt owner-Anker im Reaktionsspeicher', async () => {
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-b',
        metadata: { [TRACKER_KEY]: { krAbw: 0 } },
      },
    ])
    vi.mocked(readKrAbw).mockReturnValue(0)
    await executeAbwStampClick('hero-b', { inReactionStore: true })
    expect(patchKrStampAbwFromCharge).toHaveBeenCalledWith('hero-b', {
      stampAnchor: { rowId: 'hero-b', phaseLinkId: null },
    })
  })

  it('handleReactionStampClick ruft preventDefault nicht bei Gate-Fail', async () => {
    vi.mocked(liveFaLadungAllowed).mockReturnValue(false)
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const tap = {
      closest(sel) {
        if (sel === '.init-kr-abw-split-shell--mirror-link') return null
        if (sel === '.init-fa-cell__tap') return tap
        if (sel === '.init-fa-cell[data-fa-link-group]') {
          return {
            getAttribute: (n) =>
              n === 'data-fa-link-group' ? 'hero-a' : null,
            closest: () => null,
          }
        }
        return null
      },
    }
    const handled = await handleReactionStampClick({
      target: tap,
      preventDefault,
      stopPropagation,
    })
    expect(handled).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(stopPropagation).not.toHaveBeenCalled()
    expect(patchKrCounterByDelta).not.toHaveBeenCalled()
  })
})
