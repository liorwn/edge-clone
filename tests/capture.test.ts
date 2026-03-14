import { describe, it, expect, vi } from 'vitest'
import { findChromePath, buildSingleFileArgs } from '../src/capture.js'

describe('capture', () => {
  describe('findChromePath', () => {
    it('returns a path string', () => {
      const path = findChromePath()
      // On macOS, should find Chrome or Chromium
      expect(typeof path).toBe('string')
      expect(path.length).toBeGreaterThan(0)
    })
  })

  describe('buildSingleFileArgs', () => {
    it('builds correct args for default options', () => {
      const args = buildSingleFileArgs({
        url: 'https://example.com',
        output: '/tmp/test.html',
        wait: 8000,
        viewport: { width: 1440, height: 4000 },
        chromePath: '/usr/bin/google-chrome'
      })

      expect(args).toContain('--browser-width=1440')
      expect(args).toContain('--browser-height=4000')
      expect(args).toContain('--browser-wait-delay=8000')
      expect(args).toContain('https://example.com')
      expect(args).toContain('/tmp/test.html')
    })

    it('includes chrome path', () => {
      const args = buildSingleFileArgs({
        url: 'https://example.com',
        output: '/tmp/test.html',
        wait: 3000,
        viewport: { width: 1280, height: 720 },
        chromePath: '/path/to/chrome'
      })

      expect(args).toContain('--browser-executable-path="/path/to/chrome"')
    })
  })
})
