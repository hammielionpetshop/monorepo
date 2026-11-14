-- F2-6f-3 Koreksi bulan lalu (spec docs/work/specs/2026-11-12-f2-6f-tutup-bulan-design.md §5).
-- Kesalahan di bulan yang sudah ditutup (lupa catat, salah catat) dicatat di Arus Kas dengan tanggal uang di bulan
-- terbuka dan "Untuk bulan" = bulan asal yang sudah ditutup, beralasan. Laba Rugi bulan asal disajikan kembali;
-- Laba Rugi bulan berjalan tidak berubah (PSAK 25 / IAS 8).
ALTER TABLE "petshop"."cash_flow_entries" ADD COLUMN IF NOT EXISTS "correction_reason" text;
--> statement-breakpoint
ALTER TABLE "petshop"."cash_flow_entries" DROP CONSTRAINT IF EXISTS "cash_flow_entries_correction";
--> statement-breakpoint
ALTER TABLE "petshop"."cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_correction" CHECK (
  "correction_reason" IS NULL
  OR (length(btrim("correction_reason")) >= 5 AND "for_month" < date_trunc('month', "occurred_on")::date)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "petshop"."raise_month_closed"(d date) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  names text[] := ARRAY['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September',
                        'Oktober', 'November', 'Desember'];
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'HM001',
    MESSAGE = format('Bulan %s %s sudah ditutup. Catat di bulan berjalan; biaya/pendapatan bulan itu yang terlewat dicatat sebagai Koreksi bulan lalu di Pendapatan & Pengeluaran.',
                     names[extract(month FROM d)::int], extract(year FROM d)::int);
END;
$$;
--> statement-breakpoint
-- Arus Kas: tanggal uang di bulan ditutup selalu dikunci. "Untuk bulan" ditutup hanya boleh untuk kategori sistem
-- (Laba Rugi sudah menghitung tagihannya) atau Koreksi bulan lalu. Koreksi harus ke bulan yang sudah ditutup (HM002).
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
  IF rec."correction_reason" IS NOT NULL THEN
    IF TG_OP = 'INSERT' AND NOT "petshop"."month_is_closed"(rec."for_month") THEN
      RAISE EXCEPTION USING
        ERRCODE = 'HM002',
        MESSAGE = 'Koreksi bulan lalu hanya untuk bulan yang sudah ditutup. Bulan ini belum ditutup: catat biasa dengan Untuk bulan tersebut.';
    END IF;
    RETURN NEW;
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
