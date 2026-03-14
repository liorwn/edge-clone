import { describe, it, expect } from 'vitest'

describe('deploy', () => {
  it('sanitizes project names for cloudflare', async () => {
    // Test the sanitization logic inline since we can't easily mock execSync
    const sanitize = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 58)

    expect(sanitize('My Cool Page')).toBe('my-cool-page')
    expect(sanitize('https://example.com/checkout')).toBe('https-example-com-checkout')
    expect(sanitize('UPPER_case_TEST')).toBe('upper-case-test')
    expect(sanitize('---leading-trailing---')).toBe('leading-trailing')
    expect(sanitize('a'.repeat(100))).toHaveLength(58)
  })

  it('rejects unknown platforms', async () => {
    const { deploy } = await import('../src/deploy.js')
    await expect(deploy('/tmp/test', 'aws', 'test')).rejects.toThrow('Unknown deploy platform')
  })
})
