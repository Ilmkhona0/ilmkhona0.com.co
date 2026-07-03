import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker deployment (Hetzner): builds a minimal self-contained server
  output: "standalone",
};

export default nextConfig;
