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
