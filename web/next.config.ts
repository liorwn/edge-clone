import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The pipeline module dynamically imports from the parent andale core library.
  // These run server-side only and should not be bundled by webpack/turbopack.
  serverExternalPackages: [
    "cheerio",
    "sharp",
    "lighthouse",
    "chrome-launcher",
    "single-file-cli",
  ],
  // Note: not using standalone mode — running `next start` directly in Docker
  // so the core /app/dist/ is accessible via resolve("/app", "dist", ...)
};

export default nextConfig;
