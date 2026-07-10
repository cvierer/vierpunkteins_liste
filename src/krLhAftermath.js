/**
 * L.H.-Nachlauf: 2.AO-Wurzeln nach L.H.-Ende (promote/demote/dedupe).
 */
import {
  canCreateSecondActionRoot,
  finalizePhasesWithOrderedRoots,
  findRootLinkAtHookIni,
  hookIniForLink,
  iniNumeric,
  normalizePhases,
} from './phaseLinks.js'
import { chargeValueFromMarks } from './krDigit.js'
import { effectiveHeroPoolSplit } from './krActionPool.js'
import { readKrFirstSlotKind, syncKrPrimaryLadungFromPrimaryField } from './krPrimaryField.js'
import {
  KR_ANG,
  KR_FIRST_SLOT_KIND,
  KR_LH_ACTION,
  KR_LH_SECOND,
  KR_LH_VOID_BY_TRANSFER,
  KR_PAIR_MODE,
  KR_PRIMARY_VOID_BY_ABW_TRANSFER,
  KR_ZAO_SLOTS,
} from './krMetaKeys.js'
import {
  clearLhTrackerActivity,
  isLhActive,
  phaseOffsetFromHeroSecondAoMeta,
  readLhState,
} from './lhMeta.js'
import { applyUoDefaultAbwChargeIfNeeded, readZaoSlots } from './krZaoSlots.js'
import { reconcileShieldLedger } from './shieldLedger.js'

/**
 * Entfernt doppelte 2.AO-Wurzeln (regulär oder lhEnd) an derselben Hook-INI.
 *
 * @param {Record<string, unknown>} m
 * @param {number} hookIni
 * @param {{ preferLhEnd?: boolean, preferRegular?: boolean }} [opts]
 * @returns {boolean}
 */
export function dedupeZaoRootsAtHookIni(m, hookIni, opts = {}) {
  if (!m || typeof m !== 'object') return false
  const ownerIniStr = m.initiative
  if (typeof ownerIniStr !== 'string') return false
  const hookN = Number(hookIni)
  if (!Number.isFinite(hookN)) return false

  const p = normalizePhases(m.phases)
  const links = p.links
  /** @type {import('./phaseLinks.js').PhaseLink[]} */
  const atHook = []
  for (const l of links) {
    if (!l || l.parentId !== null || l.heroExtra) continue
    const hook = hookIniForLink(l.id, ownerIniStr, links)
    if (hook === hookN) atHook.push(l)
  }
  if (atHook.length <= 1) return false

  const preferLhEnd = opts.preferLhEnd === true
  const preferRegular = opts.preferRegular === true
  let keeper = atHook[0]
  if (preferLhEnd) {
    keeper = atHook.find((l) => l.lhEnd === true) ?? atHook[0]
  } else if (preferRegular) {
    keeper = atHook.find((l) => l.lhEnd !== true) ?? atHook[0]
  }

  const removeIds = new Set(
    atHook.filter((l) => l.id !== keeper.id).map((l) => l.id)
  )
  if (removeIds.size === 0) return false

  const slots = readZaoSlots(m)
  for (const id of removeIds) {
    delete slots[id]
  }
  m[KR_ZAO_SLOTS] = slots
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...p,
    rowPanelOpen: true,
    links: p.links.filter((l) => !removeIds.has(l.id)),
  })
  return true
}

/**
 * End-KR-Hook: genau eine lhEnd-Wurzel an `endIni` (promote oder anlegen).
 *
 * @param {Record<string, unknown>} m
 * @param {number} endIni
 * @param {number} offset positiver Offset Helden-INI − End-INI
 * @returns {boolean}
 */
export function ensureLhEndRootAtHook(m, endIni, offset) {
  if (!m || typeof m !== 'object') return false
  const ownerIniStr = m.initiative
  if (typeof ownerIniStr !== 'string') return false
  const endN = Number(endIni)
  const off = Math.max(1, Math.floor(Number(offset)) || 0)
  if (!Number.isFinite(endN) || !(off > 0)) return false

  let changed = false
  const p0 = normalizePhases(m.phases)
  const existing = findRootLinkAtHookIni(p0.links, ownerIniStr, endN)

  if (existing?.lhEnd === true) {
    const pOpen = normalizePhases(m.phases)
    if (!pOpen.rowPanelOpen && pOpen.links.length > 0) {
      m.phases = finalizePhasesWithOrderedRoots(m, {
        ...pOpen,
        rowPanelOpen: true,
      })
      changed = true
    }
  } else if (existing) {
    if (promoteRegularRootToLhEnd(m, existing.id)) changed = true
  } else {
    const newId = crypto.randomUUID()
    const pNow = normalizePhases(m.phases)
    m.phases = finalizePhasesWithOrderedRoots(m, {
      ...pNow,
      rowPanelOpen: true,
      links: [
        ...pNow.links,
        {
          id: newId,
          parentId: null,
          offset: off,
          lhEnd: true,
          expiresNextRound: true,
        },
      ],
    })
    const slots = readZaoSlots(m)
    slots[newId] = { kind: 'lh', marks: 1 }
    m[KR_ZAO_SLOTS] = slots
    changed = true
  }

  if (dedupeZaoRootsAtHookIni(m, endN, { preferLhEnd: true })) changed = true
  return changed
}

/**
 * Reguläre 2.AO-Wurzel für L.H.-Ende an 2.A. zu lhEnd promoten.
 *
 * @param {Record<string, unknown>} m
 * @param {string} linkId
 * @returns {boolean}
 */
export function promoteRegularRootToLhEnd(m, linkId) {
  if (!m || typeof m !== 'object' || typeof linkId !== 'string' || !linkId) {
    return false
  }
  const p = normalizePhases(m.phases)
  const link = p.links.find((l) => l.id === linkId)
  if (
    !link ||
    link.parentId !== null ||
    link.heroExtra ||
    link.lhEnd === true
  ) {
    return false
  }
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...p,
    rowPanelOpen: true,
    links: p.links.map((l) =>
      l.id === linkId
        ? { ...l, lhEnd: true, expiresNextRound: true }
        : l
    ),
  })
  const slots = readZaoSlots(m)
  slots[linkId] = { kind: 'lh', marks: 1 }
  m[KR_ZAO_SLOTS] = slots
  return true
}

/**
 * lhEnd-Wurzel nach L.H.-Abschluss wieder in reguläre 2.AO umwandeln.
 *
 * @param {Record<string, unknown>} m
 * @param {string} linkId
 * @returns {boolean}
 */
export function demoteLhEndRootToRegular(m, linkId) {
  if (!m || typeof m !== 'object' || typeof linkId !== 'string' || !linkId) {
    return false
  }
  const p = normalizePhases(m.phases)
  const link = p.links.find((l) => l.id === linkId)
  if (!link || link.parentId !== null || link.lhEnd !== true) return false

  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...p,
    rowPanelOpen: true,
    links: p.links.map((l) => {
      if (l.id !== linkId) return l
      return {
        id: l.id,
        parentId: null,
        offset: l.offset,
        expiresNextRound: true,
      }
    }),
  })
  const slots = readZaoSlots(m)
  const newSlot = { kind: 'uo', marks: 0, lodgedAbw: true }
  slots[linkId] = newSlot
  m[KR_ZAO_SLOTS] = slots
  applyUoDefaultAbwChargeIfNeeded(m, newSlot)
  reconcileShieldLedger(m)
  return true
}

/**
 * Alle lhEnd-Wurzeln des Helden zu regulären 2.AO demoten.
 *
 * @param {Record<string, unknown>} m
 * @returns {boolean}
 */
export function demoteAllLhEndRootsToRegular(m) {
  if (!m || typeof m !== 'object') return false
  const ownerIniStr = m.initiative
  if (typeof ownerIniStr !== 'string') return false
  const p = normalizePhases(m.phases)
  let changed = false
  for (const l of p.links) {
    if (l.parentId !== null || l.heroExtra || l.lhEnd !== true) continue
    const hook = hookIniForLink(l.id, ownerIniStr, p.links)
    if (!Number.isFinite(hook) || hook < 0) continue
    if (demoteLhEndRootToRegular(m, l.id)) changed = true
  }
  return changed
}

/**
 * Stellt nach einem L.H.-Ende/-Reset MITTEN in der KR die regulaere 2.AO-Wurzel
 * des Helden wieder her, falls sie fehlt oder im falschen Zustand ist.
 *
 * Hintergrund: Regulaere 2.AO-Wurzeln sind ephemer (`expiresNextRound`) und
 * werden beim KR-Wechsel ueber `clearEphemeralExtraIniRows` entfernt. Waehrend
 * einer laufenden L.H. baut `resetAllKrCountersInScene` (mit `skipActionInit`)
 * sie NICHT neu auf. Endet/resettet die L.H. dann mitten in der KR (z. B. per
 * Vorbei-Navigieren ueber das End-INI oder per Abschluss-Stempel), fehlt die
 * normale 2.AO-Wurzel bis zum naechsten KR-Reset.
 *
 * Der Ziel-Slot ist `{kind:'uo', marks:0, lodgedAbw:true}` — exakt der
 * Kampfstart-Default (`defaultZaoSlotForPhaseNum`). Gleichzeitig wird via
 * `applyUoDefaultAbwChargeIfNeeded` eine Schildmarke in `KR_ABW` gebucht,
 * damit der Transfer (uo→ang) moeglich bleibt und die zwei Schilde wie zu
 * Kampfbeginn am Mutterobjekt erscheinen statt auf der 2.AO-Zeile.
 *
 * Idempotenz: Korrigiert nur wenn der Slot fehlt, `kind !== 'uo'` ist, oder
 * `lodgedAbw` fehlt — ein bereits gueltiger `uo/lodgedAbw`-Slot wird nicht
 * angetastet (keine doppelte Schildmarke).
 *
 * No-op, wenn bereits eine navigierbare regulaere Wurzel im Soll-Zustand
 * existiert, das Budget keine zweite Aktion hergibt oder die Ziel-INI negativ
 * waere. `heroExtra`- und `lhEnd`-Wurzeln bleiben unberuehrt; die neue Wurzel
 * ist wieder ephemer.
 *
 * @param {Record<string, unknown>} m
 * @returns {boolean} true, wenn eine Wurzel angelegt oder korrigiert wurde
 */
export function restoreRegularSecondActionRootAfterLh(m) {
  if (!m || typeof m !== 'object') return false
  const ownerIniStr = m.initiative
  if (typeof ownerIniStr !== 'string') return false

  let changed = demoteAllLhEndRootsToRegular(m)

  const phaseOffset = phaseOffsetFromHeroSecondAoMeta(m)
  if (!canCreateSecondActionRoot(ownerIniStr, phaseOffset)) return changed
  const { ang } = effectiveHeroPoolSplit(m)
  if (ang < 1) return changed

  const ownerN = iniNumeric(ownerIniStr)
  const targetHook =
    Number.isFinite(ownerN) && Number.isFinite(phaseOffset)
      ? ownerN - phaseOffset
      : null

  if (Number.isFinite(targetHook)) {
    if (dedupeZaoRootsAtHookIni(m, targetHook, { preferRegular: true })) {
      changed = true
    }
    const pTarget = normalizePhases(m.phases)
    const atTarget = findRootLinkAtHookIni(
      pTarget.links,
      ownerIniStr,
      targetHook,
      { regularOnly: true }
    )
    if (atTarget) {
      const slots = readZaoSlots(m)
      const existing = slots[atTarget.id]
      const slotNeedsFix =
        !existing || existing.kind !== 'uo' || existing.lodgedAbw !== true
      if (slotNeedsFix) {
        const newSlot = { kind: 'uo', marks: 0, lodgedAbw: true }
        slots[atTarget.id] = newSlot
        m[KR_ZAO_SLOTS] = slots
        applyUoDefaultAbwChargeIfNeeded(m, newSlot)
        reconcileShieldLedger(m)
        return true
      }
      return changed
    }
  }

  const p = normalizePhases(m.phases)
  const links = p.links
  const regularRoots = links.filter(
    (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
  )
  for (const r of regularRoots) {
    const hook = hookIniForLink(r.id, ownerIniStr, links)
    if (Number.isFinite(hook) && hook >= 0) {
      const slots = readZaoSlots(m)
      const existing = slots[r.id]
      const slotNeedsFix =
        !existing || existing.kind !== 'uo' || existing.lodgedAbw !== true
      if (slotNeedsFix) {
        const newSlot = { kind: 'uo', marks: 0, lodgedAbw: true }
        slots[r.id] = newSlot
        m[KR_ZAO_SLOTS] = slots
        applyUoDefaultAbwChargeIfNeeded(m, newSlot)
        reconcileShieldLedger(m)
        return true
      }
      return changed
    }
  }

  const newId = crypto.randomUUID()
  m.phases = finalizePhasesWithOrderedRoots(m, {
    ...p,
    rowPanelOpen: true,
    links: [
      ...links,
      { id: newId, parentId: null, offset: phaseOffset, expiresNextRound: true },
    ],
  })
  const slots = readZaoSlots(m)
  // Kampfstart-Default: leeres 2.AO mit eingelagertem Schild. Die zugehoerige
  // Schildmarke wird via applyUoDefaultAbwChargeIfNeeded in KR_ABW gebucht,
  // damit Transfer (uo->ang) moeglich ist und die Schilde am Mutterobjekt
  // erscheinen (marks:0 haelt den Spiegel isMirrorAbwUiActive inaktiv).
  const newSlot = { kind: 'uo', marks: 0, lodgedAbw: true }
  slots[newId] = newSlot
  m[KR_ZAO_SLOTS] = slots
  applyUoDefaultAbwChargeIfNeeded(m, newSlot)
  reconcileShieldLedger(m)
  if (Number.isFinite(targetHook)) {
    dedupeZaoRootsAtHookIni(m, targetHook, { preferRegular: true })
  }
  return true
}

/**
 * Radikaler L.H.-Ende-Reset fuer EINEN Helden: bringt den KR-Aktionszustand in
 * den Kampfstart-Zustand zurueck, sodass sich das Objekt nach L.H.-Ende wieder
 * normal verhaelt und voll umwandelbar ist (ang/sra/lh/uo).
 *
 * - L.H.-Aktivitaet leeren (`clearLhTrackerActivity`) und Void-Transfer-Flags
 *   entfernen.
 * - ALLE regulaeren 2.AO-Wurzeln (kein heroExtra/lhEnd) auf den Kampfstart-
 *   Default `{kind:'uo', marks:0, lodgedAbw:true}` setzen und je eine
 *   Schildmarke buchen (via `applyUoDefaultAbwChargeIfNeeded`) — nur, wenn der
 *   Slot noch nicht im Soll-Zustand ist (keine doppelte Marke).
 * - Sicherstellen, dass mindestens eine navigierbare regulaere Wurzel existiert
 *   (`restoreRegularSecondActionRootAfterLh` legt bei Bedarf eine an).
 *
 * Bewusst NICHT enthalten: die Mutter-Primaeraktion wird nicht neu geladen —
 * die L.H. war die Aktion dieser KR. Pools/Frei bleiben wie zum KR-Start
 * (`resetAllKrCountersInScene` baut sie in der End-KR ohnehin voll auf).
 *
 * @param {Record<string, unknown>} m
 * @returns {boolean} true, wenn Meta veraendert wurde
 */
/**
 * Mutter-Primärfeld von abgelaufener/abgebrochener L.H. auf Kampfstart-Default
 * (Schwert mit einer Ladung). Kein volles rebuildKrActionPoolVisualsFromAngAbw.
 *
 * @param {Record<string, unknown>} m
 * @returns {boolean}
 */
function restoreMotherPrimaryFromLhToAng(m) {
  if (!m || typeof m !== 'object') return false
  if (readKrFirstSlotKind(m) !== 'lh') return false
  m[KR_FIRST_SLOT_KIND] = 'ang'
  m[KR_PAIR_MODE] = 'ang_abw'
  m[KR_ANG] = chargeValueFromMarks(1)
  m[KR_LH_ACTION] = chargeValueFromMarks(0)
  m[KR_LH_SECOND] = 0
  delete m[KR_LH_VOID_BY_TRANSFER]
  delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
  syncKrPrimaryLadungFromPrimaryField(m)
  return true
}

/**
 * @param {Record<string, unknown>} m
 * @param {{ forcePrimaryReset?: boolean }} [opts]
 */
export function normalizeHeroKrStateAfterLhEnd(m, opts = {}) {
  if (!m || typeof m !== 'object') return false
  const forcePrimaryReset = opts.forcePrimaryReset === true
  const wasLhRunning = isLhActive(m) || readLhState(m).max > 0
  let changed = false
  clearLhTrackerActivity(m)
  if (m[KR_LH_VOID_BY_TRANSFER] !== undefined) {
    delete m[KR_LH_VOID_BY_TRANSFER]
    changed = true
  }
  if (m[KR_PRIMARY_VOID_BY_ABW_TRANSFER] !== undefined) {
    delete m[KR_PRIMARY_VOID_BY_ABW_TRANSFER]
    changed = true
  }
  // Nach Ablauf/Abbruch: hängendes Primär-Kind 'lh' auf Schwert zurücksetzen.
  // Setup (kind=lh, max=0) bleibt unberührt — ausser bei explizitem Abbrechen.
  if (
    (forcePrimaryReset || wasLhRunning) &&
    restoreMotherPrimaryFromLhToAng(m)
  ) {
    changed = true
  }
  const p = normalizePhases(m.phases)
  const regularRoots = p.links.filter(
    (l) => l.parentId === null && !l.heroExtra && l.lhEnd !== true
  )
  const slots = readZaoSlots(m)
  let slotsChanged = false
  for (const r of regularRoots) {
    const existing = slots[r.id]
    const needsFix =
      !existing || existing.kind !== 'uo' || existing.lodgedAbw !== true
    if (needsFix) {
      const newSlot = { kind: 'uo', marks: 0, lodgedAbw: true }
      slots[r.id] = newSlot
      applyUoDefaultAbwChargeIfNeeded(m, newSlot)
      slotsChanged = true
    }
  }
  if (slotsChanged) {
    m[KR_ZAO_SLOTS] = slots
    changed = true
  }
  if (restoreRegularSecondActionRootAfterLh(m)) changed = true
  if (reconcileShieldLedger(m)) changed = true
  return changed
}

/**
 * Held nach L.H.-Abbruch (× oder Umwandel-Pfeil) auf lokalen Kampfstart-Default.
 *
 * @param {Record<string, unknown>} m
 * @returns {boolean}
 */
export function restoreHeroKrCombatStartDefault(m) {
  return normalizeHeroKrStateAfterLhEnd(m, { forcePrimaryReset: true })
}
