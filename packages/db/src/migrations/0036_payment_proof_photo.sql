-- Foto bukti transfer opsional di pembayaran manual Back Office (keputusan owner 2026-10-11,
-- docs/work/backlog/2026-10-11-retur-internal.md bagian "Perbaikan terpisah"):
-- pelunasan piutang pelanggan & pembayaran hutang ke supplier.
-- Hanya MENAMBAH satu kolom kosong di dua tabel — tidak ada data lama yang diubah.
ALTER TABLE "petshop"."debt_payments"
  ADD COLUMN IF NOT EXISTS "proof_photo_url" text;
--> statement-breakpoint

ALTER TABLE "petshop"."supplier_payable_payments"
  ADD COLUMN IF NOT EXISTS "proof_photo_url" text;
