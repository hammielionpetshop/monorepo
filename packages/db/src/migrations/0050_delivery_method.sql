-- Cara kirim nota & PO Internal (Logistik Tahap 1 bagian kasir, spec
-- docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §2.1, §3.1, §3.2).
-- Nota berpelanggan wajib memilih cara kirim saat bayar: PICKUP (ambil sendiri), BRANCH_COURIER
-- (diantar kurir cabang, alur ongkir yang sudah ada), TRUCK (dikirim truk Gudang). NULL = nota Umum,
-- nota sebelum fitur ini, nota hasil PO Internal, atau saklar fitur dimatikan.
ALTER TABLE "petshop"."transactions" ADD COLUMN IF NOT EXISTS "delivery_method" varchar(20);
--> statement-breakpoint
ALTER TABLE "petshop"."transactions" ADD CONSTRAINT "chk_transactions_delivery_method"
  CHECK ("delivery_method" IS NULL OR "delivery_method" IN ('PICKUP', 'BRANCH_COURIER', 'TRUCK'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_delivery_method" ON "petshop"."transactions" ("delivery_method", "created_at")
  WHERE "delivery_method" IS NOT NULL;
--> statement-breakpoint
-- PO Internal: dipilih saat Kirim. TRUCK (dibawa truk Gudang) / SELF (dikirim sendiri cabang).
ALTER TABLE "petshop"."inter_branch_transfers" ADD COLUMN IF NOT EXISTS "delivery_method" varchar(20);
--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_transfers" ADD CONSTRAINT "chk_inter_branch_transfers_delivery_method"
  CHECK ("delivery_method" IS NULL OR "delivery_method" IN ('TRUCK', 'SELF'));
--> statement-breakpoint
-- Riwayat ubah cara kirim (jalan keluar salah tandai). Tidak pernah diubah/dihapus.
CREATE TABLE IF NOT EXISTS "petshop"."delivery_method_changes" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_type" varchar(20) NOT NULL,
  "document_id" integer NOT NULL,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "old_method" varchar(20),
  "new_method" varchar(20) NOT NULL,
  "reason" text NOT NULL,
  "changed_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_delivery_method_changes_document_type" CHECK ("document_type" IN ('TRANSACTION', 'INTERNAL_TRANSFER')),
  CONSTRAINT "chk_delivery_method_changes_reason" CHECK (btrim("reason") <> '')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_delivery_method_changes_document" ON "petshop"."delivery_method_changes" ("document_type", "document_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "petshop"."reject_delivery_method_change_edit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Riwayat cara kirim tidak boleh diubah atau dihapus';
END $$;
--> statement-breakpoint
CREATE TRIGGER "delivery_method_changes_no_edit" BEFORE UPDATE OR DELETE ON "petshop"."delivery_method_changes"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."reject_delivery_method_change_edit"();
--> statement-breakpoint
-- Pengaturan (saklar Owner/GM): wajib pilih menyala; tombol "Truk Gudang" paling depan di cabang Gudang.
INSERT INTO "petshop"."app_settings" ("key", "value") VALUES ('delivery_method_required', 'true')
  ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."app_settings" ("key", "value")
SELECT 'delivery_truck_first_branch_ids', coalesce(string_agg("id"::text, ',' ORDER BY "id"), '')
FROM "petshop"."branches" WHERE lower(btrim("name")) = 'gudang'
ON CONFLICT ("key") DO NOTHING;
