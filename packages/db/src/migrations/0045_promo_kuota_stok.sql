-- Kuota & syarat stok promo (P3a, docs/work/specs/2026-10-12-promo-otomatis-design.md bagian
-- "Keputusan owner 2026-10-18"). Hanya menambah kolom & tabel; aturannya dihitung mesin promo
-- (lib/promo/promo-engine.ts). Kuota dihitung terpisah tiap cabang (jatah tidak dicampur).
ALTER TABLE "petshop"."promos" ADD COLUMN IF NOT EXISTS "quota_kind" varchar(10);
--> statement-breakpoint
ALTER TABLE "petshop"."promos" ADD COLUMN IF NOT EXISTS "quota_per_branch" integer;
--> statement-breakpoint
ALTER TABLE "petshop"."promos" ADD COLUMN IF NOT EXISTS "require_stock" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "petshop"."promos" ADD CONSTRAINT "chk_promos_quota" CHECK (
  ("quota_kind" IS NULL AND "quota_per_branch" IS NULL)
  OR ("quota_kind" IN ('PCS', 'NOTA') AND "quota_per_branch" IS NOT NULL AND "quota_per_branch" > 0)
);
--> statement-breakpoint
-- Pemakaian kuota per cabang: bertambah saat simpan nota, berkurang saat batal nota (retur tidak).
CREATE TABLE IF NOT EXISTS "petshop"."promo_branch_usage" (
  "promo_id" integer NOT NULL REFERENCES "petshop"."promos"("id"),
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "used_pcs" integer DEFAULT 0 NOT NULL,
  "used_notes" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "promo_branch_usage_pk" PRIMARY KEY ("promo_id", "branch_id"),
  CONSTRAINT "chk_promo_branch_usage_nonneg" CHECK ("used_pcs" >= 0 AND "used_notes" >= 0)
);
