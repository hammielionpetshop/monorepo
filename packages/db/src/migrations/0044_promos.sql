-- Promo otomatis (P2a, docs/work/specs/2026-10-12-promo-otomatis-design.md): satu promo =
-- syarat (barang + jumlah minimal) + hadiah (barang yang dipotong) + batas (cabang, masa
-- berlaku, jam, kelipatan, maksimal per nota). Hanya menambah tabel; belum ada kode yang
-- membaca atau menulisnya. Tabel `promotions` lama tidak dipakai dan dibiarkan.
CREATE TABLE IF NOT EXISTS "petshop"."promos" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "kind" varchar(20) NOT NULL,
  "note" text,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "daily_start_minute" integer,
  "daily_end_minute" integer,
  "is_multiple" boolean DEFAULT false NOT NULL,
  "max_per_note" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_id" integer REFERENCES "petshop"."users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deactivated_by_id" integer REFERENCES "petshop"."users"("id"),
  "deactivated_at" timestamp,
  CONSTRAINT "chk_promos_kind" CHECK ("kind" IN ('POTONGAN', 'FLASH_SALE', 'BELI_GRATIS', 'BUNDLING', 'HADIAH_PILIHAN')),
  CONSTRAINT "chk_promos_period" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "chk_promos_daily_window" CHECK (
    ("daily_start_minute" IS NULL AND "daily_end_minute" IS NULL)
    OR ("daily_start_minute" BETWEEN 0 AND 1439 AND "daily_end_minute" BETWEEN 0 AND 1439
        AND "daily_start_minute" <> "daily_end_minute")
  ),
  CONSTRAINT "chk_promos_max_per_note" CHECK ("max_per_note" IS NULL OR "max_per_note" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."promo_branches" (
  "promo_id" integer NOT NULL REFERENCES "petshop"."promos"("id"),
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  CONSTRAINT "promo_branches_pk" PRIMARY KEY ("promo_id", "branch_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."promo_conditions" (
  "id" serial PRIMARY KEY NOT NULL,
  "promo_id" integer NOT NULL REFERENCES "petshop"."promos"("id"),
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id"),
  "uom_id" integer NOT NULL REFERENCES "petshop"."units_of_measure"("id"),
  "min_qty" integer NOT NULL,
  CONSTRAINT "chk_promo_conditions_min_qty" CHECK ("min_qty" > 0),
  CONSTRAINT "uq_promo_conditions_item" UNIQUE ("promo_id", "product_id", "uom_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."promo_rewards" (
  "id" serial PRIMARY KEY NOT NULL,
  "promo_id" integer NOT NULL REFERENCES "petshop"."promos"("id"),
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id"),
  "uom_id" integer NOT NULL REFERENCES "petshop"."units_of_measure"("id"),
  "reward_type" varchar(20) NOT NULL,
  "value" integer NOT NULL,
  "qty" integer,
  CONSTRAINT "chk_promo_rewards_type" CHECK ("reward_type" IN ('POTONG_PER_PCS', 'HARGA_JADI', 'GRATIS')),
  CONSTRAINT "chk_promo_rewards_value" CHECK ("value" >= 0),
  CONSTRAINT "chk_promo_rewards_qty" CHECK ("qty" IS NULL OR "qty" > 0),
  CONSTRAINT "uq_promo_rewards_item" UNIQUE ("promo_id", "product_id", "uom_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promos_active_period" ON "petshop"."promos" ("is_active", "starts_at", "ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_branches_branch" ON "petshop"."promo_branches" ("branch_id");
