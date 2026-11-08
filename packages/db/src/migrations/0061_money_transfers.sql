-- F2-4c Pindah Dana (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §4).
-- Uang pindah antar Tempat Uang (Brankas → rekening, rekening → Brankas, Brankas → kas pegangan).
-- Bukan biaya dan bukan pendapatan. Satu baris per pindah; perpindahannya juga dicatat di
-- money_movements (sumber TRANSFER) agar saldo Tempat Uang terbaca dari satu tempat.
-- Tidak diubah/dihapus; batal = isi pembatalan + baris pembalikan negatif di money_movements.
CREATE TABLE IF NOT EXISTS "petshop"."money_transfers" (
  "id" serial PRIMARY KEY,
  "from_money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  "to_money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  "amount" integer NOT NULL,
  "occurred_on" date NOT NULL,
  "note" text,
  "proof_photo_url" text,
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "cancelled_at" timestamp,
  "cancelled_by" integer REFERENCES "petshop"."users"("id"),
  "cancel_reason" text,
  CONSTRAINT "money_transfers_amount" CHECK ("amount" > 0),
  CONSTRAINT "money_transfers_places" CHECK ("from_money_place_id" <> "to_money_place_id"),
  CONSTRAINT "money_transfers_cancel" CHECK (
    ("cancelled_at" IS NULL AND "cancelled_by" IS NULL AND "cancel_reason" IS NULL)
    OR ("cancelled_at" IS NOT NULL AND "cancelled_by" IS NOT NULL AND btrim(coalesce("cancel_reason", '')) <> '')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_money_transfers_occurred" ON "petshop"."money_transfers" ("occurred_on");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "petshop"."guard_money_transfer_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Catatan Pindah Dana tidak boleh dihapus; batalkan dengan alasan';
  END IF;
  IF OLD."cancelled_at" IS NOT NULL
     OR NEW."cancelled_at" IS NULL
     OR (NEW."from_money_place_id", NEW."to_money_place_id", NEW."amount", NEW."occurred_on", NEW."note",
         NEW."proof_photo_url", NEW."created_by", NEW."created_at")
        IS DISTINCT FROM
        (OLD."from_money_place_id", OLD."to_money_place_id", OLD."amount", OLD."occurred_on", OLD."note",
         OLD."proof_photo_url", OLD."created_by", OLD."created_at") THEN
    RAISE EXCEPTION 'Catatan Pindah Dana tidak boleh diubah; batalkan dengan alasan lalu catat ulang';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "money_transfers_guard" ON "petshop"."money_transfers";
--> statement-breakpoint
CREATE TRIGGER "money_transfers_guard" BEFORE UPDATE OR DELETE ON "petshop"."money_transfers"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_money_transfer_change"();
--> statement-breakpoint
ALTER TABLE "petshop"."money_movements" DROP CONSTRAINT IF EXISTS "money_movements_source";
--> statement-breakpoint
ALTER TABLE "petshop"."money_movements"
  ADD CONSTRAINT "money_movements_source" CHECK ("source_type" IN ('CASH_DEPOSIT', 'NONCASH_VERIFICATION', 'TRANSFER'));
