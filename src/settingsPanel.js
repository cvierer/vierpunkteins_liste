import OBR from '@owlbear-rodeo/sdk'
import { isGmSync } from './editAccess.js'
import {
  getHideForeignHeroColorsForViewer,
  getShowActionStamps,
  onHideForeignHeroColorsForViewerChange,
  onShowActionStampsChange,
  setHideForeignHeroColorsForViewer,
  setShowActionStamps,
} from './localUiPrefs.js'
import {
  getRoomSettings,
  onRoomSettingsChange,
  patchRoomSettings,
} from './roomSettings.js'
import { mountWappenEditor } from './wappenEditor.js'
import { cloneDefaultWappenDefs } from './wappenDefs.js'

export const KAMPF_GEAR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`

/**
 * Zahnrad im Listen-Footer (links); GM bearbeitet, Spieler nur lesen.
 * @param {HTMLElement | null} gearHost Eltern-Container (z. B. #kampf-settings-gear-host)
 * @returns {() => void} Aufräumen
 */
export function setupSettingsPanel(gearHost) {
  if (!gearHost) return () => {}

  const gear = document.createElement('button')
  gear.type = 'button'
  gear.className = 'kampf-settings-gear'
  gear.innerHTML = KAMPF_GEAR_ICON_SVG
  gear.title = 'Einstellungen'
  gear.setAttribute('aria-label', 'Einstellungen öffnen')
  gearHost.appendChild(gear)

  const backdrop = document.createElement('div')
  backdrop.className = 'kampf-settings-backdrop'
  backdrop.hidden = true
  backdrop.setAttribute('aria-hidden', 'true')
  backdrop.style.display = 'none'

  const panel = document.createElement('div')
  panel.className = 'kampf-settings-panel kampf-settings-panel--with-wappen'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'kampf-settings-title')

  panel.innerHTML = `
    <h2 class="kampf-settings-panel__title" id="kampf-settings-title">Kampf-Einstellungen</h2>
    <p class="kampf-settings-panel__hint" data-kampf-settings-role-hint></p>
    <div class="kampf-settings-panel__section">
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-setting-high-ini-fa />
        <span><strong>Hohe Initiative (optional):</strong> Bei INI strikt über 20, 30 bzw. 40 je eine zusätzliche Freie Aktion (Obergrenze 4 statt 2; Werte genau 20/30/40 zählen zur niedrigeren Stufe).</span>
      </label>
    </div>
    <div class="kampf-settings-panel__section">
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-setting-round-intro-lowest-ini />
        <span><strong>Kampfrunden-Beginn (umgekehrte INI):</strong> Nach Abschluss einer Runde beginnt die Navigation mit dem Eintrag <strong>„Ende der Kampfrunde“</strong> (statt „Beginn“); nach Bestätigung springt der erste Zug auf die <strong>niedrigste INI</strong>. Ohne diese Option: Navigation beginnt mit <strong>„Beginn der Kampfrunde“</strong>, danach höchste INI. Standard: aus.</span>
      </label>
    </div>
    <div class="kampf-settings-panel__section">
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-setting-show-action-stamps />
        <span><strong>Aktionsstempel</strong> in der Initiative-Liste anzeigen (horizontale Linien zu Angriff, Abwehr, S.R.A. und F.A.). Gilt nur auf deinem Gerät; SL und Spieler können das unabhängig einstellen.</span>
      </label>
    </div>
    <div class="kampf-settings-panel__section">
      <label class="kampf-settings-checkbox-label">
        <input type="checkbox" data-kampf-setting-hide-foreign-hero-colors />
        <span><strong>Fremde Heldenfarben ausblenden:</strong> Wenn aktiv, siehst du nur die Hintergrundfarbe deines eigenen Helden; andere Helden nutzen den Standard-Hintergrund. Gilt nur auf deinem Gerät. Ohne eigene Auswahl hier gilt der <strong>Raum-Standard</strong> (die Spielleitung kann den Standard unter Helden-Einstellungen setzen).</span>
      </label>
    </div>
    <div class="kampf-settings-panel__section" data-kampf-settings-wappen-section>
      <h3 class="kampf-settings-panel__sub">Wunden und Trefferzonen (Raum-Default)</h3>
      <p class="kampf-settings-panel__microhint">Standard-Kästchen für Wunden und Trefferzonen für alle Helden. In den Rüstungskästchen (früher Wappenkästchen) kannst du den Rüstungsschutz eintragen. Pro Kämpfer kann die Spielleitung in den Helden-Einstellungen eine eigene Liste setzen.</p>
      <div data-kampf-settings-wappen-host></div>
    </div>
    <div class="kampf-settings-panel__section kampf-settings-panel__future">
      <h3 class="kampf-settings-panel__sub">Weitere Ideen (noch nicht umgesetzt)</h3>
      <ul class="kampf-settings-panel__ideas">
        <li>Abstand der L.H.-Auslöser-INI zum Heldenwert (statt fest 8)</li>
        <li>Ob S.R.A. / Ang. / Abw. pro KR begrenzt oder unbegrenzt gezählt werden</li>
        <li>Automatische Kampfrunden-Stempel oder Würfelprotokoll</li>
        <li>Sichtbarkeit: nur GM sieht bestimmte Spalten</li>
        <li>INI-Schwellen der Hohen Initiative anpassbar (20/30/40)</li>
      </ul>
    </div>
    <div class="kampf-settings-panel__actions">
      <button type="button" class="btn kampf-settings-panel__cancel" data-kampf-settings-cancel>Abbrechen</button>
      <button type="button" class="btn btn--primary kampf-settings-panel__save" data-kampf-settings-save>Speichern und schließen</button>
    </div>
  `

  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)

  const highIniCb = panel.querySelector('[data-kampf-setting-high-ini-fa]')
  const roundIntroLowIniCb = panel.querySelector(
    '[data-kampf-setting-round-intro-lowest-ini]'
  )
  const stampsCb = panel.querySelector('[data-kampf-setting-show-action-stamps]')
  const foreignHeroCb = panel.querySelector(
    '[data-kampf-setting-hide-foreign-hero-colors]'
  )
  const roleHint = panel.querySelector('[data-kampf-settings-role-hint]')
  const saveBtn = panel.querySelector('button.kampf-settings-panel__save')
  const cancelBtn = panel.querySelector('button.kampf-settings-panel__cancel')
  const wappenSection = panel.querySelector('[data-kampf-settings-wappen-section]')
  const wappenHost = panel.querySelector('[data-kampf-settings-wappen-host]')

  /** @type {ReturnType<typeof mountWappenEditor> | null} */
  let wappenEditor = null
  let wappenValid = true

  /**
   * Zwischenspeicher: wird beim Öffnen gefüllt und beim „Abbrechen“ verworfen.
   * „Speichern und schließen“ überträgt die Werte in die Raum-Settings.
   */
  let pendingRoom = null
  let pendingStamps = null
  let pendingForeignHero = null
  /** Aktuelle Wappen-Liste im Editor (nur GM); null wenn nicht eingelesen. */
  let pendingWappen = null

  const refreshSaveDisabled = () => {
    if (!(saveBtn instanceof HTMLButtonElement)) return
    saveBtn.disabled = isGmSync() && !wappenValid
    saveBtn.title = saveBtn.disabled
      ? 'Wappen-Konfiguration ist noch unvollständig (W20 1–20 müssen abgedeckt sein)'
      : ''
  }

  const syncUi = () => {
    const src = pendingRoom ?? getRoomSettings()
    if (highIniCb instanceof HTMLInputElement) {
      highIniCb.checked = Boolean(src.highIniFreeActions)
      highIniCb.disabled = !isGmSync()
    }
    if (roundIntroLowIniCb instanceof HTMLInputElement) {
      roundIntroLowIniCb.checked = Boolean(src.roundIntroFocusLowestIni)
      roundIntroLowIniCb.disabled = !isGmSync()
    }
    if (stampsCb instanceof HTMLInputElement) {
      stampsCb.checked = pendingStamps ?? getShowActionStamps()
      stampsCb.disabled = false
    }
    if (foreignHeroCb instanceof HTMLInputElement) {
      foreignHeroCb.checked =
        pendingForeignHero ?? getHideForeignHeroColorsForViewer()
      foreignHeroCb.disabled = false
    }
    if (roleHint) {
      roleHint.textContent = isGmSync()
        ? 'Als Spielleitung kannst du die kampfbezogenen Raum-Optionen ändern; alle Spieler sehen dieselben Werte. „Aktionsstempel“ und „Fremde Heldenfarben“ sind persönliche Anzeige-Optionen (nur bei dir). Änderungen greifen erst bei „Speichern und schließen“.'
        : 'Nur die Spielleitung kann die Raum-Option oben ändern. „Aktionsstempel“ und „Fremde Heldenfarben“ kannst du für deine Ansicht selbst einstellen. Änderungen greifen erst bei „Speichern und schließen“.'
    }
    if (wappenSection instanceof HTMLElement) {
      const gm = isGmSync()
      wappenSection.hidden = !gm
      wappenSection.style.display = gm ? '' : 'none'
    }
    refreshSaveDisabled()
  }

  const closePanel = () => {
    backdrop.hidden = true
    backdrop.setAttribute('aria-hidden', 'true')
    backdrop.style.display = 'none'
    pendingRoom = null
    pendingStamps = null
    pendingForeignHero = null
    pendingWappen = null
    if (wappenEditor) {
      wappenEditor.destroy()
      wappenEditor = null
    }
    gear.focus()
  }

  const openPanel = () => {
    const s = getRoomSettings()
    pendingRoom = {
      highIniFreeActions: Boolean(s.highIniFreeActions),
      roundIntroFocusLowestIni: Boolean(s.roundIntroFocusLowestIni),
    }
    pendingStamps = getShowActionStamps()
    pendingForeignHero = getHideForeignHeroColorsForViewer()
    if (isGmSync() && wappenHost instanceof HTMLElement) {
      if (wappenEditor) {
        wappenEditor.destroy()
        wappenEditor = null
      }
      const initial = Array.isArray(s.wappenDefs) && s.wappenDefs.length > 0
        ? s.wappenDefs
        : cloneDefaultWappenDefs()
      pendingWappen = initial
      wappenEditor = mountWappenEditor(wappenHost, {
        initial,
        readOnly: false,
        onChange: (next) => {
          pendingWappen = next
        },
        onValidityChange: (ok) => {
          wappenValid = ok
          refreshSaveDisabled()
        },
      })
      wappenValid = wappenEditor.isValid()
    } else {
      pendingWappen = null
      wappenValid = true
    }
    syncUi()
    backdrop.hidden = false
    backdrop.style.display = 'flex'
    backdrop.setAttribute('aria-hidden', 'false')
    saveBtn instanceof HTMLElement ? saveBtn.focus() : null
  }

  const saveAndClose = async () => {
    if (isGmSync() && pendingRoom) {
      const target = pendingRoom
      const wappenSnap = pendingWappen
      await patchRoomSettings((cur) => ({
        ...cur,
        ...target,
        ...(wappenSnap !== null ? { wappenDefs: wappenSnap } : {}),
      }))
    }
    if (pendingStamps !== null && pendingStamps !== getShowActionStamps()) {
      setShowActionStamps(Boolean(pendingStamps))
    }
    if (
      pendingForeignHero !== null &&
      pendingForeignHero !== getHideForeignHeroColorsForViewer()
    ) {
      setHideForeignHeroColorsForViewer(Boolean(pendingForeignHero))
    }
    closePanel()
  }

  gear.addEventListener('click', (e) => {
    e.preventDefault()
    openPanel()
  })

  saveBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void saveAndClose()
  })

  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    closePanel()
  })

  /** true nur wenn die Druckgeste direkt den Dimm traf (kein Markieren aus einem Feld, Loslassen auf Dimm). */
  let backdropPointerFromBackdrop = false
  backdrop.addEventListener('pointerdown', (e) => {
    backdropPointerFromBackdrop = e.target === backdrop
  })
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && backdropPointerFromBackdrop) closePanel()
  })

  const onDocKey = (e) => {
    if (e.key === 'Escape' && !backdrop.hidden) {
      e.preventDefault()
      closePanel()
    }
  }
  document.addEventListener('keydown', onDocKey)

  highIniCb?.addEventListener('change', () => {
    if (!isGmSync() || !(highIniCb instanceof HTMLInputElement)) return
    if (pendingRoom) pendingRoom.highIniFreeActions = highIniCb.checked
  })

  roundIntroLowIniCb?.addEventListener('change', () => {
    if (!isGmSync() || !(roundIntroLowIniCb instanceof HTMLInputElement)) return
    if (pendingRoom) {
      pendingRoom.roundIntroFocusLowestIni = roundIntroLowIniCb.checked
    }
  })

  stampsCb?.addEventListener('change', () => {
    if (!(stampsCb instanceof HTMLInputElement)) return
    pendingStamps = stampsCb.checked
  })

  foreignHeroCb?.addEventListener('change', () => {
    if (!(foreignHeroCb instanceof HTMLInputElement)) return
    pendingForeignHero = foreignHeroCb.checked
  })

  const offSettings = onRoomSettingsChange(() => {
    if (!backdrop.hidden) syncUi()
  })

  const offStampPref = onShowActionStampsChange(() => {
    if (!backdrop.hidden && stampsCb instanceof HTMLInputElement) {
      stampsCb.checked = getShowActionStamps()
    }
  })

  const offForeignHeroPref = onHideForeignHeroColorsForViewerChange(() => {
    if (!backdrop.hidden && foreignHeroCb instanceof HTMLInputElement) {
      pendingForeignHero = getHideForeignHeroColorsForViewer()
      foreignHeroCb.checked = pendingForeignHero
    }
  })

  const offPlayer = OBR.player.onChange(() => {
    if (!backdrop.hidden) syncUi()
  })

  return () => {
    document.removeEventListener('keydown', onDocKey)
    offSettings()
    offStampPref()
    offForeignHeroPref()
    offPlayer()
    gear.remove()
    backdrop.remove()
  }
}
