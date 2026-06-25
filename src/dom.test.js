// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { el, svgEl } from './dom.js'

describe('el', () => {
  it('erzeugt ein Element mit Klasse und Text', () => {
    const node = el('div', { class: 'foo bar', text: 'Hallo' })
    expect(node.tagName).toBe('DIV')
    expect(node.className).toBe('foo bar')
    expect(node.textContent).toBe('Hallo')
  })

  it('akzeptiert className als Alias', () => {
    const node = el('span', { className: 'x' })
    expect(node.getAttribute('class')).toBe('x')
  })

  it('setzt style aus String und Objekt', () => {
    const s1 = el('div', { style: 'color: red;' })
    expect(s1.getAttribute('style')).toContain('color')
    const s2 = el('div', { style: { display: 'none' } })
    expect(s2.style.display).toBe('none')
  })

  it('setzt dataset und attrs', () => {
    const node = el('div', { dataset: { foo: 'bar' }, attrs: { 'aria-hidden': 'true' } })
    expect(node.dataset.foo).toBe('bar')
    expect(node.getAttribute('aria-hidden')).toBe('true')
  })

  it('überspringt false/null attrs', () => {
    const node = el('div', { attrs: { a: false, b: null, c: 'x' } })
    expect(node.hasAttribute('a')).toBe(false)
    expect(node.hasAttribute('b')).toBe(false)
    expect(node.getAttribute('c')).toBe('x')
  })

  it('registriert Event-Handler über onClick', () => {
    const fn = vi.fn()
    const node = el('button', { onClick: fn })
    node.click()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('setzt bekannte Properties (z. B. type, disabled)', () => {
    const input = el('input', { type: 'checkbox', disabled: true })
    expect(input.type).toBe('checkbox')
    expect(input.disabled).toBe(true)
  })

  it('hängt Kinder an (Knoten, Strings, verschachtelt, ignoriert null/false)', () => {
    const child = el('i', { text: 'x' })
    const node = el('p', null, 'a', child, [null, false, 'b'])
    expect(node.childNodes.length).toBe(3)
    expect(node.textContent).toBe('axb')
    expect(node.querySelector('i')).toBe(child)
  })

  it('ignoriert undefined-Props', () => {
    const node = el('div', { title: undefined })
    expect(node.hasAttribute('title')).toBe(false)
  })
})

describe('svgEl', () => {
  it('erzeugt ein SVG-Element im richtigen Namespace mit Attributen', () => {
    const node = svgEl('circle', { cx: 5, cy: 6, r: 7, class: 'ring' })
    expect(node.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(node.getAttribute('cx')).toBe('5')
    expect(node.getAttribute('r')).toBe('7')
    expect(node.getAttribute('class')).toBe('ring')
  })

  it('hängt SVG-Kinder an', () => {
    const path = svgEl('path', { d: 'M0 0' })
    const root = svgEl('svg', { viewBox: '0 0 10 10' }, path)
    expect(root.querySelector('path')).toBe(path)
    expect(root.getAttribute('viewBox')).toBe('0 0 10 10')
  })
})
