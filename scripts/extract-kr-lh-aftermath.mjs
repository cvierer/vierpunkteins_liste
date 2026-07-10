import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lines = readFileSync(join(root, 'src/krCounters.js'), 'utf8').split(/\r?\n/)
const body = lines.slice(362, 794).join('\n')
const header = `/**
 * L.H.-Nachlauf: 2.AO-Wurzeln nach L.H.-Ende (promote/demote/dedupe).
 */
import {
  canCreateSecondActionRoot,
  finalizePhasesWithOrderedRoots,
  findRootLinkAtHookIni,
  hookIniForLink,
  iniNumeric,
  normalizePhases,
} from './phaseLinks.js'
import { chargeValueFromMarks } from './krDigit.js'
import { effectiveHeroPoolSplit } from './krActionPool.js'
import { readKrFirstSlotKind, syncKrPrimaryLadungFromPrimaryField } from './krPrimaryField.js'
import {
  KR_ANG,
  KR_FIRST_SLOT_KIND,
  KR_LH_ACTION,
  KR_LH_SECOND,
  KR_LH_VOID_BY_TRANSFER,
  KR_PAIR_MODE,
  KR_PRIMARY_VOID_BY_ABW_TRANSFER,
  KR_ZAO_SLOTS,
} from './krMetaKeys.js'
import {
  clearLhTrackerActivity,
  isLhActive,
  phaseOffsetFromHeroSecondAoMeta,
  readLhState,
} from './lhMeta.js'
import { applyUoDefaultAbwChargeIfNeeded, readZaoSlots } from './krZaoSlots.js'
import { reconcileShieldLedger } from './shieldLedger.js'

`
writeFileSync(join(root, 'src/krLhAftermath.js'), header + body + '\n')
console.log('krLhAftermath.js written')
