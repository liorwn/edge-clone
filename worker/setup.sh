#!/bin/bash
# Andale Worker — one-time setup script
# Creates R2 buckets and prints secret-setting instructions.
#
# Usage: bash setup.sh
#
# Requires: wrangler installed and authenticated (npx wrangler login)

set -e

CLOUDFLARE_ACCOUNT_ID=11b818a4b2a98b4b5012359edb39cae8

echo ""
echo "=== Andale Worker Setup ==="
echo ""

echo "Creating R2 buckets..."
npx wrangler r2 bucket create andale-cache || echo "  andale-cache already exists"
npx wrangler r2 bucket create andale-cache-ctox || echo "  andale-cache-ctox already exists"

echo ""
echo "=== Set Worker secrets ==="
echo ""
echo "Run the following commands to set secrets (you will be prompted for each value):"
echo ""
echo "  # Default / shared worker:"
echo "  npx wrangler secret put ANDALE_API_SECRET"
echo "  npx wrangler secret put ORIGIN_URL"
echo ""
echo "  # ctox.com environment:"
echo "  npx wrangler secret put ANDALE_API_SECRET --env ctox"
echo "  # (ORIGIN_URL for ctox is set in wrangler.toml vars)"
echo ""
echo "  # Cache purge API (set on the Railway/Vercel web app, not the worker):"
echo "  # CF_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}"
echo "  # CF_R2_BUCKET_NAME=andale-cache-ctox"
echo "  # CF_API_TOKEN=<Cloudflare API token with R2 Object Write permission>"
echo ""
echo "=== Deploy ==="
echo ""
echo "  npm install          # install wrangler"
echo "  npm run deploy:ctox  # deploy ctox.com worker"
echo ""
echo "Done."
