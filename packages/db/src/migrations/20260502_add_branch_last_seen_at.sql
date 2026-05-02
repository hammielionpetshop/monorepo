-- packages/db/src/migrations/20260502_add_branch_last_seen_at.sql
ALTER TABLE petshop.branches ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
