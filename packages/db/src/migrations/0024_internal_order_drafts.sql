-- Draft pembuatan PO Internal dipindah dari localStorage ke DB (task kanban #38 Bagian A) —
-- sebelumnya draft hilang begitu kasir ganti device/browser atau data situsnya dibersihkan.
-- Satu draft aktif per (branch_id, created_by_id): branch_id = cabang sesi POS kasir yang
-- membuat draft (bukan source_branch_id yang bisa diganti OWNER/GM di form), created_by_id
-- supaya draft tidak bercampur antar kasir yang berbagi PC/cabang yang sama.

CREATE TABLE IF NOT EXISTS "petshop"."internal_order_drafts" (
  "id" serial PRIMARY KEY,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "created_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "destination_branch_id" integer REFERENCES "petshop"."branches"("id"),
  "source_branch_id" integer REFERENCES "petshop"."branches"("id"),
  "notes" text,
  "items" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_internal_order_drafts_branch_user"
  ON "petshop"."internal_order_drafts" ("branch_id", "created_by_id");
