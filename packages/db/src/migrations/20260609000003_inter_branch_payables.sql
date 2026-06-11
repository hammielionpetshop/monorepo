CREATE TABLE petshop.inter_branch_payables (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES petshop.inter_branch_transfers(id),
  debtor_branch_id INTEGER NOT NULL REFERENCES petshop.branches(id),
  creditor_branch_id INTEGER NOT NULL REFERENCES petshop.branches(id),
  total_amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
  notes TEXT,
  due_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE petshop.inter_branch_payments (
  id SERIAL PRIMARY KEY,
  payable_id INTEGER NOT NULL REFERENCES petshop.inter_branch_payables(id),
  amount INTEGER NOT NULL,
  paid_by_user_id INTEGER REFERENCES petshop.users(id),
  reference_number VARCHAR(100),
  notes TEXT,
  paid_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ibp_transfer ON petshop.inter_branch_payables(transfer_id);
CREATE INDEX idx_ibp_debtor ON petshop.inter_branch_payables(debtor_branch_id);
CREATE INDEX idx_ibp_creditor ON petshop.inter_branch_payables(creditor_branch_id);
CREATE INDEX idx_ibp_status ON petshop.inter_branch_payables(status);
