import { describe, it, expect } from 'vitest'
import { injectFontPreloads } from '../src/transform/preload-fonts.js'

describe('preload-fonts', () => {
  it('adds preload links for woff2 fonts in CSS', () => {
    const html = '<html><head><style>@font-face { src: url("assets/font.woff2") format("woff2"); }</style></head><body></body></html>'
    const result = injectFontPreloads(html)
    expect(result.html).toContain('rel="preload"')
    expect(result.html).toContain('as="font"')
    expect(result.html).toContain('assets/font.woff2')
    expect(result.fontsPreloaded).toBe(1)
  })

  it('adds preload for data URL fonts', () => {
    const html = '<html><head><style>@font-face { src: url("data:font/woff2;base64,AAAA") format("woff2"); }</style></head><body></body></html>'
    const result = injectFontPreloads(html)
    // Data URL fonts are already inline, don't preload
    expect(result.fontsPreloaded).toBe(0)
  })

  it('handles multiple fonts', () => {
    const html = `<html><head><style>
      @font-face { src: url("assets/regular.woff2") format("woff2"); }
      @font-face { src: url("assets/bold.woff2") format("woff2"); }
    </style></head><body></body></html>`
    const result = injectFontPreloads(html)
    expect(result.fontsPreloaded).toBe(2)
  })
})
