import { describe, it, expect } from 'vitest'
import { extractDataUrlImages, categorizeImage } from '../src/transform/optimize-images.js'

// Generate a long base64 string (>200 chars) for test data URLs that pass MIN_DATA_URL_LENGTH
const LONG_BASE64 = 'iVBORw0KGgo' + 'A'.repeat(250) + '='

describe('optimize-images', () => {
  describe('categorizeImage', () => {
    it('identifies above-fold images', () => {
      // Images in first 900px of viewport are above-fold
      expect(categorizeImage(0)).toBe('above-fold')
      expect(categorizeImage(800)).toBe('above-fold')
    })

    it('identifies below-fold images', () => {
      expect(categorizeImage(1000)).toBe('below-fold')
    })
  })

  describe('extractDataUrlImages', () => {
    it('extracts base64 PNG data URLs', () => {
      const html = `<img src="data:image/png;base64,${LONG_BASE64}">`
      const found = extractDataUrlImages(html)
      expect(found).toHaveLength(1)
      expect(found[0].mimeType).toBe('image/png')
    })

    it('extracts from CSS background-image', () => {
      const html = `<div style="background-image:url(data:image/jpeg;base64,${LONG_BASE64})"></div>`
      const found = extractDataUrlImages(html)
      expect(found).toHaveLength(1)
      expect(found[0].mimeType).toBe('image/jpeg')
    })

    it('skips small images (icons, 1x1 pixels)', () => {
      // A very short base64 string = tiny image, not worth extracting
      const html = '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">'
      const found = extractDataUrlImages(html)
      expect(found).toHaveLength(0) // 1x1 transparent gif, skip
    })
  })
})
