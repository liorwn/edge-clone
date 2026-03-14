# Andale Worker

Cloudflare Worker that sits in front of any WordPress / Kinsta site and serves Andale-optimized HTML from R2 cache.

## Architecture

```
Browser
  │
  ▼ GET ctox.com/*
Cloudflare Worker (andale-ctox)
  │
  ├── Skip? (assets / wp-admin / logged-in) ──────────────────────► Kinsta origin (unmodified)
  │
  ├── R2 cache HIT ────────────────────────────────────────────────► Serve (X-Andale-Cache: HIT)
  │
  └── R2 cache MISS
        │
        ├── Fetch Kinsta origin (raw HTML)
        │
        ├── POST https://andale.sh/api/optimize  ◄── Railway app
        │     { html, url }
        │     Returns { html, stats, changelog }
        │
        ├── ctx.waitUntil: write optimized HTML → R2
        │
        └── Serve optimized HTML (X-Andale-Cache: MISS)
```

**Key properties:**
- Zero latency penalty on cache hits — served directly from R2 at Cloudflare edge
- Graceful fallback: if `/api/optimize` fails, origin HTML is served unmodified
- Background cache writes (`ctx.waitUntil`) — never block the response
- TTL: homepage 1h, blog posts 6h, other pages 1h (configurable)

---

## Deploy to a New Site

### Step 1 — Add a new `[env.<site>]` block to `wrangler.toml`

```toml
[env.mysite]
name = "andale-mysite"

[env.mysite.vars]
CACHE_TTL_SECONDS = "3600"
ANDALE_API_URL = "https://andale.sh"
ORIGIN_URL = "https://mysite.com"   # Kinsta origin

[[env.mysite.r2_buckets]]
binding = "CACHE"
bucket_name = "andale-cache-mysite"

[[env.mysite.routes]]
pattern = "mysite.com/*"
zone_name = "mysite.com"
```

### Step 2 — Create the R2 bucket

```bash
npx wrangler r2 bucket create andale-cache-mysite
```

### Step 3 — Set secrets and deploy

```bash
npx wrangler secret put ANDALE_API_SECRET --env mysite
npm run deploy -- --env mysite
```

The Worker is now live. All traffic to `mysite.com/*` flows through it.

---

## ctox.com Specifically

```bash
# One-time setup
bash setup.sh

# Set the API secret (get from Railway dashboard → andale → Variables)
npx wrangler secret put ANDALE_API_SECRET --env ctox

# Deploy
npm run deploy:ctox
```

The `wrangler.toml` already has the ctox.com route and R2 bucket configured.

---

## Cache Invalidation

### Invalidate specific URLs

```bash
# Via the Andale API (e.g. from WordPress plugin after publish)
curl -X POST https://andale.sh/api/cache/purge \
  -H "Authorization: Bearer $ANDALE_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"siteId": "ctox", "urls": ["https://ctox.com/blog/my-post/"]}'
```

### Invalidate all pages for a site

```bash
curl -X POST https://andale.sh/api/cache/purge \
  -H "Authorization: Bearer $ANDALE_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"siteId": "ctox"}'
```

### Manual R2 delete (Wrangler CLI)

```bash
# List all objects in the ctox cache bucket
npx wrangler r2 object list andale-cache-ctox

# Delete a specific key (the sha256 of the URL)
npx wrangler r2 object delete andale-cache-ctox/<sha256-key>
```

---

## Bypass Optimization (Testing)

Add the bypass header to your request:

```bash
curl -H "x-andale-bypass: 1" https://ctox.com/
```

The Worker proxies straight to origin and adds `X-Andale-Cache: BYPASS`.

To check which path a request took:

```bash
curl -sI https://ctox.com/ | grep -i x-andale
# X-Andale-Cache: HIT
# X-Andale-Optimized: true
# X-Andale-Version: 1
```

---

## Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| `ANDALE_API_URL` | `wrangler.toml` vars | Andale Railway app URL |
| `ANDALE_API_SECRET` | Worker secret | Shared auth token for `/api/optimize` |
| `ORIGIN_URL` | `wrangler.toml` vars | Kinsta origin URL |
| `CACHE_TTL_SECONDS` | `wrangler.toml` vars | Default cache TTL (seconds) |
| `BYPASS_HEADER` | `wrangler.toml` vars | Header name to skip optimization |
| `CF_ACCOUNT_ID` | Andale Railway env | For cache purge API |
| `CF_R2_BUCKET_NAME` | Andale Railway env | R2 bucket to purge |
| `CF_API_TOKEN` | Andale Railway env | CF API token with R2 Object Write |
| `ANDALE_API_SECRET` | Andale Railway env | Must match Worker secret |

---

## Local Development

```bash
npm install
npx wrangler dev --env ctox
```

Wrangler runs the Worker locally at `http://localhost:8787`. Set `ORIGIN_URL` to point at a staging environment or add it as a local `.dev.vars` file:

```
ANDALE_API_SECRET=dev-secret
ORIGIN_URL=https://ctox.com
```
