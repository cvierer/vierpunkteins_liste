/**
 * Markup für das Helden-Einstellungen-Modal.
 * IDs und data-*-Attribute bleiben stabil für die Verdrahtung in initiativeList.js.
 */
export function buildHeroSettingsPanelHtml() {
  return `
    <div class="kampf-settings-panel__head">
      <h2 class="kampf-settings-panel__title" id="kampf-hero-settings-title">Helden-Einstellungen</h2>
      <p class="kampf-settings-panel__hint" id="kampf-hero-settings-hint"></p>
    </div>
    <div class="kampf-settings-panel__tabs" data-kset-tablist hidden></div>
    <div class="kampf-settings-panel__body" data-kset-pages>

      <div data-kset-page="held" data-kset-page-label="Held">
        <div class="kset-group">
          <h3 class="kset-group__title">Darstellung</h3>
          <label class="init-row-extra-label" data-kampf-hero-color-field-label>Heldenfarbe</label>
          <p class="kampf-settings-panel__microhint" id="kampf-hero-color-microhint">Für alle in der Szene sichtbar. Klick setzt die Farbe; „×“ entfernt sie.</p>
          <div class="kampf-hero-color-grid" data-kampf-hero-color-grid></div>
        </div>
        <div class="kset-group" data-kampf-hero-gm-only>
          <h3 class="kset-group__title">Heldenblock</h3>
          <fieldset class="kset-radios">
            <legend class="kset-radios__legend">Zusatzfeld (zwischen AE und IB)</legend>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-extra-field" value="none" />
              <span><strong>Keins</strong></span>
            </label>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-extra-field" value="ke" />
              <span><strong>KE</strong> — Karmaenergie</span>
            </label>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-extra-field" value="gw" />
              <span><strong>GW</strong> — Gefahrenwert</span>
            </label>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-extra-field" value="lo" />
              <span><strong>LO</strong> — Loyalität</span>
            </label>
          </fieldset>
          <div class="kset-check" title="Bei Vierbeinern standardmäßig ausblendbar.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-hero-show-fk />
              <span><strong>FK anzeigen</strong></span>
            </label>
          </div>
          <div class="kset-check" title="Ausdauer zwischen FK und AE in der Wertezeile; standardmäßig aus.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-hero-show-au />
              <span><strong>AU anzeigen</strong></span>
            </label>
          </div>
        </div>
      </div>

      <div data-kset-page="aktionen" data-kset-page-label="Aktionen" data-kampf-hero-gm-only>
        <div class="kset-group">
          <h3 class="kset-group__title">Ladungen / KR</h3>
          <p class="kampf-settings-panel__microhint" title="Aktions-Ladungen + Reaktions-Schilde + gestempelte Ladungen = Ladungen gesamt (konstant). Beim Rundenstart werden Objekte und Schilde daraus befüllt. Bei INI &lt; 0 wird intern eine Aktionsladung zugunsten der Reaktion verschoben.">Aktion + Reaktion + Stempel = Gesamtladung. Bei INI &lt; 0 wandert 1 Ladung zur Reaktion.</p>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-pool-max">Ladungen gesamt</label>
            <input type="text" id="kampf-hero-settings-pool-max" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Gesamtbudget Angriff+Abwehr pro KR (1–20)" />
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-pool-ang">Aktionsladungen</label>
            <input type="text" id="kampf-hero-settings-pool-ang" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Ladungen als Aktionsobjekte beim Rundenstart (0…Max); Reaktion = Rest" />
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-pool-abw">Reaktionsladungen</label>
            <input type="text" id="kampf-hero-settings-pool-abw" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Ladungen als blaue Schilde beim Rundenstart (0…Max); Aktion = Rest" />
          </div>
        </div>
        <div class="kset-group">
          <h3 class="kset-group__title">Zusatzaktionen</h3>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-fa-max">Freie Aktionen (max.)</label>
            <input type="text" id="kampf-hero-settings-fa-max" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="0–10; leer = globale Regel (highIniFreeActions + INI)" />
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-ang-count">Zusätzliche Angriffe</label>
            <input type="text" id="kampf-hero-settings-ang-count" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="0–10 zusätzliche Angriffs-ZAOs" />
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-par-count">Zusätzliche Paraden</label>
            <input type="text" id="kampf-hero-settings-par-count" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="0–10 zusätzliche schwarze Schilde" />
          </div>
        </div>
        <div class="kset-group">
          <h3 class="kset-group__title">INI &lt; 0</h3>
          <p class="kampf-settings-panel__microhint">Wie viele Ladungen gesperrt werden und ob das Schwert verfügbar bleibt.</p>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-ini-neg-lost">Weniger Aktionen</label>
            <input type="text" id="kampf-hero-settings-ini-neg-lost" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Wie viele Ladungen im negativen INI-Bereich gesperrt werden (0–10). Standard: 1." />
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-ini-neg-ang">Angriffe erlaubt</label>
            <select id="kampf-hero-settings-ini-neg-ang" class="init-row-extra-input init-row-extra-select">
              <option value="no">Nein (kein Schwert)</option>
              <option value="yes">Ja (Schwert erlaubt)</option>
              <option value="zatOnly">Nur z.AT zulassen</option>
            </select>
          </div>
        </div>
        <div class="kset-group">
          <h3 class="kset-group__title">Umwandlung</h3>
          <p class="kampf-settings-panel__microhint" title="Greifen nur, wenn das Schloss in der Liste auf Automatik steht und die Navigation nicht am Beginn/Ende der Kampfrunde ist. Nur eine der Regeln oder keine.">Nur bei Schloss „Automatik“, außerhalb KR-Beginn/-Ende.</p>
          <fieldset class="kampf-settings-convert-announce" data-kampf-hero-convert-announce>
            <legend class="kampf-settings-convert-announce__legend">Ansage-Regel</legend>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-convert-announce" value="none" />
              <span><strong>Keine Zusatzregel</strong></span>
            </label>
            <label class="kampf-settings-radio-label" title="Solange die globale Kampf-Navigation noch nicht den Mutter-Zug dieses Helden verlassen hat (einschließlich seiner 2.-Aktionszeilen mit gleicher INI), darf der Spieler die Umwandlungs-Pfeile nutzen.">
              <input type="radio" name="kampf-hero-convert-announce" value="firstPhase" />
              <span><strong>Bis einschl. erster INI-Phase</strong></span>
            </label>
            <label class="kampf-settings-radio-label" title="Der Spieler darf die Umwandlungs-Pfeile in jeder Navigations-Position der Kampfrunde nutzen; inkl. Spiegelanzeige an regulären 2.-Aktionszeilen.">
              <input type="radio" name="kampf-hero-convert-announce" value="entireRound" />
              <span><strong>Gesamte Kampfrunde</strong></span>
            </label>
          </fieldset>
        </div>
      </div>

      <div data-kset-page="wunden" data-kset-page-label="Wunden &amp; Zonen" data-kampf-hero-gm-only data-kampf-hero-wappen-section>
        <div class="kset-group">
          <h3 class="kset-group__title">Vorlage</h3>
          <p class="kampf-settings-panel__microhint" title="Eigene startet wahlweise aus Mensch oder Vierbeiner und ist danach komplett bearbeitbar (W20-Zonen, Auto-Mods). In den Rüstungskästchen den RS eintragen.">Mensch, Vierbeiner oder eigene Liste. RS in den Rüstungskästchen.</p>
          <fieldset class="kampf-settings-convert-announce">
            <legend class="kampf-settings-convert-announce__legend">Kästchen für Wunden und Trefferzonen</legend>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-wappen-source" value="global" />
              <span><strong>Mensch</strong> (Standard)</span>
            </label>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-wappen-source" value="vierbeiner" />
              <span><strong>Vierbeiner</strong></span>
            </label>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-wappen-source" value="own" />
              <span><strong>Eigene Liste</strong> für diesen Kämpfer</span>
            </label>
          </fieldset>
          <div data-kampf-hero-wappen-host hidden></div>
          <div class="kset-check" data-kampf-hero-slot9-toggle-wrap title="SW-Platzhalter im Heldenblock; optional für Wesen mit neun Zonen.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-hero-slot9-enabled />
              <span><strong>9. Trefferzone</strong></span>
            </label>
          </div>
          <div data-kampf-hero-slot9-host hidden></div>
        </div>
        <div class="kset-group">
          <h3 class="kset-group__title">LE &amp; Zustand</h3>
          <div class="kset-check" title="Zusätzliche Schwelle unterhalb der Prozentbänder.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-hero-le-threshold-enabled />
              <span><strong>LE-Schwelle aktivieren</strong></span>
            </label>
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-le-threshold-value">LE-Schwelle</label>
            <input type="text" id="kampf-hero-le-threshold-value" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Positive Zahl, z. B. 5. Leer oder deaktiviert = keine zusätzliche Schwelle." />
          </div>
          <div class="kset-check" title="Rein optische Überlagerung bei LE-Schwelle.">
            <label class="kampf-settings-checkbox-label">
              <input type="checkbox" data-kampf-hero-unfaehig-enabled />
              <span><strong>Auto-Mod „unfähig“</strong></span>
            </label>
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-unfaehig-threshold-value">Schwelle „unfähig“</label>
            <input type="text" id="kampf-hero-unfaehig-threshold-value" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="0 oder größer. Standard Mensch: 5, Vierbeiner: 0." />
          </div>
          <fieldset class="kampf-settings-convert-announce">
            <legend class="kampf-settings-convert-announce__legend">Todesregel</legend>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-death-mode" value="lt0" />
              <span><strong>Tod bei LE ≤ 0</strong></span>
            </label>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-death-mode" value="minusKo" />
              <span><strong>Tod ab LE ≤ −KO</strong></span>
            </label>
            <label class="kampf-settings-radio-label">
              <input type="radio" name="kampf-hero-death-mode" value="minusOnePointFiveKo" />
              <span><strong>Tod ab LE ≤ −1,5 KO</strong></span>
            </label>
          </fieldset>
        </div>
      </div>

      <div data-kset-page="karte" data-kset-page-label="Karte" data-kampf-hero-gm-only>
        <div class="kset-group" data-kampf-hero-dist-ring-section>
          <h3 class="kset-group__title">Distanzkreise</h3>
          <p class="kampf-settings-panel__microhint">Beim Halten des Dist-Kästchens nur aktivierte Ringe anzeigen.</p>
          <div class="kampf-hero-dist-ring__grid" data-kampf-hero-dist-ring-host></div>
          <div class="kset-field kampf-hero-dist-class-x-wrap" data-kampf-hero-dist-class-x-wrap hidden>
            <label class="kset-field__label kampf-hero-dist-class-x__label" for="kampf-hero-dist-class-x-schritt">Grenze Klasse X</label>
            <input type="text" id="kampf-hero-dist-class-x-schritt" class="init-row-extra-input kampf-hero-dist-class-x__input" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="3" title="Leer = Klasse X aus. Ring X nur mit gesetztem Wert und aktivierter Checkbox. Schritt 1–999." />
          </div>
        </div>
        <div class="kset-group" data-kampf-hero-custom-dist-section>
          <h3 class="kset-group__title">Reichweiten-Profile</h3>
          <p class="kampf-settings-panel__microhint">Fernkampf, Zauber u. a.: beliebig viele Profile, je bis zu 99 Distanzstufen.</p>
          <div data-kampf-hero-custom-dist-host></div>
        </div>
      </div>

      <div data-kset-page="erweitert" data-kset-page-label="Erweitert" data-kampf-hero-gm-only>
        <div class="kset-group">
          <h3 class="kset-group__title">Phasen-Offsets</h3>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-offset">Offset L.H.</label>
            <input type="text" id="kampf-hero-settings-offset" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Abstand der L.H.-Auslöser-INI unter der Helden-INI (Standard 8)" />
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-zat-offset">Offset z.AT</label>
            <input type="text" id="kampf-hero-settings-zat-offset" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Abstand zusätzlicher Angriffe unter der Helden-INI (Standard 4)" />
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-ao-offset">Offset 2.AO / PA→AT</label>
            <input type="text" id="kampf-hero-settings-ao-offset" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Abstand der 2.A.-Wurzel bei Plus/Umwandlung unter der Helden-INI (Standard 8)" />
          </div>
          <div class="kset-field">
            <label class="kset-field__label" for="kampf-hero-settings-apkr">L.H. Aktionen / KR</label>
            <input type="text" id="kampf-hero-settings-apkr" class="init-row-extra-input" inputmode="numeric" autocomplete="off" spellcheck="false" title="Längerfristige Handlung: Auslöser pro Kampfrunde (1–10)" />
          </div>
        </div>
        <div class="kset-group">
          <h3 class="kset-group__title">„Unfähig“-Details</h3>
          <div class="kset-field" style="grid-template-columns: 1fr;">
            <label class="kset-field__label" for="kampf-hero-unfaehig-mark-fields">Markierung (rote Diagonale)</label>
            <input type="text" id="kampf-hero-unfaehig-mark-fields" class="init-row-extra-input" autocomplete="off" spellcheck="false" title="Kommagetrennt, z. B. at,pa,a,tp,fk" />
          </div>
          <div class="kset-field" style="grid-template-columns: 1fr;">
            <label class="kset-field__label" for="kampf-hero-unfaehig-fixed-fields">Optische Fixwerte</label>
            <input type="text" id="kampf-hero-unfaehig-fixed-fields" class="init-row-extra-input" autocomplete="off" spellcheck="false" title="Kommagetrennt, z. B. at=0,pa=0,a=0,tp=0,fk=0,gs=1" />
          </div>
        </div>
      </div>

    </div>
    <div class="kampf-settings-panel__actions">
      <button type="button" class="btn kampf-settings-panel__cancel" data-kampf-hero-settings-cancel>Abbrechen</button>
      <button type="button" class="btn btn--primary kampf-settings-panel__save" data-kampf-hero-settings-save>Speichern und schließen</button>
    </div>
  `
}
