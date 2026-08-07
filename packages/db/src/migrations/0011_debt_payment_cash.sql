-- Pelunasan piutang masuk ke kas/shift.
--
-- Sebelumnya pelunasan hutang hanya menambah paid_amount di customer_debts dan berhenti di situ:
-- uang tunai yang diterima kasir tidak pernah tercatat di shift manapun, sehingga saat settlement
-- uang itu muncul sebagai kelebihan kas tanpa asal-usul.
--
-- branch_id: cabang penerima uang, dibackfill dari customer_debts.branch_id. Tetap nullable karena
-- ada hutang lama yang branch_id-nya sendiri masih NULL — biarkan NULL daripada menebak cabang.
-- shift_id: shift tempat uang tunai masuk laci. NULL untuk pelunasan non-tunai atau data lama.
--
-- Omzet TIDAK ikut berubah: penjualan hutang sudah diakui sebagai pendapatan saat transaksi dibuat.
-- Kolom ini murni untuk pelacakan kas, bukan pengakuan pendapatan kedua kali.

ALTER TABLE "petshop"."debt_payments" ADD COLUMN IF NOT EXISTS "branch_id" integer;
ALTER TABLE "petshop"."debt_payments" ADD COLUMN IF NOT EXISTS "shift_id" integer;

DO $$ BEGIN
  ALTER TABLE "petshop"."debt_payments"
    ADD CONSTRAINT "debt_payments_branch_id_branches_id_fk"
    FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "petshop"."debt_payments"
    ADD CONSTRAINT "debt_payments_shift_id_shifts_id_fk"
    FOREIGN KEY ("shift_id") REFERENCES "petshop"."shifts"("id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE "petshop"."debt_payments" dp
SET "branch_id" = cd."branch_id"
FROM "petshop"."customer_debts" cd
WHERE dp."debt_id" = cd."id"
  AND dp."branch_id" IS NULL
  AND cd."branch_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_debt_payments_shift" ON "petshop"."debt_payments" ("shift_id");
CREATE INDEX IF NOT EXISTS "idx_debt_payments_branch_created" ON "petshop"."debt_payments" ("branch_id","created_at");
