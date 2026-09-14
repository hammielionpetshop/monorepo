-- Kode batch & link PO untuk product_stock_batches. Sebelum ini, batch cuma punya id serial
-- internal (bukan untuk dilihat user) dan tidak tertaut ke PO/dokumen penerimaan yang
-- membuatnya — dipakai halaman Ringkasan Stok per Produk supaya owner bisa membedakan batch
-- satu sama lain. Nullable & tidak di-backfill: batch lama tetap tidak punya kode/link, batch
-- baru mulai dari migrasi ini otomatis dapat kode lewat StockService.addStock().

ALTER TABLE "petshop"."product_stock_batches"
  ADD COLUMN IF NOT EXISTS "batch_code" varchar(30);

ALTER TABLE "petshop"."product_stock_batches"
  ADD COLUMN IF NOT EXISTS "purchase_order_id" integer REFERENCES "petshop"."purchase_orders"("id");
