-- F2-6e-1 Hitung Kas (spec docs/work/specs/2026-11-12-f2-6e-hitung-kas-design.md §1).
-- Uang nyata Tunai/Rekening pada akhir hari tanggal hitung. Saldo sistem & selisih dibaca web Finance.
-- Tidak diubah/dihapus; salah = batal beralasan. Penyesuaian = satu catatan Arus Kas kategori sistem tertaut.
CREATE TABLE IF NOT EXISTS "petshop"."cash_counts" (
  "id" serial PRIMARY KEY,
  "money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  "counted_on" date NOT NULL,
  "amount" integer NOT NULL,
  "note" text,
  "photo_url" varchar(300),
  "created_by" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "adjustment_cash_flow_entry_id" integer REFERENCES "petshop"."cash_flow_entries"("id"),
  "cancelled_at" timestamp,
  "cancelled_by" integer REFERENCES "petshop"."users"("id"),
  "cancel_reason" text,
  CONSTRAINT "cash_counts_amount" CHECK ("amount" >= 0),
  CONSTRAINT "cash_counts_counted_on" CHECK ("counted_on" >= DATE '2026-11-01'),
  CONSTRAINT "cash_counts_cancel" CHECK (
    ("cancelled_at" IS NULL AND "cancelled_by" IS NULL AND "cancel_reason" IS NULL)
    OR ("cancelled_at" IS NOT NULL AND "cancelled_by" IS NOT NULL AND btrim(coalesce("cancel_reason", '')) <> '')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cash_counts_active_unique"
  ON "petshop"."cash_counts" ("money_place_id", "counted_on") WHERE "cancelled_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_counts_counted_on_idx" ON "petshop"."cash_counts" ("counted_on");
--> statement-breakpoint
-- Laci kasir tidak dihitung di sini (uang laci dihitung per shift). Isi hitungan tidak berubah; yang boleh
-- berubah hanya pembatalan (sekali) dan tautan penyesuaian selama hitungan belum batal.
CREATE OR REPLACE FUNCTION "petshop"."guard_cash_count"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Hitung Kas tidak boleh dihapus; batalkan dengan alasan';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "petshop"."money_places" p WHERE p."id" = NEW."money_place_id" AND p."kind" = 'DRAWER') THEN
      RAISE EXCEPTION 'Laci kasir tidak dihitung di Hitung Kas';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."cancelled_at" IS NOT NULL
     OR (NEW."money_place_id", NEW."counted_on", NEW."amount", NEW."note", NEW."photo_url", NEW."created_by", NEW."created_at")
        IS DISTINCT FROM
        (OLD."money_place_id", OLD."counted_on", OLD."amount", OLD."note", OLD."photo_url", OLD."created_by", OLD."created_at") THEN
    RAISE EXCEPTION 'Hitung Kas tidak boleh diubah; batalkan dengan alasan lalu catat ulang';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "cash_counts_guard" ON "petshop"."cash_counts";
--> statement-breakpoint
CREATE TRIGGER "cash_counts_guard" BEFORE INSERT OR UPDATE OR DELETE ON "petshop"."cash_counts"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."guard_cash_count"();
--> statement-breakpoint
-- Kategori sistem penyesuaian (tidak bisa dipilih langsung di Arus Kas; dibatalkan lewat Hitung Kas).
INSERT INTO "petshop"."cash_flow_categories" ("name", "type", "report_kind", "is_system")
VALUES
  ('Selisih kas kurang', 'EXPENSE', 'COST', true),
  ('Selisih kas lebih', 'INCOME', 'INCOME', true)
ON CONFLICT ("name", "type") DO UPDATE SET "report_kind" = EXCLUDED."report_kind", "is_system" = true;
