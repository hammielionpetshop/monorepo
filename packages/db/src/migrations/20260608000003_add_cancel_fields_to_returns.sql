ALTER TABLE petshop.returns
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_by_id INTEGER REFERENCES petshop.users(id),
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
