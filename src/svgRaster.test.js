import { describe, expect, it } from 'vitest'
import { clearSvgRasterCache, rasterizeSvgToPngDataUrl } from './svgRaster.js'
import { MAP_PRIMARY_ICON_H, MAP_PRIMARY_ICON_W } from './krPrimaryKindIcons.js'

describe('rasterizeSvgToPngDataUrl', () => {
  it('liefert null ohne DOM (Vitest)', async () => {
    const url = await rasterizeSvgToPngDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34"></svg>',
      MAP_PRIMARY_ICON_W,
      MAP_PRIMARY_ICON_H
    )
    expect(url).toBeNull()
  })

  it('Cache kann geleert werden', () => {
    clearSvgRasterCache()
    expect(true).toBe(true)
  })
})
