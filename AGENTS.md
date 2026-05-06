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
