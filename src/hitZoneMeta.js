import OBR from '@owlbear-rodeo/sdk'

/** Freitext Kampfnotizen (Trefferzonen-Dialog). */
export const HZ_KAMPFNOTIZ = 'hzKampfnotiz'

/** Trefferzonen: Zufallsspalte W20 (Fußkampf), vereinfachte Zuordnung. */
export const HIT_ZONE_DEFS = Object.freeze([
  {
    id: 'kopf',
    short: 'Kopf',
    w20: '19–20',
    w20Title:
      'Zufall W20 (Fußkampf): 19–20 = Kopf und Hals. Optional: Trefferzonen.',
    pos: { left: '50%', top: '4%', transform: 'translate(-50%, 0)' },
  },
  {
    id: 'brust',
    short: 'Brust',
    w20: '15–18',
    w20Title:
      'Zufall W20 (Fußkampf): 15–18 = Brust/Rücken (Rumpf); bei Frontalangriff Brust.',
    pos: { left: '42%', top: '22%', transform: 'translate(-50%, 0)' },
  },
  {
    id: 'ruecken',
    short: 'Rücken',
    w20: '15–18',
    w20Title:
      'Zufall W20 (Fußkampf): 15–18 = Brust/Rücken (Rumpf); ohne Frontalangriff Rücken.',
    pos: { left: '58%', top: '22%', transform: 'translate(-50%, 0)' },
  },
  {
    id: 'schildarm',
    short: 'S.-Arm',
    w20: '9–14 U',
    w20Title:
      'Zufall W20: 9–14, ungerade = Schildarm (linker Arm).',
    pos: { left: '12%', top: '30%', transform: 'translate(0, 0)' },
  },
  {
    id: 'schwertarm',
    short: 'Sw.-Arm',
    w20: '9–14 G',
    w20Title:
      'Zufall W20: 9–14, gerade = Schwertarm (rechter Arm).',
    pos: { left: '88%', top: '30%', transform: 'translate(-100%, 0)' },
  },
  {
    id: 'bauch',
    short: 'Bauch',
    w20: '7–8',
    w20Title: 'Zufall W20 (Fußkampf): 7–8 = Bauch.',
    pos: { left: '50%', top: '42%', transform: 'translate(-50%, 0)' },
  },
  {
    id: 'lbein',
    short: 'L-Bein',
    w20: '1–6 U',
    w20Title:
      'Zufall W20: 1–6, ungerade = linkes Bein.',
    pos: { left: '36%', top: '72%', transform: 'translate(-50%, 0)' },
  },
  {
    id: 'rbein',
    short: 'R-Bein',
    w20: '1–6 G',
    w20Title:
      'Zufall W20: 1–6, gerade = rechtes Bein.',
    pos: { left: '64%', top: '72%', transform: 'translate(-50%, 0)' },
  },
])

function capId(id) {
  return id.replace(/^[a-z]/, (c) => c.toUpperCase())
}

export function hzRsKey(zoneId) {
  return `hz${capId(zoneId)}Rs`
}

export function hzWKey(zoneId) {
  return `hz${capId(zoneId)}W`
}

function strOrEmpty(v) {
  if (v === undefined || v === null) return ''
  return String(v)
}

export function clampWound(n) {
  const x = Math.floor(Number(n))
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(4, x))
}

/**
 * Liest pro Wappen-/Trefferzone die persistierten RS- und Wundwerte.
 * Wenn keine Wappen-Liste übergeben wird, fällt die Funktion auf die
 * statische {@link HIT_ZONE_DEFS} zurück (=heutiges Verhalten).
 *
 * @param {Record<string, unknown> | undefined} meta
 * @param {string} trackerMetaKey
 * @param {Array<{ id: string }> | null | undefined} [wappenDefs]
 */
export function readHitZoneBundle(meta, trackerMetaKey, wappenDefs) {
  void trackerMetaKey
  const list =
    Array.isArray(wappenDefs) && wappenDefs.length > 0
      ? wappenDefs
      : HIT_ZONE_DEFS
  const zones = {}
  for (const z of list) {
    const rsRaw = meta?.[hzRsKey(z.id)]
    const wRaw = meta?.[hzWKey(z.id)]
    zones[z.id] = {
      rs: strOrEmpty(rsRaw),
      w: clampWound(wRaw),
    }
  }
  return {
    notiz: strOrEmpty(meta?.[HZ_KAMPFNOTIZ]),
    zones,
  }
}

/**
 * @param {string} itemId
 * @param {ReturnType<typeof readHitZoneBundle>} bundle
 * @param {string} trackerMetaKey
 * @param {Array<{ id: string }> | null | undefined} [wappenDefs]
 */
export async function applyHitZoneBundle(
  itemId,
  bundle,
  trackerMetaKey,
  wappenDefs
) {
  const list =
    Array.isArray(wappenDefs) && wappenDefs.length > 0
      ? wappenDefs
      : HIT_ZONE_DEFS
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      const m = d.metadata[trackerMetaKey]
      if (!m) continue

      const nT = bundle.notiz.trim()
      if (nT === '') delete m[HZ_KAMPFNOTIZ]
      else m[HZ_KAMPFNOTIZ] = nT

      for (const z of list) {
        const rs = bundle.zones[z.id]?.rs ?? ''
        const w = clampWound(bundle.zones[z.id]?.w)
        const rsT = String(rs).trim()
        if (rsT === '') delete m[hzRsKey(z.id)]
        else m[hzRsKey(z.id)] = rsT
        if (w <= 0) delete m[hzWKey(z.id)]
        else m[hzWKey(z.id)] = w
      }
    }
  })
}
