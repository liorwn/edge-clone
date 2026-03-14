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
  // Output standalone for Docker
  output: "standalone",
};

export default nextConfig;
