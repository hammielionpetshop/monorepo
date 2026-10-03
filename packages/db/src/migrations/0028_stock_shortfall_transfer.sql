ALTER TABLE petshop.stock_shortfalls
  ADD COLUMN source_transfer_id integer REFERENCES petshop.inter_branch_transfers(id),
  ADD COLUMN source_transfer_item_id integer REFERENCES petshop.inter_branch_transfer_items(id);
