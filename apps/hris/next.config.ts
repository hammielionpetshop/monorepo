import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  // Bundel mandiri berisi server + node_modules seperlunya, dipakai image Docker di VPS.
  output: "standalone",
  // Wajib di monorepo pnpm: tanpa ini file tracing berhenti di apps/hris dan
  // @petshop/hris-db (symlink ke packages/, tanpa build step) tidak
  // ikut tersalin ke .next/standalone — server langsung mati saat start.
  outputFileTracingRoot: join(__dirname, "../.."),
};

export default nextConfig;
