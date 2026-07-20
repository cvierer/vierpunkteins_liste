/**
 * Listen-INI: gespeicherter Rohwert (kein Live-IB-Overlay).
 * IB-Mods fließen erst nach „INI berechnen“ in die gespeicherte INI ein.
 * Modul bleibt als klarer Hook-Punkt / Test-Anker.
 */

/**
 * @param {Record<string, unknown> | undefined} _meta
 * @param {string} storedIni
 * @param {number | null | undefined} [_round]
 * @param {number | null | undefined} [_navIni]
 * @returns {string}
 */
export function effectiveListInitiativeString(_meta, storedIni, _round, _navIni) {
  return String(storedIni ?? '')
}
