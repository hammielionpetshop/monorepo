-- F2-6f Tutup Bulan (spec docs/work/specs/2026-11-12-f2-6f-tutup-bulan-design.md §1).
-- Owner/GM menutup bulan di web Finance (berurutan, mulai November 2026, hanya bulan yang sudah lewat).
-- Saat ditutup Finance menyimpan salinan Laba Rugi & saldo akhir bulan (snapshot). Tidak ada buka kembali.
-- Sesudah ditutup, catatan uang Back Office bertanggal di bulan itu tidak bisa dicatat atau dibatalkan lagi.
CREATE TABLE IF NOT EXISTS "petshop"."month_closings" (
  "id" serial PRIMARY KEY,
  "month" date NOT NULL,
  "closed_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "closed_at" timestamp NOT NULL DEFAULT now(),
  "with_notes" boolean NOT NULL DEFAULT false,
  "note" text,
  "open_items" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "snapshot" jsonb NOT NULL,
  CONSTRAINT "month_closings_month_unique" UNIQUE ("month"),
  CONSTRAINT "month_closings_month" CHECK (extract(day FROM "month") = 1 AND "month" >= DATE '2026-11-01'),
  CONSTRAINT "month_closings_note" CHECK (NOT "with_notes" OR btrim(coalesce("note", '')) <> '')
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "petshop"."month_is_closed"(d date) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT d IS NOT NULL AND EXISTS (
    SELECT 1 FROM "petshop"."month_closings" c WHERE c."month" = date_trunc('month', d)::date
  );
$$;
--> statement-breakpoint
-- Kode galat HM001 dikenali Back Office (lib/db-errors.ts) agar pesannya sampai ke layar.
CREATE OR REPLACE FUNCTION "petshop"."raise_month_closed"(d date) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  names text[] := ARRAY['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September',
                        'Oktober', 'November', 'Desember'];
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'HM001',
    MESSAGE = format('Bulan %s %s sudah ditutup. Catat di bulan berjalan dan sebut bulan asalnya di catatan.',
                     names[extract(month FROM d)::int], extract(year FROM d)::int);
END;
$$;
--> statement-breakpoint
-- Penutupan tidak diubah/dihapus; bulan ditutup berurutan dan hanya bila sudah lewat (WIB).
CREATE OR REPLACE FUNCTION "petshop"."guard_month_closing"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  this_month date := date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Tutup bulan tidak boleh diubah atau dihapus (tidak ada buka kembali)';
  END IF;
  IF NEW."month" >= this_month THEN
    RAISE EXCEPTION 'Bulan berjalan belum bisa ditutup; tunggu sampai bulannya lewat';
  END IF;
  IF NEW."month" > DATE '2026-11-01'
     AND NOT "petshop"."month_is_closed"((NEW."month" - interval '1 month')::date) THEN
    RAISE EXCEPTION 'Tutup bulan harus berurutan; tutup dulu bulan sebelumnya';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "month_closings_guard" ON "petshop"."month_closings";
--> statement-breakpoint
CREATE TRIGGER "month_closings_guard" BEFORE INSERT OR UPDATE OR DELETE ON "petshop"."month_closings"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_month_closing"();
--> statement-breakpoint
-- Arus Kas: tanggal uang di bulan ditutup selalu dikunci. "Untuk bulan" ditutup dikunci untuk kategori biasa;
-- kategori sistem (bayar Biaya Rutin bulan lalu, dsb.) tetap boleh karena Laba Rugi sudah menghitung tagihannya.
CREATE OR REPLACE FUNCTION "petshop"."guard_cash_flow_month_closed"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  rec "petshop"."cash_flow_entries"%ROWTYPE;
  system_category boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD."cancelled_at" IS NULL AND NEW."cancelled_at" IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN rec := NEW; ELSE rec := OLD; END IF;
  IF "petshop"."month_is_closed"(rec."occurred_on") THEN
    PERFORM "petshop"."raise_month_closed"(rec."occurred_on");
  END IF;
  IF "petshop"."month_is_closed"(rec."for_month") THEN
    SELECT c."is_system" INTO system_category FROM "petshop"."cash_flow_categories" c WHERE c."id" = rec."category_id";
    IF NOT coalesce(system_category, false) THEN
      PERFORM "petshop"."raise_month_closed"(rec."for_month");
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "cash_flow_entries_month_closed" ON "petshop"."cash_flow_entries";
--> statement-breakpoint
CREATE TRIGGER "cash_flow_entries_month_closed" BEFORE INSERT OR UPDATE ON "petshop"."cash_flow_entries"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_cash_flow_month_closed"();
--> statement-breakpoint
-- Pindah Dana: catat & batal dikunci menurut tanggal pindah.
CREATE OR REPLACE FUNCTION "petshop"."guard_money_transfer_month_closed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND "petshop"."month_is_closed"(NEW."occurred_on") THEN
    PERFORM "petshop"."raise_month_closed"(NEW."occurred_on");
  END IF;
  IF TG_OP = 'UPDATE' AND "petshop"."month_is_closed"(OLD."occurred_on") THEN
    PERFORM "petshop"."raise_month_closed"(OLD."occurred_on");
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "money_transfers_month_closed" ON "petshop"."money_transfers";
--> statement-breakpoint
CREATE TRIGGER "money_transfers_month_closed" BEFORE INSERT OR UPDATE ON "petshop"."money_transfers"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_money_transfer_month_closed"();
--> statement-breakpoint
-- Hitung Kas: catat, batal, dan penyesuaian dikunci menurut tanggal hitung.
CREATE OR REPLACE FUNCTION "petshop"."guard_cash_count_month_closed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND "petshop"."month_is_closed"(NEW."counted_on") THEN
    PERFORM "petshop"."raise_month_closed"(NEW."counted_on");
  END IF;
  IF TG_OP = 'UPDATE' AND "petshop"."month_is_closed"(OLD."counted_on") THEN
    PERFORM "petshop"."raise_month_closed"(OLD."counted_on");
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "cash_counts_month_closed" ON "petshop"."cash_counts";
--> statement-breakpoint
CREATE TRIGGER "cash_counts_month_closed" BEFORE INSERT OR UPDATE ON "petshop"."cash_counts"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_cash_count_month_closed"();
--> statement-breakpoint
-- Aset: beli & batal dikunci menurut tanggal beli; Rusak/Hilang/Dijual menurut tanggal kejadiannya.
CREATE OR REPLACE FUNCTION "petshop"."guard_fixed_asset_month_closed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF "petshop"."month_is_closed"(NEW."purchased_on") THEN
      PERFORM "petshop"."raise_month_closed"(NEW."purchased_on");
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."cancelled_at" IS NULL AND NEW."cancelled_at" IS NOT NULL THEN
    IF "petshop"."month_is_closed"(OLD."purchased_on") THEN
      PERFORM "petshop"."raise_month_closed"(OLD."purchased_on");
    END IF;
    IF "petshop"."month_is_closed"(OLD."disposed_on") THEN
      PERFORM "petshop"."raise_month_closed"(OLD."disposed_on");
    END IF;
  END IF;
  IF NEW."disposed_on" IS DISTINCT FROM OLD."disposed_on" AND "petshop"."month_is_closed"(NEW."disposed_on") THEN
    PERFORM "petshop"."raise_month_closed"(NEW."disposed_on");
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "fixed_assets_month_closed" ON "petshop"."fixed_assets";
--> statement-breakpoint
CREATE TRIGGER "fixed_assets_month_closed" BEFORE INSERT OR UPDATE ON "petshop"."fixed_assets"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_fixed_asset_month_closed"();
--> statement-breakpoint
-- Saldo awal (per 1 November 2026): terkunci begitu November ditutup.
CREATE OR REPLACE FUNCTION "petshop"."guard_opening_balance_month_closed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF "petshop"."month_is_closed"(CASE WHEN TG_OP = 'INSERT' THEN NEW."as_of" ELSE OLD."as_of" END) THEN
    PERFORM "petshop"."raise_month_closed"(CASE WHEN TG_OP = 'INSERT' THEN NEW."as_of" ELSE OLD."as_of" END);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "money_place_opening_balances_month_closed" ON "petshop"."money_place_opening_balances";
--> statement-breakpoint
CREATE TRIGGER "money_place_opening_balances_month_closed" BEFORE INSERT OR UPDATE ON "petshop"."money_place_opening_balances"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_opening_balance_month_closed"();
