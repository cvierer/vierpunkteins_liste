import { describe, expect, it, vi, beforeEach } from 'vitest'

const {
  patchCombat,
  autoStampForCombatStep,
  canAutoStampForCombatStep,
  hasPrimaryActionStampAtCombatStep,
} = vi.hoisted(() => ({
  patchCombat: vi.fn(async () => {}),
  autoStampForCombatStep: vi.fn(async () => false),
  canAutoStampForCombatStep: vi.fn(async () => true),
  hasPrimaryActionStampAtCombatStep: vi.fn(() => false),
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

vi.mock('./combatRoom.js', () => ({
  patchCombat,
}))

vi.mock('./combatAutoStamp.js', () => ({
  autoStampForCombatStep,
  canAutoStampForCombatStep,
}))

vi.mock('./krCounters.js', () => ({
  hasPrimaryActionStampAtCombatStep,
}))

vi.mock('./phaseLinks.js', () => ({
  isStampableCombatStep: vi.fn((cur) => cur?.kind === 'token'),
}))

import OBR from '@owlbear-rodeo/sdk'
import { advanceTokenMotherToReactionSubstep } from './combatReactionSubstep.js'

describe('advanceTokenMotherToReactionSubstep', () => {
  const combat = {
    started: true,
    round: 1,
    currentTurnSubStep: 'action',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasPrimaryActionStampAtCombatStep).mockReturnValue(false)
    vi.mocked(autoStampForCombatStep).mockResolvedValue(false)
    vi.mocked(canAutoStampForCombatStep).mockResolvedValue(true)
    vi.mocked(OBR.scene.items.getItems).mockResolvedValue([])
  })

  it('bleibt auf action wenn Stempel fehlschlägt aber noch möglich wäre', async () => {
    const cur = { kind: 'token', id: 'hero-a', sub: 'action' }
    const ok = await advanceTokenMotherToReactionSubstep(cur, combat)
    expect(ok).toBe(false)
    expect(patchCombat).not.toHaveBeenCalled()
  })

  it('wechselt zu reaction nach erfolgreichem Auto-Stempel', async () => {
    vi.mocked(autoStampForCombatStep).mockResolvedValue(true)
    const cur = { kind: 'token', id: 'hero-a', sub: 'action' }
    const ok = await advanceTokenMotherToReactionSubstep(cur, combat)
    expect(ok).toBe(true)
    expect(patchCombat).toHaveBeenCalledWith(
      expect.objectContaining({ currentTurnSubStep: 'reaction' })
    )
  })

  it('wechselt zu reaction wenn nichts zu stempeln ist', async () => {
    vi.mocked(canAutoStampForCombatStep).mockResolvedValue(false)
    const cur = { kind: 'token', id: 'hero-a', sub: 'action' }
    const ok = await advanceTokenMotherToReactionSubstep(cur, combat)
    expect(ok).toBe(true)
    expect(autoStampForCombatStep).toHaveBeenCalled()
    expect(patchCombat).toHaveBeenCalledWith(
      expect.objectContaining({ currentTurnSubStep: 'reaction' })
    )
  })
})
