import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { TransformStats, ChangeLogEntry } from "@/../../src/types";

/**
 * POST /api/optimize
 *
 * Raw HTML in, optimized HTML out. No Chrome capture.
 * Designed for the Cloudflare Worker: the Worker fetches origin HTML and
 * sends it here for optimization, then caches the result in R2.
 *
 * Body: { html: string, url: string, siteId?: string }
 * Returns: { html: string, stats: TransformStats, changelog: ChangeLogEntry[] }
 * Auth: Bearer <ANDALE_API_SECRET>
 */

const MAX_HTML_BYTES = 10 * 1024 * 1024; // 10MB hard cap
const TIMEOUT_MS = 25_000; // 25s — well within Workers 30s CPU limit

function auth(request: NextRequest): boolean {
  const secret = process.env.ANDALE_API_SECRET;
  if (!secret) {
    // If no secret is configured, reject all requests
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

/**
 * Load a module from the andale core library at RUNTIME.
 * Uses eval('require') to hide from Turbopack static analysis.
 */
function loadCoreModule(moduleName: string) {
  const cwd = process.cwd();
  const searchPaths = [
    resolve(cwd, "..", "dist", `${moduleName}.js`),
    resolve("/app", "dist", `${moduleName}.js`),
    resolve(cwd, "dist", `${moduleName}.js`),
  ];

  for (const p of searchPaths) {
    if (existsSync(p)) {
      // eslint-disable-next-line no-eval
      return eval("require")(p);
    }
  }

  throw new Error(
    `Could not find andale core module "${moduleName}". Searched: ${searchPaths.join(", ")}.`
  );
}

export interface OptimizeRequest {
  html: string;
  url: string;
  siteId?: string;
}

export interface OptimizeResponse {
  html: string;
  stats: TransformStats;
  changelog: ChangeLogEntry[];
}

export async function POST(request: NextRequest) {
  // --- Auth ---
  if (!auth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Parse body ---
  let body: OptimizeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { html, url, siteId: _siteId } = body;

  if (!html || typeof html !== "string") {
    return NextResponse.json(
      { error: "html is required and must be a string" },
      { status: 400 }
    );
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "url is required and must be a string" },
      { status: 400 }
    );
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  // Size guard
  const byteLength = Buffer.byteLength(html, "utf-8");
  if (byteLength > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: `HTML too large: ${byteLength} bytes (max ${MAX_HTML_BYTES})` },
      { status: 413 }
    );
  }

  // --- Run transform with timeout ---
  let transformModule: { transform: Function };
  try {
    transformModule = loadCoreModule("transform");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[optimize] Failed to load transform module:", msg);
    return NextResponse.json(
      { error: "Transform module not available", detail: msg },
      { status: 503 }
    );
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Transform timed out after ${TIMEOUT_MS}ms`)),
      TIMEOUT_MS
    )
  );

  // For the Worker use-case, we skip image extraction (no local disk) and
  // run all purely HTML-level optimizations.
  const transformPromise = transformModule.transform(html, "/tmp/andale-optimize", {
    deferTracking: true,
    stripTracking: false,
    prefill: true,
    optimizeImages: false, // Worker sends HTML only — no data-URL images to extract
  });

  let result: { html: string; stats: TransformStats; changelog: ChangeLogEntry[] };
  try {
    result = await Promise.race([transformPromise, timeoutPromise]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[optimize] Transform failed:", msg);
    return NextResponse.json(
      { error: "Transform failed", detail: msg },
      { status: 500 }
    );
  }

  const response: OptimizeResponse = {
    html: result.html,
    stats: result.stats,
    changelog: result.changelog,
  };

  return NextResponse.json(response);
}
