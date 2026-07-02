-- Pastikan satu transfer hanya memiliki satu payable (idempotency guard)
-- Jika ada duplikat existing, hapus dulu sebelum menjalankan migration ini
CREATE UNIQUE INDEX IF NOT EXISTS idx_ibp_transfer_unique
  ON petshop.inter_branch_payables(transfer_id);
