/**
 * Proxy a request to the Kinsta origin.
 */

import { Env } from "./types";

/**
 * Fetch the request from the configured ORIGIN_URL.
 *
 * Rewrites the host header so the origin recognises the request.
 * Preserves all other headers from the incoming request.
 */
export async function fetchOrigin(request: Request, env: Env): Promise<Response> {
  const originBase = (env.ORIGIN_URL ?? "").replace(/\/$/, "");
  if (!originBase) {
    return new Response("ORIGIN_URL not configured", { status: 503 });
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = `${originBase}${incomingUrl.pathname}${incomingUrl.search}`;

  // Clone request headers and fix Host
  const headers = new Headers(request.headers);
  const originHost = new URL(originBase).hostname;
  headers.set("host", originHost);

  // Remove Cloudflare-added headers that origin doesn't need
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");

  const originRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
    redirect: "follow",
  });

  return fetch(originRequest);
}
