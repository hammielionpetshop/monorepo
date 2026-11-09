-- F2-4b Arus Kas dirapikan (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §3).
-- Catatan: tanggal uang, untuk bulan, Tempat Uang, foto bukti, pembatalan beralasan (tanpa ubah/hapus).
-- Kategori: jenis laporan (Biaya / Bukan biaya / Pendapatan lain / Bukan pendapatan), aktif, sistem,
-- hanya Owner, catatan wajib; daftar bawaan; sambungan kategori Pengeluaran Kasir ke kategori Arus Kas.
ALTER TABLE "petshop"."cash_flow_entries"
  ADD COLUMN IF NOT EXISTS "occurred_on" date,
  ADD COLUMN IF NOT EXISTS "for_month" date,
  ADD COLUMN IF NOT EXISTS "money_place_id" integer REFERENCES "petshop"."money_places"("id"),
  ADD COLUMN IF NOT EXISTS "proof_photo_url" text,
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp,
  ADD COLUMN IF NOT EXISTS "cancelled_by" integer REFERENCES "petshop"."users"("id"),
  ADD COLUMN IF NOT EXISTS "cancel_reason" text;
--> statement-breakpoint
-- Catatan lama: tanggal uang & untuk bulan dari tanggal simpannya (WIB); Tempat Uang "belum diketahui".
UPDATE "petshop"."cash_flow_entries"
SET "occurred_on" = (("created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date
WHERE "occurred_on" IS NULL;
--> statement-breakpoint
UPDATE "petshop"."cash_flow_entries"
SET "for_month" = date_trunc('month', "occurred_on")::date
WHERE "for_month" IS NULL;
--> statement-breakpoint
ALTER TABLE "petshop"."cash_flow_entries"
  ALTER COLUMN "occurred_on" SET DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  ALTER COLUMN "occurred_on" SET NOT NULL,
  ALTER COLUMN "for_month" SET DEFAULT (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta')::date),
  ALTER COLUMN "for_month" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "petshop"."cash_flow_entries"
  ADD CONSTRAINT "cash_flow_entries_for_month_first_day" CHECK (extract(day FROM "for_month") = 1),
  ADD CONSTRAINT "cash_flow_entries_cancel" CHECK (
    ("cancelled_at" IS NULL AND "cancelled_by" IS NULL AND "cancel_reason" IS NULL)
    OR ("cancelled_at" IS NOT NULL AND "cancelled_by" IS NOT NULL AND btrim(coalesce("cancel_reason", '')) <> '')
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cash_flow_entries_occurred" ON "petshop"."cash_flow_entries" ("occurred_on");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cash_flow_entries_money_place" ON "petshop"."cash_flow_entries" ("money_place_id");
--> statement-breakpoint
-- Catatan Arus Kas tidak dihapus dan tidak diubah; yang boleh hanya mengisi pembatalan satu kali.
CREATE OR REPLACE FUNCTION "petshop"."guard_cash_flow_entry_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Catatan Arus Kas tidak boleh dihapus; batalkan dengan alasan';
  END IF;
  IF OLD."cancelled_at" IS NOT NULL
     OR NEW."cancelled_at" IS NULL
     OR (NEW."type", NEW."category_id", NEW."branch_id", NEW."amount", NEW."note", NEW."created_by", NEW."created_at",
         NEW."occurred_on", NEW."for_month", NEW."money_place_id", NEW."proof_photo_url")
        IS DISTINCT FROM
        (OLD."type", OLD."category_id", OLD."branch_id", OLD."amount", OLD."note", OLD."created_by", OLD."created_at",
         OLD."occurred_on", OLD."for_month", OLD."money_place_id", OLD."proof_photo_url") THEN
    RAISE EXCEPTION 'Catatan Arus Kas tidak boleh diubah; batalkan dengan alasan lalu catat ulang';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "cash_flow_entries_guard" ON "petshop"."cash_flow_entries";
--> statement-breakpoint
CREATE TRIGGER "cash_flow_entries_guard" BEFORE UPDATE OR DELETE ON "petshop"."cash_flow_entries"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_cash_flow_entry_change"();
--> statement-breakpoint
-- Kategori. report_kind NULL = "jenis belum dipilih" (kategori lama; Owner memilihnya di layar Kategori).
ALTER TABLE "petshop"."cash_flow_categories"
  ADD COLUMN IF NOT EXISTS "report_kind" varchar(12),
  ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "owner_only" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "note_required" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "petshop"."cash_flow_categories"
  ADD CONSTRAINT "cash_flow_categories_report_kind" CHECK (
    "report_kind" IS NULL
    OR ("type" = 'EXPENSE' AND "report_kind" IN ('COST', 'NON_COST'))
    OR ("type" = 'INCOME' AND "report_kind" IN ('INCOME', 'NON_INCOME'))
  );
--> statement-breakpoint
-- Dua kategori otomatis dari bayar utang internal manual: sistem, bukan biaya / bukan pendapatan.
UPDATE "petshop"."cash_flow_categories"
SET "is_system" = true, "report_kind" = CASE "type" WHEN 'EXPENSE' THEN 'NON_COST' ELSE 'NON_INCOME' END
WHERE ("name", "type") IN (('Bayar Hutang Internal', 'EXPENSE'), ('Terima Piutang Internal', 'INCOME'));
--> statement-breakpoint
-- Daftar bawaan (disetujui owner 2026-11-09). Nama yang sudah ada tidak digandakan.
INSERT INTO "petshop"."cash_flow_categories" ("name", "type", "report_kind", "owner_only", "note_required")
VALUES
  ('Listrik', 'EXPENSE', 'COST', false, false),
  ('Air/PDAM', 'EXPENSE', 'COST', false, false),
  ('Internet & pulsa', 'EXPENSE', 'COST', false, false),
  ('Perbaikan & perawatan', 'EXPENSE', 'COST', false, false),
  ('Perlengkapan toko & kebersihan', 'EXPENSE', 'COST', false, false),
  ('Alat tulis & cetak', 'EXPENSE', 'COST', false, false),
  ('Konsumsi karyawan', 'EXPENSE', 'COST', false, false),
  ('Parkir, tol & ongkos jalan', 'EXPENSE', 'COST', false, false),
  ('Kebutuhan hewan & grooming', 'EXPENSE', 'COST', false, false),
  ('Biaya bank', 'EXPENSE', 'COST', false, false),
  ('Iuran & retribusi', 'EXPENSE', 'COST', false, false),
  ('Pajak', 'EXPENSE', 'COST', false, false),
  ('Bantuan karyawan', 'EXPENSE', 'COST', false, false),
  ('Sewa (sementara)', 'EXPENSE', 'COST', false, false),
  ('Pengeluaran lain', 'EXPENSE', 'COST', false, true),
  ('Diambil Owner / pribadi', 'EXPENSE', 'NON_COST', true, false),
  ('Bayar cicilan pinjaman', 'EXPENSE', 'NON_COST', false, false),
  ('Rebate/cashback supplier', 'INCOME', 'INCOME', false, false),
  ('Jual barang bekas', 'INCOME', 'INCOME', false, false),
  ('Modal masuk dari Owner', 'INCOME', 'NON_INCOME', false, false),
  ('Pinjaman masuk', 'INCOME', 'NON_INCOME', false, false),
  ('Pemasukan lain', 'INCOME', 'INCOME', false, true)
ON CONFLICT ("name", "type") DO NOTHING;
--> statement-breakpoint
-- Kategori Pengeluaran Kasir disambungkan ke satu kategori Arus Kas (tampilan kasir tidak berubah).
ALTER TABLE "petshop"."expense_categories"
  ADD COLUMN IF NOT EXISTS "cash_flow_category_id" integer REFERENCES "petshop"."cash_flow_categories"("id");
--> statement-breakpoint
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES
  ('cashflow.record', 'Catat Arus Kas', 'Mencatat uang masuk/keluar di Arus Kas dan Pindah Dana (semua cabang)'),
  ('cashflow.cancel', 'Batalkan Catatan Arus Kas', 'Membatalkan catatan Arus Kas orang lain atau hari sebelumnya, dengan alasan')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE (p."code" = 'cashflow.record' AND r."name" IN ('OWNER', 'GM', 'FINANCE'))
   OR (p."code" = 'cashflow.cancel' AND r."name" IN ('OWNER', 'GM'))
ON CONFLICT DO NOTHING;
