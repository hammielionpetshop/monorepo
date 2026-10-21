-- Diskon manual mode PERSEN (docs/work/backlog/2026-10-11-daftar-tunda-owner.md — diskon persentase):
-- persentase bulat yang diketik kasir (1–100) untuk ditampilkan di struk & Laporan Riwayat Diskon
-- sebagai "Diskon 10%". NULL = diskon rupiah (per pcs / per baris) seperti sebelumnya. Kolom display
-- saja — `amount` tetap sumber nilai uang. Nota lama tidak diubah.
ALTER TABLE "petshop"."transaction_item_discounts" ADD COLUMN IF NOT EXISTS "percent" integer;
--> statement-breakpoint
ALTER TABLE "petshop"."transaction_item_discounts" ADD CONSTRAINT "chk_transaction_item_discounts_percent" CHECK ("percent" IS NULL OR ("percent" BETWEEN 1 AND 100));
