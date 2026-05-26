/**
 * DIST-Probe: Klicks auf Listen-Zeilen (#initiative-list ul) vs. Scroll-Hintergrund.
 * @param {HTMLElement} listUl
 * @param {EventTarget | null | undefined} target
 */
export function isProbePointerFromListRows(listUl, target) {
  return (
    target != null &&
    typeof listUl?.contains === 'function' &&
    listUl.contains(target)
  )
}
