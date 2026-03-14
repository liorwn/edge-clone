# Andale — Page Speed Optimizer

Clone any web page into a speed-optimized static site. Pixel-perfect rendering, deferred tracking, sub-1-second loads.

## What It Does

Takes a URL → captures the fully rendered page (including JS-hydrated SPAs) → optimizes for speed → outputs a deployable static directory.

**Pipeline:** Capture (SingleFile + Chrome) → Defer Tracking → Optimize Images → Preload Fonts → Inject Prefill → Output

## Quick Start

```bash
# Clone a page
npx tsx src/cli.ts https://example.com -o ./output

# Clone a heavy SPA (React/Next.js) with longer wait
npx tsx src/cli.ts https://example.com/checkout -o ./checkout-clone --wait=8000

# Strip tracking instead of deferring
npx tsx src/cli.ts https://example.com -o ./output --strip-tracking

# Skip image optimization (faster)
npx tsx src/cli.ts https://example.com -o ./output --no-optimize-images
```

## Build & Link

```bash
npm run build          # TypeScript → dist/
npm link               # Makes `andale` available globally
andale <url>       # Use from anywhere
```

## Test

```bash
npm test               # Run all 23 tests
npm run test:watch     # Watch mode
```

## Architecture

```
src/
  cli.ts                    # Commander.js CLI entry point
  index.ts                  # Library exports
  types.ts                  # All interfaces + 20 tracking vendor patterns
  capture.ts                # SingleFile CLI wrapper (Chrome headless)
  transform.ts              # Pipeline orchestrator (chains all stages)
  transform/
    defer-tracking.ts       # Defer tracking scripts to post-interaction
    optimize-images.ts      # Extract data URLs → WebP via sharp
    preload-fonts.ts        # Inject <link rel="preload"> for woff2 fonts
    inject-prefill.ts       # Add URL param prefill JS (?email=&fname=&lname=)
tests/
  capture.test.ts
  defer-tracking.test.ts
  optimize-images.test.ts
  preload-fonts.test.ts
  inject-prefill.test.ts
  transform.test.ts
```

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output <dir>` | `./output` | Output directory |
| `-w, --wait <ms>` | `8000` | Wait for JS rendering (SPAs need more) |
| `--no-defer-tracking` | defer on | Keep tracking scripts inline |
| `--strip-tracking` | off | Remove tracking entirely |
| `--no-prefill` | prefill on | Skip URL param prefill injection |
| `--no-optimize-images` | optimize on | Skip image extraction/WebP conversion |
| `--viewport <WxH>` | `1440x4000` | Browser viewport for capture |
| `--chrome-path <path>` | auto-detect | Path to Chrome/Chromium |

## Tracking Deferral (Core Feature)

The key insight: marketing pages are slow because tracking scripts block paint. GTM alone adds 1-3 seconds of TBT.

**andale defers, doesn't strip.** Tracking is important for attribution. The deferred loader:
1. Converts `<script src="gtm.js">` → `<script data-deferred-src="gtm.js" type="text/deferred-tracking">`
2. Injects a loader that fires all deferred scripts on first real user interaction (click/touch/mouse/key) or after 15 seconds
3. Result: 0ms TBT from tracking, all analytics still fire

**Supported vendors (20+):** GTM, GA, Facebook Pixel, HotJar, Amplitude, OneTrust, TTD, HubSpot, Segment, Intercom, Drift, Clarity, LinkedIn, Twitter/X, TikTok, Pinterest, Reddit, Quora

## Stack

- **Node.js 22+**, TypeScript, ESM
- **single-file-cli** — Chromium-based page capture (renders JS before saving)
- **cheerio** — HTML parsing and manipulation
- **sharp** — Image optimization (WebP conversion)
- **commander** — CLI framework
- **chalk + ora** — Terminal UI (colors, spinners)
- **vitest** — Testing

## Dependencies

- Google Chrome or Chromium (for capture)
- `npx single-file-cli` (auto-installed)

## Roadmap

### v0.2 — CLI Polish
- [ ] `--deploy cloudflare` — auto-deploy to CF Pages
- [ ] `--deploy vercel` — auto-deploy to Vercel
- [ ] `--report` — run Lighthouse, output PageSpeed score before/after
- [ ] `--diff` — screenshot original vs clone side-by-side
- [ ] README.md with benchmarks and demo GIF
- [ ] npm publish as `andale`
- [ ] GitHub Actions CI

### v0.3 — Web App (andale.sh)
- [ ] Web frontend — paste a URL, get optimized clone + PageSpeed report
- [ ] Hosted output — each clone gets a subdomain (e.g., `yoursite.andale.sh`)
- [ ] Before/after comparison — side-by-side screenshots + Lighthouse scores
- [ ] Queue system — clone jobs processed async, webhook/email on completion
- [ ] Dashboard — history of clones, scores, deploy status

### v1.0 — SaaS
- [ ] User accounts + API keys
- [ ] Custom domains for cloned pages
- [ ] Scheduled re-clones (keep clone in sync with source)
- [ ] Team workspaces
- [ ] Webhook notifications
- [ ] Usage-based pricing

### Future
- [ ] Config file support (`.andalrc`)
- [ ] Critical CSS extraction (inline above-fold only)
- [ ] Multi-page support (clone entire site)
- [ ] A/B testing — serve original vs clone, measure conversion difference

## Origin

Built from real-world need: marketing checkout pages (Next.js + CMS + Stripe) load in 4-8 seconds due to GTM, HotJar, Facebook Pixel, OneTrust, and Amplitude all blocking paint. A static clone with deferred tracking loads in <1 second from Cloudflare edge while preserving all analytics attribution.
