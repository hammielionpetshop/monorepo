-- Ledger "utang stok" untuk oversell (jual/koreksi nota melebihi stok tercatat). Sebelum ini,
-- kekurangan cuma tercatat di audit_logs (action OVERSELL) dan tidak pernah jadi angka —
-- product_stocks.qty di-floor ke 0, jadi barang masuk berikutnya dianggap 100% stok baru padahal
-- sebagian sebenarnya cuma menutup kekurangan lama. Baris di sini yang menjelaskan kenapa
-- product_stocks.qty sekarang boleh minus (lihat stock-service.ts deductStock/addStock).

CREATE TABLE IF NOT EXISTS "petshop"."stock_shortfalls" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id"),
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "qty_short" integer NOT NULL,
  "qty_remaining" integer NOT NULL,
  "cost_price_per_unit" integer NOT NULL,
  "source_type" varchar(20) NOT NULL,
  "source_transaction_id" integer REFERENCES "petshop"."transactions"("id"),
  "source_transaction_item_id" integer REFERENCES "petshop"."transaction_items"("id"),
  "closed_at" timestamp,
  "written_off_at" timestamp,
  "written_off_by_id" integer REFERENCES "petshop"."users"("id"),
  "write_off_reason" varchar(255),
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Urutan pelunasan FIFO: utang tertua per (cabang, produk) dilunasi duluan oleh barang masuk.
CREATE INDEX IF NOT EXISTS "idx_stock_shortfalls_open_fifo"
  ON "petshop"."stock_shortfalls" ("branch_id", "product_id", "created_at")
  WHERE "closed_at" IS NULL AND "written_off_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_stock_shortfalls_branch_created"
  ON "petshop"."stock_shortfalls" ("branch_id", "created_at");

-- Satu baris per kejadian pelunasan (sebagian/penuh) — satu shortfall bisa dilunasi bertahap
-- lewat beberapa penerimaan PO berbeda. reference_id polimorfik (po_id / so_id /
-- stock_adjustment_id) tanpa FK tunggal, sama seperti audit_logs.record_id.
CREATE TABLE IF NOT EXISTS "petshop"."stock_shortfall_clearings" (
  "id" serial PRIMARY KEY,
  "shortfall_id" integer NOT NULL REFERENCES "petshop"."stock_shortfalls"("id"),
  "qty_cleared" integer NOT NULL,
  "cost_price_at_clearing" integer NOT NULL,
  "reference_type" varchar(20) NOT NULL,
  "reference_id" integer,
  "reversed_at" timestamp,
  "cleared_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_stock_shortfall_clearings_shortfall"
  ON "petshop"."stock_shortfall_clearings" ("shortfall_id");

CREATE INDEX IF NOT EXISTS "idx_stock_shortfall_clearings_reference"
  ON "petshop"."stock_shortfall_clearings" ("reference_type", "reference_id");
