ALTER TABLE petshop.purchase_orders
  ADD COLUMN po_type varchar(20) NOT NULL DEFAULT 'EXTERNAL',
  ADD COLUMN source_branch_id integer REFERENCES petshop.branches(id);

ALTER TABLE petshop.purchase_orders
  ALTER COLUMN supplier_id DROP NOT NULL;
