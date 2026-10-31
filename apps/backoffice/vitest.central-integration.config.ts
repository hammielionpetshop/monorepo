import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const value = process.env.CENTRAL_TEST_DATABASE_URL
if (!value) throw new Error('CENTRAL_TEST_DATABASE_URL wajib diisi untuk tes adapter auth pusat')
const url = new URL(value)
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/petshop_wt_[a-z0-9_]+$/.test(url.pathname)) {
  throw new Error('Tes adapter auth pusat hanya boleh memakai PostgreSQL localhost dan DB worktree petshop_wt_*')
}

// Tes ini menjalankan rollback massal (mencabut SEMUA sesi) dan migrasi auth pada DB-nya,
// jadi guard di atas sengaja ketat.
// Jalankan: CENTRAL_TEST_DATABASE_URL=... pnpm exec vitest run -c vitest.central-integration.config.ts
export default defineConfig({
  css: { postcss: { plugins: [] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['lib/central-adapter.integration.test.ts', 'lib/hris-backoffice-access.integration.test.ts'],
    env: {
      DATABASE_URL: value,
      BO_AUTH_MODE: 'central',
      AUTH_COOKIE_ENV: 'local',
      AUTH_CSRF_SECRET: 'rahasia-csrf-uji-yang-panjangnya-lebih-dari-32',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:6974',
      JWT_SECRET: 'rahasia-uji-yang-panjangnya-lebih-dari-32-karakter',
      JWT_REFRESH_SECRET: 'rahasia-refresh-yang-panjangnya-lebih-dari-32-karakter',
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
