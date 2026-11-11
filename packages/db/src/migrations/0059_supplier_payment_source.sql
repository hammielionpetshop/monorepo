-- F2-4a "Dibayar dari" di Bayar Hutang Supplier (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §2).
-- Tempat Uang asal setiap pembayaran supplier yang memakai uang. Kosong = pembayaran lama ("belum diketahui")
-- atau metode sistem tanpa uang (Retur, Saldo Supplier, Retur Batal). Tidak ada pengisian data lama.
ALTER TABLE "petshop"."supplier_payable_payments"
  ADD COLUMN IF NOT EXISTS "money_place_id" integer REFERENCES "petshop"."money_places"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_payable_payments_money_place"
  ON "petshop"."supplier_payable_payments" ("money_place_id");
