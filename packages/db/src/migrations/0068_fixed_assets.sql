-- F2-6d-1 Aset & Penyusutan (spec docs/work/specs/2026-11-12-f2-6d-aset-penyusutan-design.md §1).
-- Barang tahan lama ≥ Rp1 juta. Pembelian bercermin satu catatan Arus Kas "Beli aset" (Bukan biaya);
-- penyusutan dihitung saat dibaca, tidak disimpan. Tidak dihapus; salah catat = batal beralasan.
INSERT INTO "petshop"."cash_flow_categories" ("name", "type", "report_kind", "is_system")
VALUES
  ('Beli aset', 'EXPENSE', 'NON_COST', true),
  ('Jual aset', 'INCOME', 'NON_INCOME', true)
ON CONFLICT ("name", "type") DO UPDATE SET "report_kind" = EXCLUDED."report_kind", "is_system" = true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."fixed_assets" (
  "id" serial PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "asset_type" varchar(30) NOT NULL,
  "branch_id" integer REFERENCES "petshop"."branches"("id"),
  "purchase_price" integer NOT NULL,
  "purchased_on" date NOT NULL,
  "useful_life_months" integer NOT NULL,
  "purchase_cash_flow_entry_id" integer NOT NULL REFERENCES "petshop"."cash_flow_entries"("id"),
  "proof_photo_url" text,
  "note" text,
  "status" varchar(10) NOT NULL DEFAULT 'IN_USE',
  "disposed_on" date,
  "disposal_reason" text,
  "sale_amount" integer,
  "sale_cash_flow_entry_id" integer REFERENCES "petshop"."cash_flow_entries"("id"),
  "disposed_by" integer REFERENCES "petshop"."users"("id"),
  "disposed_at" timestamp,
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "cancelled_at" timestamp,
  "cancelled_by" integer REFERENCES "petshop"."users"("id"),
  "cancel_reason" text,
  CONSTRAINT "fixed_assets_name" CHECK (btrim("name") <> ''),
  CONSTRAINT "fixed_assets_type" CHECK ("asset_type" IN ('ELECTRONICS', 'MACHINE', 'FURNITURE', 'VEHICLE', 'LEASEHOLD_IMPROVEMENT')),
  CONSTRAINT "fixed_assets_price" CHECK ("purchase_price" >= 1000000),
  CONSTRAINT "fixed_assets_life" CHECK ("useful_life_months" BETWEEN 1 AND 120),
  CONSTRAINT "fixed_assets_purchased_on" CHECK ("purchased_on" >= DATE '2026-11-01'),
  CONSTRAINT "fixed_assets_status" CHECK ("status" IN ('IN_USE', 'DAMAGED', 'LOST', 'SOLD')),
  CONSTRAINT "fixed_assets_disposal" CHECK (
    ("status" = 'IN_USE' AND "disposed_on" IS NULL AND "disposal_reason" IS NULL AND "sale_amount" IS NULL
      AND "sale_cash_flow_entry_id" IS NULL AND "disposed_by" IS NULL AND "disposed_at" IS NULL)
    OR ("status" <> 'IN_USE' AND "disposed_on" IS NOT NULL AND "disposed_on" >= "purchased_on"
      AND btrim(coalesce("disposal_reason", '')) <> '' AND "disposed_by" IS NOT NULL AND "disposed_at" IS NOT NULL
      AND ("status" = 'SOLD' OR ("sale_amount" IS NULL AND "sale_cash_flow_entry_id" IS NULL))
      AND ("status" <> 'SOLD' OR ("sale_amount" IS NOT NULL AND "sale_amount" >= 0)))
  ),
  CONSTRAINT "fixed_assets_cancel" CHECK (
    ("cancelled_at" IS NULL AND "cancelled_by" IS NULL AND "cancel_reason" IS NULL)
    OR ("cancelled_at" IS NOT NULL AND "cancelled_by" IS NOT NULL AND btrim(coalesce("cancel_reason", '')) <> '')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_assets_purchase_entry_unique" ON "petshop"."fixed_assets" ("purchase_cash_flow_entry_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_assets_sale_entry_unique" ON "petshop"."fixed_assets" ("sale_cash_flow_entry_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_assets_branch_idx" ON "petshop"."fixed_assets" ("branch_id");
--> statement-breakpoint
-- Aset tidak dihapus; isi tidak diubah. Yang boleh: Dipakai → Rusak/Hilang/Dijual sekali, dan batal sekali.
CREATE OR REPLACE FUNCTION "petshop"."guard_fixed_asset_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Aset tidak boleh dihapus; batalkan dengan alasan';
  END IF;
  IF OLD."cancelled_at" IS NOT NULL THEN
    RAISE EXCEPTION 'Aset sudah dibatalkan';
  END IF;
  IF (NEW."name", NEW."asset_type", NEW."branch_id", NEW."purchase_price", NEW."purchased_on", NEW."useful_life_months",
      NEW."purchase_cash_flow_entry_id", NEW."proof_photo_url", NEW."note", NEW."created_by", NEW."created_at")
     IS DISTINCT FROM
     (OLD."name", OLD."asset_type", OLD."branch_id", OLD."purchase_price", OLD."purchased_on", OLD."useful_life_months",
      OLD."purchase_cash_flow_entry_id", OLD."proof_photo_url", OLD."note", OLD."created_by", OLD."created_at") THEN
    RAISE EXCEPTION 'Isi aset tidak boleh diubah; batalkan lalu catat ulang';
  END IF;
  IF OLD."status" <> 'IN_USE'
     AND (NEW."status", NEW."disposed_on", NEW."disposal_reason", NEW."sale_amount", NEW."sale_cash_flow_entry_id", NEW."disposed_by", NEW."disposed_at")
         IS DISTINCT FROM
         (OLD."status", OLD."disposed_on", OLD."disposal_reason", OLD."sale_amount", OLD."sale_cash_flow_entry_id", OLD."disposed_by", OLD."disposed_at") THEN
    RAISE EXCEPTION 'Keadaan aset tidak bisa diubah lagi';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "fixed_assets_guard" ON "petshop"."fixed_assets";
--> statement-breakpoint
CREATE TRIGGER "fixed_assets_guard" BEFORE UPDATE OR DELETE ON "petshop"."fixed_assets"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_fixed_asset_change"();
