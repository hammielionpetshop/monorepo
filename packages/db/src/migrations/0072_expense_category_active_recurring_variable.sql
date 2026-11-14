-- Kategori Pengeluaran Kasir dikelola di Back Office (permintaan owner 2026-11-14): nonaktif = tidak bisa dipilih
-- kasir lagi, catatan lama tetap. Tidak ada hapus.
ALTER TABLE "petshop"."expense_categories" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- Biaya Rutin "Nominal berubah tiap bulan" (listrik, air): jumlah per bulan = perkiraan; bayar beda jumlah tanpa alasan.
ALTER TABLE "petshop"."recurring_costs" ADD COLUMN IF NOT EXISTS "variable_amount" boolean DEFAULT false NOT NULL;
