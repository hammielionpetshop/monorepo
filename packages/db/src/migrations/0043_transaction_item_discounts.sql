-- Diskon per barang (P1a, docs/work/specs/2026-10-12-promo-otomatis-design.md): catatan potongan
-- per baris nota — satu baris per potongan. Sumber Laporan Riwayat Diskon dan Laporan Promo.
-- Hanya menambah tabel; belum ada kode yang menulis ke sini, nota lama tidak diubah.
CREATE TABLE IF NOT EXISTS "petshop"."transaction_item_discounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "transaction_id" integer NOT NULL REFERENCES "petshop"."transactions"("id"),
  "transaction_item_id" integer NOT NULL REFERENCES "petshop"."transaction_items"("id"),
  "kind" varchar(10) NOT NULL,
  "amount" integer NOT NULL,
  "reason_code" varchar(30),
  "reason_note" text,
  "promotion_id" integer,
  "promotion_name" varchar(100),
  "promotion_snapshot" jsonb,
  "created_by_id" integer REFERENCES "petshop"."users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_transaction_item_discounts_kind" CHECK ("kind" IN ('MANUAL', 'PROMO')),
  CONSTRAINT "chk_transaction_item_discounts_amount" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transaction_item_discounts_item" ON "petshop"."transaction_item_discounts" ("transaction_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transaction_item_discounts_transaction" ON "petshop"."transaction_item_discounts" ("transaction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transaction_item_discounts_kind_created" ON "petshop"."transaction_item_discounts" ("kind", "created_at");
