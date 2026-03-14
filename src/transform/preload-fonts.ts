import * as cheerio from 'cheerio'

export function injectFontPreloads(html: string): { html: string; fontsPreloaded: number } {
  const $ = cheerio.load(html, { decodeEntities: false } as any)

  // Find all font URLs in @font-face rules
  const fontUrls: Set<string> = new Set()
  const fontRegex = /url\("?([^")\s]+\.woff2[^")*]*)"?\)/g

  $('style').each((_, el) => {
    const css = $(el).html() || ''
    let match
    while ((match = fontRegex.exec(css)) !== null) {
      const url = match[1]
      // Skip data URLs (already inline)
      if (url.startsWith('data:')) continue
      fontUrls.add(url)
    }
  })

  // Inject preload links into <head>
  const preloadLinks = [...fontUrls].map(
    url => `<link rel="preload" href="${url}" as="font" type="font/woff2" crossorigin>`
  )

  if (preloadLinks.length > 0) {
    // Insert after <meta charset> or at start of <head>
    const charset = $('meta[charset]')
    if (charset.length) {
      charset.after('\n  ' + preloadLinks.join('\n  '))
    } else {
      $('head').prepend('\n  ' + preloadLinks.join('\n  '))
    }
  }

  return { html: $.html(), fontsPreloaded: fontUrls.size }
}
