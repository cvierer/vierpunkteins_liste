import { isLhActive, readLhState } from './lhMeta.js'

/**
 * Ob ein laufender L.H.-Counter das readOnly 1/x-Widget braucht (statt Setup-Feld).
 *
 * @param {unknown} trackerMeta
 * @param {boolean} hasReadOnlyCounter
 */
export function shouldRemountLhRunningCounter(trackerMeta, hasReadOnlyCounter) {
  const st = readLhState(trackerMeta)
  if (!(st.max > 0) || !isLhActive(trackerMeta)) return false
  return !hasReadOnlyCounter
}
