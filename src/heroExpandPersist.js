/**
 * Debounced Persist-Controller für mountHeroExpandBlock.
 */

/**
 * @param {{
 *   debounceMs?: number,
 *   onFlush: (snapshot: unknown, generation: number) => void | Promise<void>,
 *   onPending?: (pending: boolean) => void,
 * }} opts
 */
export function createHeroExpandPersistController(opts) {
  const debounceMs = opts.debounceMs ?? 320
  /** @type {ReturnType<typeof setTimeout> | null} */
  let persistTimer = null
  let persistQueued = false
  /** @type {unknown} */
  let persistNextSnapshot = null
  let persistGeneration = 0

  const cancel = () => {
    if (persistTimer != null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    persistQueued = false
    persistNextSnapshot = null
    opts.onPending?.(false)
  }

  const flush = () => {
    persistTimer = null
    if (!persistQueued || persistNextSnapshot == null) return
    const snapshot = persistNextSnapshot
    persistQueued = false
    persistNextSnapshot = null
    const gen = ++persistGeneration
    void Promise.resolve(opts.onFlush(snapshot, gen)).then(() => {
      if (gen === persistGeneration) opts.onPending?.(false)
    })
  }

  const schedule = (snapshot) => {
    persistNextSnapshot = snapshot
    persistQueued = true
    opts.onPending?.(true)
    if (persistTimer != null) clearTimeout(persistTimer)
    persistTimer = setTimeout(flush, debounceMs)
  }

  const bumpGeneration = () => {
    persistGeneration += 1
    cancel()
  }

  return { schedule, flush, cancel, bumpGeneration }
}
