-- F2-2 Setoran (spec docs/work/specs/2026-11-08-f2-2-setoran-design.md).
-- Setoran Tunai (≥1 shift utuh satu cabang), verifikasi non-tunai per shift per metode, dan
-- catatan perpindahan uang. Hanya menambah tabel, hak, dan pengaturan — tidak mengubah data lama.
CREATE TABLE IF NOT EXISTS "petshop"."cash_deposits" (
  "id" serial PRIMARY KEY,
  "deposit_number" varchar(40) NOT NULL UNIQUE,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "destination_money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  "deposit_date" date NOT NULL,
  "reported_amount" integer NOT NULL,
  "slip_photo_url" text,
  "report_channel" varchar(12) NOT NULL,
  "reported_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "reported_at" timestamp NOT NULL DEFAULT now(),
  "status" varchar(12) NOT NULL DEFAULT 'PENDING',
  "received_amount" integer,
  "verified_by" integer REFERENCES "petshop"."users"("id"),
  "verified_at" timestamp,
  "verified_held_by" varchar(10),
  "notes" text,
  "cancelled_by" integer REFERENCES "petshop"."users"("id"),
  "cancelled_at" timestamp,
  "cancel_reason" varchar(255),
  "corrects_deposit_id" integer REFERENCES "petshop"."cash_deposits"("id"),
  CONSTRAINT "cash_deposits_status" CHECK ("status" IN ('PENDING', 'VERIFIED', 'CANCELLED', 'CORRECTED')),
  CONSTRAINT "cash_deposits_channel" CHECK ("report_channel" IN ('POS', 'BACKOFFICE')),
  CONSTRAINT "cash_deposits_reported_amount" CHECK ("reported_amount" >= 0),
  CONSTRAINT "cash_deposits_received_amount" CHECK ("received_amount" IS NULL OR "received_amount" >= 0),
  -- Setoran terverifikasi (termasuk yang kemudian dikoreksi) selalu punya angka diterima & pemverifikasi.
  CONSTRAINT "cash_deposits_verified_fields" CHECK (
    "status" NOT IN ('VERIFIED', 'CORRECTED')
    OR ("received_amount" IS NOT NULL AND "verified_by" IS NOT NULL AND "verified_at" IS NOT NULL AND "verified_held_by" IS NOT NULL)
  ),
  CONSTRAINT "cash_deposits_cancel_fields" CHECK (
    "status" <> 'CANCELLED'
    OR ("cancelled_by" IS NOT NULL AND "cancelled_at" IS NOT NULL AND nullif(btrim("cancel_reason"), '') IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cash_deposits_branch_status" ON "petshop"."cash_deposits" ("branch_id", "status");
--> statement-breakpoint
-- Satu setoran terverifikasi hanya dikoreksi sekali; koreksi berikutnya menautkan setoran koreksi.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cash_deposits_corrects" ON "petshop"."cash_deposits" ("corrects_deposit_id") WHERE "corrects_deposit_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."cash_deposit_shifts" (
  "id" serial PRIMARY KEY,
  "deposit_id" integer NOT NULL REFERENCES "petshop"."cash_deposits"("id"),
  "shift_id" integer NOT NULL REFERENCES "petshop"."shifts"("id"),
  -- Salinan kas tunai shift saat dimasukkan ke setoran.
  "cash_amount" integer NOT NULL,
  -- Diisi saat setoran dibatalkan/dikoreksi: shift kembali bebas tanpa menghapus baris.
  "released_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cash_deposit_shifts_active" ON "petshop"."cash_deposit_shifts" ("shift_id") WHERE "released_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cash_deposit_shifts_deposit" ON "petshop"."cash_deposit_shifts" ("deposit_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."cash_deposit_variances" (
  "id" serial PRIMARY KEY,
  "deposit_id" integer NOT NULL REFERENCES "petshop"."cash_deposits"("id"),
  "amount" integer NOT NULL,
  "cause" varchar(20) NOT NULL,
  "shift_id" integer REFERENCES "petshop"."shifts"("id"),
  "cashier_id" integer REFERENCES "petshop"."users"("id"),
  "note" varchar(255),
  CONSTRAINT "cash_deposit_variances_cause" CHECK ("cause" IN ('BANK_FEE', 'CASHIER_SHORT', 'CASHIER_OVER', 'OTHER')),
  CONSTRAINT "cash_deposit_variances_amount" CHECK (
    "amount" <> 0
    AND ("cause" NOT IN ('BANK_FEE', 'CASHIER_SHORT') OR "amount" < 0)
    AND ("cause" <> 'CASHIER_OVER' OR "amount" > 0)
  ),
  CONSTRAINT "cash_deposit_variances_cashier" CHECK (
    "cause" NOT IN ('CASHIER_SHORT', 'CASHIER_OVER') OR ("shift_id" IS NOT NULL AND "cashier_id" IS NOT NULL)
  ),
  CONSTRAINT "cash_deposit_variances_note" CHECK ("cause" <> 'OTHER' OR nullif(btrim("note"), '') IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cash_deposit_variances_deposit" ON "petshop"."cash_deposit_variances" ("deposit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cash_deposit_variances_shift" ON "petshop"."cash_deposit_variances" ("shift_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."noncash_verifications" (
  "id" serial PRIMARY KEY,
  -- Kosong = pelunasan non-tunai dari Back Office tanpa shift (dikelompokkan per cabang per hari).
  "shift_id" integer REFERENCES "petshop"."shifts"("id"),
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "business_date" date NOT NULL,
  "payment_method_id" integer NOT NULL REFERENCES "petshop"."payment_methods"("id"),
  "expected_amount" integer NOT NULL,
  "money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  "held_by" varchar(10) NOT NULL,
  "status" varchar(16) NOT NULL,
  "received_amount" integer,
  "variance" integer,
  "cause" varchar(20),
  "cashier_id" integer REFERENCES "petshop"."users"("id"),
  "note" varchar(255),
  "verified_by" integer REFERENCES "petshop"."users"("id"),
  "verified_at" timestamp,
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "superseded_at" timestamp,
  "superseded_by_id" integer REFERENCES "petshop"."noncash_verifications"("id"),
  CONSTRAINT "noncash_verifications_status" CHECK ("status" IN ('AWAITING_FUNDS', 'VERIFIED')),
  CONSTRAINT "noncash_verifications_cause" CHECK ("cause" IS NULL OR "cause" IN ('BANK_FEE', 'AWAITING_FUNDS', 'CASHIER_INPUT', 'OTHER')),
  CONSTRAINT "noncash_verifications_verified_fields" CHECK (
    "status" <> 'VERIFIED'
    OR ("received_amount" IS NOT NULL AND "variance" IS NOT NULL AND "verified_by" IS NOT NULL AND "verified_at" IS NOT NULL
        AND ("variance" = 0 OR "cause" IS NOT NULL))
  ),
  CONSTRAINT "noncash_verifications_note" CHECK ("cause" IS DISTINCT FROM 'OTHER' OR nullif(btrim("note"), '') IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_noncash_verifications_shift" ON "petshop"."noncash_verifications" ("shift_id", "payment_method_id")
  WHERE "shift_id" IS NOT NULL AND "superseded_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_noncash_verifications_bo_day" ON "petshop"."noncash_verifications" ("branch_id", "business_date", "payment_method_id")
  WHERE "shift_id" IS NULL AND "superseded_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."money_movements" (
  "id" serial PRIMARY KEY,
  -- Kosong = uang masuk langsung dari pembeli (non-tunai).
  "from_money_place_id" integer REFERENCES "petshop"."money_places"("id"),
  "to_money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  -- Pembalikan memakai tempat yang sama dengan nilai negatif.
  "amount" integer NOT NULL,
  "occurred_on" date NOT NULL,
  "source_type" varchar(30) NOT NULL,
  "source_id" integer NOT NULL,
  "reversal_of_id" integer UNIQUE REFERENCES "petshop"."money_movements"("id"),
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "money_movements_amount" CHECK ("amount" <> 0),
  CONSTRAINT "money_movements_source" CHECK ("source_type" IN ('CASH_DEPOSIT', 'NONCASH_VERIFICATION'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_money_movements_source" ON "petshop"."money_movements" ("source_type", "source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_money_movements_to" ON "petshop"."money_movements" ("to_money_place_id", "occurred_on");
--> statement-breakpoint
-- Catatan perpindahan uang tidak pernah diubah/dihapus; koreksi = baris pembalikan.
CREATE OR REPLACE FUNCTION "petshop"."reject_money_movement_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Catatan perpindahan uang tidak boleh diubah atau dihapus; buat pembalikan';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "money_movements_immutable" BEFORE UPDATE OR DELETE ON "petshop"."money_movements"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."reject_money_movement_change"();
--> statement-breakpoint
-- Tujuan bawaan setoran tunai per cabang (baris Tunai di Tempat Uang › Metode Bayar per Cabang).
CREATE TABLE IF NOT EXISTS "petshop"."cash_deposit_defaults" (
  "branch_id" integer PRIMARY KEY REFERENCES "petshop"."branches"("id") ON DELETE CASCADE,
  "money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" integer REFERENCES "petshop"."users"("id")
);
--> statement-breakpoint
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES ('deposit.report', 'Laporkan Setoran Tunai', 'Melaporkan setoran tunai ke bank dari POS (cabang sendiri)')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE p."code" = 'deposit.report' AND r."name" IN ('OWNER', 'GM', 'MANAGER', 'KASIR')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Tanggal mulai Setoran = hari migrasi ini dijalankan (WIB): di produksi itu hari rilis F2-2.
INSERT INTO "petshop"."app_settings" ("key", "value")
VALUES (
  'deposit_settings',
  json_build_object(
    'startDate', to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD'),
    'warnDays', 5,
    'warnAmount', 25000000,
    'awaitingFundsDays', 2
  )::text
)
ON CONFLICT ("key") DO NOTHING;
