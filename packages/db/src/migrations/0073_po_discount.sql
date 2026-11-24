-- Diskon rupiah atas total PO (permintaan owner 2026-11-25). total_amount = total sesudah diskon;
-- modal barang dan hutang supplier dihitung dengan persentase diskon yang sama (lib/po-discount.ts).
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN IF NOT EXISTS "discount_amount" integer DEFAULT 0 NOT NULL;
