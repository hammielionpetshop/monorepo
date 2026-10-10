-- Retur ke Supplier: barang yang sudah diterima lalu ketahuan rusak/expired dikembalikan ke
-- supplier. Stok keluar & tagihan PO asal dipotong saat disetujui OWNER/GM; kelebihannya
-- (PO sudah lunas / retur tanpa PO) jadi saldo supplier untuk memotong tagihan berikutnya.
-- Hanya MENAMBAH tabel — tidak ada data lama yang diubah.
CREATE TABLE IF NOT EXISTS "petshop"."supplier_returns" (
  "id" serial PRIMARY KEY,
  "return_number" varchar(50) NOT NULL UNIQUE,
  "supplier_id" integer NOT NULL REFERENCES "petshop"."suppliers"("id"),
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "po_id" integer REFERENCES "petshop"."purchase_orders"("id"),
  "reason" varchar(20) NOT NULL,
  "notes" text NOT NULL,
  "source" varchar(10) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "total_value" integer NOT NULL,
  "total_cogs" integer,
  "payable_deduction" integer NOT NULL DEFAULT 0,
  "credit_amount" integer NOT NULL DEFAULT 0,
  "payable_payment_id" integer REFERENCES "petshop"."supplier_payable_payments"("id"),
  "requested_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "requested_at" timestamp NOT NULL DEFAULT now(),
  "resolved_by_id" integer REFERENCES "petshop"."users"("id"),
  "resolved_at" timestamp,
  "rejection_reason" text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_supplier_returns_status_branch" ON "petshop"."supplier_returns" ("status", "branch_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_supplier_returns_po" ON "petshop"."supplier_returns" ("po_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "petshop"."supplier_return_items" (
  "id" serial PRIMARY KEY,
  "supplier_return_id" integer NOT NULL REFERENCES "petshop"."supplier_returns"("id"),
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id"),
  "uom_id" integer NOT NULL REFERENCES "petshop"."units_of_measure"("id"),
  "po_item_id" integer REFERENCES "petshop"."purchase_order_items"("id"),
  "qty" integer NOT NULL,
  "unit_price" integer NOT NULL,
  "line_value" integer NOT NULL,
  "cogs" integer,
  "photo_url" text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_supplier_return_items_return" ON "petshop"."supplier_return_items" ("supplier_return_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "petshop"."supplier_credit_entries" (
  "id" serial PRIMARY KEY,
  "supplier_id" integer NOT NULL REFERENCES "petshop"."suppliers"("id"),
  "amount" integer NOT NULL,
  "source_type" varchar(20) NOT NULL,
  "supplier_return_id" integer REFERENCES "petshop"."supplier_returns"("id"),
  "payable_payment_id" integer REFERENCES "petshop"."supplier_payable_payments"("id"),
  "note" text,
  "created_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_supplier_credit_entries_supplier" ON "petshop"."supplier_credit_entries" ("supplier_id");
