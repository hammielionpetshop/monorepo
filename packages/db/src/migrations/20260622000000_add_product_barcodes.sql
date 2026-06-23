CREATE TABLE IF NOT EXISTS petshop.product_barcodes (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES petshop.products(id),
  barcode varchar(50) NOT NULL UNIQUE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON petshop.product_barcodes(product_id);
