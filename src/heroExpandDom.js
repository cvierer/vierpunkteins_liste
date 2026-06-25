// DOM-Factories und statische SVG-Grafiken für den Heldenblock.
// Modul-Level-Helfer ohne Closure-/Render-State (nur DOM-APIs + statische
// Tooltip-Texte). Aus iniModMeta.js ausgelagert und dort über das Barrel
// re-exportiert (verhaltensneutral) — Etappe 4, DOM-Factories.

import { LE_THRESHOLD_TOOLTIP, WUNDEN_DOTS_TOOLTIP_BY_ZONE } from './heroExpandTooltips.js'

function strOrEmpty(v) {
  if (v === undefined || v === null) return ''
  return String(v)
}

/** Zwischen TP und TZ: Tool-Schwert-Icon, Rotation/Skalierung via CSS. */
export const TP_TZ_BRIDGE_SVG =
  '<svg class="init-hero-ex__sp-tz-bridge-icon" xmlns="http://www.w3.org/2000/svg" viewBox="-5 0 34 34" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" focusable="false"><g><ellipse cx="12" cy="30.6" rx="2.5" ry="2.3" fill="#5d4037"/><circle cx="12" cy="30.6" r="1.85" fill="#b8860b"/><circle cx="12" cy="30.6" r="0.85" fill="#7e1010"/><path fill="#3e2723" d="M10.4 22.4 H13.6 V29.8 H10.4 Z"/><path fill="#5d4037" d="M10.55 22.6 H13.45 V23.5 H10.55 Z M10.55 24.4 H13.45 V25.3 H10.55 Z M10.55 26.2 H13.45 V27.1 H10.55 Z M10.55 28.0 H13.45 V28.9 H10.55 Z"/><path fill="#4f4643" d="M3.4 18.9 H20.6 L18.6 22.4 H5.4 Z"/><path fill="#6d615d" d="M4.2 19.3 H19.8 L18.0 22.0 H6.0 Z"/><ellipse cx="12" cy="20.7" rx="1.7" ry="1.0" fill="#584e4a"/><path fill="#5d4037" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 Z"/><path fill="#7e1010" d="M10.2 18.5 L11.6 2.5 L12.4 2.5 L13.8 18.5 Z"/><path fill="#c62828" d="M10.65 18.3 L11.7 3.4 L12.3 3.4 L13.35 18.3 Z"/><path fill="#ef9a9a" opacity="0.85" d="M11.85 4 L12.15 4 L12.0 17.6 Z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" stroke-linejoin="round" d="M9.6 18.9 L11.4 1.4 L12.6 1.4 L14.4 18.9 H20.6 L18.6 22.4 H13.6 V29.8 A1.6 1.6 0 1 1 10.4 29.8 V22.4 H5.4 L3.4 18.9 Z"/></g></svg>'

/** TP/TZ-Beschriftungszeile: RS ignorieren — Miniatur wie blaues Abwehr-Schild (KR-Zeile). */
export const RS_BYPASS_TOGGLE_SVG =
  '<svg class="init-hero-ex__rs-bypass-btn-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" aria-hidden="true" focusable="false"><path fill="#5d4037" d="M12 2l8 3v8.4c0 6.9-3.2 13-8 15.8-4.8-2.8-8-8.9-8-15.8V5l8-3z"/><path fill="currentColor" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/><path fill="#ffffff" opacity="0.10" d="M12 5.55 7.15 7.25v6.45c0 4.2 1.85 8.1 4.85 10.2 3-2.1 4.85-6 4.85-10.2V7.25L12 5.55z"/><path fill="#b8860b" d="M12 2.75 19.05 4.85 18.85 5.45 12 3.75 5.15 5.45 4.95 4.85 12 2.75z"/><path fill="#ffffff" opacity="0.26" d="M8.65 9.1c1.05 2.5 1.55 5.15 1.55 7.95 0 3.45-.75 6.75-2.1 9.75 1.85-1.7 3.05-4.55 3.05-7.75 0-3.25-.85-6.3-2.5-8.95z"/><path fill="none" stroke="#3e2723" stroke-width="0.45" d="M12 4.25 6 6.45v7.1c0 5.4 2.45 10.3 6 12.7 3.55-2.4 6-7.3 6-12.7v-7.1L12 4.25z"/></svg>'

/** Gestrichelte Mod-Pfeile im MOD+-Button (V652, gleiche Grafik wie Kampfliste). */
export const SVG_HERO_MOD_TOGGLE_UP =
  '<svg class="init-hero-ex__mod-toggle-sum-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-dasharray="4.5 4" stroke-linecap="round" d="M12 24V9"/><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" d="M5.5 11L12 4l6.5 7"/></svg>'
export const SVG_HERO_MOD_TOGGLE_DOWN =
  '<svg class="init-hero-ex__mod-toggle-sum-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-dasharray="4.5 4" stroke-linecap="round" d="M12 4v15"/><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" d="M5.5 17L12 24l6.5-7"/></svg>'

/** Kleine gestrichelte Summen-Pfeile (Mod-Chips unter MOD+). */
export const SVG_MOD_CHIP_SUM_UP =
  '<svg class="init-hero-ex__mod-chip-card__sum-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-dasharray="4.5 4" stroke-linecap="round" d="M12 24V9"/><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" d="M5.5 11L12 4l6.5 7"/></svg>'
export const SVG_MOD_CHIP_SUM_DOWN =
  '<svg class="init-hero-ex__mod-chip-card__sum-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-dasharray="4.5 4" stroke-linecap="round" d="M12 4v15"/><path fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" d="M5.5 17L12 24l6.5-7"/></svg>'
export const SVG_MOD_CHIP_UNFAEHIG_MARK =
  '<svg class="init-hero-ex__mod-chip-card__sum-svg init-hero-ex__mod-chip-card__sum-svg--unfaehig" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7 17L17 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
export const SVG_MOD_CHIP_MAGIC_STAR =
  '<svg class="init-hero-ex__mod-chip-card__magic-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.8 14.7 8l5.8.8-4.2 4.1 1 5.8L12 16l-5.3 2.7 1-5.8L3.5 8.8 9.3 8z" fill="currentColor"/></svg>'

export function syncWappenRsFontSize(el, opts = {}) {
  const threshold = opts.compactFromDigits ?? 2
  const n = el.value.trim().length
  el.classList.toggle('init-hero-ex__micro--wappen-rs--compact', n >= threshold)
}

/**
 * Formatiert eine Wappen-W20-Spanne als kurzen Anzeigetext (z. B. „19–20", „9, 11, 13").
 * @param {{ from: number, to: number, parity: 'all'|'odd'|'even' } | null | undefined} range
 */
export function formatWappenW20(range) {
  if (!range) return ''
  const { from, to, parity } = range
  if (parity === 'odd' || parity === 'even') {
    const nums = []
    for (let n = from; n <= to; n++) {
      if (parity === 'odd' && n % 2 === 0) continue
      if (parity === 'even' && n % 2 === 1) continue
      nums.push(n)
    }
    return nums.join(', ')
  }
  return from === to ? String(from) : `${from}–${to}`
}

export const WAPPEN_AUTO_MOD_FIELD_LABELS = {
  at: 'AT',
  pa: 'PA',
  a: 'AW',
  fk: 'FK',
  mu: 'MU',
  kl: 'KL',
  inn: 'IN',
  ib: 'IB',
  ko: 'KO',
  kk: 'KK',
  ff: 'FF',
  ge: 'GE',
  gs: 'GS',
}

/**
 * Erzeugt einen Wundregel-Tooltip aus einem Wappen.
 * Bevorzugt die explizite `woundTooltip`-Beschreibung; fällt sonst auf
 * eine generierte Zusammenfassung der Auto-Mods zurück.
 *
 * @param {{ id: string, label?: string, woundTooltip?: string, autoMods?: Array<{ field: string, delta: number, perStufe: 'perStage'|'perWound'|'once' }> }} def
 */
export function buildWappenWoundRuleText(def) {
  const explicit = String(def?.woundTooltip ?? '').trim()
  if (explicit) return explicit
  const mods = Array.isArray(def?.autoMods) ? def.autoMods : []
  if (mods.length === 0) return ''
  const labelName = String(def?.label || def?.id || '').trim()
  const parts = mods.map((m) => {
    const fl = WAPPEN_AUTO_MOD_FIELD_LABELS[m.field] ?? String(m.field).toUpperCase()
    const sign = m.delta < 0 ? '−' : '+'
    const abs = Math.abs(m.delta)
    const mode =
      m.perStufe === 'perWound'
        ? 'je Wunde'
        : m.perStufe === 'once'
          ? 'einmalig'
          : 'je Wundstufe'
    return `${fl} ${sign}${abs} (${mode})`
  })
  return `${labelName ? labelName + ': ' : ''}${parts.join(', ')}`
}

/**
 * Mini-Wappen pro Trefferzone (RS + 3 Wundmarken).
 * @param {string} itemId
 * @param {boolean} canEdit
 * @param {{ id: string, abbr?: string, label?: string, tooltip?: string, woundTooltip?: string, w20Range?: any, autoMods?: any[] }} def
 * @param {{ rs: string, w: number }} zSnap
 */
export function mountZoneMiniWappen(itemId, canEdit, def, zSnap) {
  let wundenCount = Math.min(3, Math.max(0, Math.floor(Number(zSnap.w)) || 0))
  const w20Text = formatWappenW20(def?.w20Range)
  const w20Hint = w20Text ? `W20: ${w20Text} (Fußkampf)` : 'Fußkampf'
  const rsHint = 'In den Rüstungskästchen den Rüstungsschutz eintragen'
  const titleBase =
    String(def?.tooltip || def?.label || def?.id || '').trim() ||
    String(def?.id || '')
  const abbrText =
    String(def?.abbr || '').trim() ||
    String(def?.label || def?.id || '').slice(0, 2)
  const cell = document.createElement('div')
  cell.className = 'init-hero-ex__micro-cell init-hero-ex__micro-cell--wappen'
  const ab = document.createElement('span')
  ab.className = 'init-hero-ex__abbr'
  ab.textContent = abbrText
  ab.title = `${titleBase} · ${w20Hint} — ${rsHint}`
  const wappen = document.createElement('div')
  wappen.className = 'init-hero-ex__wappen'
  wappen.setAttribute('role', 'group')
  wappen.setAttribute(
    'aria-label',
    `${titleBase}: Rüstungsschutz und Wundmarken`
  )
  const chief = document.createElement('div')
  chief.className = 'init-hero-ex__wappen-chief'
  /** @type {HTMLButtonElement[]} */
  const dots = []
  const woundRule =
    buildWappenWoundRuleText(def) || WUNDEN_DOTS_TOOLTIP_BY_ZONE[def?.id]
  const tapHint = (idx) =>
    `Wundmarke ${idx + 1}: antippen zum Setzen oder Absenken`
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('button')
    dot.type = 'button'
    dot.className = 'init-hero-ex__wappen-dot'
    dot.title = woundRule
      ? `${woundRule} — ${tapHint(i)}`
      : `${titleBase} · ${w20Hint} — ${rsHint}. ${tapHint(i)}`
    dot.setAttribute('aria-label', `Wundmarke ${i + 1} (${titleBase})`)
    dots.push(dot)
  }
  chief.append(...dots)
  const rsInp = document.createElement('input')
  rsInp.type = 'text'
  rsInp.inputMode = 'numeric'
  rsInp.className = 'init-hero-ex__micro init-hero-ex__micro--wappen-rs'
  rsInp.id = `hero-ex-${itemId}-hz-${def.id}-rs`
  rsInp.autocomplete = 'off'
  rsInp.spellcheck = false
  rsInp.disabled = !canEdit
  rsInp.value = strOrEmpty(zSnap.rs)
  rsInp.maxLength = 2
  rsInp.title = `${titleBase} · ${w20Hint} — RS (bis 2 Ziffern). ${rsHint}.`
  rsInp.setAttribute('aria-label', `${titleBase}, Rüstungsschutz`)
  wappen.append(chief, rsInp)
  cell.append(ab, wappen)

  const syncDots = () => {
    dots.forEach((btn, idx) => {
      const on = idx < wundenCount
      btn.classList.toggle('init-hero-ex__wappen-dot--on', on)
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }
  syncDots()
  for (const dot of dots) dot.disabled = !canEdit
  syncWappenRsFontSize(rsInp)

  return {
    cell,
    rsInp,
    dots,
    zoneId: def.id,
    getWunden: () => wundenCount,
    syncDots,
    bumpWunden(idx) {
      const n = idx + 1
      wundenCount = wundenCount === n ? n - 1 : n
      wundenCount = Math.min(3, Math.max(0, wundenCount))
      syncDots()
    },
    setWunden(count) {
      wundenCount = Math.min(3, Math.max(0, Math.floor(Number(count)) || 0))
      syncDots()
    },
  }
}

/**
 * LE-Schwellen-Balken (Fill + Marker-Linien) für LE-Rail und Energy-Rails.
 * @param {string} [boxExtraClass]
 */
export function createLeThresholdGaugeBox(boxExtraClass = '') {
  const box = document.createElement('div')
  box.className =
    'init-hero-ex__le-threshold__box' +
    (boxExtraClass ? ` ${boxExtraClass}` : '')
  box.title = LE_THRESHOLD_TOOLTIP
  box.setAttribute('role', 'img')
  box.setAttribute('aria-label', 'LE-Schwellenanzeige')
  const fill = document.createElement('div')
  fill.className = 'init-hero-ex__le-threshold__fill'
  const line50 = document.createElement('div')
  line50.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--50'
  line50.style.bottom = '50%'
  line50.title = 'Schwelle 1/2 LE'
  const line33 = document.createElement('div')
  line33.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--33'
  line33.style.bottom = '33.333%'
  line33.title = 'Schwelle 1/3 LE'
  const line25 = document.createElement('div')
  line25.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--25'
  line25.style.bottom = '25%'
  line25.title = 'Schwelle 1/4 LE'
  const line5 = document.createElement('div')
  line5.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--le5'
  line5.title = 'Schwelle LE 5 (kampfunfähig bei 0–5)'
  line5.style.display = 'none'
  const lineUnf = document.createElement('div')
  lineUnf.className =
    'init-hero-ex__le-threshold__line init-hero-ex__le-threshold__line--unfaehig'
  lineUnf.style.display = 'none'
  const skull = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  skull.setAttribute('viewBox', '0 0 24 24')
  skull.setAttribute('aria-hidden', 'true')
  skull.setAttribute('focusable', 'false')
  skull.classList.add('init-hero-ex__le-threshold__skull')
  skull.style.display = 'none'
  skull.innerHTML =
    '<path fill="currentColor" d="M12 2C7.58 2 4 5.58 4 10c0 2.49 1.14 4.7 2.92 6.16.36.3.58.74.58 1.2V19a2 2 0 0 0 2 2h1v-2h1v2h2v-2h1v2h1a2 2 0 0 0 2-2v-1.64c0-.46.22-.9.58-1.2C18.86 14.7 20 12.49 20 10c0-4.42-3.58-8-8-8Zm-3 9.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm6 0a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm-4.5 3.25h3l.5 1.25h-4l.5-1.25Z"/>'
  box.append(fill, lineUnf, line5, line25, line33, line50, skull)
  return { box, fill, line50, line33, line25, line5, lineUnf, skull }
}

/** Sichtbarer Platzhalter für inaktiven Slot 9 (Kürzel SW, nicht editierbar). */
export function mountSlot9Placeholder(itemId, canEdit, def) {
  const abbrText = String(def?.abbr || 'SW').trim() || 'SW'
  const titleBase =
    String(def?.tooltip || def?.label || '9. Trefferzone').trim() ||
    '9. Trefferzone'
  const cell = document.createElement('div')
  cell.className =
    'init-hero-ex__micro-cell init-hero-ex__micro-cell--wappen init-hero-ex__micro-cell--slot9-placeholder'
  const ab = document.createElement('span')
  ab.className = 'init-hero-ex__abbr'
  ab.textContent = abbrText
  ab.title = `${titleBase} — in Helden-Einstellungen konfigurierbar`
  const wappen = document.createElement('div')
  wappen.className = 'init-hero-ex__wappen init-hero-ex__wappen--slot9-placeholder'
  wappen.setAttribute('role', 'group')
  wappen.setAttribute('aria-label', `${titleBase} (Platzhalter)`)
  const chief = document.createElement('div')
  chief.className = 'init-hero-ex__wappen-chief'
  /** @type {HTMLButtonElement[]} */
  const dots = []
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('button')
    dot.type = 'button'
    dot.className = 'init-hero-ex__wappen-dot'
    dot.disabled = true
    dot.tabIndex = -1
    dot.setAttribute('aria-hidden', 'true')
    dots.push(dot)
  }
  chief.append(...dots)
  const rsInp = document.createElement('input')
  rsInp.type = 'text'
  rsInp.className = 'init-hero-ex__micro init-hero-ex__micro--wappen-rs'
  rsInp.id = `hero-ex-${itemId}-hz-slot9-rs`
  rsInp.disabled = true
  rsInp.tabIndex = -1
  rsInp.setAttribute('aria-hidden', 'true')
  wappen.append(chief, rsInp)
  const modSub = document.createElement('span')
  modSub.className = 'init-hero-ex__mod-sub-slot'
  modSub.setAttribute('aria-hidden', 'true')
  cell.append(ab, wappen, modSub)
  return {
    cell,
    rsInp,
    dots,
    zoneId: def?.id || 'slot9',
    getWunden: () => 0,
    syncDots: () => {},
    bumpWunden: () => {},
    isPlaceholder: true,
  }
}
