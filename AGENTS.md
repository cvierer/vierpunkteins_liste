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
