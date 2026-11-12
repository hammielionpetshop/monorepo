-- F2-6a-1 Saldo awal Tempat Uang (spec docs/work/specs/2026-11-12-f2-6-modul-finance-design.md §2).
-- Saldo tiap Tunai/Rekening per 1 November 2026 awal hari, titik mulai saldo yang dibaca Finance.
-- Tidak diubah/dihapus; salah = batal beralasan lalu isi ulang. Satu saldo awal berlaku per tempat.
CREATE TABLE IF NOT EXISTS "petshop"."money_place_opening_balances" (
  "id" serial PRIMARY KEY,
  "money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  "as_of" date NOT NULL DEFAULT '2026-11-01',
  "amount" integer NOT NULL,
  "note" text,
  "proof_photo_url" varchar(300),
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "cancelled_at" timestamp,
  "cancelled_by" integer REFERENCES "petshop"."users"("id"),
  "cancel_reason" text,
  CONSTRAINT "money_place_opening_balances_amount" CHECK ("amount" >= 0),
  CONSTRAINT "money_place_opening_balances_as_of" CHECK ("as_of" = DATE '2026-11-01'),
  CONSTRAINT "money_place_opening_balances_cancel" CHECK (
    ("cancelled_at" IS NULL AND "cancelled_by" IS NULL AND "cancel_reason" IS NULL)
    OR ("cancelled_at" IS NOT NULL AND "cancelled_by" IS NOT NULL AND btrim(coalesce("cancel_reason", '')) <> '')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "money_place_opening_balances_active_unique"
  ON "petshop"."money_place_opening_balances" ("money_place_id") WHERE "cancelled_at" IS NULL;
--> statement-breakpoint
-- Laci kasir tidak punya saldo awal (uang laci dihitung per shift).
CREATE OR REPLACE FUNCTION "petshop"."guard_money_place_opening_balance"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Saldo awal Tempat Uang tidak boleh dihapus; batalkan dengan alasan';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "petshop"."money_places" p WHERE p."id" = NEW."money_place_id" AND p."kind" = 'DRAWER') THEN
      RAISE EXCEPTION 'Laci kasir tidak punya saldo awal';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."cancelled_at" IS NOT NULL
     OR NEW."cancelled_at" IS NULL
     OR (NEW."money_place_id", NEW."as_of", NEW."amount", NEW."note", NEW."proof_photo_url", NEW."created_by", NEW."created_at")
        IS DISTINCT FROM
        (OLD."money_place_id", OLD."as_of", OLD."amount", OLD."note", OLD."proof_photo_url", OLD."created_by", OLD."created_at") THEN
    RAISE EXCEPTION 'Saldo awal Tempat Uang tidak boleh diubah; batalkan dengan alasan lalu isi ulang';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "money_place_opening_balances_guard" ON "petshop"."money_place_opening_balances";
--> statement-breakpoint
CREATE TRIGGER "money_place_opening_balances_guard" BEFORE INSERT OR UPDATE OR DELETE ON "petshop"."money_place_opening_balances"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_money_place_opening_balance"();
