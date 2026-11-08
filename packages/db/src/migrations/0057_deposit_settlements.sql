-- F2-3 Pelunasan Otomatis (spec docs/work/specs/2026-11-08-f2-3-pelunasan-otomatis-design.md).
-- Verifikasi setoran melunasi utang internal otomatis (berantai, paling lama dulu); sisa = setoran
-- bebas. Hanya menambah tabel & pengaturan — utang sebelum November 2026 tidak disentuh.
CREATE TABLE IF NOT EXISTS "petshop"."deposit_settlements" (
  "id" serial PRIMARY KEY,
  "source_type" varchar(30) NOT NULL,
  "source_id" integer NOT NULL,
  "level" integer NOT NULL,
  "parent_id" integer REFERENCES "petshop"."deposit_settlements"("id"),
  "payer_branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  -- Kosong = setoran bebas cabang itu.
  "payable_id" integer REFERENCES "petshop"."inter_branch_payables"("id"),
  "payment_id" integer REFERENCES "petshop"."inter_branch_payments"("id"),
  "amount" integer NOT NULL,
  "reversal_of_id" integer UNIQUE REFERENCES "petshop"."deposit_settlements"("id"),
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "deposit_settlements_amount" CHECK ("amount" <> 0),
  CONSTRAINT "deposit_settlements_level" CHECK ("level" >= 1),
  CONSTRAINT "deposit_settlements_source" CHECK ("source_type" IN ('CASH_DEPOSIT', 'NONCASH_VERIFICATION')),
  CONSTRAINT "deposit_settlements_payment" CHECK (("payable_id" IS NULL) = ("payment_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deposit_settlements_source" ON "petshop"."deposit_settlements" ("source_type", "source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deposit_settlements_payable" ON "petshop"."deposit_settlements" ("payable_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "petshop"."reject_deposit_settlement_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Catatan pelunasan setoran tidak boleh diubah atau dihapus; buat pembalikan';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "deposit_settlements_immutable" BEFORE UPDATE OR DELETE ON "petshop"."deposit_settlements"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."reject_deposit_settlement_change"();
--> statement-breakpoint
-- Tanggal mulai 1 November 2026 (owner 2026-11-08: "cukup semua data november saja"): utang
-- internal yang lahir sebelumnya tidak dilunasi otomatis. Batas umur merah Utang Internal 30 hari.
INSERT INTO "petshop"."app_settings" ("key", "value")
VALUES (
  'auto_settlement_settings',
  json_build_object(
    'startDate', '2026-11-01',
    'redAgeDays', 30
  )::text
)
ON CONFLICT ("key") DO NOTHING;
