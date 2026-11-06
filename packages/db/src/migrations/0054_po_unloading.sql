-- Bongkaran → Draft PO (keputusan owner 2026-11-06, docs/work/specs/2026-11-06-bongkaran-draft-po-design.md §3).
-- Hanya menambah tabel/kolom; isi PO lama tidak berubah.
CREATE TABLE IF NOT EXISTS "petshop"."purchase_order_unloadings" (
  "id" serial PRIMARY KEY NOT NULL,
  "po_id" integer REFERENCES "petshop"."purchase_orders"("id"),
  "hris_report_id" integer NOT NULL,
  "report_number" varchar(30) NOT NULL,
  "report_version" integer NOT NULL,
  "kind" varchar(10) NOT NULL,
  "action" varchar(20) NOT NULL,
  "idempotency_key" varchar(120) NOT NULL,
  "changed_after_approval_at" timestamp,
  "reviewed_at" timestamp,
  "reviewed_by_id" integer REFERENCES "petshop"."users"("id"),
  "review_note" text,
  "created_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_purchase_order_unloadings_kind" CHECK ("kind" IN ('DRAFT', 'MATCHED')),
  CONSTRAINT "chk_purchase_order_unloadings_action" CHECK ("action" IN ('CREATED', 'REPLACED', 'MATCHED', 'CANCELLED', 'FLAGGED', 'NONE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_purchase_order_unloadings_key" ON "petshop"."purchase_order_unloadings" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_order_unloadings_report" ON "petshop"."purchase_order_unloadings" ("hris_report_id", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_order_unloadings_po" ON "petshop"."purchase_order_unloadings" ("po_id", "id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."purchase_order_attachments" (
  "id" serial PRIMARY KEY NOT NULL,
  "po_id" integer NOT NULL REFERENCES "petshop"."purchase_orders"("id"),
  "url" text NOT NULL,
  "kind" varchar(20) NOT NULL,
  "source" varchar(10) DEFAULT 'HRIS' NOT NULL,
  "hris_report_id" integer,
  "hris_file_id" varchar(64),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_purchase_order_attachments_kind" CHECK ("kind" IN ('DELIVERY_NOTE', 'GOODS'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_purchase_order_attachments_file" ON "petshop"."purchase_order_attachments" ("po_id", "hris_file_id");
--> statement-breakpoint
ALTER TABLE "petshop"."purchase_order_items" ADD COLUMN IF NOT EXISTS "qty_unloaded" integer;
--> statement-breakpoint
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES ('po.unloading_sync', 'Draft PO dari Bongkaran', 'Membuat Draft PO dan mengubah berat produk dari Laporan Bongkaran HRIS (lewat pintu internal)')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE p."code" = 'po.unloading_sync' AND r."name" IN ('OWNER', 'GM', 'GUDANG')
ON CONFLICT DO NOTHING;
