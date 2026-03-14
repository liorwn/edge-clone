/**
 * Call the Andale /api/optimize endpoint to transform HTML.
 */

import { Env, OptimizeApiResponse } from "./types";

const OPTIMIZE_TIMEOUT_MS = 25_000; // 25s — matches server-side timeout

/**
 * Send HTML to the Andale optimization API and return the result.
 *
 * Throws on network error, non-2xx response, or timeout.
 * Caller should catch and fall back to origin HTML.
 */
export async function callOptimizeApi(
  html: string,
  url: string,
  env: Env
): Promise<OptimizeApiResponse> {
  const apiBase = (env.ANDALE_API_URL ?? "").replace(/\/$/, "");
  if (!apiBase) {
    throw new Error("ANDALE_API_URL not configured");
  }

  const secret = env.ANDALE_API_SECRET;
  if (!secret) {
    throw new Error("ANDALE_API_SECRET not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPTIMIZE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ html, url }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`Optimize API returned ${response.status}: ${body}`);
  }

  const data = (await response.json()) as OptimizeApiResponse;

  if (!data.html || typeof data.html !== "string") {
    throw new Error("Optimize API response missing html field");
  }

  return data;
}
