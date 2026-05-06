/**
 * UI-Kennung „V.xxx“: unter GitHub Actions = `GITHUB_RUN_NUMBER` (Vite `define`),
 * lokal = Fallback-Zahl unten.
 */
const BUILD_VERSION_FALLBACK = 537

// eslint-disable-next-line no-undef -- ersetzt beim Build durch Vite `define`
const raw = typeof __CI_BUILD_NUM__ !== 'undefined' ? __CI_BUILD_NUM__ : ''

export const BUILD_VERSION =
  typeof raw === 'string' &&
  raw !== '' &&
  Number.isFinite(Number(raw)) &&
  Number(raw) > 0
    ? Number(raw)
    : BUILD_VERSION_FALLBACK
