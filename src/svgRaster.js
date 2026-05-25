/** @type {Map<string, string>} */
const pngCache = new Map()

/**
 * @param {string} svgMarkup
 */
function svgDataUrl(svgMarkup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`
}

/**
 * Rasterisiert inline-SVG zu PNG (OBR buildImage lädt SVG-Data-URLs oft nicht).
 * @param {string} svgMarkup
 * @param {number} width
 * @param {number} height
 * @returns {Promise<string | null>}
 */
export async function rasterizeSvgToPngDataUrl(svgMarkup, width, height) {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const cacheKey = `${w}x${h}:${svgMarkup.length}:${svgMarkup.slice(0, 48)}`
  const cached = pngCache.get(cacheKey)
  if (cached) return cached

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null
  }

  const url = svgDataUrl(svgMarkup)
  const png = await new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })

  if (png) pngCache.set(cacheKey, png)
  return png
}

export function clearSvgRasterCache() {
  pngCache.clear()
}
