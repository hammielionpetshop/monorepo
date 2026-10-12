-- Jasa grooming J3a2 (docs/work/specs/2026-10-11-jasa-grooming-design.md, keputusan owner
-- 2026-10-12): delivery antar-jemput, ongkos kirim sebagai jasa, dan pengantar.

-- Satu daftar nama untuk groomer dan pengantar. Yang sudah terdaftar tetap groomer.
ALTER TABLE "petshop"."groomers"
  ADD COLUMN IF NOT EXISTS "is_groomer" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "petshop"."groomers"
  ADD COLUMN IF NOT EXISTS "is_courier" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "petshop"."service_deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "transaction_id" integer NOT NULL REFERENCES "petshop"."transactions"("id"),
  "transaction_item_id" integer NOT NULL REFERENCES "petshop"."transaction_items"("id"),
  "customer_id" integer NOT NULL REFERENCES "petshop"."customers"("id"),
  "courier_id" integer NOT NULL REFERENCES "petshop"."groomers"("id"),
  "address" text NOT NULL,
  "status" varchar(20) DEFAULT 'DIPROSES' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "cancelled_at" timestamp,
  "cancel_source" varchar(10),
  "cancel_reason" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_deliveries_transaction" ON "petshop"."service_deliveries" ("transaction_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_deliveries_transaction_item" ON "petshop"."service_deliveries" ("transaction_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_deliveries_courier" ON "petshop"."service_deliveries" ("courier_id", "created_at");
--> statement-breakpoint

-- Ongkos kirim = jasa (tanpa stok). Dicocokkan dari nama persisnya. Stok minus dan utang stok
-- lamanya dibiarkan (keputusan owner).
UPDATE "petshop"."products"
SET "product_kind" = 'JASA_ONGKIR'
WHERE upper(trim("name")) = 'ONGKIR' AND "product_kind" = 'BARANG';
--> statement-breakpoint

-- Keputusan owner 2026-10-12: harga ongkir Rp 1.000 per satuan, besar ongkir diisi lewat qty
-- (mis. 15 x 1.000). Tiga tarif lama yang disimpan di tingkat harga (Retail/Reseller/Grosir)
-- disamakan menjadi 1.000 — barisnya tidak dihapus. Nota lama tidak berubah (harga di nota
-- adalah salinan saat transaksi).
-- Jejak perubahan harga (harga tidak boleh berubah diam-diam).
INSERT INTO "petshop"."audit_logs" ("action", "table_name", "record_id", "old_data", "new_data")
SELECT 'PRICE_UPDATE', 'product_prices', pp."id"::text,
  json_build_object('productId', pp."product_id", 'branchId', pp."branch_id", 'tierType', pp."tier_type", 'price', pp."price")::text,
  json_build_object('price', 1000, 'source', 'MIGRATION_0040', 'note', 'Ongkir Rp 1.000 per satuan, besar ongkir lewat qty (keputusan owner 2026-10-12)')::text
FROM "petshop"."product_prices" pp
JOIN "petshop"."products" p ON p."id" = pp."product_id"
WHERE p."product_kind" = 'JASA_ONGKIR' AND pp."price" <> 1000;
--> statement-breakpoint
UPDATE "petshop"."product_prices" pp
SET "price" = 1000
FROM "petshop"."products" p
WHERE p."id" = pp."product_id" AND p."product_kind" = 'JASA_ONGKIR' AND pp."price" <> 1000;
