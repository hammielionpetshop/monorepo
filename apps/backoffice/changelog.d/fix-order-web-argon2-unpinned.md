### Fixed
- **Deploy VPS gagal karena build Docker `order-web` gagal.** `apps/order-web/package.json` memakai `argon2: "latest"` (tidak dikunci) — `pnpm install` penuh terbaru menariknya ke versi yang tidak punya prebuilt binary untuk image build, sehingga gagal kompilasi dari source (butuh Python, tidak ada di image builder). Dikunci ke `0.44.0`, sama seperti `apps/backoffice` dan `packages/db`.
