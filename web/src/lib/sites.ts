/**
 * In-memory site store for MVP.
 * No database yet — sites are per-process, reset on server restart.
 */

export interface Site {
  id: string;
  url: string;
  createdAt: Date;
}

export interface BeaconPayload {
  siteId: string;
  url: string;
  metrics: {
    lcp?: number;
    fcp?: number;
    cls?: number;
    tbt?: number;
    ttfb?: number;
  };
  scriptsFound?: string[];
  scriptsDeferred?: string[];
}

// Avoid duplicate stores on hot reload
const g = globalThis as Record<string, unknown>;

if (!g.__andale_sites__) {
  g.__andale_sites__ = new Map<string, Site>();
}
if (!g.__andale_beacons__) {
  g.__andale_beacons__ = [] as BeaconPayload[];
}

const sites = g.__andale_sites__ as Map<string, Site>;
const beacons = g.__andale_beacons__ as BeaconPayload[];

const MAX_BEACONS = 10000; // rolling window

export function registerSite(url: string): Site {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const site: Site = { id, url, createdAt: new Date() };
  sites.set(id, site);
  return site;
}

export function getSite(id: string): Site | undefined {
  return sites.get(id);
}

export function recordBeacon(payload: BeaconPayload): void {
  beacons.push(payload);
  // Rolling trim to avoid unbounded memory growth
  if (beacons.length > MAX_BEACONS) {
    beacons.splice(0, beacons.length - MAX_BEACONS);
  }
  console.log(
    `[andale/beacon] site=${payload.siteId} url=${payload.url} ` +
    `lcp=${payload.metrics?.lcp ?? "-"}ms tbt=${payload.metrics?.tbt ?? "-"}ms ` +
    `scripts=${(payload.scriptsFound ?? []).join(",") || "none"}`
  );
}

export function getBeaconsForSite(siteId: string): BeaconPayload[] {
  return beacons.filter((b) => b.siteId === siteId);
}

export function buildSnippet(siteId: string, origin: string): string {
  return `<script src="${origin}/api/snippet/${siteId}" async></script>`;
}
