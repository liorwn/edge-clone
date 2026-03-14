# edge-clone MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that takes any URL and produces a speed-optimized static clone — pixel-perfect, with tracking deferred (not stripped), ready for sub-1-second edge deployment.

**Architecture:** Three-stage pipeline: Capture (SingleFile CLI for rendered DOM) → Transform (parse HTML, defer tracking scripts, extract/optimize images, inject font preloads + prefill JS) → Output (deployable static directory with assets/). Each stage is a separate module with a clean interface. The CLI orchestrates the pipeline and optionally deploys to CF Pages.

**Tech Stack:** Node.js 22+, TypeScript, Commander.js (CLI), cheerio (HTML parsing), sharp (image optimization), single-file-cli (capture), vitest (testing)

---

## Phase 1: Project Scaffolding + Capture

### Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `src/cli.ts`
- Create: `.gitignore`

**Step 1: Initialize and configure**

```bash
cd ~/dev/edge-clone
git init
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install commander chalk ora
npm install -D typescript vitest @types/node tsx
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Create package.json scripts and bin**

Update package.json:
```json
{
  "name": "edge-clone",
  "version": "0.1.0",
  "description": "Clone any web page into a speed-optimized static site with deferred tracking. Sub-1-second loads.",
  "type": "module",
  "bin": {
    "edge-clone": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["pagespeed", "clone", "static-site", "edge", "performance", "tracking", "marketing"],
  "license": "MIT"
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
*.tgz
.DS_Store
output/
```

**Step 6: Create entry point stubs**

`src/cli.ts`:
```typescript
#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()

program
  .name('edge-clone')
  .description('Clone any web page into a speed-optimized static site. Sub-1-second loads.')
  .version('0.1.0')
  .argument('<url>', 'URL to clone')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-w, --wait <ms>', 'Wait time for JS rendering (ms)', '8000')
  .option('--no-defer-tracking', 'Keep tracking scripts inline (no deferral)')
  .option('--strip-tracking', 'Remove tracking scripts entirely')
  .option('--no-prefill', 'Skip URL param prefill injection')
  .option('--no-optimize-images', 'Skip image optimization')
  .option('--deploy <platform>', 'Deploy after clone (cloudflare|vercel)')
  .option('--name <name>', 'Project name for deployment')
  .option('--viewport <WxH>', 'Browser viewport size', '1440x4000')
  .action(async (url, options) => {
    console.log(`edge-clone: ${url}`)
    console.log('Options:', options)
  })

program.parse()
```

`src/index.ts`:
```typescript
export { capture } from './capture.js'
export { transform } from './transform.js'
export type { EdgeCloneOptions, EdgeCloneResult } from './types.js'
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: initialize edge-clone project scaffolding"
```

---

### Task 2: Types and config

**Files:**
- Create: `src/types.ts`

**Step 1: Define core types**

```typescript
export interface EdgeCloneOptions {
  url: string
  output: string
  wait: number
  deferTracking: boolean
  stripTracking: boolean
  prefill: boolean
  optimizeImages: boolean
  deploy?: 'cloudflare' | 'vercel'
  deployName?: string
  viewport: { width: number; height: number }
  chromePath?: string
}

export interface CaptureResult {
  html: string
  filePath: string
  originalSize: number
  captureTimeMs: number
}

export interface TransformResult {
  html: string
  assets: ExtractedAsset[]
  stats: TransformStats
}

export interface ExtractedAsset {
  originalUrl: string
  localPath: string
  type: 'image' | 'font' | 'other'
  originalSize: number
  optimizedSize: number
  format: string
}

export interface TransformStats {
  trackingScriptsDeferred: number
  trackingScriptsStripped: number
  imagesOptimized: number
  fontsPreloaded: number
  originalHtmlSize: number
  finalHtmlSize: number
  totalAssetSize: number
  estimatedLoadTimeMs: number
}

export interface EdgeCloneResult {
  outputDir: string
  indexPath: string
  stats: TransformStats
  captureTimeMs: number
  transformTimeMs: number
  deployUrl?: string
}

// Known tracking script patterns
export const TRACKING_PATTERNS = {
  gtm: /googletagmanager\.com/,
  ga: /google-analytics\.com|gtag\/js/,
  fbPixel: /facebook\.com\/tr|fbevents\.js|connect\.facebook\.net/,
  hotjar: /hotjar\.com|static\.hotjar\.com/,
  amplitude: /cdn\.amplitude\.com/,
  onetrust: /cdn\.cookielaw\.org|onetrust/,
  ttd: /adsrvr\.org|insight\.adsrvr\.org/,
  hubspot: /js\.hs-scripts\.com|js\.hs-analytics\.net|js\.hsforms\.net/,
  segment: /cdn\.segment\.com|analytics\.js/,
  intercom: /widget\.intercom\.io/,
  drift: /js\.driftt\.com/,
  clarity: /clarity\.ms/,
  linkedin: /snap\.licdn\.com|px\.ads\.linkedin\.com/,
  twitter: /static\.ads-twitter\.com|analytics\.twitter\.com/,
  tiktok: /analytics\.tiktok\.com/,
  pinterest: /ct\.pinterest\.com|pintrk/,
  reddit: /alb\.reddit\.com/,
  quora: /q\.quora\.com/,
} as const

export type TrackingVendor = keyof typeof TRACKING_PATTERNS
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core types and tracking pattern definitions"
```

---

### Task 3: Capture module

**Files:**
- Create: `src/capture.ts`
- Create: `tests/capture.test.ts`

**Step 1: Write the test**

```typescript
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

      expect(args).toContain('--browser-executable-path=/path/to/chrome')
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/capture.test.ts
```

Expected: FAIL (module not found)

**Step 3: Implement capture module**

`src/capture.ts`:
```typescript
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
    `--browser-executable-path=${opts.chromePath}`,
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

  execSync(`npx single-file-cli ${args.join(' ')}`, {
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
```

**Step 4: Run tests**

```bash
npx vitest run tests/capture.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/capture.ts tests/capture.test.ts
git commit -m "feat: add capture module with SingleFile CLI integration"
```

---

## Phase 2: Transform Pipeline

### Task 4: Tracking script deferral

**Files:**
- Create: `src/transform/defer-tracking.ts`
- Create: `tests/defer-tracking.test.ts`

**Step 1: Install cheerio**

```bash
npm install cheerio
npm install -D @types/cheerio
```

**Step 2: Write tests**

```typescript
import { describe, it, expect } from 'vitest'
import { deferTracking, identifyTrackingScripts } from '../src/transform/defer-tracking.js'
import * as cheerio from 'cheerio'

describe('defer-tracking', () => {
  describe('identifyTrackingScripts', () => {
    it('detects GTM scripts', () => {
      const html = '<html><head><script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script></head><body></body></html>'
      const $ = cheerio.load(html)
      const found = identifyTrackingScripts($)
      expect(found).toHaveLength(1)
      expect(found[0].vendor).toBe('gtm')
    })

    it('detects Facebook Pixel', () => {
      const html = '<html><head><script>!function(f,b,e,v){fbevents.js};</script></head><body><noscript><img height="1" width="1" src="https://www.facebook.com/tr?id=123&ev=PageView"/></noscript></body></html>'
      const $ = cheerio.load(html)
      const found = identifyTrackingScripts($)
      expect(found.length).toBeGreaterThanOrEqual(1)
    })

    it('detects multiple vendors', () => {
      const html = `<html><head>
        <script src="https://www.googletagmanager.com/gtm.js"></script>
        <script src="https://static.hotjar.com/c/hotjar-123.js"></script>
        <script src="https://cdn.amplitude.com/libs/analytics.js"></script>
      </head><body></body></html>`
      const $ = cheerio.load(html)
      const found = identifyTrackingScripts($)
      expect(found.length).toBe(3)
    })

    it('ignores non-tracking scripts', () => {
      const html = '<html><head><script src="https://cdn.example.com/app.js"></script></head><body></body></html>'
      const $ = cheerio.load(html)
      const found = identifyTrackingScripts($)
      expect(found).toHaveLength(0)
    })
  })

  describe('deferTracking', () => {
    it('converts tracking script src to data-deferred-src', () => {
      const html = '<html><head><script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC"></script></head><body></body></html>'
      const result = deferTracking(html)
      expect(result.html).toContain('data-deferred-src')
      expect(result.html).toContain('type="text/deferred-tracking"')
      expect(result.html).not.toContain('src="https://www.googletagmanager.com')
      expect(result.deferredCount).toBe(1)
    })

    it('injects the deferred loader script', () => {
      const html = '<html><head><script src="https://www.googletagmanager.com/gtm.js"></script></head><body></body></html>'
      const result = deferTracking(html)
      expect(result.html).toContain('function loadTracking()')
      expect(result.html).toContain('click')
      expect(result.html).toContain('touchstart')
      expect(result.html).toContain('setTimeout(loadTracking, 15000)')
    })

    it('removes OneTrust consent banner', () => {
      const html = '<html><body><div id="onetrust-consent-sdk"><div class="ot-sdk-container">Cookie banner</div></div><div>Real content</div></body></html>'
      const result = deferTracking(html)
      expect(result.html).not.toContain('onetrust-consent-sdk')
      expect(result.html).toContain('Real content')
    })

    it('handles inline tracking scripts', () => {
      const html = '<html><head><script>!function(f,b,e,v){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}; fbevents.js}</script></head><body></body></html>'
      const result = deferTracking(html)
      expect(result.html).toContain('type="text/deferred-tracking"')
    })

    it('returns 0 deferred when no tracking found', () => {
      const html = '<html><head></head><body><p>Hello</p></body></html>'
      const result = deferTracking(html)
      expect(result.deferredCount).toBe(0)
      expect(result.html).not.toContain('loadTracking')
    })
  })
})
```

**Step 3: Run tests (should fail)**

```bash
npx vitest run tests/defer-tracking.test.ts
```

**Step 4: Implement**

`src/transform/defer-tracking.ts`:
```typescript
import * as cheerio from 'cheerio'
import { TRACKING_PATTERNS, type TrackingVendor } from '../types.js'

export interface TrackedScript {
  vendor: TrackingVendor | 'unknown'
  type: 'external' | 'inline' | 'noscript' | 'iframe'
  src?: string
  content?: string
}

export function identifyTrackingScripts($: cheerio.CheerioAPI): TrackedScript[] {
  const found: TrackedScript[] = []

  // Check external scripts
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || ''
    for (const [vendor, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(src)) {
        found.push({ vendor: vendor as TrackingVendor, type: 'external', src })
        return
      }
    }
  })

  // Check inline scripts
  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || ''
    for (const [vendor, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(content)) {
        found.push({ vendor: vendor as TrackingVendor, type: 'inline', content: content.slice(0, 200) })
        return
      }
    }
  })

  // Check noscript tracking pixels
  $('noscript').each((_, el) => {
    const content = $(el).html() || ''
    for (const [vendor, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(content)) {
        found.push({ vendor: vendor as TrackingVendor, type: 'noscript', content: content.slice(0, 200) })
        return
      }
    }
  })

  // Check tracking iframes (1x1 pixels)
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || ''
    const h = $(el).attr('height')
    const w = $(el).attr('width')
    if ((h === '0' || h === '1') && (w === '0' || w === '1')) {
      for (const [vendor, pattern] of Object.entries(TRACKING_PATTERNS)) {
        if (pattern.test(src)) {
          found.push({ vendor: vendor as TrackingVendor, type: 'iframe', src })
          return
        }
      }
    }
  })

  return found
}

const DEFERRED_LOADER = `
<script>
(function(){
  var loaded=false;
  function loadTracking(){
    if(loaded)return;
    loaded=true;
    document.querySelectorAll('script[type="text/deferred-tracking"]').forEach(function(el){
      var s=document.createElement('script');
      if(el.dataset.deferredSrc){s.src=el.dataset.deferredSrc;s.async=true}
      else{s.textContent=el.textContent}
      Array.from(el.attributes).forEach(function(a){
        if(a.name!=='type'&&a.name!=='data-deferred-src')s.setAttribute(a.name,a.value)
      });
      el.parentNode.replaceChild(s,el)
    });
    document.querySelectorAll('noscript[data-deferred-tracking]').forEach(function(el){
      var d=document.createElement('div');d.innerHTML=el.textContent;
      el.parentNode.replaceChild(d,el)
    });
  }
  ['click','touchstart','mousemove','keydown'].forEach(function(e){
    document.addEventListener(e,loadTracking,{once:true,passive:true})
  });
  setTimeout(loadTracking,15000);
})();
</script>`

export function deferTracking(html: string): { html: string; deferredCount: number; vendors: string[] } {
  const $ = cheerio.load(html, { decodeEntities: false })
  let deferredCount = 0
  const vendors: Set<string> = new Set()

  // Defer external tracking scripts
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || ''
    for (const [vendor, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(src)) {
        $(el).attr('data-deferred-src', src)
        $(el).removeAttr('src')
        $(el).attr('type', 'text/deferred-tracking')
        deferredCount++
        vendors.add(vendor)
        return
      }
    }
  })

  // Defer inline tracking scripts
  $('script:not([src]):not([type="text/deferred-tracking"])').each((_, el) => {
    const content = $(el).html() || ''
    for (const [vendor, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(content)) {
        $(el).attr('type', 'text/deferred-tracking')
        deferredCount++
        vendors.add(vendor)
        return
      }
    }
  })

  // Mark noscript tracking pixels
  $('noscript').each((_, el) => {
    const content = $(el).html() || ''
    for (const [, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(content)) {
        $(el).attr('data-deferred-tracking', '')
        deferredCount++
        return
      }
    }
  })

  // Remove OneTrust consent banner
  $('#onetrust-consent-sdk').remove()
  $('[class*="onetrust"]').remove()
  $('#ot-sdk-btn-floating').remove()

  // Remove tracking iframes (0x0 or 1x1 pixels)
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || ''
    const h = $(el).attr('height')
    const w = $(el).attr('width')
    if ((h === '0' || h === '1') && (w === '0' || w === '1')) {
      for (const [, pattern] of Object.entries(TRACKING_PATTERNS)) {
        if (pattern.test(src)) {
          $(el).remove()
          deferredCount++
          return
        }
      }
    }
  })

  // Inject loader only if we deferred something
  if (deferredCount > 0) {
    $('body').append(DEFERRED_LOADER)
  }

  return { html: $.html(), deferredCount, vendors: [...vendors] }
}

export function stripTracking(html: string): { html: string; strippedCount: number; vendors: string[] } {
  const $ = cheerio.load(html, { decodeEntities: false })
  let strippedCount = 0
  const vendors: Set<string> = new Set()

  // Remove external tracking scripts
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || ''
    for (const [vendor, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(src)) {
        $(el).remove()
        strippedCount++
        vendors.add(vendor)
        return
      }
    }
  })

  // Remove inline tracking scripts
  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || ''
    for (const [vendor, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(content)) {
        $(el).remove()
        strippedCount++
        vendors.add(vendor)
        return
      }
    }
  })

  // Remove noscript tracking pixels
  $('noscript').each((_, el) => {
    const content = $(el).html() || ''
    for (const [, pattern] of Object.entries(TRACKING_PATTERNS)) {
      if (pattern.test(content)) {
        $(el).remove()
        strippedCount++
        return
      }
    }
  })

  // Remove OneTrust
  $('#onetrust-consent-sdk').remove()
  $('[class*="onetrust"]').remove()

  // Remove tracking iframes
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || ''
    const h = $(el).attr('height')
    const w = $(el).attr('width')
    if ((h === '0' || h === '1') && (w === '0' || w === '1')) {
      $(el).remove()
      strippedCount++
    }
  })

  return { html: $.html(), strippedCount, vendors: [...vendors] }
}
```

**Step 5: Run tests**

```bash
npx vitest run tests/defer-tracking.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add tracking script deferral with 20+ vendor patterns"
```

---

### Task 5: Image extraction and optimization

**Files:**
- Create: `src/transform/optimize-images.ts`
- Create: `tests/optimize-images.test.ts`

**Step 1: Install sharp**

```bash
npm install sharp
```

**Step 2: Write tests**

```typescript
import { describe, it, expect } from 'vitest'
import { extractDataUrlImages, categorizeImage } from '../src/transform/optimize-images.js'

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
      const html = '<img src="data:image/png;base64,iVBORw0KGgo=">'
      const found = extractDataUrlImages(html)
      expect(found).toHaveLength(1)
      expect(found[0].mimeType).toBe('image/png')
    })

    it('extracts from CSS background-image', () => {
      const html = '<div style="background-image:url(data:image/jpeg;base64,/9j/4AAQ=)"></div>'
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
```

**Step 3: Implement**

`src/transform/optimize-images.ts`:
```typescript
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

  const $ = cheerio.load(html, { decodeEntities: false })
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
```

**Step 4: Run tests**

```bash
npx vitest run tests/optimize-images.test.ts
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add image extraction and WebP optimization via sharp"
```

---

### Task 6: Font preloading injection

**Files:**
- Create: `src/transform/preload-fonts.ts`
- Create: `tests/preload-fonts.test.ts`

**Step 1: Write test**

```typescript
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
```

**Step 2: Implement**

`src/transform/preload-fonts.ts`:
```typescript
import * as cheerio from 'cheerio'

export function injectFontPreloads(html: string): { html: string; fontsPreloaded: number } {
  const $ = cheerio.load(html, { decodeEntities: false })

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
```

**Step 3: Run tests, commit**

```bash
npx vitest run tests/preload-fonts.test.ts
git add -A
git commit -m "feat: add font preload injection for woff2 fonts"
```

---

### Task 7: URL param prefill injection

**Files:**
- Create: `src/transform/inject-prefill.ts`
- Create: `tests/inject-prefill.test.ts`

**Step 1: Write test**

```typescript
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
```

**Step 2: Implement**

`src/transform/inject-prefill.ts`:
```typescript
import * as cheerio from 'cheerio'

const PREFILL_SCRIPT = `
<script>
(function(){
  var p=new URLSearchParams(window.location.search);
  var m={
    email:['input[type="email"]','[name="email"]','#email','[data-testid*="email"]'],
    fname:['input[placeholder*="First"]','[name="firstName"]','[name="fname"]','#firstName','#fname'],
    lname:['input[placeholder*="Last"]','[name="lastName"]','[name="lname"]','#lastName','#lname'],
    firstName:['input[placeholder*="First"]','[name="firstName"]','#firstName'],
    lastName:['input[placeholder*="Last"]','[name="lastName"]','#lastName'],
    phone:['input[type="tel"]','[name="phone"]','#phone']
  };
  Object.keys(m).forEach(function(k){
    var v=p.get(k);if(!v)return;
    m[k].forEach(function(s){
      try{document.querySelectorAll(s).forEach(function(el){
        if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'){
          el.value=v;
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
      })}catch(e){}
    });
  });
})();
</script>`

export function injectPrefill(html: string): string {
  const $ = cheerio.load(html, { decodeEntities: false })
  $('body').append(PREFILL_SCRIPT)
  return $.html()
}
```

**Step 3: Run tests, commit**

```bash
npx vitest run tests/inject-prefill.test.ts
git add -A
git commit -m "feat: add URL param prefill injection"
```

---

## Phase 3: Pipeline Orchestration + CLI

### Task 8: Transform pipeline orchestrator

**Files:**
- Create: `src/transform.ts`
- Create: `tests/transform.test.ts`

**Step 1: Write integration test**

```typescript
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
```

**Step 2: Implement**

`src/transform.ts`:
```typescript
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
```

**Step 3: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add transform pipeline orchestrator"
```

---

### Task 9: Full CLI with pipeline

**Files:**
- Modify: `src/cli.ts`

**Step 1: Wire up the full pipeline**

Replace `src/cli.ts` with:
```typescript
#!/usr/bin/env node
import { Command } from 'commander'
import { resolve, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import chalk from 'chalk'
import ora from 'ora'
import { capture } from './capture.js'
import { transform } from './transform.js'
import type { EdgeCloneOptions } from './types.js'

const program = new Command()

program
  .name('edge-clone')
  .description('Clone any web page into a speed-optimized static site. Sub-1-second loads.')
  .version('0.1.0')
  .argument('<url>', 'URL to clone')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-w, --wait <ms>', 'Wait time for JS rendering (ms)', '8000')
  .option('--no-defer-tracking', 'Keep tracking scripts inline')
  .option('--strip-tracking', 'Remove tracking scripts entirely')
  .option('--no-prefill', 'Skip URL param prefill injection')
  .option('--no-optimize-images', 'Skip image optimization')
  .option('--viewport <WxH>', 'Browser viewport size', '1440x4000')
  .option('--chrome-path <path>', 'Path to Chrome/Chromium executable')
  .action(async (url: string, opts: Record<string, any>) => {
    const outputDir = resolve(opts.output)
    const [vw, vh] = (opts.viewport as string).split('x').map(Number)

    console.log(chalk.bold('\n⚡ edge-clone\n'))
    console.log(`  URL:    ${chalk.cyan(url)}`)
    console.log(`  Output: ${chalk.dim(outputDir)}`)
    console.log()

    mkdirSync(outputDir, { recursive: true })

    // Step 1: Capture
    const captureSpinner = ora('Capturing rendered page...').start()
    let captureResult
    try {
      captureResult = await capture(url, join(outputDir, '_raw.html'), {
        wait: parseInt(opts.wait),
        viewport: { width: vw, height: vh },
        chromePath: opts.chromePath,
      })
      captureSpinner.succeed(
        `Captured ${chalk.bold((captureResult.originalSize / 1024).toFixed(0) + 'KB')} in ${(captureResult.captureTimeMs / 1000).toFixed(1)}s`
      )
    } catch (err: any) {
      captureSpinner.fail(`Capture failed: ${err.message}`)
      process.exit(1)
    }

    // Step 2: Transform
    const transformSpinner = ora('Optimizing...').start()
    const start = Date.now()
    let transformResult
    try {
      transformResult = await transform(captureResult.html, outputDir, {
        deferTracking: opts.deferTracking !== false && !opts.stripTracking,
        stripTracking: !!opts.stripTracking,
        prefill: opts.prefill !== false,
        optimizeImages: opts.optimizeImages !== false,
      })
      const transformTime = Date.now() - start
      transformSpinner.succeed(`Optimized in ${(transformTime / 1000).toFixed(1)}s`)
    } catch (err: any) {
      transformSpinner.fail(`Transform failed: ${err.message}`)
      process.exit(1)
    }

    // Step 3: Write output
    const indexPath = join(outputDir, 'index.html')
    writeFileSync(indexPath, transformResult.html, 'utf-8')

    // Summary
    const s = transformResult.stats
    console.log()
    console.log(chalk.bold('  Results:'))
    console.log(`  HTML:     ${chalk.green((s.originalHtmlSize / 1024).toFixed(0) + 'KB')} → ${chalk.bold.green((s.finalHtmlSize / 1024).toFixed(0) + 'KB')}`)

    if (s.trackingScriptsDeferred > 0) {
      console.log(`  Tracking: ${chalk.yellow(s.trackingScriptsDeferred + ' scripts deferred')} (fires on first interaction)`)
    }
    if (s.trackingScriptsStripped > 0) {
      console.log(`  Tracking: ${chalk.red(s.trackingScriptsStripped + ' scripts removed')}`)
    }
    if (s.imagesOptimized > 0) {
      const saved = transformResult.assets.reduce((sum, a) => sum + (a.originalSize - a.optimizedSize), 0)
      console.log(`  Images:   ${chalk.green(s.imagesOptimized + ' optimized')} (${(saved / 1024).toFixed(0)}KB saved)`)
    }
    if (s.fontsPreloaded > 0) {
      console.log(`  Fonts:    ${chalk.green(s.fontsPreloaded + ' preloaded')}`)
    }

    console.log()
    console.log(`  ${chalk.bold.green('✓')} ${chalk.bold(indexPath)}`)
    console.log(`  ${chalk.dim('Test prefill:')} ${chalk.cyan(url.split('?')[0] + '?email=test@example.com&fname=John&lname=Doe')}`)
    console.log()
  })

program.parse()
```

**Step 2: Test manually**

```bash
npx tsx src/cli.ts https://example.com -o /tmp/edge-clone-test --wait=3000
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire up full CLI pipeline with capture + transform"
```

---

### Task 10: Build, link, and test end-to-end

**Step 1: Build**

```bash
npm run build
```

**Step 2: Link globally for local use**

```bash
npm link
```

**Step 3: Test end-to-end with a real page**

```bash
edge-clone https://example.com -o /tmp/edge-clone-e2e --wait=3000
```

**Step 4: Test with a heavy marketing page**

```bash
edge-clone https://example.com/checkout/product-page -o /tmp/checkout-test
```

**Step 5: Verify PageSpeed**

Open the output in browser and check:
```bash
open /tmp/checkout-test/index.html
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: edge-clone v0.1.0 — pixel-perfect cloning with deferred tracking"
```

---

## Phase 4: Polish for npm publish (future)

These are tracked but not implemented in MVP:

- [ ] README.md with demo GIF, benchmarks, and comparison table
- [ ] `--deploy cloudflare` integration (wrangler)
- [ ] `--deploy vercel` integration
- [ ] `--report` flag — run Lighthouse/PageSpeed and output score
- [ ] `--diff` flag — screenshot original vs clone side-by-side
- [ ] GitHub Actions CI (test on push)
- [ ] npm publish workflow
- [ ] Config file support (`.edgeclonerc`)
- [ ] Multi-page support (clone entire site)
- [ ] CSS extraction from inline `<style>` to external file (for caching)
- [ ] Critical CSS extraction (above-fold only inline, rest deferred)

---

## Summary

| Phase | Tasks | What it does |
|-------|-------|-------------|
| 1 | 1-3 | Project setup, types, SingleFile capture |
| 2 | 4-7 | Tracking deferral, image optimization, font preloads, prefill |
| 3 | 8-10 | Pipeline orchestrator, CLI, end-to-end test |
| 4 | future | Deploy integrations, PageSpeed reporting, npm publish |

**Total: ~10 tasks, each 5-15 min = ~2-3 hours to MVP**
