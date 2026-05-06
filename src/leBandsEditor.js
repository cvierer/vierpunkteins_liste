/**
 * Wiederverwendbarer LE-Band-Editor.
 *
 * Wird im globalen SL-Settings-Panel und im Helden-Settings-Modal genutzt.
 * Verwaltet einen lokalen Zustand (Array von LeBandDef[]); Änderungen
 * werden über `onChange` an den Aufrufer propagiert und dort
 * zwischengespeichert, bis dieser sie tatsächlich persistiert
 * (z. B. „Speichern und schließen").
 */

import {
  cloneDefaultLeBandDefs,
  defaultLeBandLabel,
  LE_BAND_MOD_FIELDS,
  normalizeLeBandDefs,
} from './leBandDefs.js'

const THRESHOLD_TYPE_OPTIONS = [
  { value: 'fraction', label: 'Bruch (LE < n/d × max)' },
  { value: 'absolute', label: 'Absolut (LE ≤ Wert)' },
  { value: 'negKoDepth', label: 'Negativ-KO-Tiefe (-LE > Faktor × KO)' },
]

function fmtFieldLabel(f) {
  switch (f) {
    case 'at':
      return 'AT'
    case 'pa':
      return 'PA'
    case 'a':
      return 'AW'
    case 'fk':
      return 'FK'
    case 'inn':
      return 'IN'
    case 'kl':
      return 'KL'
    case 'mu':
      return 'MU'
    case 'ko':
      return 'KO'
    case 'kk':
      return 'KK'
    case 'ff':
      return 'FF'
    case 'ge':
      return 'GE'
    case 'gs':
      return 'GS'
    case 'ib':
      return 'IB'
    default:
      return f.toUpperCase()
  }
}

function makeNewBand() {
  return {
    id: `band-${Math.random().toString(36).slice(2, 8)}`,
    active: true,
    label: '',
    tooltip: '',
    threshold: { type: 'fraction', num: 1, den: 2 },
    mods: [{ field: 'at', delta: -1 }],
  }
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   initial: import('./leBandDefs.js').LeBandDef[] | null | undefined,
 *   readOnly?: boolean,
 *   onChange?: (next: import('./leBandDefs.js').LeBandDef[]) => void,
 *   onValidityChange?: (ok: boolean) => void,
 * }} opts
 * @returns {{
 *   getValue: () => import('./leBandDefs.js').LeBandDef[],
 *   setValue: (next: import('./leBandDefs.js').LeBandDef[]) => void,
 *   resetToDefaults: () => void,
 *   destroy: () => void,
 *   isValid: () => boolean,
 * }}
 */
export function mountLeBandsEditor(host, opts) {
  const readOnly = Boolean(opts?.readOnly)
  const onChange = typeof opts?.onChange === 'function' ? opts.onChange : null
  const onValidityChange =
    typeof opts?.onValidityChange === 'function' ? opts.onValidityChange : null

  /** @type {import('./leBandDefs.js').LeBandDef[]} */
  let state = normalizeLeBandDefs(opts?.initial)

  const root = document.createElement('div')
  root.className = 'kampf-le-bands-editor'

  const summary = document.createElement('p')
  summary.className =
    'kampf-settings-panel__microhint kampf-le-bands-editor__hint'
  summary.textContent =
    'Bänder werden von oben nach unten geprüft (oben = am schwersten); das erste passende Band gewinnt. Mit „↑/↓" lässt sich die Reihenfolge anpassen. Pro Band kannst du den Schwellen-Typ wählen (Bruch, absolute LE oder Negativ-KO-Tiefe) und beliebige Werte (AT, PA, AW, FK, …) verändern.'
  root.appendChild(summary)

  const cards = document.createElement('div')
  cards.className = 'kampf-le-bands-editor__cards'
  root.appendChild(cards)

  const validBox = document.createElement('div')
  validBox.className = 'kampf-le-bands-editor__validity'
  root.appendChild(validBox)

  const actions = document.createElement('div')
  actions.className = 'kampf-le-bands-editor__actions'

  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'btn kampf-le-bands-editor__add'
  addBtn.textContent = '+ Band'
  addBtn.disabled = readOnly
  addBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (readOnly) return
    state = [...state, makeNewBand()]
    rerender()
    emitChange()
  })
  actions.appendChild(addBtn)

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.className = 'btn kampf-le-bands-editor__reset'
  resetBtn.textContent = 'Auf Standard zurücksetzen'
  resetBtn.disabled = readOnly
  resetBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (readOnly) return
    setValue(cloneDefaultLeBandDefs())
  })
  actions.appendChild(resetBtn)
  root.appendChild(actions)

  host.appendChild(root)

  function emitChange() {
    if (onChange) onChange(getValue())
    refreshValidity()
  }

  function refreshValidity() {
    const issues = []
    const activeBands = state.filter((b) => b.active)
    for (const b of activeBands) {
      const hasMod = (b.mods || []).some((m) => m && m.delta && m.field)
      if (!hasMod) {
        issues.push(`Band "${defaultLeBandLabel(b)}" hat keine Mods.`)
      }
    }
    const ok = issues.length === 0
    validBox.classList.toggle('kampf-le-bands-editor__validity--ok', ok)
    validBox.classList.toggle('kampf-le-bands-editor__validity--err', !ok)
    if (ok) {
      validBox.textContent = `${activeBands.length} aktive Band(s) — alle haben mindestens einen Mod-Effekt.`
    } else {
      validBox.textContent = `Hinweis: ${issues.join(' ')}`
    }
    if (onValidityChange) onValidityChange(true)
  }

  function isValid() {
    return true
  }

  function getValue() {
    return state.map((d) => ({
      id: d.id,
      active: Boolean(d.active),
      label: d.label || '',
      tooltip: d.tooltip || '',
      threshold: { ...d.threshold },
      mods: (d.mods || []).map((m) => ({ ...m })),
    }))
  }

  function setValue(next) {
    state = normalizeLeBandDefs(next)
    rerender()
    emitChange()
  }

  function destroy() {
    root.remove()
  }

  function moveBand(idx, delta) {
    const j = idx + delta
    if (j < 0 || j >= state.length) return
    const cp = state.slice()
    const [it] = cp.splice(idx, 1)
    cp.splice(j, 0, it)
    state = cp
    rerender()
    emitChange()
  }

  function removeBand(idx) {
    state = state.filter((_, i) => i !== idx)
    rerender()
    emitChange()
  }

  function buildBandCard(idx) {
    const def = state[idx]
    const card = document.createElement('div')
    card.className = 'kampf-le-bands-editor__card'
    card.classList.toggle('kampf-le-bands-editor__card--inactive', !def.active)

    const header = document.createElement('div')
    header.className = 'kampf-le-bands-editor__card-header'

    const title = document.createElement('span')
    title.className = 'kampf-le-bands-editor__card-title'
    title.textContent = `Band ${idx + 1}: ${def.label || defaultLeBandLabel(def) || '(unbenannt)'}`
    header.appendChild(title)

    const ctrls = document.createElement('div')
    ctrls.className = 'kampf-le-bands-editor__card-ctrls'

    const upBtn = document.createElement('button')
    upBtn.type = 'button'
    upBtn.className = 'btn kampf-le-bands-editor__move'
    upBtn.textContent = '↑'
    upBtn.title = 'Höhere Schwere (nach oben verschieben)'
    upBtn.disabled = readOnly || idx === 0
    upBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      moveBand(idx, -1)
    })

    const downBtn = document.createElement('button')
    downBtn.type = 'button'
    downBtn.className = 'btn kampf-le-bands-editor__move'
    downBtn.textContent = '↓'
    downBtn.title = 'Niedrigere Schwere (nach unten verschieben)'
    downBtn.disabled = readOnly || idx === state.length - 1
    downBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      moveBand(idx, 1)
    })

    const rmBtn = document.createElement('button')
    rmBtn.type = 'button'
    rmBtn.className = 'btn kampf-le-bands-editor__remove'
    rmBtn.textContent = '×'
    rmBtn.title = 'Band entfernen'
    rmBtn.disabled = readOnly
    rmBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      removeBand(idx)
    })

    ctrls.append(upBtn, downBtn, rmBtn)
    header.appendChild(ctrls)

    const activeLbl = document.createElement('label')
    activeLbl.className =
      'kampf-settings-checkbox-label kampf-le-bands-editor__active-toggle'
    const activeCb = document.createElement('input')
    activeCb.type = 'checkbox'
    activeCb.checked = Boolean(def.active)
    activeCb.disabled = readOnly
    activeLbl.appendChild(activeCb)
    const activeTxt = document.createElement('span')
    activeTxt.textContent = 'Aktiv'
    activeLbl.appendChild(activeTxt)
    header.appendChild(activeLbl)

    activeCb.addEventListener('change', () => {
      def.active = activeCb.checked
      card.classList.toggle('kampf-le-bands-editor__card--inactive', !def.active)
      emitChange()
    })

    card.appendChild(header)

    const grid = document.createElement('div')
    grid.className = 'kampf-le-bands-editor__card-grid'

    const mkInput = (labelText, value, onInput, attrs = {}) => {
      const wrap = document.createElement('div')
      wrap.className = 'kampf-le-bands-editor__field'
      const lbl = document.createElement('label')
      lbl.className = 'init-row-extra-label'
      lbl.textContent = labelText
      wrap.appendChild(lbl)
      const inp = document.createElement('input')
      inp.type = attrs.type ?? 'text'
      inp.className = 'init-row-extra-input'
      inp.value = value ?? ''
      inp.autocomplete = 'off'
      inp.spellcheck = false
      inp.disabled = readOnly
      if (attrs.maxLength) inp.maxLength = attrs.maxLength
      if (attrs.inputMode) inp.inputMode = attrs.inputMode
      if (attrs.title) inp.title = attrs.title
      if (attrs.min !== undefined) inp.min = String(attrs.min)
      if (attrs.max !== undefined) inp.max = String(attrs.max)
      if (attrs.step !== undefined) inp.step = String(attrs.step)
      inp.addEventListener('input', () => onInput(inp.value))
      wrap.appendChild(inp)
      return { wrap, inp }
    }

    const labelField = mkInput(
      'Name (z. B. <1/2)',
      def.label,
      (v) => {
        def.label = String(v).slice(0, 64)
        title.textContent = `Band ${idx + 1}: ${def.label || defaultLeBandLabel(def) || '(unbenannt)'}`
        emitChange()
      },
      { maxLength: 64 }
    )
    grid.appendChild(labelField.wrap)

    const tooltipField = mkInput(
      'Tooltip',
      def.tooltip,
      (v) => {
        def.tooltip = String(v).slice(0, 1024)
        emitChange()
      },
      { maxLength: 1024 }
    )
    grid.appendChild(tooltipField.wrap)

    // Schwellen-Typ + dynamische Felder
    const threshWrap = document.createElement('div')
    threshWrap.className =
      'kampf-le-bands-editor__field kampf-le-bands-editor__field--full'
    const threshTitle = document.createElement('label')
    threshTitle.className = 'init-row-extra-label'
    threshTitle.textContent = 'Schwelle'
    threshWrap.appendChild(threshTitle)

    const threshRow = document.createElement('div')
    threshRow.className = 'kampf-le-bands-editor__threshold-row'

    const typeSel = document.createElement('select')
    typeSel.className =
      'init-row-extra-input init-row-extra-select kampf-le-bands-editor__threshold-type'
    typeSel.disabled = readOnly
    for (const o of THRESHOLD_TYPE_OPTIONS) {
      const opt = document.createElement('option')
      opt.value = o.value
      opt.textContent = o.label
      typeSel.appendChild(opt)
    }
    typeSel.value = def.threshold?.type || 'fraction'
    threshRow.appendChild(typeSel)

    const paramsHost = document.createElement('div')
    paramsHost.className = 'kampf-le-bands-editor__threshold-params'
    threshRow.appendChild(paramsHost)

    threshWrap.appendChild(threshRow)
    grid.appendChild(threshWrap)

    const renderParams = () => {
      paramsHost.replaceChildren()
      const t = def.threshold
      if (!t) return
      if (t.type === 'fraction') {
        const numInp = document.createElement('input')
        numInp.type = 'number'
        numInp.className =
          'init-row-extra-input kampf-le-bands-editor__threshold-num'
        numInp.value = String(t.num)
        numInp.min = '1'
        numInp.max = '99'
        numInp.disabled = readOnly
        numInp.title = 'Zähler'
        numInp.addEventListener('change', () => {
          const n = parseInt(numInp.value, 10)
          if (Number.isFinite(n) && n >= 1) t.num = Math.min(99, n)
          numInp.value = String(t.num)
          emitChange()
        })
        const sep = document.createElement('span')
        sep.className = 'kampf-le-bands-editor__threshold-sep'
        sep.textContent = '/'
        const denInp = document.createElement('input')
        denInp.type = 'number'
        denInp.className =
          'init-row-extra-input kampf-le-bands-editor__threshold-num'
        denInp.value = String(t.den)
        denInp.min = '1'
        denInp.max = '999'
        denInp.disabled = readOnly
        denInp.title = 'Nenner'
        denInp.addEventListener('change', () => {
          const n = parseInt(denInp.value, 10)
          if (Number.isFinite(n) && n >= 1) t.den = Math.min(999, n)
          denInp.value = String(t.den)
          emitChange()
        })
        const hint = document.createElement('span')
        hint.className = 'kampf-le-bands-editor__threshold-hint'
        hint.textContent = `Trifft, wenn LE > 0 und LE × ${t.den} < LE-Max × ${t.num}.`
        paramsHost.append(numInp, sep, denInp, hint)
      } else if (t.type === 'absolute') {
        const valInp = document.createElement('input')
        valInp.type = 'number'
        valInp.className =
          'init-row-extra-input kampf-le-bands-editor__threshold-num'
        valInp.value = String(t.value)
        valInp.min = '0'
        valInp.max = '9999'
        valInp.disabled = readOnly
        valInp.title = 'LE ≤ Wert'
        valInp.addEventListener('change', () => {
          const n = parseInt(valInp.value, 10)
          if (Number.isFinite(n) && n >= 0) t.value = Math.min(9999, n)
          valInp.value = String(t.value)
          emitChange()
        })
        const hint = document.createElement('span')
        hint.className = 'kampf-le-bands-editor__threshold-hint'
        hint.textContent = 'Trifft, wenn LE ≤ Wert. (0 = Kampfunfähig.)'
        paramsHost.append(valInp, hint)
      } else if (t.type === 'negKoDepth') {
        const facInp = document.createElement('input')
        facInp.type = 'number'
        facInp.className =
          'init-row-extra-input kampf-le-bands-editor__threshold-num'
        facInp.value = String(t.factor)
        facInp.min = '0'
        facInp.max = '10'
        facInp.step = '0.1'
        facInp.disabled = readOnly
        facInp.title = 'Faktor × KO'
        facInp.addEventListener('change', () => {
          const n = parseFloat(facInp.value)
          if (Number.isFinite(n) && n >= 0) {
            t.factor = Math.round(Math.min(10, n) * 1000) / 1000
          }
          facInp.value = String(t.factor)
          emitChange()
        })
        const hint = document.createElement('span')
        hint.className = 'kampf-le-bands-editor__threshold-hint'
        hint.textContent = 'Trifft, wenn LE ≤ 0 und (-LE) > Faktor × KO.'
        paramsHost.append(facInp, hint)
      }
    }
    renderParams()

    typeSel.addEventListener('change', () => {
      const newType = typeSel.value
      if (newType === 'fraction') {
        def.threshold = { type: 'fraction', num: 1, den: 2 }
      } else if (newType === 'absolute') {
        def.threshold = { type: 'absolute', value: 0 }
      } else if (newType === 'negKoDepth') {
        def.threshold = { type: 'negKoDepth', factor: 0.5 }
      }
      renderParams()
      title.textContent = `Band ${idx + 1}: ${def.label || defaultLeBandLabel(def) || '(unbenannt)'}`
      emitChange()
    })

    card.appendChild(grid)

    // Mods-Liste
    const modsWrap = document.createElement('div')
    modsWrap.className = 'kampf-le-bands-editor__mods'
    const modsTitle = document.createElement('div')
    modsTitle.className = 'kampf-le-bands-editor__mods-title'
    modsTitle.textContent = 'Auto-Mods, wenn Band greift'
    modsWrap.appendChild(modsTitle)

    const modsList = document.createElement('div')
    modsList.className = 'kampf-le-bands-editor__mods-list'
    modsWrap.appendChild(modsList)

    const renderMods = () => {
      modsList.replaceChildren()
      ;(def.mods || []).forEach((mod, mi) => {
        const row = document.createElement('div')
        row.className = 'kampf-le-bands-editor__mod-row'

        const fldSel = document.createElement('select')
        fldSel.className =
          'init-row-extra-input init-row-extra-select kampf-le-bands-editor__mod-field'
        fldSel.disabled = readOnly
        for (const f of LE_BAND_MOD_FIELDS) {
          const opt = document.createElement('option')
          opt.value = f
          opt.textContent = fmtFieldLabel(f)
          fldSel.appendChild(opt)
        }
        fldSel.value = mod.field
        fldSel.addEventListener('change', () => {
          mod.field = fldSel.value
          emitChange()
        })
        row.appendChild(fldSel)

        const dInp = document.createElement('input')
        dInp.type = 'number'
        dInp.className = 'init-row-extra-input kampf-le-bands-editor__mod-delta'
        dInp.value = String(mod.delta ?? 0)
        dInp.disabled = readOnly
        dInp.title = 'Delta (negativ = Erschwernis)'
        dInp.addEventListener('change', () => {
          const n = parseInt(dInp.value, 10)
          mod.delta = Number.isFinite(n)
            ? Math.max(-99, Math.min(99, n))
            : 0
          dInp.value = String(mod.delta)
          emitChange()
        })
        row.appendChild(dInp)

        const rmRowBtn = document.createElement('button')
        rmRowBtn.type = 'button'
        rmRowBtn.className = 'btn kampf-le-bands-editor__mod-rm'
        rmRowBtn.textContent = '×'
        rmRowBtn.disabled = readOnly
        rmRowBtn.title = 'Mod entfernen'
        rmRowBtn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          def.mods = (def.mods || []).filter((_, i) => i !== mi)
          renderMods()
          emitChange()
        })
        row.appendChild(rmRowBtn)

        modsList.appendChild(row)
      })
    }
    renderMods()

    const addModBtn = document.createElement('button')
    addModBtn.type = 'button'
    addModBtn.className = 'btn kampf-le-bands-editor__mod-add'
    addModBtn.textContent = '+ Mod'
    addModBtn.disabled = readOnly
    addModBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!Array.isArray(def.mods)) def.mods = []
      def.mods.push({ field: 'at', delta: -1 })
      renderMods()
      emitChange()
    })
    modsWrap.appendChild(addModBtn)
    card.appendChild(modsWrap)

    return card
  }

  function rerender() {
    cards.replaceChildren()
    state.forEach((_, i) => cards.appendChild(buildBandCard(i)))
  }

  rerender()
  refreshValidity()

  return {
    getValue,
    setValue,
    resetToDefaults: () => setValue(cloneDefaultLeBandDefs()),
    destroy,
    isValid,
  }
}
