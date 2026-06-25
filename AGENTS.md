# vierpunkteins_kampf — Agent notes

## Stack and commands

- Vite 8, plain JS modules, `@owlbear-rodeo/sdk`.
- `npm install` → `npm run dev` (HTTPS dev server) → `npm run build` → load `dist/` as Owlbear extension.
- GitHub Pages: `BASE_PATH` is set in CI; local build uses [`src/buildVersion.js`](src/buildVersion.js) for the UI version label.

## Owlbear / HTTPS

- Owlbear loads extensions over **HTTPS**. Use a manifest URL like `https://localhost:5173/manifest.json` after `npm run dev`, accept the dev cert once. Plain `http` often fails (mixed content).

## Feature clusters (slimming / navigation)

- **Core (boot order matters):** [`src/main.js`](src/main.js) → `initCombatRoom`, `initEditAccess`, `setupCombatControls` — room combat state, edit permissions, toolbar (start/prev/next).
- **List and rules engine:** [`src/initiativeList.js`](src/initiativeList.js) (large) plus [`src/combatRoom.js`](src/combatRoom.js), [`src/phaseLinks.js`](src/phaseLinks.js), [`src/krCounters.js`](src/krCounters.js), participants/sort/manual INI tie helpers.
- **Secondary UI:** [`src/contextMenu.js`](src/contextMenu.js), [`src/settingsPanel.js`](src/settingsPanel.js), [`src/actionChrome.js`](src/actionChrome.js) (action title/icon sync).
- **Optional / auxiliary:** Long-handling ([`src/longHandlung.js`](src/longHandlung.js), `lh*`), hit zones (`hitZone*`), [`src/combatLog.js`](src/combatLog.js), legacy cleanup [`src/turnMarkerCleanup.js`](src/turnMarkerCleanup.js).

Heavy subsystems are mostly reached via initiative/combat/phase links, not separate apps. Prefer **dynamic `import()`** from `main.js` for peripheral modules before removing features.

## Module map — Barrels und Leaf-Module

Zwei große Dateien sind **Barrels (Shell + `export *`)**: ändere möglichst das passende **Leaf-Modul**, nicht das Barrel. Beide re-exportieren ihre Submodule, sodass bestehende Importe (`from './krCounters.js'` bzw. `from './iniModMeta.js'`) stabil bleiben.

### KR-Zähler/Pool — Barrel [`src/krCounters.js`](src/krCounters.js)

Bottom-up-Schichten (Blatt → oben), je mit eigenem Test:

- [`src/krMetaKeys.js`](src/krMetaKeys.js) — Meta-Keys, Defaults, Limits (`HERO_EXTRA_MAX`, `KR_*`).
- [`src/krDigit.js`](src/krDigit.js) — Zähler↔Marks-Konvertierung (`normalizeKrDigit`, `marksFromChargeValue`, `chargeValueFromMarks`).
- [`src/krCounterRead.js`](src/krCounterRead.js) — synchrone Reader/Hero-Extra/Parade/INI-Neg-Modus (`readKr*`, `readHeroExtra*`, `readHeroIniNeg*`, `migrateHeroExtraCountFields`).
- [`src/krStampPredicates.js`](src/krStampPredicates.js) — Primäraktions-Stempel-Prädikate (`motherPrimarySelfStamped`, `hasPrimaryActionStampAtCombatStep`).
- [`src/krPrimaryField.js`](src/krPrimaryField.js) — Paarmodus + Primärfeld (`readKrPairMode`, `krPairModeFieldForSlot`, `readKrFirstSlotKind`, `primaryFieldForKind`, `syncKrPrimaryLadungFromPrimaryField`).
- [`src/krIniLock.js`](src/krIniLock.js) — INI-Sperre/INI-Vorzeichen (`isHeroIniBelowZero`, `applyIniLockCharges`, `ensureFullFreeActionQuota`).
- [`src/krActionPool.js`](src/krActionPool.js) — reine Umwandlungs-Budget-Mathematik (`readHeroActionPool*`, `effectiveHeroPoolSplit`, `readKrActionPoolRem*`).
- [`src/krTransferMarks.js`](src/krTransferMarks.js) — Abwehr-Transfer-Marken (`krTransferMarkPresent`, `addOneAbwTransferChargeValue`).
- [`src/krZaoSlots.js`](src/krZaoSlots.js) — synchrone 2.A.-Objekt-Slot-Reader (`readZaoSlots`, `defaultZaoSlotForPhaseNum`, `metaHasPendingLoadedNonHeroExtraZao`, `syncReactionShieldForDualAng`).
- **`krCounters.js` selbst:** die **async Stempel-Engine** (`patchKrCounterByDelta`, Transfer-/Scene-Reset-Patches über `OBR.scene.items.updateItems`). Bewusst kohäsiv gehalten (tiefe sync/async-Kopplung) — vorsichtig editieren.

### Heldenblock — Barrel [`src/iniModMeta.js`](src/iniModMeta.js)

- [`src/heroExMetaKeys.js`](src/heroExMetaKeys.js) — `HERO_EX_*`-Meta-Keys.
- [`src/heroExMods.js`](src/heroExMods.js) — Mod-Datenschicht (`addHeroExMod`, `removeHeroExMod`, …).
- [`src/heroExpandTooltips.js`](src/heroExpandTooltips.js) — Tooltip-Texte (`LE_THRESHOLD_TOOLTIP`, `WUNDEN_DOTS_TOOLTIP_BY_ZONE`, …).
- [`src/heroExpandDom.js`](src/heroExpandDom.js) — DOM-Factories + statische SVG-Grafiken (`mountZoneMiniWappen`, `createLeThresholdGaugeBox`, `mountSlot9Placeholder`, `SVG_*`, `TP_TZ_BRIDGE_SVG`).
- **`iniModMeta.js` selbst:** `mountHeroExpandBlock` ist **eine sehr große Funktion** (Render-/Event-/Persist-Closure mit gemeinsamem lokalem State). Closures **nicht entlang sync/async-Grenzen mittendrin** auftrennen; Verhalten ist nur teilweise durch Smoke-Tests abgedeckt.

### Gemeinsame UI-Helfer

- [`src/dom.js`](src/dom.js) — `el(tag, props, ...children)` / `svgEl(...)` zum Entdoppeln von `createElement`-Boilerplate (siehe [`src/dom.test.js`](src/dom.test.js)).

## Wo ändere ich X?

- **KR-Zähler lesen/normalisieren** → `krCounterRead.js` / `krDigit.js`.
- **Mutter-Aktion Ang/SRA/L.H., Paarmodus** → `krPrimaryField.js`.
- **Verhalten bei INI < 0** → `krIniLock.js` (Sperre) + `krActionPool.js` (Budget-Verschiebung).
- **Ang.→Abw.-Schild-Umwandlung (Marken)** → `krTransferMarks.js`; Slot-/2.A.-Logik → `krZaoSlots.js`.
- **Stempel setzen/zurücknehmen (async, OBR)** → `krCounters.js` (`patchKrCounterByDelta` & Co.).
- **Wappen/Trefferzonen-Zelle, LE-Schwellen-Balken, SVG-Icons** → `heroExpandDom.js`.
- **Heldenblock-Verdrahtung/Persist/Layout** → `mountHeroExpandBlock` in `iniModMeta.js`.

## Tests / DOM-Harness

- `npm test` (Vitest). Default-Environment ist **`node`**.
- DOM-Tests setzen pro Datei `// @vitest-environment happy-dom` in Zeile 1 (z. B. [`src/dom.test.js`](src/dom.test.js), [`src/heroExpandMount.smoke.test.js`](src/heroExpandMount.smoke.test.js), [`src/initiativeListRender.smoke.test.js`](src/initiativeListRender.smoke.test.js)).
- Smoke-Tests prüfen **„mountet/rendert/teardownt ohne Throw" + Grundstruktur**, kein Pixel-Layout. Sie sind ein Sicherheitsnetz für das Zerlegen der UI-Monolithe, ersetzen aber **keine** Verhaltenstests.
- Test-only/Hilfs-Kalibrierung: [`src/distRingClassCalibration.test.js`](src/distRingClassCalibration.test.js) (DIST-Ringe).

## DIST-Ringe H/N/S/P (Owlbear-Checkliste)

Nach Änderungen an [`src/distanceRingsOverlay.js`](src/distanceRingsOverlay.js) / [`src/tokenDistance.js`](src/tokenDistance.js):

1. **Square + CHEBYSHEV** (häufig): Maßband an N/O/S/W — Ring **N** ≈ 2, **S** ≈ 4, **P** ≈ 5 Schritt.
2. **Square + MANHATTAN**: Raute-Ecken auf Schwelle.
3. **Hex + CHEBYSHEV**: 6-Eck-Ecken.
4. **EUCLIDEAN** auf Hex/Iso: Kontur-Polygon (nicht Kreis).
5. **(H)** in Spokes nur bei Zellberührung; H-Ring zeigt 1-Schritt-Grenze der Berührungszone.

Automatisiert: [`src/distRingClassCalibration.test.js`](src/distRingClassCalibration.test.js).

## Naming and push hygiene

- Never use the blocked personal-name identifier (spaced or compact variant) in code, docs, comments, commit messages, PR text, or push-related notes.
- Before commit/push, run a quick repo scan for the blocked identifier variants and remove/replace any matches found.
