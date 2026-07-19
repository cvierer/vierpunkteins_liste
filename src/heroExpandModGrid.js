/**
 * Heldenblock Mod-Grid: Tooltip-/Badge-Texte (aus iniModMeta extrahiert).
 */
import { formatModChipValue } from './heroExpandModFormat.js'
import { MOD_FIELD_LABEL, modNavFractionLabelFromNav } from './heroExMods.js'

/**
 * @param {import('./heroExMods.js').HeroExModRecord} modRec
 * @param {number} ownerIniNum
 * @param {import('./lhMeta.js').LhMechanics} lhMech
 * @param {number | null | undefined} round
 * @param {number | null | undefined} navIni
 * @param {number} effectiveDelta
 */
export function buildModBadgeLongSummary(
  modRec,
  ownerIniNum,
  lhMech,
  round,
  navIni,
  effectiveDelta
) {
  const val = formatModChipValue(effectiveDelta, modRec?.absolute === true)
  return `${MOD_FIELD_LABEL[modRec.field]} ${val} (${modNavFractionLabelFromNav(modRec, ownerIniNum, lhMech, round, navIni)})`
}

export { MOD_FIELD_LABEL, modNavFractionLabelFromNav }
