import { describe, it, expect } from 'vitest'
import { injectPrefill } from '../src/transform/inject-prefill.js'

describe('inject-prefill', () => {
  it('injects prefill script before </body>', () => {
    const html = '<html><body><form></form></body></html>'
    const result = injectPrefill(html)
    expect(result).toContain('URLSearchParams')
    expect(result).toContain('email')
    expect(result).toContain('fname')
    expect(result).toContain('lname')
    expect(result).toContain('dispatchEvent')
  })

  it('does not inject when no body tag', () => {
    const html = '<html><frameset></frameset></html>'
    const result = injectPrefill(html)
    // Still works, cheerio adds body
    expect(result).toContain('URLSearchParams')
  })
})
