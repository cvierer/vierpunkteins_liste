import { describe, expect, it } from 'vitest'
import { resolveActivePhaseLinkId } from './navActivePhaseLink.js'

const phaseStep = (ownerId, linkId) => ({ kind: 'phase', ownerId, linkId, sub: 'action' })
const tokenStep = (ownerId) => ({ kind: 'token', ownerId, sub: 'action' })

describe('resolveActivePhaseLinkId', () => {
  it('null bleibt null (Mutterzeile / Rundengrenze)', () => {
    expect(
      resolveActivePhaseLinkId(
        { currentItemId: 'hero-a', currentPhaseLinkId: null },
        [phaseStep('hero-a', 'zao-1')]
      )
    ).toBeNull()
  })

  it('exakter Treffer bleibt unveraendert', () => {
    expect(
      resolveActivePhaseLinkId(
        { currentItemId: 'hero-a', currentPhaseLinkId: 'zao-1' },
        [tokenStep('hero-a'), phaseStep('hero-a', 'zao-1')]
      )
    ).toBe('zao-1')
  })

  it('Ghost-ID + genau ein Owner-Phasenschritt -> dessen linkId', () => {
    expect(
      resolveActivePhaseLinkId(
        { currentItemId: 'hero-a', currentPhaseLinkId: 'stale-old' },
        [tokenStep('hero-a'), phaseStep('hero-a', 'zao-new')]
      )
    ).toBe('zao-new')
  })

  it('Ghost-ID + kein Owner-Phasenschritt -> unveraendert (No-op)', () => {
    expect(
      resolveActivePhaseLinkId(
        { currentItemId: 'hero-a', currentPhaseLinkId: 'stale-old' },
        [tokenStep('hero-a')]
      )
    ).toBe('stale-old')
  })

  it('Ghost-ID + mehrere Owner-Phasenschritte -> erster', () => {
    expect(
      resolveActivePhaseLinkId(
        { currentItemId: 'hero-a', currentPhaseLinkId: 'stale-old' },
        [
          phaseStep('hero-a', 'zao-first'),
          phaseStep('hero-a', 'zao-second'),
        ]
      )
    ).toBe('zao-first')
  })

  it('fremde Owner-Phasenschritte werden ignoriert', () => {
    expect(
      resolveActivePhaseLinkId(
        { currentItemId: 'hero-a', currentPhaseLinkId: 'stale-old' },
        [phaseStep('hero-b', 'zao-b')]
      )
    ).toBe('stale-old')
  })

  it('ohne Steps-Array unveraendert', () => {
    expect(
      resolveActivePhaseLinkId(
        { currentItemId: 'hero-a', currentPhaseLinkId: 'zao-1' },
        null
      )
    ).toBe('zao-1')
  })

  it('ohne aktiven Owner -> phaseId unveraendert (No-op, Matching braucht ohnehin den Owner)', () => {
    expect(
      resolveActivePhaseLinkId(
        { currentItemId: null, currentPhaseLinkId: 'zao-1' },
        [phaseStep('hero-a', 'zao-1')]
      )
    ).toBe('zao-1')
  })
})
