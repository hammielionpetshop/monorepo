-- Approval per-item untuk SO Besar (stock_opnames.type = 'FULL').
--
-- Sebelumnya satu SO disetujui/ditolak sekaligus untuk semua itemnya. Untuk SO Besar itu
-- salah: item yang fisiknya sudah pas (varianceQty 0) tidak perlu ditinjau, sementara item
-- yang selisih perlu ditahan dan idealnya dihitung ulang sebelum admin memutuskan — supaya
-- selisih yang cuma salah hitung tidak ikut mengubah stok.
--
-- Kolom-kolom ini cuma bermakna untuk item milik SO type='FULL'; item SO Harian tetap NULL
-- dan tetap disetujui satu header sekaligus lewat alur lama.
--
-- recount_system_qty sengaja terpisah dari system_qty (bukan menimpanya): system_qty adalah
-- snapshot hitungan pertama, recount_system_qty snapshot BARU saat hitung ulang — stok bisa
-- sudah bergerak (penjualan) di antara keduanya, jadi keduanya harus tetap bisa dibandingkan
-- terpisah untuk audit.

ALTER TABLE "petshop"."stock_opname_items"
  ADD COLUMN IF NOT EXISTS "item_status" varchar(20),
  ADD COLUMN IF NOT EXISTS "decision_note" text,
  ADD COLUMN IF NOT EXISTS "decided_by_id" integer REFERENCES "petshop"."users"("id"),
  ADD COLUMN IF NOT EXISTS "decided_at" timestamp,
  ADD COLUMN IF NOT EXISTS "recount_system_qty" integer,
  ADD COLUMN IF NOT EXISTS "recount_variance_qty" integer,
  ADD COLUMN IF NOT EXISTS "recounted_by_id" integer REFERENCES "petshop"."users"("id"),
  ADD COLUMN IF NOT EXISTS "recounted_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_stock_opname_items_pending"
  ON "petshop"."stock_opname_items" ("so_id")
  WHERE "item_status" = 'PENDING';
