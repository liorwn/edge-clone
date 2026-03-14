import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

/**
 * POST /api/cache/purge
 *
 * Purges R2 cache entries for a site. Called by the WordPress plugin when
 * content is published/updated.
 *
 * Body: { siteId: string, urls?: string[] }
 * Auth: Bearer <ANDALE_API_SECRET>
 *
 * - If urls is provided: deletes those specific R2 keys (sha256 of each URL)
 * - If urls is omitted: deletes all objects with prefix `<siteId>/`
 *
 * R2 object keys follow the pattern: `<siteId>/<sha256(url)>`
 * (matching what the Cloudflare Worker writes)
 */

function auth(request: NextRequest): boolean {
  const secret = process.env.ANDALE_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

interface PurgeRequest {
  siteId: string;
  urls?: string[];
}

interface PurgeResult {
  purged: number;
  keys: string[];
  errors: string[];
}

export async function POST(request: NextRequest) {
  // --- Auth ---
  if (!auth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Parse body ---
  let body: PurgeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { siteId, urls } = body;

  if (!siteId || typeof siteId !== "string") {
    return NextResponse.json(
      { error: "siteId is required" },
      { status: 400 }
    );
  }

  // Validate siteId (alphanumeric + dashes only)
  if (!/^[a-z0-9-]+$/i.test(siteId)) {
    return NextResponse.json(
      { error: "siteId must be alphanumeric with dashes only" },
      { status: 400 }
    );
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const bucketName = process.env.CF_R2_BUCKET_NAME;
  const cfApiToken = process.env.CF_API_TOKEN;

  if (!accountId || !bucketName || !cfApiToken) {
    return NextResponse.json(
      { error: "Cloudflare R2 credentials not configured" },
      { status: 503 }
    );
  }

  const result: PurgeResult = { purged: 0, keys: [], errors: [] };

  if (urls && Array.isArray(urls) && urls.length > 0) {
    // Purge specific URLs
    for (const url of urls.slice(0, 500)) {
      // 500 max per request
      if (typeof url !== "string") continue;
      const key = `${siteId}/${sha256(url)}`;
      const deleted = await deleteR2Object(accountId, bucketName, cfApiToken, key);
      if (deleted.ok) {
        result.keys.push(key);
        result.purged++;
      } else {
        result.errors.push(`Failed to delete ${key}: ${deleted.error}`);
      }
    }
  } else {
    // Purge all objects for this siteId by listing then deleting
    const listed = await listR2Objects(
      accountId,
      bucketName,
      cfApiToken,
      `${siteId}/`
    );
    if (!listed.ok) {
      return NextResponse.json(
        { error: "Failed to list R2 objects", detail: listed.error },
        { status: 500 }
      );
    }

    for (const key of listed.keys) {
      const deleted = await deleteR2Object(accountId, bucketName, cfApiToken, key);
      if (deleted.ok) {
        result.keys.push(key);
        result.purged++;
      } else {
        result.errors.push(`Failed to delete ${key}: ${deleted.error}`);
      }
    }
  }

  return NextResponse.json(result);
}

// ---------------------------------------------------------------------------
// Cloudflare R2 API helpers
// ---------------------------------------------------------------------------

interface CFResult {
  ok: boolean;
  error?: string;
  keys: string[];
}

async function listR2Objects(
  accountId: string,
  bucketName: string,
  token: string,
  prefix: string
): Promise<CFResult> {
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects?prefix=${encodeURIComponent(prefix)}&limit=1000`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `CF API ${res.status}: ${text}`, keys: [] };
    }

    const data = (await res.json()) as {
      result: { objects: Array<{ key: string }> };
    };
    const keys = (data.result?.objects ?? []).map((o) => o.key);
    return { ok: true, keys };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      keys: [],
    };
  }
}

async function deleteR2Object(
  accountId: string,
  bucketName: string,
  token: string,
  key: string
): Promise<{ ok: boolean; error?: string; keys: string[] }> {
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      // 404 is fine — object already gone
      const text = await res.text();
      return { ok: false, error: `CF API ${res.status}: ${text}`, keys: [] };
    }

    return { ok: true, keys: [key] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      keys: [],
    };
  }
}
