-- Fondasi Retur Internal (RI4, docs/work/specs/2026-10-11-retur-internal-design.md): dokumen
-- "Barang Dikembalikan" / "Revisi Harga Beli" untuk kiriman antar cabang (IBT + nota Bulk Sale),
-- baris barangnya, dan buku Saldo Internal per pasangan cabang penerima → pengirim.
-- Hanya MENAMBAH tabel & satu kolom kosong — tidak ada data lama yang diubah.
CREATE TABLE IF NOT EXISTS "petshop"."internal_returns" (
  "id" serial PRIMARY KEY,
  "return_number" varchar(50) NOT NULL UNIQUE,
  "kind" varchar(30) NOT NULL,
  "transfer_id" integer NOT NULL REFERENCES "petshop"."inter_branch_transfers"("id"),
  "sale_transaction_id" integer NOT NULL REFERENCES "petshop"."transactions"("id"),
  "payable_id" integer REFERENCES "petshop"."inter_branch_payables"("id"),
  "request_branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "receiver_branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "sender_branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "reason" varchar(20) NOT NULL,
  "notes" text NOT NULL,
  "source" varchar(10) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "total_value" integer NOT NULL,
  "payable_deduction" integer NOT NULL DEFAULT 0,
  "credit_amount" integer NOT NULL DEFAULT 0,
  "cogs_adjustment" integer NOT NULL DEFAULT 0,
  "payable_payment_id" integer REFERENCES "petshop"."inter_branch_payments"("id"),
  "sale_return_id" uuid REFERENCES "petshop"."returns"("id"),
  "requested_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "requested_at" timestamp NOT NULL DEFAULT now(),
  "resolved_by_id" integer REFERENCES "petshop"."users"("id"),
  "resolved_at" timestamp,
  "rejection_reason" text,
  "cancelled_by_id" integer REFERENCES "petshop"."users"("id"),
  "cancelled_at" timestamp,
  "cancellation_reason" text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_internal_returns_status_receiver" ON "petshop"."internal_returns" ("status", "receiver_branch_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_internal_returns_status_sender" ON "petshop"."internal_returns" ("status", "sender_branch_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_internal_returns_transfer" ON "petshop"."internal_returns" ("transfer_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "petshop"."internal_return_items" (
  "id" serial PRIMARY KEY,
  "internal_return_id" integer NOT NULL REFERENCES "petshop"."internal_returns"("id"),
  "transfer_item_id" integer NOT NULL REFERENCES "petshop"."inter_branch_transfer_items"("id"),
  "sale_item_id" integer REFERENCES "petshop"."transaction_items"("id"),
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id"),
  "uom_id" integer NOT NULL REFERENCES "petshop"."units_of_measure"("id"),
  "qty" integer NOT NULL,
  "old_unit_price" integer NOT NULL,
  "proposed_unit_price" integer,
  "final_unit_price" integer,
  "line_value" integer NOT NULL,
  "cogs" integer,
  "qty_consumed" integer,
  "cogs_adjustment" integer,
  "photo_url" text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_internal_return_items_return" ON "petshop"."internal_return_items" ("internal_return_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_internal_return_items_transfer_item" ON "petshop"."internal_return_items" ("transfer_item_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "petshop"."internal_credit_entries" (
  "id" serial PRIMARY KEY,
  "debtor_branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "creditor_branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "amount" integer NOT NULL,
  "source_type" varchar(20) NOT NULL,
  "internal_return_id" integer REFERENCES "petshop"."internal_returns"("id"),
  "payable_id" integer REFERENCES "petshop"."inter_branch_payables"("id"),
  "payment_id" integer REFERENCES "petshop"."inter_branch_payments"("id"),
  "note" text,
  "created_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_internal_credit_entries_pair" ON "petshop"."internal_credit_entries" ("debtor_branch_id", "creditor_branch_id");
--> statement-breakpoint

-- Penanda baris pembayaran hutang internal yang dibuat otomatis oleh Retur Internal / Saldo
-- Internal (bukan uang kas). NULL = pembayaran biasa — semua baris lama tetap NULL.
ALTER TABLE "petshop"."inter_branch_payments"
  ADD COLUMN IF NOT EXISTS "source_type" varchar(20);
