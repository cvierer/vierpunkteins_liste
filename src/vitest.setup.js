import { vi } from 'vitest'

/** Owlbear-SDK setzt u. a. in getDetails() auf `window` — in Node unverfügbar. */
vi.mock('@owlbear-rodeo/sdk', () => ({ default: {} }))
