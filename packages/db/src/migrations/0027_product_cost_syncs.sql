-- Sinkron modal Manajemen Harga dari barang masuk (PO, koreksi faktur PO, terima IBT,
-- penyesuaian stok bermodal). Baris APPLIED = diterapkan otomatis; PENDING = lompatan >= 30%
-- atau usulan pengembalian setelah penerimaan PO dibatalkan, menunggu OWNER/GM.

CREATE TABLE IF NOT EXISTS "petshop"."product_cost_syncs" (
  "id" serial PRIMARY KEY,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id"),
  "source_type" varchar(20) NOT NULL,
  "source_id" integer,
  "source_ref" varchar(60),
  "source_uom_id" integer NOT NULL REFERENCES "petshop"."units_of_measure"("id"),
  "source_unit_cost" integer NOT NULL,
  "old_cost_per_base" integer,
  "new_cost_per_base" integer NOT NULL,
  "status" varchar(20) NOT NULL,
  "effective_at" timestamp NOT NULL,
  "created_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_by_id" integer REFERENCES "petshop"."users"("id"),
  "resolved_at" timestamp,
  "resolution_note" text
);

CREATE INDEX IF NOT EXISTS "idx_product_cost_syncs_status_branch"
  ON "petshop"."product_cost_syncs" ("status", "branch_id");
CREATE INDEX IF NOT EXISTS "idx_product_cost_syncs_branch_product"
  ON "petshop"."product_cost_syncs" ("branch_id", "product_id", "effective_at");
CREATE INDEX IF NOT EXISTS "idx_product_cost_syncs_source"
  ON "petshop"."product_cost_syncs" ("source_type", "source_id");
