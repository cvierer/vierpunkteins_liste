import { el } from './dom.js'

/**
 * Seite ist für Tabs verfügbar, wenn der Host sie nicht per `hidden` ausgeblendet hat.
 * Tab-Wechsel nutzt nur `.kset-page--inactive` (kein `hidden`), damit GM-Modus und
 * Tabs sich nicht gegenseitig überschreiben.
 * @param {HTMLElement} page
 */
function pageIsAvailable(page) {
  return !page.hidden
}

/**
 * Baut eine Tab-Leiste aus `[data-kset-page]`-Kindern und schaltet Seiten.
 * Tabs ohne sichtbaren Inhalt entfallen; bei nur einer Seite verschwindet die Leiste.
 *
 * Erwartete Struktur im Panel:
 * - optional `[data-kset-tablist]` (wird sonst angelegt)
 * - Seiten mit `data-kset-page` + `data-kset-page-label`
 *
 * @param {HTMLElement} panelEl
 * @returns {{ refresh: () => void, destroy: () => void, selectPage: (id: string) => void, getActivePageId: () => string | null }}
 */
export function mountSettingsTabs(panelEl) {
  if (!(panelEl instanceof HTMLElement)) {
    return {
      refresh: () => {},
      destroy: () => {},
      selectPage: () => {},
      getActivePageId: () => null,
    }
  }

  let tablist = panelEl.querySelector('[data-kset-tablist]')
  if (!(tablist instanceof HTMLElement)) {
    tablist = el('div', {
      class: 'kampf-settings-panel__tabs',
      attrs: { 'data-kset-tablist': '', role: 'tablist' },
    })
    const body = panelEl.querySelector('[data-kset-pages]')
    if (body?.parentNode === panelEl) {
      panelEl.insertBefore(tablist, body)
    } else {
      const head = panelEl.querySelector('.kampf-settings-panel__head')
      if (head?.nextSibling) panelEl.insertBefore(tablist, head.nextSibling)
      else panelEl.prepend(tablist)
    }
  }
  tablist.setAttribute('role', 'tablist')
  tablist.classList.add('kampf-settings-panel__tabs')

  /** @type {string | null} */
  let activeId = null
  /** @type {HTMLButtonElement[]} */
  let tabButtons = []

  const allPages = () =>
    [...panelEl.querySelectorAll('[data-kset-page]')].filter(
      (n) => n instanceof HTMLElement
    )

  const availablePages = () => allPages().filter(pageIsAvailable)

  const applyActivePage = (id) => {
    for (const page of allPages()) {
      const isActive = page.dataset.ksetPage === id
      page.classList.toggle('kset-page--active', isActive)
      page.classList.toggle('kset-page--inactive', pageIsAvailable(page) && !isActive)
      page.setAttribute('aria-hidden', isActive ? 'false' : 'true')
    }
  }

  const syncTabButtonState = () => {
    for (const btn of tabButtons) {
      const selected = btn.dataset.ksetTab === activeId
      btn.setAttribute('aria-selected', selected ? 'true' : 'false')
      btn.tabIndex = selected ? 0 : -1
      btn.classList.toggle('kampf-settings-panel__tab--active', selected)
    }
  }

  const selectPage = (id) => {
    const pages = availablePages()
    if (pages.length === 0) {
      activeId = null
      applyActivePage('')
      syncTabButtonState()
      return
    }
    const match = pages.find((p) => p.dataset.ksetPage === id)
    const next = match ?? pages[0]
    activeId = next.dataset.ksetPage ?? null
    applyActivePage(activeId ?? '')
    syncTabButtonState()
  }

  const onTabKeydown = (e) => {
    if (
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight' &&
      e.key !== 'Home' &&
      e.key !== 'End'
    ) {
      return
    }
    if (tabButtons.length < 2) return
    e.preventDefault()
    const idx = tabButtons.findIndex((b) => b.dataset.ksetTab === activeId)
    let next = idx < 0 ? 0 : idx
    if (e.key === 'ArrowLeft') {
      next = (idx - 1 + tabButtons.length) % tabButtons.length
    } else if (e.key === 'ArrowRight') {
      next = (idx + 1) % tabButtons.length
    } else if (e.key === 'Home') {
      next = 0
    } else if (e.key === 'End') {
      next = tabButtons.length - 1
    }
    const btn = tabButtons[next]
    if (!btn) return
    selectPage(btn.dataset.ksetTab ?? '')
    btn.focus()
  }

  const rebuildTabs = () => {
    // Vorherige Tab-Inaktivität zurücksetzen, damit Availability nur Host-`hidden` sieht.
    for (const page of allPages()) {
      page.classList.remove('kset-page--inactive', 'kset-page--active')
    }

    const pages = availablePages()
    const prevActive = activeId
    tablist.replaceChildren()
    tabButtons = []

    if (pages.length <= 1) {
      tablist.hidden = true
      tablist.style.display = 'none'
      tablist.setAttribute('aria-hidden', 'true')
      activeId = pages[0]?.dataset.ksetPage ?? null
      applyActivePage(activeId ?? '')
      syncTabButtonState()
      return
    }

    tablist.hidden = false
    tablist.style.display = ''
    tablist.setAttribute('aria-hidden', 'false')

    for (const page of pages) {
      const id = page.dataset.ksetPage ?? ''
      const label = page.dataset.ksetPageLabel || id
      const btn = el(
        'button',
        {
          type: 'button',
          class: 'kampf-settings-panel__tab',
          attrs: {
            role: 'tab',
            'data-kset-tab': id,
            'aria-selected': 'false',
            tabindex: '-1',
          },
          onClick: () => selectPage(id),
          onKeydown: onTabKeydown,
        },
        label
      )
      tablist.appendChild(btn)
      tabButtons.push(btn)
    }

    const keep =
      prevActive && pages.some((p) => p.dataset.ksetPage === prevActive)
        ? prevActive
        : pages[0].dataset.ksetPage
    selectPage(keep ?? '')
  }

  rebuildTabs()

  return {
    refresh: rebuildTabs,
    destroy: () => {
      tablist.replaceChildren()
      tabButtons = []
      activeId = null
      for (const page of allPages()) {
        page.classList.remove('kset-page--inactive', 'kset-page--active')
      }
    },
    selectPage,
    getActivePageId: () => activeId,
  }
}
