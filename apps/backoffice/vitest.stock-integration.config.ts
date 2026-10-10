import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const value = process.env.STOCK_TEST_DATABASE_URL
if (!value) throw new Error('STOCK_TEST_DATABASE_URL wajib diisi untuk tes stok lokal')
const url = new URL(value)
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/petshop_wt_[a-z0-9_]+$/.test(url.pathname)) {
  throw new Error('Tes stok hanya boleh memakai PostgreSQL localhost dan DB worktree petshop_wt_*')
}

export default defineConfig({
  css: { postcss: { plugins: [] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['lib/services/stock-fifo.integration.test.ts', 'lib/services/ibt-bulk-sale.integration.test.ts', 'lib/services/po-alur-baru.integration.test.ts'],
    env: { DATABASE_URL: value },
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
})
