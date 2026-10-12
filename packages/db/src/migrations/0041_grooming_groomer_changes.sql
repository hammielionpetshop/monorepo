-- Jasa grooming J4 (docs/work/specs/2026-10-11-jasa-grooming-design.md): jejak "Ganti Groomer"
-- dan izin Riwayat Grooming / laporan bonus. Hanya menambah tabel & izin.
CREATE TABLE IF NOT EXISTS "petshop"."grooming_groomer_changes" (
  "id" serial PRIMARY KEY NOT NULL,
  "grooming_order_id" integer NOT NULL REFERENCES "petshop"."grooming_orders"("id"),
  "old_groomer_id" integer NOT NULL REFERENCES "petshop"."groomers"("id"),
  "new_groomer_id" integer NOT NULL REFERENCES "petshop"."groomers"("id"),
  "reason" text NOT NULL,
  "changed_by_id" integer REFERENCES "petshop"."users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grooming_groomer_changes_order" ON "petshop"."grooming_groomer_changes" ("grooming_order_id", "created_at");
--> statement-breakpoint

-- Izin dipasang lewat migrasi karena pipeline deploy hanya menjalankan migrasi.
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES
  ('grooming.report.view', 'Lihat Riwayat Grooming & Bonus', 'Melihat Riwayat Grooming dan laporan jasa & bonus groomer / pengantar di Back Office'),
  ('grooming.order.change_groomer', 'Ganti Groomer', 'Mengganti groomer pada catatan grooming yang salah pilih (alasan wajib, berjejak)')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE (p."code" = 'grooming.report.view' AND r."name" IN ('OWNER', 'GM', 'MANAGER'))
   OR (p."code" = 'grooming.order.change_groomer' AND r."name" IN ('OWNER', 'GM'))
ON CONFLICT DO NOTHING;
