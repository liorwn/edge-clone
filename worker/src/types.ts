/**
 * Andale Worker — type definitions
 */

export interface Env {
  // R2 bucket binding (set in wrangler.toml)
  CACHE: R2Bucket;

  // Worker secrets / env vars
  ANDALE_API_URL: string;    // e.g. https://andale.sh
  ANDALE_API_SECRET: string; // shared secret for /api/optimize
  ORIGIN_URL: string;        // e.g. https://ctox.com
  CACHE_TTL_SECONDS: string; // default "3600"
  BYPASS_HEADER?: string;    // default "x-andale-bypass"
}

export interface CacheMetadata {
  url: string;
  cachedAt: string;   // ISO 8601
  ttl: number;        // seconds
  optimized: boolean;
}

export interface OptimizeApiResponse {
  html: string;
  stats: {
    trackingScriptsDeferred: number;
    trackingScriptsStripped: number;
    imagesOptimized: number;
    fontsPreloaded: number;
    originalHtmlSize: number;
    finalHtmlSize: number;
    totalAssetSize: number;
    estimatedLoadTimeMs: number;
  };
  changelog: Array<{
    type: string;
    category: string;
    description: string;
    detail?: string;
  }>;
}
