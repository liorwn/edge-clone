import { deferTracking, stripTracking } from './transform/defer-tracking.js'
import { extractAndOptimizeImages } from './transform/optimize-images.js'
import { injectFontPreloads } from './transform/preload-fonts.js'
import { injectPrefill } from './transform/inject-prefill.js'
import type { TransformResult, ExtractedAsset, TransformStats } from './types.js'

export interface TransformOptions {
  deferTracking: boolean
  stripTracking: boolean
  prefill: boolean
  optimizeImages: boolean
}

export async function transform(
  html: string,
  outputDir: string,
  options: TransformOptions
): Promise<TransformResult> {
  const originalSize = Buffer.byteLength(html, 'utf-8')
  let current = html
  let trackingDeferred = 0
  let trackingStripped = 0
  let vendors: string[] = []
  let assets: ExtractedAsset[] = []

  // Stage 1: Handle tracking scripts
  if (options.stripTracking) {
    const result = stripTracking(current)
    current = result.html
    trackingStripped = result.strippedCount
    vendors = result.vendors
  } else if (options.deferTracking) {
    const result = deferTracking(current)
    current = result.html
    trackingDeferred = result.deferredCount
    vendors = result.vendors
  }

  // Stage 2: Extract and optimize images
  if (options.optimizeImages) {
    const result = await extractAndOptimizeImages(current, outputDir)
    current = result.html
    assets = result.assets
  }

  // Stage 3: Inject font preloads
  const fontResult = injectFontPreloads(current)
  current = fontResult.html

  // Stage 4: Inject URL param prefill
  if (options.prefill) {
    current = injectPrefill(current)
  }

  const finalSize = Buffer.byteLength(current, 'utf-8')
  const totalAssetSize = assets.reduce((sum, a) => sum + a.optimizedSize, 0)

  const stats: TransformStats = {
    trackingScriptsDeferred: trackingDeferred,
    trackingScriptsStripped: trackingStripped,
    imagesOptimized: assets.filter(a => a.type === 'image').length,
    fontsPreloaded: fontResult.fontsPreloaded,
    originalHtmlSize: originalSize,
    finalHtmlSize: finalSize,
    totalAssetSize,
    estimatedLoadTimeMs: Math.round((finalSize + totalAssetSize) / 1000 * 8), // rough: 1MB/s on 3G
  }

  return { html: current, assets, stats }
}
