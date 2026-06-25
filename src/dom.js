// Kompakter DOM-Builder zum Entdoppeln der createElement-/className-Boilerplate.
// Reines Blatt-Modul (nur Browser-/happy-dom-DOM-APIs). Wird ab Etappe 4/5 in den
// neuen UI-Submodulen eingesetzt, damit je 3–6 Boilerplate-Zeilen zu einer
// kollabieren und eindeutigere Such-Anker für künftige Edits entstehen.

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Wendet ein props-Objekt auf einen Knoten an. Unterstützt:
 * - `class`/`className`: CSS-Klassen (String)
 * - `style`: String (cssText) oder Objekt (Object.assign auf node.style)
 * - `dataset`: Objekt (Object.assign auf node.dataset)
 * - `attrs`: Objekt (setAttribute je Eintrag; `false`/`null`/`undefined` = überspringen)
 * - `text`: textContent
 * - `html`: innerHTML
 * - `onClick`, `onInput`, … (`on` + Großbuchstabe): addEventListener(event, handler)
 * - jeder andere Key: Property setzen, wenn vorhanden, sonst setAttribute
 *
 * @param {Element} node
 * @param {Record<string, unknown> | null | undefined} props
 * @param {boolean} useAttrForUnknown true = unbekannte Keys immer als Attribut (SVG)
 */
function applyProps(node, props, useAttrForUnknown) {
  if (!props) return
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue
    if (key === 'class' || key === 'className') {
      if (value != null && value !== false) node.setAttribute('class', String(value))
      continue
    }
    if (key === 'style') {
      if (typeof value === 'string') node.setAttribute('style', value)
      else if (value && typeof value === 'object') Object.assign(node.style, value)
      continue
    }
    if (key === 'dataset') {
      if (value && typeof value === 'object') {
        Object.assign(/** @type {HTMLElement} */ (node).dataset, value)
      }
      continue
    }
    if (key === 'attrs') {
      if (value && typeof value === 'object') {
        for (const [a, v] of Object.entries(value)) {
          if (v === false || v == null) continue
          node.setAttribute(a, v === true ? '' : String(v))
        }
      }
      continue
    }
    if (key === 'text') {
      node.textContent = value == null ? '' : String(value)
      continue
    }
    if (key === 'html') {
      node.innerHTML = value == null ? '' : String(value)
      continue
    }
    if (key.length > 2 && key.startsWith('on') && key[2] === key[2].toUpperCase()) {
      if (typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value)
      }
      continue
    }
    if (!useAttrForUnknown && key in node) {
      node[key] = value
    } else if (value === false || value == null) {
      // boolesch-falsche Attribute weglassen
    } else {
      node.setAttribute(key, value === true ? '' : String(value))
    }
  }
}

/**
 * @param {Node} parent
 * @param {unknown[]} children beliebig verschachtelt; Strings → Textknoten,
 *   `null`/`undefined`/`false`/`true` werden ignoriert.
 */
function appendChildren(parent, children) {
  for (const child of children) {
    if (child == null || child === false || child === true) continue
    if (Array.isArray(child)) {
      appendChildren(parent, child)
      continue
    }
    if (child instanceof Node) {
      parent.appendChild(child)
    } else {
      parent.appendChild(document.createTextNode(String(child)))
    }
  }
}

/**
 * Erzeugt ein HTML-Element. Siehe `applyProps` für unterstützte props.
 *
 * @param {string} tag
 * @param {Record<string, unknown> | null} [props]
 * @param {...unknown} children
 * @returns {HTMLElement}
 */
export function el(tag, props = null, ...children) {
  const node = document.createElement(tag)
  applyProps(node, props, false)
  appendChildren(node, children)
  return node
}

/**
 * Erzeugt ein SVG-Element (Namespace + alle unbekannten Keys als Attribut).
 *
 * @param {string} tag
 * @param {Record<string, unknown> | null} [props]
 * @param {...unknown} children
 * @returns {SVGElement}
 */
export function svgEl(tag, props = null, ...children) {
  const node = document.createElementNS(SVG_NS, tag)
  applyProps(node, props, true)
  appendChildren(node, children)
  return node
}
