-- packages/db/src/migrations/202604181300_phase4_stock_opname.sql

-- 1. stock_opnames adjustments
ALTER TABLE petshop.stock_opnames
  ADD COLUMN shift_id INTEGER REFERENCES petshop.shifts(id),
  ADD COLUMN method VARCHAR(20),
  ADD COLUMN skip_reason TEXT,
  ADD COLUMN is_skipped BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN approved_at TIMESTAMP,
  ADD COLUMN rejected_by_id INTEGER REFERENCES petshop.users(id),
  ADD COLUMN rejected_at TIMESTAMP,
  ADD COLUMN rejection_note TEXT,
  ADD COLUMN notes TEXT;

-- 2. stock_opname_items adjustments
ALTER TABLE petshop.stock_opname_items
  ADD COLUMN variance_cost_value DECIMAL(15,2),
  ADD COLUMN variance_category VARCHAR(20),
  ADD COLUMN is_recounted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN recount_physical_qty DECIMAL(12,2);

-- 3. notifications table
CREATE TABLE petshop.notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  branch_id INTEGER REFERENCES petshop.branches(id),
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
