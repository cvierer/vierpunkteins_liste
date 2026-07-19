/** Info-Symbol (Kreis mit i), passend zum Erweiterungs-Stil. */
export const HIT_ZONE_INFO_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9.5"/>
  <path d="M12 10v6M12 7.5h.01" stroke-width="2.2"/>
</svg>`.trim()

/** Reset-Symbol (Rotate-CCW), gleiche Größe wie Info-/Zahnrad-Icons. */
export const COMBAT_START_RESET_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 12a9 9 0 1 0 3-6.7"/>
  <path d="M3 4v5h5"/>
</svg>`.trim()

import {
  formatCombatLogForDisplay,
  getCombatLogUiSnapshot,
  subscribeCombatLog,
} from './combatLog.js'

const LOG_GROUPS = [
  { id: 'hit', title: 'Treffer' },
  { id: 'le', title: 'LE' },
  { id: 'wounds', title: 'Wunden' },
  { id: 'mods', title: 'Werte' },
  { id: 'state', title: 'Zustand' },
  { id: 'misc', title: 'Sonst' },
]

/**
 * @param {string} line
 */
function classifyLogLine(line) {
  const t = String(line ?? '').trim()
  if (!t) return 'misc'
  if (t.startsWith('Treffer ')) return 'hit'
  if (
    t.startsWith('LE:') ||
    t.startsWith('LE-') ||
    t.startsWith('LE ') ||
    t.startsWith('LE-Band')
  ) {
    return 'le'
  }
  if (
    t.startsWith('Zone ') ||
    t.includes('Wundcheck') ||
    t.includes('Wunden:') ||
    /\bW\d\b/.test(t)
  ) {
    return 'wounds'
  }
  if (
    t.includes('AT/PA') ||
    t.includes('Werte:') ||
    t.includes('Kampfwerte') ||
    t.includes('Erschwernis') ||
    t.includes('Gesamtwunden')
  ) {
    return 'mods'
  }
  if (
    t.includes('kampfunfähig') ||
    t.includes('lebensbedrohlich') ||
    t.includes('bewusstlos') ||
    t.includes('tot')
  ) {
    return 'state'
  }
  return 'misc'
}

/**
 * Dialog „(i)“: Kampfprotokoll (Rechenblöcke für diese Figur) + Schließen.
 * @param {{ trackerMetaKey: string }} opts — `trackerMetaKey` bleibt für API-Kompatibilität
 */
export function createHitZoneOverlay(opts) {
  void opts

  let openItemId = null
  let focusReturnEl = null
  /** @type {(() => void) | null} */
  let offLog = null

  const backdrop = document.createElement('div')
  backdrop.className =
    'kampf-settings-backdrop kampf-hit-zone-backdrop'
  backdrop.hidden = true
  backdrop.setAttribute('aria-hidden', 'true')
  backdrop.style.display = 'none'

  const panel = document.createElement('div')
  panel.className = 'kampf-settings-panel kampf-hit-zone-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'kampf-hit-zone-title')

  const title = document.createElement('h2')
  title.className = 'kampf-settings-panel__title'
  title.id = 'kampf-hit-zone-title'
  title.textContent = 'Kampfprotokoll'

  const logWrap = document.createElement('div')
  logWrap.className = 'kampf-hit-zone-log-wrap'
  const logRoot = document.createElement('div')
  logRoot.className = 'kampf-hit-zone-log-root'
  logRoot.setAttribute('role', 'log')
  logRoot.setAttribute('aria-live', 'polite')
  logRoot.setAttribute('aria-relevant', 'additions')
  logWrap.appendChild(logRoot)

  const rawWrap = document.createElement('div')
  rawWrap.className = 'kampf-hit-zone-raw-wrap'
  const rawLabel = document.createElement('h3')
  rawLabel.className = 'kampf-hit-zone-log-h'
  rawLabel.textContent = 'Als Text (kopierbar)'
  const rawLog = document.createElement('textarea')
  rawLog.className = 'kampf-hit-zone-raw-log'
  rawLog.readOnly = true
  rawLog.spellcheck = false
  rawLog.setAttribute('aria-label', 'Vollständiges Rechenprotokoll')
  rawWrap.append(rawLabel, rawLog)

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'btn kampf-settings-panel__close'
  closeBtn.textContent = 'Schließen'
  closeBtn.dataset.kampfHitZoneClose = ''

  panel.append(title, logWrap, rawWrap, closeBtn)
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)

  const refreshLog = () => {
    const { blocks, misc } = getCombatLogUiSnapshot(openItemId)
    logRoot.replaceChildren()
    const rawText = formatCombatLogForDisplay(openItemId).trim()
    rawLog.value =
      rawText || 'Noch keine protokollierten Berechnungen für diese Figur.'

    if (misc.length > 0) {
      const miscArt = document.createElement('article')
      miscArt.className = 'kampf-hit-zone-log-block'
      const miscHead = document.createElement('header')
      miscHead.className = 'kampf-hit-zone-log-block__head'
      miscHead.textContent = 'Sonstiges'
      const miscBody = document.createElement('div')
      miscBody.className = 'kampf-hit-zone-log-block__body'
      const sec = document.createElement('section')
      sec.className = 'kampf-hit-zone-log-group'
      const h = document.createElement('h4')
      h.className = 'kampf-hit-zone-log-group__head'
      h.textContent = 'Sonst'
      const ol = document.createElement('ol')
      ol.className = 'kampf-hit-zone-log-group__list'
      for (const ln of misc) {
        const li = document.createElement('li')
        li.className = 'kampf-hit-zone-log-group__line'
        li.textContent = ln
        ol.appendChild(li)
      }
      sec.append(h, ol)
      miscBody.appendChild(sec)
      miscArt.append(miscHead, miscBody)
      logRoot.appendChild(miscArt)
    }

    for (const b of blocks) {
      const art = document.createElement('article')
      art.className = 'kampf-hit-zone-log-block'
      const head = document.createElement('header')
      head.className = 'kampf-hit-zone-log-block__head'
      head.textContent = `${b.ts} · ${b.displayName}`
      const bdy = document.createElement('div')
      bdy.className = 'kampf-hit-zone-log-block__body'
      /** @type {Map<string, string[]>} */
      const grouped = new Map(LOG_GROUPS.map((g) => [g.id, []]))
      for (const ln of b.lines) {
        grouped.get(classifyLogLine(ln))?.push(ln)
      }
      for (const g of LOG_GROUPS) {
        const lines = grouped.get(g.id) ?? []
        if (lines.length === 0) continue
        const sec = document.createElement('section')
        sec.className = 'kampf-hit-zone-log-group'
        const h = document.createElement('h4')
        h.className = 'kampf-hit-zone-log-group__head'
        h.textContent = g.title
        const ol = document.createElement('ol')
        ol.className = 'kampf-hit-zone-log-group__list'
        for (const ln of lines) {
          const li = document.createElement('li')
          li.className = 'kampf-hit-zone-log-group__line'
          li.textContent = ln
          ol.appendChild(li)
        }
        sec.append(h, ol)
        bdy.appendChild(sec)
      }
      art.append(head, bdy)
      logRoot.appendChild(art)
    }

    if (logRoot.childNodes.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'kampf-hit-zone-log-empty'
      empty.textContent =
        'Noch keine protokollierten Berechnungen für diese Figur.'
      logRoot.appendChild(empty)
    }

    logWrap.scrollTop = logWrap.scrollHeight
  }

  const close = () => {
    backdrop.hidden = true
    backdrop.style.display = 'none'
    backdrop.setAttribute('aria-hidden', 'true')
    offLog?.()
    offLog = null
    openItemId = null
    focusReturnEl?.focus()
    focusReturnEl = null
  }

  closeBtn.addEventListener('click', (e) => {
    e.preventDefault()
    close()
  })

  let hitZoneBackdropPointerFromBackdrop = false
  backdrop.addEventListener('pointerdown', (e) => {
    hitZoneBackdropPointerFromBackdrop = e.target === backdrop
  })
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && hitZoneBackdropPointerFromBackdrop) close()
  })

  const onDocKey = (e) => {
    if (e.key === 'Escape' && !backdrop.hidden) {
      e.preventDefault()
      close()
    }
  }
  document.addEventListener('keydown', onDocKey)

  /**
   * @param {string} itemId
   * @param {string} displayName
   * @param {Record<string, unknown> | undefined} _meta
   * @param {boolean} _canEdit
   */
  const open = (itemId, displayName, _meta, _canEdit) => {
    void _meta
    void _canEdit
    openItemId = itemId
    title.textContent = `Kampfprotokoll: ${displayName}`
    offLog?.()
    offLog = null
    refreshLog()
    backdrop.hidden = false
    backdrop.style.display = 'flex'
    backdrop.setAttribute('aria-hidden', 'false')
    offLog = subscribeCombatLog(() => {
      refreshLog()
    })
    closeBtn.focus()
  }

  const destroy = () => {
    document.removeEventListener('keydown', onDocKey)
    offLog?.()
    offLog = null
    backdrop.remove()
  }

  return {
    open,
    close,
    syncFromItems() {
      if (!openItemId) return
      refreshLog()
    },
    setFocusReturn(el) {
      focusReturnEl = el
    },
    getOpenItemId: () => openItemId,
    destroy,
  }
}
