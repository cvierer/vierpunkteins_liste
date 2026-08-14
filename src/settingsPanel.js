import OBR from '@owlbear-rodeo/sdk'
import { BUILD_VERSION } from './buildVersion.js'
import { isGmSync } from './editAccess.js'
import {
  getHideForeignHeroColorsForViewer,
  getShowActionStamps,
  getShowHeroOrientationRings,
  onHideForeignHeroColorsForViewerChange,
  onShowActionStampsChange,
  onShowHeroOrientationRingsChange,
  setHideForeignHeroColorsForViewer,
  setShowActionStamps,
  setShowHeroOrientationRings,
} from './localUiPrefs.js'
import {
  getRoomSettings,
  onRoomSettingsChange,
  patchRoomSettings,
} from './roomSettings.js'
import { mountSettingsTabs } from './settingsShell.js'
import { mountWappenEditor } from './wappenEditor.js'
import { cloneDefaultWappenDefs } from './wappenDefs.js'

export const KAMPF_GEAR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`

/**
 * Zahnrad oben links in der Kampf-Toolbar (Höhe Kampfrunde); GM bearbeitet, Spieler nur lesen.
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
  panel.className =
    'kampf-settings-panel kampf-settings-panel--with-wappen kampf-settings-panel--shell'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'kampf-settings-title')

  panel.innerHTML = `
    <div class="kampf-settings-panel__head">
      <h2 class="kampf-settings-panel__title" id="kampf-settings-title">Kampf-Einstellungen</h2>
      <p class="kampf-settings-panel__hint" data-kampf-settings-role-hint></p>
    </div>
    <div class="kampf-settings-panel__tabs" data-kset-tablist hidden></div>
    <div class="kampf-settings-panel__body" data-kset-pages>
      <div data-kset-page="raum" data-kset-page-label="Raum" data-kampf-settings-gm-page>
        <div class="kset-group">
          <h3 class="kset-group__title">Raum-Regeln</h3>
          <div class="kset-check" title="Bei INI strikt über 20, 30 bzw. 40 je eine zusätzliche Freie Aktion (Obergrenze 4 statt 2; Werte genau 20/30/40 zählen zur niedrigeren Stufe).">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-setting-high-ini-fa />
              <span><strong>Hohe Initiative: mehr Freie Aktionen</strong></span>
            </label>
            <p class="kset-check__hint">Ab INI &gt; 20/30/40 je +1 F.A. (max. 4).</p>
          </div>
          <div class="kset-check" title="Nach Abschluss einer Runde beginnt die Navigation mit „Ende der Kampfrunde“; nach Bestätigung springt der erste Zug auf die niedrigste INI. Ohne Option: Beginn der Kampfrunde, danach höchste INI.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-setting-round-intro-lowest-ini />
              <span><strong>Runde beginnt mit „Ende der Kampfrunde“</strong></span>
            </label>
            <p class="kset-check__hint">Erster Zug danach bei der niedrigsten INI. Standard: aus.</p>
          </div>
          <div class="kset-check" title="Voreinstellung für alle, die in den Kampf-Einstellungen keine eigene Wahl unter Anzeige getroffen haben. Wenn aktiv, sehen sie nur die Farbe des eigenen Helden.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-setting-hide-foreign-room />
              <span><strong>Fremde Heldenfarben ausblenden</strong></span>
            </label>
            <p class="kset-check__hint">Raum-Standard, wenn keine persönliche Anzeige-Wahl gesetzt ist.</p>
          </div>
        </div>
      </div>
      <div data-kset-page="anzeige" data-kset-page-label="Anzeige">
        <div class="kset-group">
          <h3 class="kset-group__title">Dieses Gerät</h3>
          <p class="kampf-settings-panel__microhint">Diese Optionen gelten nur auf deinem Gerät.</p>
          <div class="kset-check" title="Horizontale Linien zu Angriff, Abwehr, S.R.A. und F.A. in der Initiative-Liste. SL und Spieler können das unabhängig einstellen.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-setting-show-action-stamps />
              <span><strong>Aktionsstempel anzeigen</strong></span>
            </label>
          </div>
          <div class="kset-check" title="Farbe = Zeilenfarbe des Helden, Dreieck = Blickrichtung. Nur auf deinem Gerät.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-setting-show-orientation-rings />
              <span><strong>Orientierungsringe auf der Karte</strong></span>
            </label>
          </div>
          <div class="kset-check" title="Wenn aktiv, siehst du nur die Hintergrundfarbe deines eigenen Helden; andere nutzen den Standard-Hintergrund. Persönliche Wahl überschreibt den Raum-Standard.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-setting-hide-foreign-hero-colors />
              <span><strong>Fremde Heldenfarben ausblenden</strong></span>
            </label>
            <p class="kset-check__hint">Persönliche Ansicht; überschreibt den Raum-Standard.</p>
          </div>
        </div>
      </div>
      <div data-kset-page="wunden" data-kset-page-label="Wunden &amp; Zonen" data-kampf-settings-gm-page data-kampf-settings-wappen-section>
        <div class="kset-group">
          <h3 class="kset-group__title">Raum-Default</h3>
          <p class="kampf-settings-panel__microhint" title="Pro Kämpfer kann die SL in den Helden-Einstellungen eine eigene Liste setzen.">Standard-Kästchen für alle Helden. In den Rüstungskästchen den RS eintragen.</p>
          <div data-kampf-settings-wappen-host></div>
        </div>
      </div>
    </div>
    <div class="kampf-settings-panel__actions">
      <p class="kampf-settings-panel__version" data-kampf-settings-version aria-label="Build-Version"></p>
      <button type="button" class="btn kampf-settings-panel__cancel" data-kampf-settings-cancel>Abbrechen</button>
      <button type="button" class="btn btn--primary kampf-settings-panel__save" data-kampf-settings-save>Speichern und schließen</button>
    </div>
  `

  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)

  const tabsApi = mountSettingsTabs(panel)

  const highIniCb = panel.querySelector('[data-kampf-setting-high-ini-fa]')
  const roundIntroLowIniCb = panel.querySelector(
    '[data-kampf-setting-round-intro-lowest-ini]'
  )
  const hideForeignRoomCb = panel.querySelector(
    '[data-kampf-setting-hide-foreign-room]'
  )
  const stampsCb = panel.querySelector('[data-kampf-setting-show-action-stamps]')
  const orientationRingsCb = panel.querySelector(
    '[data-kampf-setting-show-orientation-rings]'
  )
  const foreignHeroCb = panel.querySelector(
    '[data-kampf-setting-hide-foreign-hero-colors]'
  )
  const roleHint = panel.querySelector('[data-kampf-settings-role-hint]')
  const versionEl = panel.querySelector('[data-kampf-settings-version]')
  const saveBtn = panel.querySelector('button.kampf-settings-panel__save')
  const cancelBtn = panel.querySelector('button.kampf-settings-panel__cancel')
  const wappenSection = panel.querySelector('[data-kampf-settings-wappen-section]')
  const wappenHost = panel.querySelector('[data-kampf-settings-wappen-host]')
  const gmPages = panel.querySelectorAll('[data-kampf-settings-gm-page]')

  /** @type {ReturnType<typeof mountWappenEditor> | null} */
  let wappenEditor = null
  let wappenValid = true

  /**
   * Zwischenspeicher: wird beim Öffnen gefüllt und beim „Abbrechen“ verworfen.
   * „Speichern und schließen“ überträgt die Werte in die Raum-Settings.
   */
  let pendingRoom = null
  let pendingStamps = null
  let pendingOrientationRings = null
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
    const gm = isGmSync()
    if (highIniCb instanceof HTMLInputElement) {
      highIniCb.checked = Boolean(src.highIniFreeActions)
      highIniCb.disabled = !gm
    }
    if (roundIntroLowIniCb instanceof HTMLInputElement) {
      roundIntroLowIniCb.checked = Boolean(src.roundIntroFocusLowestIni)
      roundIntroLowIniCb.disabled = !gm
    }
    if (hideForeignRoomCb instanceof HTMLInputElement) {
      hideForeignRoomCb.checked = Boolean(src.hideForeignHeroColors)
      hideForeignRoomCb.disabled = !gm
    }
    if (stampsCb instanceof HTMLInputElement) {
      stampsCb.checked = pendingStamps ?? getShowActionStamps()
      stampsCb.disabled = false
    }
    if (orientationRingsCb instanceof HTMLInputElement) {
      orientationRingsCb.checked =
        pendingOrientationRings ?? getShowHeroOrientationRings()
      orientationRingsCb.disabled = false
    }
    if (foreignHeroCb instanceof HTMLInputElement) {
      foreignHeroCb.checked =
        pendingForeignHero ?? getHideForeignHeroColorsForViewer()
      foreignHeroCb.disabled = false
    }
    if (roleHint) {
      roleHint.textContent = gm
        ? 'Raum-Regeln gelten für alle. Anzeige-Optionen nur auf diesem Gerät. Speichern schließt das Fenster.'
        : 'Raum-Regeln nur für die Spielleitung. Anzeige-Optionen kannst du selbst setzen.'
    }
    if (versionEl) {
      versionEl.textContent = `V.${BUILD_VERSION}`
    }
    for (const page of gmPages) {
      if (!(page instanceof HTMLElement)) continue
      page.hidden = !gm
      page.style.display = gm ? '' : 'none'
    }
    if (wappenSection instanceof HTMLElement) {
      wappenSection.hidden = !gm
      wappenSection.style.display = gm ? '' : 'none'
    }
    tabsApi.refresh()
    refreshSaveDisabled()
  }

  const closePanel = () => {
    backdrop.hidden = true
    backdrop.setAttribute('aria-hidden', 'true')
    backdrop.style.display = 'none'
    pendingRoom = null
    pendingStamps = null
    pendingOrientationRings = null
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
      hideForeignHeroColors: Boolean(s.hideForeignHeroColors),
    }
    pendingStamps = getShowActionStamps()
    pendingOrientationRings = getShowHeroOrientationRings()
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
      pendingOrientationRings !== null &&
      pendingOrientationRings !== getShowHeroOrientationRings()
    ) {
      setShowHeroOrientationRings(Boolean(pendingOrientationRings))
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

  hideForeignRoomCb?.addEventListener('change', () => {
    if (!isGmSync() || !(hideForeignRoomCb instanceof HTMLInputElement)) return
    if (pendingRoom) {
      pendingRoom.hideForeignHeroColors = hideForeignRoomCb.checked
    }
  })

  stampsCb?.addEventListener('change', () => {
    if (!(stampsCb instanceof HTMLInputElement)) return
    pendingStamps = stampsCb.checked
  })

  orientationRingsCb?.addEventListener('change', () => {
    if (!(orientationRingsCb instanceof HTMLInputElement)) return
    pendingOrientationRings = orientationRingsCb.checked
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

  const offOrientationPref = onShowHeroOrientationRingsChange(() => {
    if (!backdrop.hidden && orientationRingsCb instanceof HTMLInputElement) {
      pendingOrientationRings = getShowHeroOrientationRings()
      orientationRingsCb.checked = pendingOrientationRings
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
    offOrientationPref()
    offForeignHeroPref()
    offPlayer()
    tabsApi.destroy()
    gear.remove()
    backdrop.remove()
  }
}
