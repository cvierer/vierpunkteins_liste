/**
 * Fehlende 2.AO-Wurzeln nach INI-Änderung nachziehen (sync, Meta-only).
 * Mitten in der KR: neue Slots ohne lodgedAbw (kein Schild-Gutschreiben).
 */
import { effectiveHeroPoolSplit } from './krActionPool.js'
import { KR_ZAO_SLOTS } from './krMetaKeys.js'
import {
  isHeroAtLhMotherEndInRound,
  isLhActive,
  phaseOffsetFromHeroSecondAoMeta,
} from './lhMeta.js'
import {
  finalizePhasesWithOrderedRoots,
  nextChainedZaoParentForTransfer,
  normalizePhases,
} from './phaseLinks.js'
import { readZaoSlots } from './krZaoSlots.js'

/**
 * Legt fehlende reguläre 2.AO-Wurzeln an, wenn Ang.-Budget und INI es erlauben.
 * Skip bei laufender L.H., außer L.H. endet am Mutterobjekt in `currentRound`
 * (dann ist ein reguläres 2.AO legitim).
 *
 * @param {Record<string, unknown>} m
 * @param {number | null | undefined} [currentRound]
 * @returns {boolean} true wenn Meta mutiert wurde
 */
export function ensureZaoRootsForIni(m, currentRound = null) {
  if (!m || typeof m !== 'object') return false
  if (isLhActive(m) && !isHeroAtLhMotherEndInRound(m, currentRound)) {
    return false
  }

  const { ang } = effectiveHeroPoolSplit(m)
  if (ang < 1) return false

  const iniStr = m.initiative
  if (typeof iniStr !== 'string') return false

  const phaseOffset = phaseOffsetFromHeroSecondAoMeta(m)
  const wantedRoots = Math.max(ang, 2) - 1
  if (wantedRoots < 1) return false

  let phasesAcc = normalizePhases(m.phases)
  phasesAcc = {
    ...phasesAcc,
    links: [...phasesAcc.links],
    rowPanelOpen: true,
  }
  const slots = { ...readZaoSlots(m) }
  let added = 0

  for (;;) {
    const regularRootCount = phasesAcc.links.filter(
      (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
    ).length
    if (regularRootCount >= wantedRoots) break

    phasesAcc = finalizePhasesWithOrderedRoots(m, phasesAcc)
    const next = nextChainedZaoParentForTransfer(
      iniStr,
      phasesAcc,
      phaseOffset
    )
    if (!next) break

    const newLinkId = crypto.randomUUID()
    phasesAcc = {
      ...phasesAcc,
      links: [
        ...phasesAcc.links,
        {
          id: newLinkId,
          parentId: next.parentId,
          offset: next.offset,
        },
      ],
      rowPanelOpen: true,
    }
    // Mitten in der KR: kein lodgedAbw — sonst würde ein Schild gutgeschrieben.
    slots[newLinkId] = { kind: 'uo', marks: 0 }
    added++
  }

  if (added === 0) return false

  phasesAcc = finalizePhasesWithOrderedRoots(m, {
    ...phasesAcc,
    rowPanelOpen: true,
  })
  m.phases = { ...phasesAcc, rowPanelOpen: true }
  m[KR_ZAO_SLOTS] = slots
  return true
}
