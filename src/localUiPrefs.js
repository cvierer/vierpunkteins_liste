const SHOW_ACTION_STAMPS_KEY = 'vierp_show_action_stamps_v1'
/** Persönlich: Fremde Helden-Hintergrundfarben ausblenden. Fehlt der Eintrag, Standard an. */
const HIDE_FOREIGN_HERO_COLORS_KEY = 'vierp_hide_foreign_hero_colors_v1'
const SHOW_HERO_ORIENTATION_RINGS_KEY = 'vierp_show_hero_orientation_rings_v1'
/** Persönlich: Detail-Ansicht (Tabs) im Helden-Aufklappbereich. Default: aus (Kompakt). */
const HERO_DETAILED_VIEW_KEY = 'vierp_hero_detailed_view_v1'

const listeners = new Set()
const foreignHeroColorListeners = new Set()
const orientationRingListeners = new Set()
const heroDetailedViewListeners = new Set()

export function getShowActionStamps() {
  try {
    const v = localStorage.getItem(SHOW_ACTION_STAMPS_KEY)
    if (v === null) return true
    return v !== '0'
  } catch {
    return true
  }
}

export function setShowActionStamps(show) {
  try {
    localStorage.setItem(SHOW_ACTION_STAMPS_KEY, show ? '1' : '0')
  } catch {
    /* ignore */
  }
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function onShowActionStampsChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Ob **auf diesem Gerät** fremde Helden-Zeilenfarben ausgeblendet werden.
 * Ohne lokalen Eintrag: Standard **an** (wie Aktionsstempel).
 */
export function getHideForeignHeroColorsForViewer() {
  try {
    const v = localStorage.getItem(HIDE_FOREIGN_HERO_COLORS_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  /* Ohne lokale Wahl: Standard wie Aktionsstempel — „fremde Farben ausblenden“ an. */
  return true
}

/**
 * Persönliche Anzeige-Option (localStorage). Jeder Spieler und die SL unabhängig.
 * @param {boolean} hide
 */
export function setHideForeignHeroColorsForViewer(hide) {
  try {
    localStorage.setItem(HIDE_FOREIGN_HERO_COLORS_KEY, hide ? '1' : '0')
  } catch {
    /* ignore */
  }
  for (const fn of foreignHeroColorListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function onHideForeignHeroColorsForViewerChange(fn) {
  foreignHeroColorListeners.add(fn)
  return () => foreignHeroColorListeners.delete(fn)
}

export function getShowHeroOrientationRings() {
  try {
    const v = localStorage.getItem(SHOW_HERO_ORIENTATION_RINGS_KEY)
    if (v === null) return true
    return v !== '0'
  } catch {
    return true
  }
}

export function setShowHeroOrientationRings(show) {
  try {
    localStorage.setItem(SHOW_HERO_ORIENTATION_RINGS_KEY, show ? '1' : '0')
  } catch {
    /* ignore */
  }
  for (const fn of orientationRingListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function onShowHeroOrientationRingsChange(fn) {
  orientationRingListeners.add(fn)
  return () => orientationRingListeners.delete(fn)
}

/**
 * Detail-Ansicht (Tabs) im aufklappbaren Heldenblock. Persönlich pro Gerät.
 * Ohne lokalen Eintrag: Standard **aus** (Kompakt-Ansicht wie bisher).
 */
export function getHeroDetailedView() {
  try {
    const v = localStorage.getItem(HERO_DETAILED_VIEW_KEY)
    return v === '1'
  } catch {
    return false
  }
}

/**
 * @param {boolean} on
 */
export function setHeroDetailedView(on) {
  try {
    localStorage.setItem(HERO_DETAILED_VIEW_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
  for (const fn of heroDetailedViewListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function onHeroDetailedViewChange(fn) {
  heroDetailedViewListeners.add(fn)
  return () => heroDetailedViewListeners.delete(fn)
}
