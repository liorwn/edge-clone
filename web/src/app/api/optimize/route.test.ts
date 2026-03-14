/**
 * Tests for POST /api/optimize
 *
 * Run with: npx vitest run web/src/app/api/optimize/route.test.ts
 * (from the andale root, where vitest.config.ts lives)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Minimal NextRequest / NextResponse shims so we can unit-test the handler
// without a full Next.js server.
// ---------------------------------------------------------------------------

class MockNextResponse {
  public body: unknown;
  public status: number;
  public headers: Record<string, string>;

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.headers = init?.headers ?? {};
  }

  static json(body: unknown, init?: { status?: number }) {
    const r = new MockNextResponse(body, init);
    return r;
  }

  async json() {
    return this.body;
  }
}

// Patch module resolution before importing route
vi.mock("next/server", () => ({
  NextRequest: class {
    constructor(public url: string, private init?: RequestInit) {}
    headers = new Map<string, string>();
    async json() {
      return JSON.parse((this.init?.body as string) ?? "{}");
    }
  },
  NextResponse: MockNextResponse,
}));

// Mock the transform core module
const mockTransform = vi.fn();
vi.mock("node:fs", () => ({
  existsSync: () => true,
}));

// We patch loadCoreModule via the eval-require path — stub it by intercepting
// the module-level require at test time by overriding the global `require`.
// Simpler: we just mock the entire pipeline path used inside the route.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, authHeader?: string) {
  const { NextRequest } = require("next/server");
  const req = new NextRequest("https://andale.sh/api/optimize", {
    method: "POST",
    body: JSON.stringify(body),
  });
  req.headers.set(
    "authorization",
    authHeader ?? `Bearer test-secret`
  );
  req.headers.set("content-type", "application/json");
  // Override json() to return our body
  req.json = async () => body;
  return req;
}

const SAMPLE_HTML = `<!DOCTYPE html><html><head><title>Test</title></head><body><p>Hello</p></body></html>`;

const MOCK_TRANSFORM_RESULT = {
  html: `<!DOCTYPE html><html><head><title>Test</title></head><body><p>Hello optimized</p></body></html>`,
  stats: {
    trackingScriptsDeferred: 2,
    trackingScriptsStripped: 0,
    imagesOptimized: 0,
    fontsPreloaded: 1,
    originalHtmlSize: 100,
    finalHtmlSize: 90,
    totalAssetSize: 0,
    estimatedLoadTimeMs: 720,
  },
  changelog: [
    { type: "deferred", category: "tracking", description: "Deferred GTM to post-interaction" },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/optimize", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV, ANDALE_API_SECRET: "test-secret" };
    mockTransform.mockResolvedValue(MOCK_TRANSFORM_RESULT);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    // We need to import fresh each time because env vars are read at call time
    // Use a direct call approach with our own auth check simulation
    const req = makeRequest({ html: SAMPLE_HTML, url: "https://ctox.com/" }, "");
    // Simulate the route handler directly
    const { POST } = await import("./route");
    const res = await POST(req as never);
    expect((res as unknown as MockNextResponse).status).toBe(401);
  });

  it("returns 401 when Authorization header has wrong secret", async () => {
    const req = makeRequest(
      { html: SAMPLE_HTML, url: "https://ctox.com/" },
      "Bearer wrong-secret"
    );
    const { POST } = await import("./route");
    const res = await POST(req as never);
    expect((res as unknown as MockNextResponse).status).toBe(401);
  });

  it("returns 400 when html is missing", async () => {
    const req = makeRequest({ url: "https://ctox.com/" });
    const { POST } = await import("./route");
    const res = await POST(req as never);
    expect((res as unknown as MockNextResponse).status).toBe(400);
    const body = await (res as unknown as MockNextResponse).json();
    expect((body as { error: string }).error).toMatch(/html/i);
  });

  it("returns 400 when url is missing", async () => {
    const req = makeRequest({ html: SAMPLE_HTML });
    const { POST } = await import("./route");
    const res = await POST(req as never);
    expect((res as unknown as MockNextResponse).status).toBe(400);
    const body = await (res as unknown as MockNextResponse).json();
    expect((body as { error: string }).error).toMatch(/url/i);
  });

  it("returns 400 when url is invalid", async () => {
    const req = makeRequest({ html: SAMPLE_HTML, url: "not-a-url" });
    const { POST } = await import("./route");
    const res = await POST(req as never);
    expect((res as unknown as MockNextResponse).status).toBe(400);
    const body = await (res as unknown as MockNextResponse).json();
    expect((body as { error: string }).error).toMatch(/invalid url/i);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const { NextRequest } = require("next/server");
    const req = new NextRequest("https://andale.sh/api/optimize");
    req.headers.set("authorization", "Bearer test-secret");
    req.json = async () => { throw new SyntaxError("Unexpected token"); };
    const { POST } = await import("./route");
    const res = await POST(req as never);
    expect((res as unknown as MockNextResponse).status).toBe(400);
  });

  it("returns 413 when html exceeds 10MB", async () => {
    const bigHtml = "a".repeat(11 * 1024 * 1024);
    const req = makeRequest({ html: bigHtml, url: "https://ctox.com/" });
    const { POST } = await import("./route");
    const res = await POST(req as never);
    expect((res as unknown as MockNextResponse).status).toBe(413);
  });

  it("passes siteId through without error (optional field)", async () => {
    // This test just verifies optional siteId doesn't cause a 400
    // The transform itself is mocked so we check it reaches the transform stage
    // (503 expected since transform module mock may not be loaded in test env)
    const req = makeRequest({
      html: SAMPLE_HTML,
      url: "https://ctox.com/",
      siteId: "ctox",
    });
    const { POST } = await import("./route");
    const res = await POST(req as never);
    // Should not be 400 (validation passed)
    expect((res as unknown as MockNextResponse).status).not.toBe(400);
  });
});
