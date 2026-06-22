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

vi.mock('./krCounters.js', () => ({
  KR_ABW: 'krAbw',
  KR_FREE_ACTION: 'krFreeAction',
  normalizeKrDigit: (v) => Math.floor(Number(v)) || 0,
  patchKrCounterByDelta,
  patchKrStampAbwFromCharge,
  patchKrStampParadeExtraFromCharge,
  readKrAbw: vi.fn(() => 0),
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
import { readKrAbw, readKrParadeExtraSlots } from './krCounters.js'
import {
  executeAbwStampClick,
  executeFaStampClick,
  reactionAbwStampAllowed,
  reactionStampAnchor,
  resolveReactionStampTarget,
} from './reactionStampClick.js'

describe('reactionStampClick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(canEditSceneItem).mockReturnValue(true)
    vi.mocked(isLhLockingActions).mockReturnValue(false)
    vi.mocked(readKrAbw).mockReturnValue(0)
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
        metadata: { 'vierpunkteins_kampf.tracker/metadata': {} },
      },
    ])
    const ok = await executeFaStampClick('hero-a', 1)
    expect(ok).toBe(true)
    expect(patchKrCounterByDelta).toHaveBeenCalledWith(
      'hero-a',
      'krFreeAction',
      1
    )
  })

  it('executeAbwStampClick nutzt owner-Anker im Reaktionsspeicher', async () => {
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([
      {
        id: 'hero-b',
        metadata: { 'vierpunkteins_kampf.tracker/metadata': { krAbw: 0 } },
      },
    ])
    vi.mocked(readKrAbw).mockReturnValue(0)
    await executeAbwStampClick('hero-b', { inReactionStore: true })
    expect(patchKrStampAbwFromCharge).toHaveBeenCalledWith('hero-b', {
      stampAnchor: { rowId: 'hero-b', phaseLinkId: null },
    })
  })
})
