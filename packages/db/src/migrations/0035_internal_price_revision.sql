-- Revisi Harga Beli (RI8, docs/work/specs/2026-10-11-retur-internal-design.md bagian B).
-- 1. Batch stok mencatat baris kiriman antar cabang (IBT) asalnya — diisi saat terima transfer
--    mulai sekarang; batch lama dibiarkan kosong (tidak di-backfill).
-- 2. Jejak koreksi modal batch per dokumen revisi (dipakai saat revisi dibatalkan).
-- Hanya MENAMBAH satu kolom kosong & satu tabel — tidak ada data lama yang diubah.
ALTER TABLE "petshop"."product_stock_batches"
  ADD COLUMN IF NOT EXISTS "transfer_item_id" integer REFERENCES "petshop"."inter_branch_transfer_items"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_product_stock_batches_transfer_item" ON "petshop"."product_stock_batches" ("transfer_item_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "petshop"."internal_return_batch_adjustments" (
  "id" serial PRIMARY KEY,
  "internal_return_id" integer NOT NULL REFERENCES "petshop"."internal_returns"("id"),
  "internal_return_item_id" integer NOT NULL REFERENCES "petshop"."internal_return_items"("id"),
  "batch_id" integer NOT NULL REFERENCES "petshop"."product_stock_batches"("id"),
  "old_cost_price" integer NOT NULL,
  "new_cost_price" integer NOT NULL,
  "qty_remaining" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_internal_return_batch_adj_return" ON "petshop"."internal_return_batch_adjustments" ("internal_return_id");
