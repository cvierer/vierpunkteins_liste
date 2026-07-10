#!/usr/bin/env node
/**
 * Prüft Feature-Isolations-Grenzen per statischer Import-Analyse.
 * Wird von `npm test` vor Vitest ausgeführt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src', import.meta.url))

/** @type {{ id: string, files: RegExp, forbidden: RegExp[] }[]} */
const RULES = [
  {
    id: 'lh-domain-no-ui',
    files: /^(lhMeta|lhEngine|longHandlung)\.js$/,
    forbidden: [/from\s+['"]\.\/initiativeList\.js['"]/, /from\s+['"]\.\/iniModMeta\.js['"]/],
  },
  {
    id: 'hero-expand-leaf-no-lh-engine',
    files: /^heroExpand(Dom|Tooltips|Gauges|ModFormat|Persist)\.js$/,
    forbidden: [/from\s+['"]\.\/longHandlung\.js['"]/, /from\s+['"]\.\/lhEngine\.js['"]/],
  },
  {
    id: 'hero-ex-data-no-kr-stamp',
    files: /^heroExMods\.js$/,
    forbidden: [
      /from\s+['"]\.\/longHandlung\.js['"]/,
      /patchKrCounterByDelta/,
    ],
  },
  {
    id: 'kr-leaf-no-initiative-list',
    files: /^(krDigit|krActionPool|krCounterRead|krPrimaryField|krIniLock|krTransferMarks|krZaoSlots|krStampPredicates)\.js$/,
    forbidden: [/from\s+['"]\.\/initiativeList\.js['"]/],
  },
  {
    id: 'lh-meta-no-kr-counters-barrel',
    files: /^lhMeta\.js$/,
    forbidden: [/from\s+['"]\.\/krCounters\.js['"]/],
  },
]

/**
 * @param {string} dir
 * @param {string[]} acc
 */
function walkJs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walkJs(p, acc)
      continue
    }
    if (name.endsWith('.js')) acc.push(p)
  }
  return acc
}

const files = walkJs(SRC)
/** @type {string[]} */
const violations = []

for (const filePath of files) {
  const rel = relative(SRC, filePath).replace(/\\/g, '/')
  const base = rel.split('/').pop() ?? rel
  const content = readFileSync(filePath, 'utf8')
  for (const rule of RULES) {
    if (!rule.files.test(base)) continue
    for (const pattern of rule.forbidden) {
      if (pattern.test(content)) {
        violations.push(`${rel}: rule "${rule.id}" violated (${pattern})`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Import boundary violations:\n')
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log(`Import boundaries OK (${files.length} files checked).`)
