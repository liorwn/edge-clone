import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * GET /api/snippet/:siteId
 *
 * Serves o.js with the site ID baked in as window._andale_site.
 * Customers can use this URL directly instead of the static o.js,
 * which lets us inject per-site config in the future.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;

  if (!siteId || typeof siteId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(siteId)) {
    return new NextResponse("Invalid site ID", { status: 400 });
  }

  let baseScript: string;
  try {
    const scriptPath = join(process.cwd(), "public", "o.js");
    baseScript = readFileSync(scriptPath, "utf-8");
  } catch {
    return new NextResponse("Snippet not found", { status: 500 });
  }

  // Inject site ID as the first line so getSiteId() picks it up via window._andale_site
  const header = `// Andale optimizer — site: ${siteId}\nvar _andale_site = ${JSON.stringify(siteId)};\n`;
  const output = header + baseScript;

  return new NextResponse(output, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // 5-minute CDN cache, 1-minute stale-while-revalidate
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
