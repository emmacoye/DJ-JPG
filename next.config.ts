import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Note: Pages Router API routes have a hard 1MB limit that can't be overridden
  // Images are compressed client-side to stay under this limit
};

export default nextConfig;
