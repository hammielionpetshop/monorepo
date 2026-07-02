-- Snapshot identitas produk di transaction_items agar histori struk/laporan tidak
-- bergantung pada master produk yang live (aman saat produk di-merge/hapus).
-- product_id dilonggarkan: nullable + ON DELETE SET NULL.

ALTER TABLE petshop.transaction_items
  ADD COLUMN IF NOT EXISTS product_name varchar(255),
  ADD COLUMN IF NOT EXISTS product_sku varchar(50);

-- Backfill snapshot dari master produk saat ini
UPDATE petshop.transaction_items ti
SET product_name = p.name,
    product_sku = p.sku
FROM petshop.products p
WHERE p.id = ti.product_id
  AND ti.product_name IS NULL;

-- product_id boleh NULL (untuk produk yang nantinya benar-benar dihapus)
ALTER TABLE petshop.transaction_items
  ALTER COLUMN product_id DROP NOT NULL;

-- Ganti FK agar ON DELETE SET NULL
ALTER TABLE petshop.transaction_items
  DROP CONSTRAINT IF EXISTS transaction_items_product_id_products_id_fk;

ALTER TABLE petshop.transaction_items
  ADD CONSTRAINT transaction_items_product_id_products_id_fk
  FOREIGN KEY (product_id) REFERENCES petshop.products(id) ON DELETE SET NULL;
