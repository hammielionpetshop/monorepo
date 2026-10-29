import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "warn",
    },
  },
  {
    // Pagar batas modul (spec L0 §4). Pagar yang tidak bisa ditulis sebagai pola di sini
    // (impor relatif keluar folder modul, schema modul lain) dijaga
    // scripts/check-module-boundaries.mjs.
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@petshop/db",
              message: "HRIS tidak membaca tabel petshop langsung — pakai view di schema hris.",
            },
          ],
          patterns: [
            {
              regex: "^@/modules/[^/]+/.+",
              message: "Impor modul lain hanya lewat pintunya: @/modules/<nama> (index.ts).",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
