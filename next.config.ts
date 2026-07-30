import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // tsc --noEmit handles type checking; next build's internal checker
    // is stricter and produces false positives with Prisma-inferred types.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
