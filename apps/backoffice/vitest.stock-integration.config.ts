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
    include: ['lib/services/stock-fifo.integration.test.ts', 'lib/services/ibt-bulk-sale.integration.test.ts', 'lib/services/po-alur-baru.integration.test.ts', 'lib/services/supplier-return.integration.test.ts', 'lib/services/supplier-active.integration.test.ts', 'lib/services/supplier-return-cancel.integration.test.ts', 'lib/services/internal-return-schema.integration.test.ts', 'lib/services/internal-return-goods.integration.test.ts', 'lib/services/internal-return-screen.integration.test.ts', 'lib/services/internal-credit-auto.integration.test.ts', 'lib/services/internal-price-revision.integration.test.ts', 'lib/services/retur-cancel-ledger.integration.test.ts', 'lib/services/payment-proof-photo.integration.test.ts', 'lib/services/trx-number-retry.integration.test.ts', 'lib/services/jasa-tanpa-stok.integration.test.ts', 'lib/services/grooming-master.integration.test.ts', 'lib/services/grooming-order.integration.test.ts', 'lib/services/grooming-delivery.integration.test.ts', 'lib/services/grooming-report.integration.test.ts', 'lib/services/line-discount.integration.test.ts', 'lib/services/retur-net-value.integration.test.ts', 'lib/services/line-discount-paths.integration.test.ts', 'lib/services/discount-history.integration.test.ts', 'lib/services/promo.integration.test.ts', 'lib/services/promo-sale.integration.test.ts', 'lib/services/promo-jalur-lain.integration.test.ts', 'lib/services/promo-report.integration.test.ts', 'lib/services/promo-kuota.integration.test.ts', 'lib/services/promo-gratis.integration.test.ts', 'lib/services/base-uom-change.integration.test.ts', 'lib/services/delivery-method.integration.test.ts', 'lib/services/po-cancel.integration.test.ts', 'lib/services/shortfall-cleanup.integration.test.ts', 'lib/services/promo-group.integration.test.ts', 'lib/services/grooming-hold.integration.test.ts', 'lib/services/po-unloading.integration.test.ts', 'lib/services/po-item-edit.integration.test.ts', 'lib/services/money-place.integration.test.ts', 'lib/services/deposit.integration.test.ts', 'lib/services/deposit-settlement.integration.test.ts', 'lib/services/legacy-settlement-run.integration.test.ts', 'lib/services/cash-flow.integration.test.ts', 'lib/services/money-transfer.integration.test.ts', 'lib/services/below-cost.integration.test.ts', 'lib/services/price-review.integration.test.ts'],
    env: { DATABASE_URL: value },
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
})
