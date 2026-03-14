import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as cheerio from 'cheerio'
import type { ExtractedAsset } from '../types.js'

const ABOVE_FOLD_THRESHOLD = 900 // pixels
const MIN_DATA_URL_LENGTH = 200 // skip tiny tracking pixels

export function categorizeImage(positionY: number): 'above-fold' | 'below-fold' {
  return positionY < ABOVE_FOLD_THRESHOLD ? 'above-fold' : 'below-fold'
}

export interface DataUrlImage {
  mimeType: string
  base64: string
  sizeBytes: number
  context: 'img-src' | 'css-bg' | 'other'
}

export function extractDataUrlImages(html: string): DataUrlImage[] {
  const images: DataUrlImage[] = []
  const dataUrlRegex = /data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)/g

  let match
  while ((match = dataUrlRegex.exec(html)) !== null) {
    const base64 = match[2]
    const sizeBytes = Math.ceil(base64.length * 0.75)

    // Skip tiny images (tracking pixels, 1x1 gifs, icons under 500 bytes)
    if (base64.length < MIN_DATA_URL_LENGTH) continue

    images.push({
      mimeType: match[1],
      base64,
      sizeBytes,
      context: 'img-src', // simplified; full impl checks DOM context
    })
  }

  return images
}

export async function extractAndOptimizeImages(
  html: string,
  outputDir: string
): Promise<{ html: string; assets: ExtractedAsset[] }> {
  const assetsDir = join(outputDir, 'assets')
  mkdirSync(assetsDir, { recursive: true })

  const $ = cheerio.load(html, { decodeEntities: false } as any)
  const assets: ExtractedAsset[] = []
  let imageIndex = 0

  // Find all data URL images in <img> tags
  const imgPromises: Promise<void>[] = []

  $('img[src^="data:image"]').each((_, el) => {
    const src = $(el).attr('src') || ''
    const match = src.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
    if (!match) return

    const mimeType = match[1]
    const base64 = match[2]
    const originalSize = Math.ceil(base64.length * 0.75)

    // Skip tiny images
    if (base64.length < MIN_DATA_URL_LENGTH) return

    const idx = imageIndex++
    const ext = mimeType === 'image/svg+xml' ? 'svg' : 'webp'
    const filename = `img-${idx}.${ext}`
    const filePath = join(assetsDir, filename)

    const p = (async () => {
      const buffer = Buffer.from(base64, 'base64')

      if (mimeType === 'image/svg+xml') {
        // SVGs: just write as-is
        writeFileSync(filePath, buffer)
        assets.push({
          originalUrl: `data:${mimeType};base64,...`,
          localPath: `assets/${filename}`,
          type: 'image',
          originalSize,
          optimizedSize: buffer.length,
          format: 'svg',
        })
      } else {
        // Raster images: convert to WebP
        const optimized = await sharp(buffer)
          .webp({ quality: 80 })
          .toBuffer()

        writeFileSync(filePath, optimized)
        assets.push({
          originalUrl: `data:${mimeType};base64,...`,
          localPath: `assets/${filename}`,
          type: 'image',
          originalSize,
          optimizedSize: optimized.length,
          format: 'webp',
        })
      }

      $(el).attr('src', `assets/${filename}`)
      $(el).attr('loading', idx < 3 ? 'eager' : 'lazy')
    })()

    imgPromises.push(p)
  })

  await Promise.all(imgPromises)

  return { html: $.html(), assets }
}
