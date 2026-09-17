-- Daftar tunggu Bulk Sale dipindah dari localStorage ke DB (task kanban #38 Bagian B) —
-- draft yang cuma tersimpan di satu browser hilang begitu diakses dari device lain. LIST
-- snapshot bernama per user (bukan satu draft aktif seperti internal_order_drafts), payload
-- disimpan mentah sama seperti bentuk localStorage lama.

CREATE TABLE IF NOT EXISTS "petshop"."bulk_sale_drafts" (
  "id" serial PRIMARY KEY,
  "created_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "name" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bulk_sale_drafts_created_by"
  ON "petshop"."bulk_sale_drafts" ("created_by_id", "created_at");
