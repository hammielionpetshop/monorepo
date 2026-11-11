-- Batalkan pembayaran manual Utang Internal (spec docs/work/specs/2026-11-11-ibp-payment-cancel-design.md).
-- Pembatalan = baris pembayaran baru `BATAL_BAYAR` bernilai negatif yang menunjuk pembayaran asal.
-- UNIQUE: satu pembayaran hanya bisa dibatalkan sekali.
ALTER TABLE "petshop"."inter_branch_payments"
  ADD COLUMN IF NOT EXISTS "reversal_of_payment_id" integer UNIQUE
    REFERENCES "petshop"."inter_branch_payments"("id");
--> statement-breakpoint
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES ('payable.payment_cancel', 'Batalkan Pembayaran Utang Internal', 'Membatalkan pembayaran manual utang antar cabang, dengan alasan')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE p."code" = 'payable.payment_cancel' AND r."name" IN ('OWNER', 'GM')
ON CONFLICT DO NOTHING;
