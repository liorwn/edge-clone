import { NextRequest, NextResponse } from "next/server";
import { recordBeacon, BeaconPayload } from "@/lib/sites";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * OPTIONS /api/beacon
 * CORS preflight — snippets on 3rd-party domains need this.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/beacon
 * Receives performance metrics and script reports from o.js snippets.
 *
 * Body:
 * {
 *   siteId: string,
 *   url: string,
 *   metrics: { lcp?, fcp?, cls?, tbt?, ttfb? },
 *   scriptsFound: string[],
 *   scriptsDeferred: string[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Support both JSON body and sendBeacon (blob/text)
    let payload: BeaconPayload;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      // sendBeacon sends as text/plain or application/octet-stream
      const text = await request.text();
      try {
        payload = JSON.parse(text);
      } catch {
        return new NextResponse("Bad Request", { status: 400, headers: CORS_HEADERS });
      }
    }

    if (!payload?.siteId) {
      return new NextResponse("siteId required", { status: 400, headers: CORS_HEADERS });
    }

    // Sanitize and store
    const clean: BeaconPayload = {
      siteId: String(payload.siteId).slice(0, 64),
      url: String(payload.url || "").slice(0, 2048),
      metrics: {
        lcp: toNumber(payload.metrics?.lcp),
        fcp: toNumber(payload.metrics?.fcp),
        cls: toNumber(payload.metrics?.cls),
        tbt: toNumber(payload.metrics?.tbt),
        ttfb: toNumber(payload.metrics?.ttfb),
      },
      scriptsFound: toStringArray(payload.scriptsFound),
      scriptsDeferred: toStringArray(payload.scriptsDeferred),
    };

    recordBeacon(clean);

    // 204 No Content — beacons don't need a response body
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  } catch (err: unknown) {
    console.error("Beacon error:", err);
    // Still return 204 — never cause JS errors on client sites
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
}

function toNumber(v: unknown): number | undefined {
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).slice(0, 50);
}
