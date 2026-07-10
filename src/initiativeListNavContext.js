/**
 * Geteilter Nav-Render-Kontext zwischen initiativeList und Nav-/L.H.-UI-Modulen.
 */
export const navRenderCtx = {
  /** @type {number | null} */
  currentNavIniForRender: null,
  /** @type {import('./phaseLinks.js').ConvertListVisibilityCtx | null} */
  visibilityCtxForRender: null,
  /** @type {import('./phaseLinks.js').CombatTurnStep[] | null} */
  navStepsForRender: null,
  /** @type {string} */
  cachedMergedListStructureSignature: '',
  /** @type {string} */
  lastRenderedStampSignatureForNav: '',
}
