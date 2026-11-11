import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"] },
  {
    // Finance hanya membaca (spec F2-6 §3.1): tidak memakai ORM tulis app lain; pembacaan lewat lib/db (role finance_app).
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@petshop/db", message: "Finance membaca lewat lib/db dengan role finance_app (baca saja)." },
            { name: "@petshop/hris-db", message: "Finance membaca lewat lib/db dengan role finance_app (baca saja)." },
            { name: "@petshop/logistics", message: "Finance membaca lewat lib/db dengan role finance_app (baca saja)." },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
