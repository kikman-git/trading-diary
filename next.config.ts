import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules must not be bundled — kept external to the server runtime.
  serverExternalPackages: ["better-sqlite3", "sharp"],
};

export default nextConfig;
