/**
 * Andale Edge Optimizer — Cloudflare Worker
 *
 * Sits in front of ctox.com (Kinsta origin) and serves
 * Andale-optimized HTML from R2 cache.
 *
 * Flow:
 *   GET request
 *     → skip? (non-HTML, admin, assets, logged-in user) → proxy to origin
 *     → R2 cache HIT  → serve with X-Andale-Cache: HIT
 *     → R2 cache MISS → fetch origin → POST /api/optimize → cache in R2 → serve
 *
 * Config (Worker secrets / env vars):
 *   ANDALE_API_URL     URL of the Andale Railway app (e.g. https://andale.sh)
 *   ANDALE_API_SECRET  Shared secret for /api/optimize auth
 *   ORIGIN_URL         Kinsta origin (e.g. https://ctox.com)
 *   CACHE_TTL_SECONDS  R2 object TTL in seconds (default 3600)
 *   BYPASS_HEADER      Request header name that skips optimization (default x-andale-bypass)
 *
 * R2 binding: CACHE  (bound in wrangler.toml)
 */

import { Env, CacheMetadata } from "./types";
import { getCacheKey, getTtlForUrl, shouldSkipRequest, shouldSkipCaching } from "./cache";
import { fetchOrigin } from "./origin";
import { callOptimizeApi } from "./optimize";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // --- Step 1: Skip non-GET requests and non-HTML paths ---
    if (shouldSkipRequest(request, url, env)) {
      return fetchOrigin(request, env);
    }

    // --- Step 2: Bypass header (for testing / debugging) ---
    const bypassHeader = env.BYPASS_HEADER ?? "x-andale-bypass";
    if (request.headers.has(bypassHeader)) {
      const originResponse = await fetchOrigin(request, env);
      const res = new Response(originResponse.body, originResponse);
      res.headers.set("X-Andale-Cache", "BYPASS");
      return res;
    }

    const cacheKey = await getCacheKey(url.toString());

    // --- Step 3: R2 cache lookup ---
    let cachedObject: R2ObjectBody | null = null;
    try {
      cachedObject = await env.CACHE.get(cacheKey);
    } catch (err) {
      console.error("[andale] R2 get error:", err);
    }

    if (cachedObject !== null) {
      // Cache HIT — serve from R2
      const meta = (cachedObject.customMetadata ?? {}) as Partial<CacheMetadata>;
      const headers = new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": `public, max-age=${meta.ttl ?? 3600}`,
        "X-Andale-Cache": "HIT",
        "X-Andale-Optimized": "true",
        "X-Andale-Version": "1",
        "X-Andale-Cached-At": meta.cachedAt ?? "",
      });
      return new Response(cachedObject.body, { status: 200, headers });
    }

    // --- Step 4: Cache MISS — fetch origin ---
    let originResponse: Response;
    try {
      originResponse = await fetchOrigin(request, env);
    } catch (err) {
      console.error("[andale] Origin fetch failed:", err);
      return new Response("Bad Gateway", { status: 502 });
    }

    // If origin returned a non-200, or non-HTML, pass through directly
    const contentType = originResponse.headers.get("content-type") ?? "";
    if (!originResponse.ok || !contentType.includes("text/html")) {
      return originResponse;
    }

    // Check if origin says no-store
    const cacheControl = originResponse.headers.get("cache-control") ?? "";
    if (shouldSkipCaching(cacheControl)) {
      const res = new Response(originResponse.body, originResponse);
      res.headers.set("X-Andale-Cache", "SKIP");
      return res;
    }

    // Read origin HTML
    const originHtml = await originResponse.text();

    // --- Step 5: Call Andale optimize API ---
    let optimizedHtml: string = originHtml;
    let optimized = false;

    try {
      const result = await callOptimizeApi(originHtml, url.toString(), env);
      optimizedHtml = result.html;
      optimized = true;
    } catch (err) {
      // Graceful fallback: serve origin HTML unoptimized
      console.error("[andale] Optimize API failed, falling back to origin HTML:", err);
    }

    const ttl = getTtlForUrl(url, env);
    const cachedAt = new Date().toISOString();

    // --- Step 6: Write to R2 (background, non-blocking) ---
    ctx.waitUntil(
      (async () => {
        try {
          const metadata: CacheMetadata = {
            url: url.toString(),
            cachedAt,
            ttl,
            optimized,
          };
          await env.CACHE.put(cacheKey, optimizedHtml, {
            httpMetadata: { contentType: "text/html; charset=utf-8" },
            customMetadata: metadata as unknown as Record<string, string>,
            // R2 doesn't support native TTL on free tier; we use metadata for
            // soft expiry and rely on the Worker to re-validate after TTL
          });
        } catch (err) {
          console.error("[andale] R2 put error:", err);
        }
      })()
    );

    // --- Step 7: Serve response ---
    const responseHeaders = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": `public, max-age=${ttl}`,
      "X-Andale-Cache": "MISS",
      "X-Andale-Optimized": optimized ? "true" : "false",
      "X-Andale-Version": "1",
    });

    // Preserve useful origin headers
    for (const header of ["x-request-id", "vary", "etag", "last-modified"]) {
      const val = originResponse.headers.get(header);
      if (val) responseHeaders.set(header, val);
    }

    return new Response(optimizedHtml, { status: 200, headers: responseHeaders });
  },
};
