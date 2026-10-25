import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets parallel local previews use separate build folders (NEXT_DIST_DIR=.next-a next dev).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
