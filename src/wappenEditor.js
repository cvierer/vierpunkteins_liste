/**
 * Wiederverwendbarer Wappen-/Trefferzonen-Editor.
 *
 * Wird im globalen SL-Settings-Panel und im Helden-Settings-Modal genutzt.
 * Verwaltet einen lokalen Zustand (Array von WappenDef[]); Änderungen
 * werden über `onChange` an den Aufrufer propagiert und dort zwischengespeichert,
 * bis dieser sie tatsächlich persistiert (z. B. „Speichern und schließen“).
 */

import {
  cloneDefaultWappenDefs,
  defaultSlot9Placeholder,
  MAX_WAPPEN,
  normalizeWappenDefs,
  normalizeSlot9Def,
  validateSlot9W20Overlap,
  validateW20CoverageCore,
  WAPPEN_AUTO_MOD_FIELDS,
} from './wappenDefs.js'

const PER_STUFE_OPTIONS = [
  { value: 'perStage', label: 'je Wundstufe (max 3)' },
  { value: 'perWound', label: 'je Wunde (max 4)' },
  { value: 'once', label: 'einmalig (≥ 1 Wunde)' },
]

const PARITY_OPTIONS = [
  { value: 'all', label: 'alle' },
  { value: 'odd', label: 'ungerade' },
  { value: 'even', label: 'gerade' },
]

/** Stellt sicher, dass die Wappen-Liste Slots 1..maxSlot enthält (auch leer). */
function padToWappenSlots(list, maxSlot = 8) {
  /** @type {Map<number, any>} */
  const bySlot = new Map()
  for (const d of list) bySlot.set(d.slot, d)
  const out = []
  for (let s = 1; s <= maxSlot; s++) {
    if (bySlot.has(s)) {
      out.push(bySlot.get(s))
    } else {
      out.push(
        s === 9
          ? { ...defaultSlot9Placeholder() }
          : {
              id: `wappen-${s}`,
              active: false,
              slot: s,
              abbr: '',
              label: '',
              tooltip: '',
              woundTooltip: '',
              w20Range: null,
              autoMods: [],
            }
      )
    }
  }
  return out
}

/** Nur Slot 9 (Helden-Einstellungen bei global/vierbeiner). */
function initSlot9OnlyState(initial) {
  if (Array.isArray(initial) && initial.length > 0) {
    const fromList = initial.find((d) => d?.slot === 9) ?? initial[0]
    const norm = normalizeSlot9Def(fromList)
    if (norm) return [norm]
  } else if (initial && typeof initial === 'object') {
    const norm = normalizeSlot9Def(initial)
    if (norm) return [norm]
  }
  return [{ ...defaultSlot9Placeholder() }]
}

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

/**
 * @param {HTMLElement} host
 * @param {{
 *   initial: import('./wappenDefs.js').WappenDef[] | null | undefined,
 *   readOnly?: boolean,
 *   maxSlots?: number,
 *   onlySlot9?: boolean,
 *   onChange?: (next: import('./wappenDefs.js').WappenDef[]) => void,
 *   onValidityChange?: (ok: boolean) => void,
 * }} opts
 * @returns {{
 *   getValue: () => import('./wappenDefs.js').WappenDef[],
 *   setValue: (next: import('./wappenDefs.js').WappenDef[]) => void,
 *   resetToDefaults: () => void,
 *   destroy: () => void,
 *   isValid: () => boolean,
 * }}
 */
export function mountWappenEditor(host, opts) {
  const readOnly = Boolean(opts?.readOnly)
  const onlySlot9 = Boolean(opts?.onlySlot9)
  const maxSlots = onlySlot9
    ? 1
    : Math.max(1, Math.min(MAX_WAPPEN, Math.floor(Number(opts?.maxSlots)) || 8))
  const onChange = typeof opts?.onChange === 'function' ? opts.onChange : null
  const onValidityChange =
    typeof opts?.onValidityChange === 'function' ? opts.onValidityChange : null

  /** @type {import('./wappenDefs.js').WappenDef[]} */
  let state = onlySlot9
    ? initSlot9OnlyState(opts?.initial)
    : padToWappenSlots(normalizeWappenDefs(opts?.initial), maxSlots)

  const root = document.createElement('div')
  root.className = 'kampf-wappen-editor'

  const summary = document.createElement('p')
  summary.className =
    'kampf-settings-panel__microhint kampf-wappen-editor__hint'
  summary.textContent = onlySlot9
    ? 'Optionale 9. Trefferzone (Slot SW im Heldenblock). W20 optional; darf Slots 1–8 nicht überlappen.'
    : maxSlots >= 9
      ? 'Bis zu 9 Kästchen-Slots für Wunden und Trefferzonen (Slots 1–8 Pflicht für W20 1–20, Slot 9 optional). In den Rüstungskästchen (früher Wappenkästchen) kannst du den Rüstungsschutz eintragen.'
      : 'Bis zu 8 Kästchen-Slots für Wunden und Trefferzonen. In den Rüstungskästchen (früher Wappenkästchen) kannst du den Rüstungsschutz eintragen. Jedes aktive Feld braucht eine W20-Spanne (1–20); zusammen decken alle aktiven Slots 1–20 lückenlos ab. Auto-Mods wirken bei Wunden je Trefferzone.'
  root.appendChild(summary)

  const templates = Array.isArray(opts?.templates) ? opts.templates : []
  if (templates.length > 0) {
    const tplRow = document.createElement('div')
    tplRow.className = 'kampf-wappen-editor__templates'
    const tplLabel = document.createElement('span')
    tplLabel.className = 'kampf-wappen-editor__templates-label'
    tplLabel.textContent = 'Vorlage einsetzen:'
    tplRow.appendChild(tplLabel)
    for (const tpl of templates) {
      if (!tpl || typeof tpl.build !== 'function') continue
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn kampf-wappen-editor__template-btn'
      btn.textContent = String(tpl.label || tpl.key || 'Vorlage')
      btn.disabled = readOnly
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (readOnly) return
        try {
          const next = tpl.build()
          setValue(Array.isArray(next) ? next : [])
        } catch {
          /* ignore */
        }
      })
      tplRow.appendChild(btn)
    }
    root.appendChild(tplRow)
  }

  const cards = document.createElement('div')
  cards.className = 'kampf-wappen-editor__cards'
  root.appendChild(cards)

  const validBox = document.createElement('div')
  validBox.className = 'kampf-wappen-editor__validity'
  root.appendChild(validBox)

  const actions = document.createElement('div')
  actions.className = 'kampf-wappen-editor__actions'

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.className = 'btn kampf-wappen-editor__reset'
  resetBtn.textContent = 'Auf Standard zurücksetzen'
  resetBtn.disabled = readOnly
  actions.appendChild(resetBtn)
  root.appendChild(actions)

  host.appendChild(root)

  resetBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (readOnly) return
    setValue(cloneDefaultWappenDefs())
  })

  function emitChange() {
    if (onChange) {
      const cur = getValue()
      onChange(cur)
    }
    refreshValidity()
  }

  function computeValidity() {
    if (onlySlot9) {
      const d = state[0]
      if (!d?.active) return { ok: true, missing: [], overlaps: [] }
      const abbrOk = Boolean(String(d.abbr ?? '').trim())
      return {
        ok: abbrOk,
        missing: abbrOk ? [] : [9],
        overlaps: [],
      }
    }
    const core = state.filter((d) => d.slot >= 1 && d.slot <= 8)
    const v = validateW20CoverageCore(core)
    const slot9 = state.find((d) => d.slot === 9 && d.active)
    if (!slot9) return v
    const ov = validateSlot9W20Overlap(state)
    if (ov.ok) return v
    return {
      ok: false,
      missing: v.missing,
      overlaps: ov.overlaps.map((n) => ({ n, ids: ['slot9', 'core'] })),
    }
  }

  function refreshValidity() {
    const v = computeValidity()
    validBox.classList.toggle('kampf-wappen-editor__validity--ok', v.ok)
    validBox.classList.toggle('kampf-wappen-editor__validity--err', !v.ok)
    if (onlySlot9) {
      validBox.textContent = v.ok
        ? '9. Trefferzone: gültig.'
        : '9. Trefferzone: Kürzel fehlt (max. 2 Zeichen).'
    } else if (v.ok) {
      validBox.textContent =
        maxSlots >= 9
          ? 'W20-Abdeckung Slots 1–8: vollständig; Slot 9 ohne Überlappung.'
          : 'W20-Abdeckung 1–20: vollständig und überschneidungsfrei.'
    } else {
      const parts = []
      if (v.missing.length > 0) {
        parts.push(`fehlend: ${v.missing.join(', ')}`)
      }
      if (v.overlaps.length > 0) {
        parts.push(
          `überschneidungen: ${v.overlaps
            .map((o) => `${o.n} (${o.ids.join(', ')})`)
            .join('; ')}`
        )
      }
      validBox.textContent = `W20-Abdeckung: ${parts.join(' · ')}`
    }
    if (onValidityChange) onValidityChange(v.ok)
  }

  function isValid() {
    return computeValidity().ok
  }

  function getValue() {
    return state
      .filter((d) => d.active || d.abbr || d.label || (d.autoMods && d.autoMods.length))
      .map((d) => ({
        id: d.id,
        active: Boolean(d.active),
        slot: d.slot,
        abbr: d.abbr || '',
        label: d.label || '',
        tooltip: d.tooltip || '',
        woundTooltip: d.woundTooltip || '',
        w20Range: d.w20Range
          ? {
              from: d.w20Range.from,
              to: d.w20Range.to,
              parity: d.w20Range.parity,
              frontalSplit: d.w20Range.frontalSplit,
            }
          : null,
        autoMods: (d.autoMods || []).map((m) => ({ ...m })),
      }))
  }

  function setValue(next) {
    state = onlySlot9
      ? initSlot9OnlyState(next)
      : padToWappenSlots(normalizeWappenDefs(next), maxSlots)
    rerender()
    emitChange()
  }

  function destroy() {
    root.remove()
  }

  // -------- Render -----------

  function buildSlotCard(idx) {
    const def = state[idx]
    const card = document.createElement('div')
    card.className = 'kampf-wappen-editor__card'
    card.classList.toggle('kampf-wappen-editor__card--inactive', !def.active)

    const header = document.createElement('div')
    header.className = 'kampf-wappen-editor__card-header'

    const headLabel = document.createElement('span')
    headLabel.className = 'kampf-wappen-editor__card-title'
    headLabel.textContent = `Slot ${def.slot}`
    header.appendChild(headLabel)

    const activeLbl = document.createElement('label')
    activeLbl.className = 'kampf-settings-checkbox-label kampf-wappen-editor__active-toggle'
    const activeCb = document.createElement('input')
    activeCb.type = 'checkbox'
    activeCb.checked = Boolean(def.active)
    activeCb.disabled = readOnly
    activeLbl.appendChild(activeCb)
    const activeTxt = document.createElement('span')
    activeTxt.textContent = 'Aktiv'
    activeLbl.appendChild(activeTxt)
    header.appendChild(activeLbl)

    card.appendChild(header)

    activeCb.addEventListener('change', () => {
      def.active = activeCb.checked
      card.classList.toggle('kampf-wappen-editor__card--inactive', !def.active)
      emitChange()
    })

    const grid = document.createElement('div')
    grid.className = 'kampf-wappen-editor__card-grid'

    const mkInput = (labelText, value, onInput, attrs = {}) => {
      const wrap = document.createElement('div')
      wrap.className = 'kampf-wappen-editor__field'
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
      inp.addEventListener('input', () => onInput(inp.value))
      wrap.appendChild(inp)
      return wrap
    }

    const mkTextarea = (labelText, value, onInput) => {
      const wrap = document.createElement('div')
      wrap.className = 'kampf-wappen-editor__field kampf-wappen-editor__field--full'
      const lbl = document.createElement('label')
      lbl.className = 'init-row-extra-label'
      lbl.textContent = labelText
      wrap.appendChild(lbl)
      const ta = document.createElement('textarea')
      ta.className = 'init-row-extra-input kampf-wappen-editor__textarea'
      ta.rows = 2
      ta.value = value ?? ''
      ta.spellcheck = false
      ta.disabled = readOnly
      ta.addEventListener('input', () => onInput(ta.value))
      wrap.appendChild(ta)
      return wrap
    }

    grid.appendChild(
      mkInput(
        'Kürzel (max 2)',
        def.abbr,
        (v) => {
          def.abbr = Array.from(String(v).trim()).slice(0, 2).join('')
          emitChange()
        },
        { maxLength: 2 }
      )
    )
    grid.appendChild(
      mkInput('Name', def.label, (v) => {
        def.label = String(v).trim()
        emitChange()
      })
    )
    grid.appendChild(
      mkTextarea('Tooltip (Wappen)', def.tooltip, (v) => {
        def.tooltip = String(v)
        emitChange()
      })
    )
    grid.appendChild(
      mkTextarea('Tooltip (Wundregel)', def.woundTooltip, (v) => {
        def.woundTooltip = String(v)
        emitChange()
      })
    )

    // W20-Range
    const w20Wrap = document.createElement('div')
    w20Wrap.className = 'kampf-wappen-editor__field kampf-wappen-editor__field--full kampf-wappen-editor__w20'
    const w20Title = document.createElement('label')
    w20Title.className = 'init-row-extra-label'
    w20Title.textContent = 'W20-Spanne'
    w20Wrap.appendChild(w20Title)

    const hasRange = !!def.w20Range
    const enableCb = document.createElement('input')
    enableCb.type = 'checkbox'
    enableCb.checked = hasRange
    enableCb.disabled = readOnly
    const enableLbl = document.createElement('label')
    enableLbl.className = 'kampf-settings-checkbox-label kampf-wappen-editor__w20-toggle'
    enableLbl.appendChild(enableCb)
    const enableTxt = document.createElement('span')
    enableTxt.textContent = 'W20-Auflösung aktiv'
    enableLbl.appendChild(enableTxt)
    w20Wrap.appendChild(enableLbl)

    const rangeRow = document.createElement('div')
    rangeRow.className = 'kampf-wappen-editor__w20-row'
    const fromInp = document.createElement('input')
    fromInp.type = 'number'
    fromInp.min = '1'
    fromInp.max = '20'
    fromInp.className = 'init-row-extra-input kampf-wappen-editor__w20-num'
    fromInp.value = def.w20Range ? String(def.w20Range.from) : ''
    fromInp.disabled = readOnly || !hasRange
    const toInp = document.createElement('input')
    toInp.type = 'number'
    toInp.min = '1'
    toInp.max = '20'
    toInp.className = 'init-row-extra-input kampf-wappen-editor__w20-num'
    toInp.value = def.w20Range ? String(def.w20Range.to) : ''
    toInp.disabled = readOnly || !hasRange
    const sep = document.createElement('span')
    sep.textContent = '–'
    sep.className = 'kampf-wappen-editor__w20-sep'
    const paritySel = document.createElement('select')
    paritySel.className = 'init-row-extra-input init-row-extra-select kampf-wappen-editor__parity'
    paritySel.disabled = readOnly || !hasRange
    for (const o of PARITY_OPTIONS) {
      const opt = document.createElement('option')
      opt.value = o.value
      opt.textContent = o.label
      paritySel.appendChild(opt)
    }
    paritySel.value = def.w20Range?.parity ?? 'all'

    const splitSel = document.createElement('select')
    splitSel.className = 'init-row-extra-input init-row-extra-select kampf-wappen-editor__split'
    splitSel.disabled = readOnly || !hasRange
    const noneOpt = document.createElement('option')
    noneOpt.value = ''
    noneOpt.textContent = 'kein Frontal-Split'
    splitSel.appendChild(noneOpt)
    for (const other of state) {
      if (other.id === def.id) continue
      const opt = document.createElement('option')
      opt.value = other.id
      opt.textContent = `Split → ${other.label || other.abbr || other.id}`
      splitSel.appendChild(opt)
    }
    splitSel.value = def.w20Range?.frontalSplit ?? ''

    rangeRow.append(fromInp, sep, toInp, paritySel, splitSel)
    w20Wrap.appendChild(rangeRow)
    grid.appendChild(w20Wrap)

    enableCb.addEventListener('change', () => {
      if (enableCb.checked) {
        def.w20Range = {
          from: 1,
          to: 1,
          parity: 'all',
          frontalSplit: null,
        }
      } else {
        def.w20Range = null
      }
      rerender()
      emitChange()
    })

    const updateRange = () => {
      if (!def.w20Range) return
      const f = parseInt(fromInp.value, 10)
      const t = parseInt(toInp.value, 10)
      if (Number.isFinite(f) && Number.isFinite(t)) {
        def.w20Range.from = Math.min(Math.max(1, f), 20)
        def.w20Range.to = Math.min(Math.max(1, t), 20)
      }
      def.w20Range.parity = /** @type {any} */ (paritySel.value)
      def.w20Range.frontalSplit = splitSel.value || null
      emitChange()
    }
    fromInp.addEventListener('change', updateRange)
    toInp.addEventListener('change', updateRange)
    paritySel.addEventListener('change', updateRange)
    splitSel.addEventListener('change', updateRange)

    card.appendChild(grid)

    // Auto-Mods
    const modsWrap = document.createElement('div')
    modsWrap.className = 'kampf-wappen-editor__mods'
    const modsTitle = document.createElement('div')
    modsTitle.className = 'kampf-wappen-editor__mods-title'
    modsTitle.textContent = 'Auto-Mods bei Wunden'
    modsWrap.appendChild(modsTitle)
    const modsList = document.createElement('div')
    modsList.className = 'kampf-wappen-editor__mods-list'
    modsWrap.appendChild(modsList)

    const renderMods = () => {
      modsList.replaceChildren()
      ;(def.autoMods || []).forEach((mod, mi) => {
        const row = document.createElement('div')
        row.className = 'kampf-wappen-editor__mod-row'

        const fldSel = document.createElement('select')
        fldSel.className =
          'init-row-extra-input init-row-extra-select kampf-wappen-editor__mod-field'
        fldSel.disabled = readOnly
        for (const f of WAPPEN_AUTO_MOD_FIELDS) {
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
        dInp.className = 'init-row-extra-input kampf-wappen-editor__mod-delta'
        dInp.value = String(mod.delta ?? 0)
        dInp.disabled = readOnly
        dInp.title = 'Delta (negativ = Erschwernis)'
        dInp.addEventListener('change', () => {
          const n = parseInt(dInp.value, 10)
          mod.delta = Number.isFinite(n) ? Math.max(-99, Math.min(99, n)) : 0
          dInp.value = String(mod.delta)
          emitChange()
        })
        row.appendChild(dInp)

        const psSel = document.createElement('select')
        psSel.className =
          'init-row-extra-input init-row-extra-select kampf-wappen-editor__mod-perstufe'
        psSel.disabled = readOnly
        for (const o of PER_STUFE_OPTIONS) {
          const opt = document.createElement('option')
          opt.value = o.value
          opt.textContent = o.label
          psSel.appendChild(opt)
        }
        psSel.value = mod.perStufe || 'perStage'
        psSel.addEventListener('change', () => {
          mod.perStufe = /** @type {any} */ (psSel.value)
          emitChange()
        })
        row.appendChild(psSel)

        const rmBtn = document.createElement('button')
        rmBtn.type = 'button'
        rmBtn.className = 'btn kampf-wappen-editor__mod-rm'
        rmBtn.textContent = '×'
        rmBtn.disabled = readOnly
        rmBtn.title = 'Auto-Mod entfernen'
        rmBtn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          def.autoMods = (def.autoMods || []).filter((_, i) => i !== mi)
          renderMods()
          emitChange()
        })
        row.appendChild(rmBtn)

        modsList.appendChild(row)
      })
    }
    renderMods()

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn kampf-wappen-editor__mod-add'
    addBtn.textContent = '+ Auto-Mod'
    addBtn.disabled = readOnly
    addBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!Array.isArray(def.autoMods)) def.autoMods = []
      def.autoMods.push({ field: 'at', delta: -1, perStufe: 'perStage' })
      renderMods()
      emitChange()
    })
    modsWrap.appendChild(addBtn)
    card.appendChild(modsWrap)

    return card
  }

  function rerender() {
    cards.replaceChildren()
    for (let i = 0; i < state.length; i++) {
      cards.appendChild(buildSlotCard(i))
    }
  }

  rerender()
  refreshValidity()

  return {
    getValue,
    setValue,
    resetToDefaults: () => setValue(cloneDefaultWappenDefs()),
    destroy,
    isValid,
  }
}
