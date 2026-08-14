// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { el } from './dom.js'
import { mountSettingsTabs } from './settingsShell.js'

describe('mountSettingsTabs', () => {
  it('baut Tabs und schaltet Seiten', () => {
    const panel = el('div', { class: 'kampf-settings-panel' }, [
      el('div', { class: 'kampf-settings-panel__head' }, 'Titel'),
      el('div', {
        class: 'kampf-settings-panel__tabs',
        attrs: { 'data-kset-tablist': '' },
      }),
      el(
        'div',
        { class: 'kampf-settings-panel__body', attrs: { 'data-kset-pages': '' } },
        el('div', {
          attrs: { 'data-kset-page': 'a', 'data-kset-page-label': 'Alpha' },
          text: 'Seite A',
        }),
        el('div', {
          attrs: { 'data-kset-page': 'b', 'data-kset-page-label': 'Beta' },
          text: 'Seite B',
        })
      ),
    ])
    document.body.appendChild(panel)

    const api = mountSettingsTabs(panel)
    const tablist = panel.querySelector('[data-kset-tablist]')
    expect(tablist?.hidden).toBe(false)
    const tabs = [...panel.querySelectorAll('[role="tab"]')]
    expect(tabs.map((t) => t.textContent)).toEqual(['Alpha', 'Beta'])
    expect(api.getActivePageId()).toBe('a')

    const pageA = panel.querySelector('[data-kset-page="a"]')
    const pageB = panel.querySelector('[data-kset-page="b"]')
    expect(pageA?.classList.contains('kset-page--active')).toBe(true)
    expect(pageB?.classList.contains('kset-page--inactive')).toBe(true)

    api.selectPage('b')
    expect(api.getActivePageId()).toBe('b')
    expect(pageB?.classList.contains('kset-page--active')).toBe(true)
    expect(pageA?.classList.contains('kset-page--inactive')).toBe(true)

    api.destroy()
    panel.remove()
  })

  it('blendet die Tab-Leiste aus, wenn nur eine Seite verfügbar ist', () => {
    const panel = el('div', { class: 'kampf-settings-panel' }, [
      el('div', {
        class: 'kampf-settings-panel__tabs',
        attrs: { 'data-kset-tablist': '' },
      }),
      el(
        'div',
        { attrs: { 'data-kset-pages': '' } },
        el('div', {
          attrs: { 'data-kset-page': 'only', 'data-kset-page-label': 'Nur' },
          text: 'Einzig',
        }),
        el('div', {
          attrs: { 'data-kset-page': 'hidden', 'data-kset-page-label': 'Weg' },
          text: 'Versteckt',
        })
      ),
    ])
    const hiddenPage = panel.querySelector('[data-kset-page="hidden"]')
    if (hiddenPage instanceof HTMLElement) hiddenPage.hidden = true

    const api = mountSettingsTabs(panel)
    const tablist = panel.querySelector('[data-kset-tablist]')
    expect(tablist?.hidden).toBe(true)
    expect(api.getActivePageId()).toBe('only')
    expect(panel.querySelectorAll('[role="tab"]').length).toBe(0)

    api.destroy()
  })

  it('refresh überspringt neu ausgeblendete Seiten', () => {
    const panel = el('div', { class: 'kampf-settings-panel' }, [
      el('div', {
        class: 'kampf-settings-panel__tabs',
        attrs: { 'data-kset-tablist': '' },
      }),
      el(
        'div',
        { attrs: { 'data-kset-pages': '' } },
        el('div', {
          attrs: { 'data-kset-page': 'held', 'data-kset-page-label': 'Held' },
        }),
        el('div', {
          attrs: {
            'data-kset-page': 'aktionen',
            'data-kset-page-label': 'Aktionen',
          },
        })
      ),
    ])
    const api = mountSettingsTabs(panel)
    expect(panel.querySelectorAll('[role="tab"]').length).toBe(2)

    const aktionen = panel.querySelector('[data-kset-page="aktionen"]')
    if (aktionen instanceof HTMLElement) {
      aktionen.hidden = true
      aktionen.style.display = 'none'
    }
    api.refresh()
    expect(panel.querySelector('[data-kset-tablist]')?.hidden).toBe(true)
    expect(api.getActivePageId()).toBe('held')
    api.destroy()
  })
})
