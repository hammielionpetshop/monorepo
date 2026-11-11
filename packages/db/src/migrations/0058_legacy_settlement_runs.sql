-- F2-3b-2 Pelunasan susulan utang antar cabang lama (spec docs/work/specs/2026-11-08-f2-3b-utang-lama-design.md §4).
-- Owner menjalankan sekali dari layar Utang Lama; tiap potongan alokasi dicatat di deposit_settlements
-- dengan sumber LEGACY_RUN. Hanya satu pelaksanaan aktif; pembatalan membalik semua baris (tanpa hapus).
-- Tidak ada koreksi data di migrasi ini: data hanya berubah saat Owner menekan Jalankan.
CREATE TABLE IF NOT EXISTS "petshop"."legacy_settlement_runs" (
  "id" serial PRIMARY KEY,
  -- Setoran dihitung sejak tanggal ini (WIB) s.d. sebelum cutoff_date.
  "from_date" date NOT NULL,
  -- Tanggal mulai pelunasan otomatis saat dijalankan: utang lama = lahir sebelum tanggal ini.
  "cutoff_date" date NOT NULL,
  "include_noncash" boolean NOT NULL,
  "subtract_manual" boolean NOT NULL,
  "settled_amount" integer NOT NULL,
  "payables_count" integer NOT NULL,
  "free_amount" integer NOT NULL,
  "notes" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "cancelled_by" integer REFERENCES "petshop"."users"("id"),
  "cancelled_at" timestamp,
  "cancel_reason" text,
  CONSTRAINT "legacy_settlement_runs_status" CHECK ("status" IN ('ACTIVE', 'CANCELLED')),
  CONSTRAINT "legacy_settlement_runs_cancel" CHECK (
    ("status" = 'ACTIVE' AND "cancelled_at" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancelled_by" IS NOT NULL AND "cancel_reason" IS NOT NULL)
  ),
  CONSTRAINT "legacy_settlement_runs_amounts" CHECK ("settled_amount" >= 0 AND "payables_count" >= 0 AND "free_amount" >= 0)
);
--> statement-breakpoint
-- Hanya satu pelaksanaan aktif.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_legacy_settlement_runs_active" ON "petshop"."legacy_settlement_runs" ("status") WHERE "status" = 'ACTIVE';
--> statement-breakpoint
ALTER TABLE "petshop"."deposit_settlements" DROP CONSTRAINT IF EXISTS "deposit_settlements_source";
--> statement-breakpoint
ALTER TABLE "petshop"."deposit_settlements" ADD CONSTRAINT "deposit_settlements_source"
  CHECK ("source_type" IN ('CASH_DEPOSIT', 'NONCASH_VERIFICATION', 'LEGACY_RUN'));
