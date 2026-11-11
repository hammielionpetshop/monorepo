import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  // Bundel mandiri untuk image Docker staging (pola HRIS).
  output: "standalone",
  // Monorepo pnpm: file tracing perlu menjangkau packages/ (@petshop/auth tanpa build step).
  outputFileTracingRoot: join(__dirname, "../.."),
};

export default nextConfig;
