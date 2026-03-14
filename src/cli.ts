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
  .name('andale')
  .description('Clone any web page into a speed-optimized static site. Sub-1-second loads. Andale!')
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

    console.log(chalk.bold('\n🏃 andale!\n'))
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
