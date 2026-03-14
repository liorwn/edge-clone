import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export interface DeployResult {
  url: string
  projectName: string
  platform: string
}

/**
 * Deploy output directory to Cloudflare Pages.
 * Requires `npx wrangler` and authenticated session.
 */
export async function deployCloudflare(
  outputDir: string,
  projectName: string
): Promise<DeployResult> {
  if (!existsSync(outputDir)) {
    throw new Error(`Output directory not found: ${outputDir}`)
  }

  // Check wrangler auth
  try {
    execSync('npx wrangler whoami', { stdio: 'pipe', timeout: 15_000 })
  } catch {
    throw new Error(
      'Not authenticated with Cloudflare. Run `npx wrangler login` first.'
    )
  }

  // Sanitize project name for CF Pages (lowercase, alphanumeric + hyphens)
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 58) // CF Pages max project name length

  // Try to create the project (ignore if exists)
  try {
    execSync(
      `npx wrangler pages project create ${safeName} --production-branch=main`,
      { stdio: 'pipe', timeout: 30_000 }
    )
  } catch {
    // Project likely already exists — that's fine
  }

  // Deploy
  const result = execSync(
    `npx wrangler pages deploy "${outputDir}" --project-name=${safeName} --commit-dirty=true`,
    { encoding: 'utf-8', timeout: 120_000 }
  )

  // Extract URL from wrangler output
  const urlMatch = result.match(/https:\/\/[^\s]+\.pages\.dev/)
  const url = urlMatch ? urlMatch[0] : `https://${safeName}.pages.dev`

  return {
    url,
    projectName: safeName,
    platform: 'cloudflare',
  }
}

/**
 * Deploy output directory to Vercel.
 * Requires `npx vercel` and authenticated session.
 */
export async function deployVercel(
  outputDir: string,
  projectName: string
): Promise<DeployResult> {
  if (!existsSync(outputDir)) {
    throw new Error(`Output directory not found: ${outputDir}`)
  }

  // Check vercel auth
  try {
    execSync('npx vercel whoami', { stdio: 'pipe', timeout: 15_000 })
  } catch {
    throw new Error(
      'Not authenticated with Vercel. Run `npx vercel login` first.'
    )
  }

  // Deploy (Vercel auto-detects static sites)
  const result = execSync(
    `npx vercel "${outputDir}" --name=${projectName} --yes --prod`,
    { encoding: 'utf-8', timeout: 120_000 }
  )

  // Extract URL from vercel output
  const urlMatch = result.match(/https:\/\/[^\s]+\.vercel\.app/)
  const url = urlMatch ? urlMatch[0] : result.trim().split('\n').pop() || ''

  return {
    url,
    projectName,
    platform: 'vercel',
  }
}

/**
 * Deploy to the specified platform
 */
export async function deploy(
  outputDir: string,
  platform: string,
  projectName: string
): Promise<DeployResult> {
  switch (platform) {
    case 'cloudflare':
    case 'cf':
      return deployCloudflare(outputDir, projectName)
    case 'vercel':
      return deployVercel(outputDir, projectName)
    default:
      throw new Error(`Unknown deploy platform: ${platform}. Use 'cloudflare' or 'vercel'.`)
  }
}
