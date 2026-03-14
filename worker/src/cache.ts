/**
 * Cache key generation and TTL logic
 */

import { Env } from "./types";

// Asset extensions we never want to cache or optimize
const ASSET_EXTENSIONS = [
  ".js", ".mjs", ".cjs",
  ".css",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp4", ".webm", ".ogg", ".mp3",
  ".pdf", ".zip", ".gz",
  ".xml", ".json", ".txt",
  ".map",
];

// URL path prefixes we never want to intercept
const SKIP_PATH_PREFIXES = [
  "/wp-admin",
  "/wp-login",
  "/wp-json",
  "/wp-cron",
  "/?wc-ajax",
  "/feed",
  "/sitemap",
  "/robots.txt",
  "/.well-known",
  "/checkout",
  "/cart",
  "/my-account",
  "/api/",
];

// Query params that indicate dynamic / personalised content
const DYNAMIC_QUERY_PARAMS = [
  "s",          // WordPress search
  "preview",
  "p",          // preview post
  "page_id",
  "add-to-cart",
  "remove_item",
  "session_id",
  "token",
  "nonce",
];

/**
 * Returns true if this request should skip optimization entirely
 * and be proxied directly to origin.
 */
export function shouldSkipRequest(request: Request, url: URL, _env: Env): boolean {
  // Only handle GET
  if (request.method !== "GET") return true;

  const path = url.pathname.toLowerCase();

  // Skip asset extensions
  for (const ext of ASSET_EXTENSIONS) {
    if (path.endsWith(ext)) return true;
  }

  // Skip admin / system paths
  for (const prefix of SKIP_PATH_PREFIXES) {
    if (path.startsWith(prefix.toLowerCase())) return true;
  }

  // Skip dynamic query params (cart, checkout, search, etc.)
  for (const param of DYNAMIC_QUERY_PARAMS) {
    if (url.searchParams.has(param)) return true;
  }

  // Skip logged-in WordPress users
  for (const [name] of request.headers.entries()) {
    if (name.startsWith("cookie")) {
      const val = request.headers.get(name) ?? "";
      if (val.includes("wordpress_logged_in_")) return true;
    }
  }

  return false;
}

/**
 * Returns true if origin response headers indicate caching should be skipped.
 */
export function shouldSkipCaching(cacheControl: string): boolean {
  const cc = cacheControl.toLowerCase();
  return cc.includes("no-store") || cc.includes("private");
}

/**
 * Determine TTL in seconds for a given URL.
 *
 * - Homepage: 1 hour
 * - Blog posts: 6 hours
 * - Everything else: env.CACHE_TTL_SECONDS (default 1 hour)
 */
export function getTtlForUrl(url: URL, env: Env): number {
  const defaultTtl = parseInt(env.CACHE_TTL_SECONDS ?? "3600", 10) || 3600;
  const path = url.pathname;

  // Homepage
  if (path === "/" || path === "") {
    return 3600; // 1 hour
  }

  // Blog post heuristic: /blog/, /post/, /article/, /news/, dated slugs
  if (
    path.startsWith("/blog/") ||
    path.startsWith("/post/") ||
    path.startsWith("/articles/") ||
    path.startsWith("/news/") ||
    /\/\d{4}\/\d{2}\//.test(path) // WordPress date-based URLs
  ) {
    return 6 * 3600; // 6 hours
  }

  return defaultTtl;
}

/**
 * Derive a deterministic R2 cache key from a URL.
 *
 * Uses SHA-256 hex of the normalized URL.
 * Format: <sha256>   (32 bytes hex = 64 chars)
 */
export async function getCacheKey(rawUrl: string): Promise<string> {
  // Normalize: strip fragment, sort query params
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    // Fallback for malformed URLs
    return await sha256(rawUrl);
  }

  // Drop fragment
  url.hash = "";

  // Sort query params for cache-key stability
  url.searchParams.sort();

  const normalized = url.toString();
  return await sha256(normalized);
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
