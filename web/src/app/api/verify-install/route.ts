import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/verify-install?url=https://example.com&siteId=abc123
 *
 * Fetches the given URL and checks if the Andale snippet is present.
 * Looks for either:
 *   - o.js?s=<siteId>
 *   - /api/snippet/<siteId>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const siteId = request.nextUrl.searchParams.get("siteId");

  if (!url || !siteId) {
    return NextResponse.json({ error: "url and siteId are required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Andale-Verifier/1.0 (+https://andale.sh)",
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ installed: false, reason: `HTTP ${res.status}` });
    }

    const html = await res.text();
    const encodedSiteId = encodeURIComponent(siteId);

    // Check for any variation of the snippet
    const patterns = [
      `o.js?s=${siteId}`,
      `o.js?s=${encodedSiteId}`,
      `/api/snippet/${siteId}`,
      `andale.sh/o.js`,
      `_andale_site`,
    ];

    const installed = patterns.some((p) => html.includes(p));

    return NextResponse.json({ installed, url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ installed: false, reason: msg });
  }
}
