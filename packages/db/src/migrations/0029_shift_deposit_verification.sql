-- Verifikasi setoran kas shift oleh finance. Settlement hanya memotret angka yang DITULIS
-- kasir; uang yang benar-benar sampai ke finance tidak pernah tercatat, sehingga selisih
-- serah-terima (kasir tulis 2.000.000, finance hitung 1.850.000) tidak terlihat di mana pun.
ALTER TABLE "petshop"."shifts"
  ADD COLUMN IF NOT EXISTS "deposit_received_cash" integer,
  ADD COLUMN IF NOT EXISTS "deposit_variance" integer,
  ADD COLUMN IF NOT EXISTS "deposit_verified_by_id" integer REFERENCES "petshop"."users"("id"),
  ADD COLUMN IF NOT EXISTS "deposit_verified_at" timestamp,
  ADD COLUMN IF NOT EXISTS "deposit_notes" text;
--> statement-breakpoint

-- Disisipkan di sini (bukan lewat seed) karena pipeline deploy hanya menjalankan migrasi.
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES (
  'shift.deposit.verify',
  'Verifikasi Setoran Shift',
  'Mencatat kas setoran shift yang benar-benar diterima finance dan selisihnya terhadap angka kasir'
)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint

INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE r."name" IN ('OWNER', 'GM', 'FINANCE')
  AND p."code" = 'shift.deposit.verify'
ON CONFLICT DO NOTHING;
