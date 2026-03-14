import { describe, it, expect } from 'vitest'
import { transform } from '../src/transform.js'

describe('transform', () => {
  it('processes HTML through all stages', async () => {
    const html = `<html><head>
      <script src="https://www.googletagmanager.com/gtm.js"></script>
      <style>@font-face { src: url("assets/font.woff2") format("woff2"); }</style>
    </head><body><p>Hello</p></body></html>`

    const result = await transform(html, '/tmp/test-output', {
      deferTracking: true,
      stripTracking: false,
      prefill: true,
      optimizeImages: false,
    })

    expect(result.stats.trackingScriptsDeferred).toBe(1)
    expect(result.stats.fontsPreloaded).toBe(1)
    expect(result.html).toContain('URLSearchParams') // prefill injected
    expect(result.html).toContain('loadTracking') // deferred loader
    expect(result.html).toContain('rel="preload"') // font preload
  })
})
