-- Jasa (J1, docs/work/specs/2026-10-11-jasa-grooming-design.md). Grooming adalah jasa, bukan
-- barang: tidak punya stok dan tidak punya modal. `product_kind` menandai produknya;
-- `transaction_items.is_service` adalah snapshot saat nota terbit supaya pembalikan (batal nota,
-- retur) tahu baris itu dulu memotong stok atau tidak. Hanya menambah kolom.
ALTER TABLE "petshop"."products"
  ADD COLUMN IF NOT EXISTS "product_kind" varchar(20) DEFAULT 'BARANG' NOT NULL;
--> statement-breakpoint
ALTER TABLE "petshop"."transaction_items"
  ADD COLUMN IF NOT EXISTS "is_service" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- Empat produk grooming (keputusan owner 2026-10-11). Dicocokkan dari nama persisnya supaya
-- barang yang namanya mengandung kata "grooming" (sisir, sampo) tidak ikut. Hotel Cat sengaja
-- TIDAK ditandai — masih pending. Riwayat nota lama, stok minus, dan utang stok lama produk ini
-- tidak diubah.
UPDATE "petshop"."products"
SET "product_kind" = 'JASA_GROOMING'
WHERE upper(trim("name")) IN (
  'GROOMING KUMPLIT (JAMUR&KUTU)',
  'GROOMING KUTU / JAMUR',
  'GROOMING PREMIUM',
  'GROOMING SEHAT'
);
