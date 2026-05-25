/**
 * Anzeige-Logik für 2.A.O.-Spiegel der Mutter-`KR_ABW` (Umwandeln jederzeit).
 * KR-Abw: v=0 → eine geladene Ladung, v=1 → verbraucht/leer (keine Schild-Icons).
 */

/** @param {unknown} v */
export function abwShieldCountFromKrValue(v) {
  const n = Math.floor(Number(v))
  const vNorm = Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 1
  if (vNorm === 1) return 0
  if (vNorm === 0) return 1
  return vNorm
}

/**
 * @param {boolean} mirrorLinkUi
 * @param {{ marks?: number } | null | undefined} mirrorZaoSlot
 */
export function isMirrorAbwUiActive(mirrorLinkUi, mirrorZaoSlot) {
  if (!mirrorLinkUi) return true
  return mirrorZaoSlot != null && mirrorZaoSlot.marks === 1
}

/**
 * @param {boolean} mirrorLinkUi
 * @param {{ marks?: number } | null | undefined} mirrorZaoSlot
 * @param {unknown} motherKrAbw
 */
export function resolveMirrorAbwKrValue(mirrorLinkUi, mirrorZaoSlot, motherKrAbw) {
  if (isMirrorAbwUiActive(mirrorLinkUi, mirrorZaoSlot)) {
    const n = Math.floor(Number(motherKrAbw))
    return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 1
  }
  return 1
}
