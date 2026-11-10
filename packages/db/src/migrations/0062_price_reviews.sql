-- Pemeriksaan Harga Jual saat modal naik (spec docs/work/specs/2026-11-10-periksa-harga-jual-design.md Tahap 2).
-- Satu baris OPEN per (cabang, produk) selama modal naik belum diputuskan manajemen. Barang masuk
-- berikutnya memperbarui baris yang sama; modal lama yang jadi pembanding usulan tetap modal saat
-- harga jual terakhir diperiksa. Usulan harga tidak disimpan — dihitung saat dibaca dari harga & modal terkini.
-- CASCADE / SET NULL hanya agar data yang memang boleh dihapus (mis. data tes) tidak tertahan baris ini;
-- cabang, produk, dan catatan modal yang sudah terpakai tetap tertahan rujukan lain.
CREATE TABLE IF NOT EXISTS "petshop"."price_reviews" (
  "id" serial PRIMARY KEY,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id") ON DELETE CASCADE,
  "status" varchar(10) NOT NULL DEFAULT 'OPEN',
  "old_cost_per_base" integer,
  "new_cost_per_base" integer NOT NULL,
  -- Catatan sinkron modal terakhir; bila masih PENDING, menyetujui harga jual ikut menyetujui modalnya.
  "cost_sync_id" integer REFERENCES "petshop"."product_cost_syncs"("id") ON DELETE SET NULL,
  -- Daftar dokumen asal: [{ "type": "PO_RECEIVING", "id": 12, "ref": "PO-…" }, …]
  "sources" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "resolved_by_id" integer REFERENCES "petshop"."users"("id"),
  "resolved_at" timestamp,
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "price_reviews_status" CHECK ("status" IN ('OPEN', 'APPROVED', 'KEPT', 'CLOSED')),
  CONSTRAINT "price_reviews_resolved" CHECK (("status" = 'OPEN') = ("resolved_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_price_reviews_open" ON "petshop"."price_reviews" ("branch_id", "product_id") WHERE "status" = 'OPEN';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_reviews_status" ON "petshop"."price_reviews" ("status", "branch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_reviews_sources" ON "petshop"."price_reviews" USING gin ("sources");
