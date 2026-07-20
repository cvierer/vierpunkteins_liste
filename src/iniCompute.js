/**
 * INI-Wert aus IB − BE + W6 (IB als Zahl oder „a+b“; W6 bei „1+2“ summiert).
 * @returns {number | null}
 */
export function computeIniFromIbBeW6(ibRaw, beRaw, w6Raw) {
  const ibT = String(ibRaw ?? '').trim()
  const beT = String(beRaw ?? '').trim()
  const w6T = String(w6Raw ?? '').trim()
  if (ibT === '' || beT === '' || w6T === '') return null

  let ibNum = NaN
  const mPlus = ibT.match(/^(-?\d+)\s*\+\s*(-?\d+)\s*$/)
  if (mPlus) {
    ibNum = Number(mPlus[1]) + Number(mPlus[2])
  } else {
    const m = ibT.match(/^-?\d+/)
    if (m) ibNum = Number(m[0])
  }
  const beNum = Number(String(beT).replace(',', '.'))
  const w6Parts = w6T.split('+').map((p) =>
    Number(String(p).trim().replace(',', '.'))
  )
  if (!w6Parts.every((n) => Number.isFinite(n))) return null
  const w6Num = w6Parts.reduce((a, b) => a + b, 0)

  if (!Number.isFinite(ibNum) || !Number.isFinite(beNum)) return null
  const result = ibNum - beNum + w6Num
  return Number.isFinite(result) ? result : null
}

/**
 * Basis-IB/BE-Strings um Feld-Mods anpassen (wie integriertes IB-Kästchen).
 * Nicht-ganzzahlige Basis bleibt unverändert (computeIniFromIbBeW6 kann a+b).
 *
 * @param {Record<string, unknown> | undefined} meta
 * @param {string} ibRaw
 * @param {string} beRaw
 * @param {number | null} ownerIni
 * @param {number | null} round
 * @param {number | null} navIni
 * @param {(meta: any, field: string, base: number, ownerIni: number, round: number | null, navIni: number | null) => number} adjustFn
 * @returns {{ ib: string, be: string }}
 */
export function applyIbBeModsForIniCompute(
  meta,
  ibRaw,
  beRaw,
  ownerIni,
  round,
  navIni,
  adjustFn
) {
  let ibEff = String(ibRaw ?? '').trim()
  let beEff = String(beRaw ?? '').trim()
  if (ownerIni == null || typeof adjustFn !== 'function') {
    return { ib: ibEff, be: beEff }
  }
  const ibNum = Number(String(ibEff).replace(',', '.'))
  const beNum = Number(String(beEff).replace(',', '.'))
  if (Number.isFinite(ibNum)) {
    const dIb = adjustFn(meta, 'ib', ibNum, ownerIni, round, navIni)
    if (Number.isFinite(dIb)) ibEff = String(ibNum + dIb)
  }
  if (Number.isFinite(beNum)) {
    const dBe = adjustFn(meta, 'be', beNum, ownerIni, round, navIni)
    if (Number.isFinite(dBe)) beEff = String(beNum + dBe)
  }
  return { ib: ibEff, be: beEff }
}
