-- F2-1a Tempat Uang (spec docs/work/specs/2026-11-08-f2-1-tempat-uang-design.md).
CREATE TABLE IF NOT EXISTS "petshop"."money_places" (
  "id" serial PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "kind" varchar(10) NOT NULL,
  -- CASCADE hanya agar cabang yang belum pernah dipakai (mis. data tes) bisa dihapus bersama lacinya;
  -- Tempat Uang lain tetap menahan penghapusan cabang lewat trigger di bawah.
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id") ON DELETE CASCADE,
  "bank_name" varchar(50),
  "account_number" varchar(50),
  "account_holder" varchar(100),
  "held_by" varchar(10) NOT NULL DEFAULT 'FINANCE',
  "holder_note" varchar(100),
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "created_by" integer REFERENCES "petshop"."users"("id"),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" integer REFERENCES "petshop"."users"("id"),
  CONSTRAINT "money_places_kind" CHECK ("kind" IN ('DRAWER', 'CASH', 'BANK')),
  CONSTRAINT "money_places_held_by" CHECK ("held_by" IN ('FINANCE', 'STORE', 'OTHER')),
  CONSTRAINT "money_places_name_not_blank" CHECK (btrim("name") <> ''),
  -- Rekening wajib bank + nomor; jenis lain tidak menyimpan isian rekening.
  CONSTRAINT "money_places_bank_fields" CHECK (
    ("kind" = 'BANK' AND nullif(btrim("bank_name"), '') IS NOT NULL AND nullif(btrim("account_number"), '') IS NOT NULL)
    OR ("kind" <> 'BANK' AND "bank_name" IS NULL AND "account_number" IS NULL AND "account_holder" IS NULL)
  ),
  -- Laci kasir dipegang toko (tanggung jawabnya mengikuti shift POS).
  CONSTRAINT "money_places_drawer_store" CHECK ("kind" <> 'DRAWER' OR "held_by" = 'STORE')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_money_places_name" ON "petshop"."money_places" (lower("name")) WHERE "kind" <> 'DRAWER';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_money_places_drawer_branch" ON "petshop"."money_places" ("branch_id") WHERE "kind" = 'DRAWER';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_money_places_branch" ON "petshop"."money_places" ("branch_id");
--> statement-breakpoint
-- Tempat Uang tidak pernah dihapus (catatan uang menunjuk ke sana); cukup dinonaktifkan.
CREATE OR REPLACE FUNCTION "petshop"."reject_money_place_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Laci ikut terhapus hanya bila cabangnya sendiri sedang dihapus (FK CASCADE).
  IF OLD."kind" = 'DRAWER' AND NOT EXISTS (SELECT 1 FROM "petshop"."branches" b WHERE b."id" = OLD."branch_id") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Tempat Uang tidak boleh dihapus; nonaktifkan saja';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "money_places_no_delete" BEFORE DELETE ON "petshop"."money_places"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."reject_money_place_delete"();
--> statement-breakpoint
-- Laci kasir mengikuti cabang: dibuat saat cabang dibuat, namanya ikut bila cabang diganti nama.
CREATE OR REPLACE FUNCTION "petshop"."sync_branch_drawer"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "petshop"."money_places" ("name", "kind", "branch_id", "held_by")
    VALUES ('Laci Kasir ' || NEW."name", 'DRAWER', NEW."id", 'STORE')
    ON CONFLICT DO NOTHING;
  ELSIF NEW."name" IS DISTINCT FROM OLD."name" THEN
    UPDATE "petshop"."money_places" SET "name" = 'Laci Kasir ' || NEW."name", "updated_at" = now()
    WHERE "branch_id" = NEW."id" AND "kind" = 'DRAWER';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "branches_sync_drawer" AFTER INSERT OR UPDATE OF "name" ON "petshop"."branches"
  FOR EACH ROW EXECUTE FUNCTION "petshop"."sync_branch_drawer"();
--> statement-breakpoint
INSERT INTO "petshop"."money_places" ("name", "kind", "branch_id", "held_by")
SELECT 'Laci Kasir ' || b."name", 'DRAWER', b."id", 'STORE' FROM "petshop"."branches" b
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."payment_method_money_places" (
  "payment_method_id" integer NOT NULL REFERENCES "petshop"."payment_methods"("id") ON DELETE CASCADE,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id") ON DELETE CASCADE,
  "money_place_id" integer NOT NULL REFERENCES "petshop"."money_places"("id"),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" integer REFERENCES "petshop"."users"("id"),
  PRIMARY KEY ("payment_method_id", "branch_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_method_money_places_place" ON "petshop"."payment_method_money_places" ("money_place_id");
--> statement-breakpoint
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES
  ('money_place.read', 'Lihat Tempat Uang', 'Melihat daftar Tempat Uang dan tautan metode bayar per cabang'),
  ('money_place.manage', 'Kelola Tempat Uang', 'Menambah, mengubah, menonaktifkan Tempat Uang dan menautkan metode bayar per cabang')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE p."code" IN ('money_place.read', 'money_place.manage') AND r."name" IN ('OWNER', 'GM', 'FINANCE')
ON CONFLICT DO NOTHING;
