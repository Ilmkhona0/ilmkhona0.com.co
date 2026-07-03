import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is only needed for Docker builds (set in the Dockerfile).
  // Plain `npm run build` + `npm start` (Lightsail, local) works without it.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
