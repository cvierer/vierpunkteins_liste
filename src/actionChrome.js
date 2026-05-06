import OBR from '@owlbear-rodeo/sdk'
import { assetUrl } from './assetUrl.js'
import { getCombat, getIniTieOrder } from './combatRoom.js'
import {
  ROUND_END_STEP_ID,
  ROUND_START_STEP_ID,
} from './phaseLinks.js'
import { collectSortedParticipants } from './participants.js'
import { getManualIniTieOverridePairs } from './manualIniTieOverrides.js'

export async function syncActionChrome(items) {
  const combat = getCombat()
  const iconUrl = combat.started
    ? assetUrl('action-kampf-list-sword-up.svg')
    : assetUrl('action-kampf-list-sword-down.svg')

  const rows = collectSortedParticipants(
    items,
    getIniTieOrder(),
    getManualIniTieOverridePairs()
  )
  const activeId = combat.started ? combat.currentItemId : null
  const activeRow = activeId ? rows.find((r) => r.id === activeId) : null

  let title = 'vierpunkteins_kampf'

  if (combat.started && activeId) {
    if (combat.roundIntroPending) {
      const prevR =
        typeof combat.roundIntroPrevRound === 'number' &&
        combat.roundIntroPrevRound >= 1
          ? combat.roundIntroPrevRound
          : Math.max(1, combat.round - 1)
      const nr = prevR + 1
      if (activeId === ROUND_START_STEP_ID) {
        title = `Beginn der Kampfrunde · KR ${nr}`
      } else if (activeId === ROUND_END_STEP_ID) {
        title = `Ende der Kampfrunde · KR ${nr}`
      }
    } else if (activeId === ROUND_END_STEP_ID) {
      title = `Ende der Kampfrunde · Runde ${combat.round}`
    } else {
      const baseName = activeRow?.name?.trim() || 'Zug'
      const label = combat.currentPhaseLinkId
        ? `${baseName} · 2. Aktionsphase`
        : baseName
      title = `${label} · Runde ${combat.round}`
    }
  }

  await OBR.action.setBadgeText(undefined)
  await OBR.action.setIcon(iconUrl)
  await OBR.action.setTitle(title)
}
