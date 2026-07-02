-- Index untuk kolom FK/filter pada tabel panas yang selama ini tanpa index
-- (Postgres tidak mengindeks FK otomatis). Dipilih berdasarkan pola query
-- nyata di backoffice: join detail transaksi, laporan per cabang/tanggal,
-- settlement shift, FIFO/COGS, hutang & pembayaran, serta pencarian shift OPEN.
-- Semua idempotent (IF NOT EXISTS). Di produksi diterapkan CONCURRENTLY via
-- apps/db-compare/create-hot-path-indexes-20260703.mjs.

-- transactions: laporan/dashboard difilter branch + rentang tanggal; settlement per shift
CREATE INDEX IF NOT EXISTS idx_transactions_branch_created ON petshop.transactions (branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON petshop.transactions (shift_id);

-- item & pembayaran: di-join per transaksi (detail struk, laporan, void, retur)
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON petshop.transaction_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_payments_transaction ON petshop.transaction_payments (transaction_id);

-- batch stok: FIFO & perhitungan COGS per produk+cabang di tiap penjualan
CREATE INDEX IF NOT EXISTS idx_product_stock_batches_product_branch ON petshop.product_stock_batches (product_id, branch_id);

-- hutang & pembayaran hutang customer
CREATE INDEX IF NOT EXISTS idx_customer_debts_customer ON petshop.customer_debts (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_debts_transaction ON petshop.customer_debts (transaction_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON petshop.debt_payments (debt_id);

-- shift: cari shift OPEN per cabang (tiap load POS) & join biaya per shift
CREATE INDEX IF NOT EXISTS idx_shifts_branch_status ON petshop.shifts (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_expenses_shift ON petshop.shift_expenses (shift_id);
