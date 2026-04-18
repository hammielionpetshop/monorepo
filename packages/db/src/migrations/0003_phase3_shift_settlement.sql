-- 1. Add cashierId to transactions
ALTER TABLE petshop.transactions
  ADD COLUMN cashier_id INTEGER REFERENCES petshop.users(id);

UPDATE petshop.transactions t
  SET cashier_id = s.opened_by_id
  FROM petshop.shifts s
  WHERE t.shift_id = s.id AND t.cashier_id IS NULL;

ALTER TABLE petshop.transactions
  ALTER COLUMN cashier_id SET NOT NULL;

-- 2. Update shifts table
ALTER TABLE petshop.shifts
  ADD COLUMN shift_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN assigned_cashiers JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN target_end_time TIMESTAMP,
  ADD COLUMN total_closing_cash_real DECIMAL(12,2),
  ADD COLUMN total_variance DECIMAL(12,2),
  ADD COLUMN settlement_notes TEXT,
  ADD COLUMN force_closed_by_id INTEGER REFERENCES petshop.users(id),
  ADD COLUMN force_closed_at TIMESTAMP;

ALTER TABLE petshop.shifts
  RENAME COLUMN expected_cash TO total_closing_cash_expected;

-- 3. Drop & recreate shift_cashier_breakdown
DROP TABLE IF EXISTS petshop.shift_cashier_breakdown;

CREATE TABLE petshop.shift_cashier_breakdown (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES petshop.shifts(id),
  cashier_id INTEGER NOT NULL REFERENCES petshop.users(id),
  total_sales_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales_qris DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales_debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales_credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales_debt DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
  modal_share DECIMAL(12,2),
  expected_cash DECIMAL(12,2),
  real_cash DECIMAL(12,2),
  variance DECIMAL(12,2),
  is_variance_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(shift_id, cashier_id)
);

-- 4. Update shift_expenses
ALTER TABLE petshop.shift_expenses
  ADD COLUMN category_custom VARCHAR(100),
  ALTER COLUMN category_id DROP NOT NULL;

-- 5. New table: shift_cashier_sessions
CREATE TABLE petshop.shift_cashier_sessions (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES petshop.shifts(id),
  cashier_id INTEGER NOT NULL REFERENCES petshop.users(id),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX idx_cashier_sessions_shift ON petshop.shift_cashier_sessions(shift_id);
CREATE INDEX idx_cashier_sessions_cashier ON petshop.shift_cashier_sessions(cashier_id, status);
