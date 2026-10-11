-- Jasa grooming J3a (docs/work/specs/2026-10-11-jasa-grooming-design.md): satu baris per ekor
-- kucing per kunjungan, menempel ke satu baris nota. Hanya menambah tabel & izin.
CREATE TABLE IF NOT EXISTS "petshop"."grooming_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "transaction_id" integer NOT NULL REFERENCES "petshop"."transactions"("id"),
  "transaction_item_id" integer NOT NULL REFERENCES "petshop"."transaction_items"("id"),
  "sequence" integer NOT NULL,
  "customer_id" integer NOT NULL REFERENCES "petshop"."customers"("id"),
  "pet_id" integer NOT NULL REFERENCES "petshop"."pets"("id"),
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id"),
  "groomer_id" integer NOT NULL REFERENCES "petshop"."groomers"("id"),
  "condition" text NOT NULL,
  "status" varchar(20) DEFAULT 'DIKERJAKAN' NOT NULL,
  "received_by_id" integer REFERENCES "petshop"."users"("id"),
  "received_at" timestamp DEFAULT now() NOT NULL,
  "picked_up_by_id" integer REFERENCES "petshop"."users"("id"),
  "picked_up_at" timestamp,
  "cancelled_at" timestamp,
  "cancel_source" varchar(10),
  "cancel_reason" text,
  "ticket_print_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_grooming_orders_transaction_item" ON "petshop"."grooming_orders" ("transaction_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grooming_orders_branch_status" ON "petshop"."grooming_orders" ("branch_id", "status", "received_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grooming_orders_transaction" ON "petshop"."grooming_orders" ("transaction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grooming_orders_pet" ON "petshop"."grooming_orders" ("pet_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grooming_orders_groomer" ON "petshop"."grooming_orders" ("groomer_id", "received_at");
--> statement-breakpoint

-- Izin dipasang lewat migrasi karena pipeline deploy hanya menjalankan migrasi.
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES ('grooming.order.manage', 'Terima & Serahkan Kucing Grooming', 'Menerima kucing untuk grooming di kasir, melihat daftar grooming, dan menandai kucing sudah diambil')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE r."name" IN ('OWNER', 'GM', 'MANAGER', 'KASIR')
  AND p."code" = 'grooming.order.manage'
ON CONFLICT DO NOTHING;
