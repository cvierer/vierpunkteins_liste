import './style.css'
import { BUILD_VERSION } from './buildVersion.js'
import OBR from '@owlbear-rodeo/sdk'
import { initEditAccess, isGmSync } from './editAccess.js'
import { initCombatRoom } from './combatRoom.js'
import { setupCombatControls } from './combatControls.js'

const appRoot = document.querySelector('#app')
appRoot.innerHTML = `
  <header class="app-header">
    <div class="combat-bar" data-combat-root>
      <div class="combat-toolbar combat-toolbar--grid">
        <span class="combat-round-label" data-combat-round>Kampfrunde —</span>
        <button
          type="button"
          class="btn btn--nav"
          data-combat-prev
          aria-label="Zurück: Stempel an diesem Zug rückgängig oder vorheriger Zug"
        >Zurück</button>
        <button type="button" class="btn btn--nav btn--primary btn--combat-toggle" data-combat-toggle>Start</button>
        <button
          type="button"
          class="btn btn--nav"
          data-combat-next
          aria-label="Weiter: Aktion stempeln oder nächster Zug"
        >Weiter</button>
      </div>
    </div>
  </header>
  <p id="standalone-hint" class="standalone-hint" hidden></p>
  <div class="kampf-list-section">
    <div class="kampf-list-head" aria-hidden="true">
      <span class="kampf-h-spacer kampf-h-spacer--expand" aria-hidden="true"></span>
      <div class="kampf-col-za-group">
        <span class="kampf-col-label kampf-col-label--counter" title="Aktion">Aktion</span>
        <span class="kampf-h-spacer kampf-h-spacer--action-dist" aria-hidden="true"></span>
        <span class="kampf-col-label kampf-col-label--counter" title="Distanz (halten)">Dist</span>
        <span class="kampf-h-spacer kampf-h-spacer--action-reaction" aria-hidden="true"></span>
        <span class="kampf-col-label kampf-col-label--counter" title="Freie Aktion">Frei</span>
        <span class="kampf-h-spacer kampf-h-spacer--reaction-frei" aria-hidden="true"></span>
        <span class="kampf-col-label kampf-col-label--counter" title="Reaktion">Reakt</span>
      </div>
      <span class="kampf-col-label kampf-col-label--name">Name</span>
      <span class="kampf-h-spacer" aria-hidden="true"></span>
      <span class="kampf-col-label kampf-col-label--ini">INI</span>
      <span class="kampf-h-spacer kampf-h-spacer--swap" aria-hidden="true"></span>
    </div>
    <div class="initiative-list-host" id="initiative-list-host">
      <div class="initiative-list-scroll">
        <div class="initiative-list-scroll-inner">
          <ul id="initiative-list" class="initiative-list" aria-label="vierpunkteins_kampf"></ul>
        </div>
        <div
          class="kampf-round-intro-board"
          data-kampf-round-intro
          hidden
          aria-modal="true"
          role="dialog"
          aria-labelledby="kampf-round-intro-title"
          aria-describedby="kampf-round-intro-hint"
        >
          <div class="kampf-round-intro-board__panel">
            <p
              class="kampf-round-intro-board__title"
              id="kampf-round-intro-title"
              data-kampf-round-intro-label
            ></p>
            <p class="kampf-round-intro-board__hint" id="kampf-round-intro-hint">
              Zum Fortfahren oben „Weiter“ drücken.
            </p>
          </div>
        </div>
      </div>
    </div>
    <div class="kampf-list-footer">
      <div class="kampf-settings-gear-host" id="kampf-settings-gear-host"></div>
      <div id="kampf-build-version" class="kampf-build-version" aria-hidden="true"></div>
    </div>
  </div>
`
const buildVerEl = document.getElementById('kampf-build-version')
if (buildVerEl) {
  buildVerEl.textContent = `V.${BUILD_VERSION}`
}

if (OBR.isAvailable) {
  OBR.onReady(async () => {
    await initCombatRoom()
    await initEditAccess()
    const syncViewerChrome = () => {
      const gm = isGmSync()
      document.documentElement.classList.toggle('v4-is-gm', gm)
      if (buildVerEl) buildVerEl.hidden = !gm
    }
    syncViewerChrome()
    OBR.player.onChange(() => syncViewerChrome())
    void import('./turnMarkerCleanup.js').then((m) => m.cleanupLegacyTurnMarkers())

    const combatRoot = document.querySelector('[data-combat-root]')
    const { refreshBar } = await setupCombatControls(combatRoot)
    ;(await import('./heroActionLabel.js')).setupHeroActionLabel()

    const [{ setupContextMenu }, { setupInitiativeList }, { setupSettingsPanel }] =
      await Promise.all([
        import('./contextMenu.js'),
        import('./initiativeList.js'),
        import('./settingsPanel.js'),
      ])

    setupContextMenu()
    setupInitiativeList(document.querySelector('#initiative-list'), {
      onListChange: (items) => {
        refreshBar()
        if (items) {
          void import('./actionChrome.js').then((m) => m.syncActionChrome(items))
        }
      },
    })
    setupSettingsPanel(document.querySelector('#kampf-settings-gear-host'))
    ;(await import('./heroOrientationRingsOverlay.js')).setupHeroOrientationRings()
  })
} else {
  const hint = document.querySelector('#standalone-hint')
  hint.hidden = false
  hint.innerHTML = `
    <strong>Nur Vorschau im Browser:</strong> Ohne Owlbear Rodeo gibt es keine Szene und kein SDK –
    die Liste bleibt leer. Zum Testen die Extension in Owlbear einbinden.
    <br /><br />
    <strong>„Failed to fetch“:</strong> Owlbear nutzt HTTPS. Verwende die Manifest-URL mit
    <strong>https://</strong> (z.&nbsp;B. nach <code>npm run dev</code>:
    <code>https://localhost:5173/manifest.json</code>) und bestätige das selbstsignierte Zertifikat einmal im Browser.
    Reine <code>http://</code>-Links blockiert der Browser oft (Mixed Content).
  `
}
