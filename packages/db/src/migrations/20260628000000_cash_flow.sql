CREATE TABLE IF NOT EXISTS petshop.cash_flow_categories (
  id serial PRIMARY KEY,
  name varchar(50) NOT NULL,
  type varchar(10) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT cash_flow_categories_name_type_unique UNIQUE (name, type)
);

CREATE TABLE IF NOT EXISTS petshop.cash_flow_entries (
  id serial PRIMARY KEY,
  type varchar(10) NOT NULL,
  category_id integer NOT NULL REFERENCES petshop.cash_flow_categories(id),
  branch_id integer REFERENCES petshop.branches(id),
  amount integer NOT NULL,
  note varchar(255),
  created_by integer REFERENCES petshop.users(id),
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS cash_flow_entries_branch_created_idx
  ON petshop.cash_flow_entries (branch_id, created_at);
