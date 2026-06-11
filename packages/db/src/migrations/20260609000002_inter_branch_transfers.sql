CREATE TABLE petshop.inter_branch_transfers (
  id serial PRIMARY KEY,
  ibt_number varchar(50) NOT NULL UNIQUE,
  source_branch_id integer NOT NULL REFERENCES petshop.branches(id),
  destination_branch_id integer NOT NULL REFERENCES petshop.branches(id),
  requested_by_id integer NOT NULL REFERENCES petshop.users(id),
  approved_by_id integer REFERENCES petshop.users(id),
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  total_transfer_value integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE petshop.inter_branch_transfer_items (
  id serial PRIMARY KEY,
  transfer_id integer NOT NULL REFERENCES petshop.inter_branch_transfers(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES petshop.products(id),
  uom_id integer NOT NULL REFERENCES petshop.units_of_measure(id),
  qty_requested integer NOT NULL,
  qty_shipped integer NOT NULL DEFAULT 0,
  qty_received integer NOT NULL DEFAULT 0,
  cost_price_at_transfer integer NOT NULL DEFAULT 0,
  expiry_date date,
  created_at timestamp NOT NULL DEFAULT now()
);
