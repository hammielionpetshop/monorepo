-- Index komposit untuk mempercepat agregat belanja per pelanggan
-- (GET /api/customers/[id]/summary: WHERE customer_id = ? AND created_at >= ?).
-- Sebelumnya tabel transactions tidak punya index apa pun sehingga query
-- melakukan sequential scan. Idempotent: aman dijalankan ulang.
--
-- Di produksi index ini sudah dibuat lebih dulu via
-- apps/db-compare/create-index-trx-customer-20260703.mjs (CREATE INDEX CONCURRENTLY),
-- jadi statement ini menjadi no-op di sana dan tetap membentuk index di DB baru.

CREATE INDEX IF NOT EXISTS idx_transactions_customer_created
  ON petshop.transactions (customer_id, created_at);
