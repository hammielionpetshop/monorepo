-- Approval barang rusak + foto bukti per item. Sebelum ini, input barang rusak kasir langsung
-- memotong stok seketika (StockService.deductStock) tanpa jenjang persetujuan. Sekarang laporan
-- masuk sebagai PENDING (stok belum tersentuh, costPrice/lossValue item baru estimasi) — stok
-- baru benar-benar dipotong (dengan nilai FIFO nyata) saat OWNER/GM approve lewat
-- /api/bo/damaged-goods/[id]/approve. Kalau ditolak, stok tidak pernah berkurang.

ALTER TABLE "petshop"."damaged_goods"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'PENDING';

ALTER TABLE "petshop"."damaged_goods"
  ADD COLUMN IF NOT EXISTS "resolved_by_id" integer REFERENCES "petshop"."users"("id");

ALTER TABLE "petshop"."damaged_goods"
  ADD COLUMN IF NOT EXISTS "resolved_at" timestamp;

ALTER TABLE "petshop"."damaged_goods"
  ADD COLUMN IF NOT EXISTS "resolution_action" varchar(20);

ALTER TABLE "petshop"."damaged_goods"
  ADD COLUMN IF NOT EXISTS "resolution_notes" text;

ALTER TABLE "petshop"."damaged_goods"
  ADD COLUMN IF NOT EXISTS "rejection_reason" text;

ALTER TABLE "petshop"."damaged_goods_items"
  ADD COLUMN IF NOT EXISTS "photo_url" text;

CREATE INDEX IF NOT EXISTS "idx_damaged_goods_status_branch" ON "petshop"."damaged_goods" ("status", "branch_id");
