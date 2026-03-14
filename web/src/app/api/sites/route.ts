import { NextRequest, NextResponse } from "next/server";
import { registerSite, getSite, buildSnippet } from "@/lib/sites";

/**
 * POST /api/sites
 * Register a new site and get a snippet tag.
 *
 * Body: { url: string }
 * Returns: { siteId, snippet, snippetUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
    }

    const site = registerSite(url);

    // Determine origin for snippet URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("x-forwarded-proto") + "://" + request.headers.get("host") ||
      "https://andale.sh";

    const snippet = buildSnippet(site.id, origin);
    const snippetUrl = `${origin}/api/snippet/${site.id}`;

    return NextResponse.json(
      { siteId: site.id, snippet, snippetUrl, url: site.url },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("Sites POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/sites?id=abc123
 * Get site info by ID.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const site = getSite(id);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ siteId: site.id, url: site.url, createdAt: site.createdAt });
}
