-- Metode bayar pelunasan hutang internal (kanban #50): supaya jelas uangnya lewat mana
-- (tunai/transfer/QRIS). NULL = pembayaran lama sebelum kolom ini ada.
ALTER TABLE "petshop"."inter_branch_payments"
  ADD COLUMN IF NOT EXISTS "payment_method_id" integer REFERENCES "petshop"."payment_methods"("id");
--> statement-breakpoint

-- Kategori Pendapatan & Pengeluaran untuk mencatat uang pelunasan di kedua cabang.
-- Disisipkan di sini (bukan lewat seed) karena pipeline deploy hanya menjalankan migrasi.
INSERT INTO "petshop"."cash_flow_categories" ("name", "type")
VALUES ('Bayar Hutang Internal', 'EXPENSE'), ('Terima Piutang Internal', 'INCOME')
ON CONFLICT ("name", "type") DO NOTHING;
