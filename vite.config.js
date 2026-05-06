import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** GitHub-Project-Pages: BASE_PATH=/repo-name/ setzen (z. B. in CI). Lokal weglassen → '/'. */
/** GitHub Actions setzt das automatisch; lokal leer → Fallback in buildVersion.js */
const ciBuildNum = process.env.GITHUB_RUN_NUMBER || ''

const rawBase = process.env.BASE_PATH?.trim()
const base =
  rawBase && rawBase !== '/'
    ? rawBase.endsWith('/')
      ? rawBase
      : `${rawBase}/`
    : '/'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
}

function debugBuildLog(hypothesisId, location, message, data = {}) {
  const runId =
    process.env.GITHUB_RUN_ID || process.env.GITHUB_RUN_NUMBER || 'local-build'
  // #region agent log
  fetch('http://127.0.0.1:7606/ingest/2681bc4c-bb04-4c4f-a714-3d15b61bd325', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '4f2fb1',
    },
    body: JSON.stringify({
      sessionId: '4f2fb1',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

debugBuildLog('H1', 'vite.config.js:39', 'Vite config loaded', {
  nodeVersion: process.version,
  ci: process.env.CI || '',
  githubActions: process.env.GITHUB_ACTIONS || '',
  basePath: process.env.BASE_PATH || '',
})

function patchManifestForBase() {
  return {
    name: 'patch-manifest-base',
    closeBundle() {
      debugBuildLog('H2', 'vite.config.js:53', 'closeBundle entered', {
        base,
      })
      if (base === '/') return
      const manifestPath = resolve(__dirname, 'dist/manifest.json')
      debugBuildLog('H3', 'vite.config.js:58', 'Manifest path checked', {
        manifestPath,
        exists: existsSync(manifestPath),
      })
      if (!existsSync(manifestPath)) return
      const m = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      const prefix = base.replace(/\/$/, '')
      const withPrefix = (p) =>
        typeof p === 'string' && p.startsWith('/') ? `${prefix}${p}` : p
      if (m.action) {
        if (m.action.icon) m.action.icon = withPrefix(m.action.icon)
        if (m.action.popover) m.action.popover = withPrefix(m.action.popover)
      }
      if (ciBuildNum) {
        m.version = `1.0.${ciBuildNum}`
        const baseDesc = String(m.description || '')
          .replace(/^\[b\d+\]\s*/i, '')
          .replace(/^\[v[\d.]+\]\s*/i, '')
        m.description = `[b${ciBuildNum}] ${baseDesc}`.trim()
      }
      writeFileSync(manifestPath, `${JSON.stringify(m, null, 2)}\n`)
      debugBuildLog('H4', 'vite.config.js:80', 'Manifest patch completed', {
        version: m.version || '',
        descriptionPrefix: String(m.description || '').slice(0, 24),
      })
    },
  }
}

export default defineConfig({
  base,
  define: {
    __CI_BUILD_NUM__: JSON.stringify(ciBuildNum),
  },
  plugins: [basicSsl(), patchManifestForBase()],
  server: {
    host: true,
    headers: corsHeaders,
  },
  preview: {
    host: true,
    headers: corsHeaders,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    setupFiles: [resolve(__dirname, 'src/vitest.setup.js')],
  },
})
