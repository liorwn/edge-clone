import { execSync } from 'node:child_process'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CaptureResult } from './types.js'

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

export function findChromePath(): string {
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p
  }
  // Try `which` as fallback
  try {
    return execSync('which google-chrome || which chromium', { encoding: 'utf-8' }).trim()
  } catch {
    throw new Error('Chrome/Chromium not found. Install Chrome or set --chrome-path.')
  }
}

export interface BuildArgsOptions {
  url: string
  output: string
  wait: number
  viewport: { width: number; height: number }
  chromePath: string
}

export function buildSingleFileArgs(opts: BuildArgsOptions): string[] {
  return [
    `--browser-executable-path="${opts.chromePath}"`,
    `--browser-width=${opts.viewport.width}`,
    `--browser-height=${opts.viewport.height}`,
    `--browser-wait-delay=${opts.wait}`,
    '--browser-headless',
    opts.url,
    opts.output,
  ]
}

export async function capture(
  url: string,
  outputPath: string,
  options: {
    wait?: number
    viewport?: { width: number; height: number }
    chromePath?: string
  } = {}
): Promise<CaptureResult> {
  const wait = options.wait ?? 8000
  const viewport = options.viewport ?? { width: 1440, height: 4000 }
  const chromePath = options.chromePath ?? findChromePath()
  const output = resolve(outputPath)

  const args = buildSingleFileArgs({ url, output, wait, viewport, chromePath })

  const start = Date.now()

  // Use globally installed single-file if available, fall back to npx
  let singleFileCmd = 'npx single-file-cli'
  try {
    execSync('which single-file', { stdio: 'pipe' })
    singleFileCmd = 'single-file'
  } catch {
    // npx fallback — works locally, may timeout on servers without global install
  }

  execSync(`${singleFileCmd} ${args.join(' ')}`, {
    stdio: 'pipe',
    timeout: 120_000, // 2 min max
  })

  const captureTimeMs = Date.now() - start

  if (!existsSync(output)) {
    throw new Error(`Capture failed: output file not created at ${output}`)
  }

  const stats = statSync(output)
  const html = readFileSync(output, 'utf-8')

  return {
    html,
    filePath: output,
    originalSize: stats.size,
    captureTimeMs,
  }
}
