CREATE TABLE IF NOT EXISTS petshop.product_uom_costs (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES petshop.products(id),
  branch_id integer NOT NULL REFERENCES petshop.branches(id),
  uom_id integer NOT NULL REFERENCES petshop.units_of_measure(id),
  cost_price integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT product_uom_costs_unique_product_branch_uom UNIQUE (product_id, branch_id, uom_id)
);
