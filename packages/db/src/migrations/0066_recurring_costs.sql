-- F2-5a Biaya Rutin (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §2).
-- Biaya tetap bulanan (sewa toko, sewa kendaraan, sewa lain). Tagihan dihitung dari pengaturan; yang
-- disimpan hanya pembayaran, masing-masing bercermin satu catatan Arus Kas untuk bulan tagihannya.
CREATE TABLE IF NOT EXISTS "petshop"."recurring_costs" (
  "id" serial PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "category_id" integer NOT NULL REFERENCES "petshop"."cash_flow_categories"("id"),
  "branch_id" integer REFERENCES "petshop"."branches"("id"),
  "due_day" integer NOT NULL,
  "start_month" date NOT NULL,
  "end_month" date,
  "note" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" integer REFERENCES "petshop"."users"("id"),
  "updated_at" timestamp,
  CONSTRAINT "recurring_costs_name" CHECK (btrim("name") <> ''),
  CONSTRAINT "recurring_costs_due_day" CHECK ("due_day" BETWEEN 1 AND 31),
  CONSTRAINT "recurring_costs_months" CHECK (
    extract(day FROM "start_month") = 1
    AND ("end_month" IS NULL OR (extract(day FROM "end_month") = 1 AND "end_month" >= "start_month"))
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."recurring_cost_amounts" (
  "id" serial PRIMARY KEY,
  "recurring_cost_id" integer NOT NULL REFERENCES "petshop"."recurring_costs"("id"),
  "amount" integer NOT NULL,
  "effective_month" date NOT NULL,
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "recurring_cost_amounts_amount" CHECK ("amount" > 0),
  CONSTRAINT "recurring_cost_amounts_month" CHECK (extract(day FROM "effective_month") = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_cost_amounts_month_unique"
  ON "petshop"."recurring_cost_amounts" ("recurring_cost_id", "effective_month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."recurring_cost_payments" (
  "id" serial PRIMARY KEY,
  "recurring_cost_id" integer NOT NULL REFERENCES "petshop"."recurring_costs"("id"),
  "for_month" date NOT NULL,
  "billed_amount" integer NOT NULL,
  "amount" integer NOT NULL,
  "difference_reason" text,
  "cash_flow_entry_id" integer NOT NULL REFERENCES "petshop"."cash_flow_entries"("id"),
  "batch_key" varchar(40) NOT NULL,
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "cancelled_at" timestamp,
  "cancelled_by" integer REFERENCES "petshop"."users"("id"),
  "cancel_reason" text,
  CONSTRAINT "recurring_cost_payments_amount" CHECK ("amount" > 0 AND "billed_amount" > 0),
  CONSTRAINT "recurring_cost_payments_month" CHECK (extract(day FROM "for_month") = 1),
  CONSTRAINT "recurring_cost_payments_cancel" CHECK (
    ("cancelled_at" IS NULL AND "cancelled_by" IS NULL AND "cancel_reason" IS NULL)
    OR ("cancelled_at" IS NOT NULL AND "cancelled_by" IS NOT NULL AND btrim(coalesce("cancel_reason", '')) <> '')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_cost_payments_entry_unique"
  ON "petshop"."recurring_cost_payments" ("cash_flow_entry_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_cost_payments_month_unique"
  ON "petshop"."recurring_cost_payments" ("recurring_cost_id", "for_month") WHERE "cancelled_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_cost_payments_batch_idx" ON "petshop"."recurring_cost_payments" ("batch_key");
--> statement-breakpoint
-- Biaya rutin & riwayat jumlah tidak dihapus (salah buat = nonaktif).
CREATE OR REPLACE FUNCTION "petshop"."forbid_recurring_cost_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Biaya Rutin tidak boleh dihapus; akhiri atau nonaktifkan';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "recurring_costs_no_delete" ON "petshop"."recurring_costs";
--> statement-breakpoint
CREATE TRIGGER "recurring_costs_no_delete" BEFORE DELETE ON "petshop"."recurring_costs"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."forbid_recurring_cost_delete"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "recurring_cost_amounts_no_delete" ON "petshop"."recurring_cost_amounts";
--> statement-breakpoint
CREATE TRIGGER "recurring_cost_amounts_no_delete" BEFORE DELETE ON "petshop"."recurring_cost_amounts"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."forbid_recurring_cost_delete"();
--> statement-breakpoint
-- Pembayaran tidak dihapus dan tidak diubah; yang boleh hanya mengisi pembatalan satu kali.
CREATE OR REPLACE FUNCTION "petshop"."guard_recurring_cost_payment_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pembayaran Biaya Rutin tidak boleh dihapus; batalkan dengan alasan';
  END IF;
  IF OLD."cancelled_at" IS NOT NULL
     OR NEW."cancelled_at" IS NULL
     OR (NEW."recurring_cost_id", NEW."for_month", NEW."billed_amount", NEW."amount", NEW."difference_reason",
         NEW."cash_flow_entry_id", NEW."batch_key", NEW."created_by", NEW."created_at")
        IS DISTINCT FROM
        (OLD."recurring_cost_id", OLD."for_month", OLD."billed_amount", OLD."amount", OLD."difference_reason",
         OLD."cash_flow_entry_id", OLD."batch_key", OLD."created_by", OLD."created_at") THEN
    RAISE EXCEPTION 'Pembayaran Biaya Rutin tidak boleh diubah; batalkan dengan alasan lalu bayar ulang';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "recurring_cost_payments_guard" ON "petshop"."recurring_cost_payments";
--> statement-breakpoint
CREATE TRIGGER "recurring_cost_payments_guard" BEFORE UPDATE OR DELETE ON "petshop"."recurring_cost_payments"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_recurring_cost_payment_change"();
--> statement-breakpoint
-- Kategori sewa khusus Biaya Rutin: jenis Biaya, sistem (tidak bisa dipilih di Arus Kas biasa).
INSERT INTO "petshop"."cash_flow_categories" ("name", "type", "report_kind", "is_system")
VALUES
  ('Sewa toko', 'EXPENSE', 'COST', true),
  ('Sewa kendaraan', 'EXPENSE', 'COST', true),
  ('Sewa lain', 'EXPENSE', 'COST', true)
ON CONFLICT ("name", "type") DO NOTHING;
--> statement-breakpoint
-- Sewa kini lewat Biaya Rutin (spec F2-4 §3.3): "Sewa (sementara)" ditutup untuk catatan baru, catatan lama tetap.
UPDATE "petshop"."cash_flow_categories" SET "is_active" = false
WHERE "name" = 'Sewa (sementara)' AND "type" = 'EXPENSE';
