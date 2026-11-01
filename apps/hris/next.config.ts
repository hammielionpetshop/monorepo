import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  // Bundel mandiri berisi server + node_modules seperlunya, dipakai image Docker di VPS.
  output: "standalone",
  // Wajib di monorepo pnpm: tanpa ini file tracing berhenti di apps/hris dan
  // @petshop/hris-db (symlink ke packages/, tanpa build step) tidak
  // ikut tersalin ke .next/standalone — server langsung mati saat start.
  outputFileTracingRoot: join(__dirname, "../.."),
  // Halaman Apa yang baru membaca changelog dari disk saat jalan; berkasnya wajib ikut bundel.
  outputFileTracingIncludes: {
    "/apa-yang-baru": ["./CHANGELOG.md", "./changelog.d/*.md"],
  },
};

export default nextConfig;
