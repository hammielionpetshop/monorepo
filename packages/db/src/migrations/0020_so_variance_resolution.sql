-- Fase investigasi & resolusi selisih SO Besar (stock_opnames.type = 'FULL'), terpisah
-- dari siklus approve yang sudah ada. Item yang sudah APPROVED dengan varianceQty != 0
-- bisa didisposisikan lebih lanjut: ternyata ketemu (FOUND, stok dikoreksi balik lewat
-- applyManualStockAdjustment), hangus jadi kerugian toko (WRITTEN_OFF), dibebankan ke
-- karyawan sebagian/seluruhnya (EMPLOYEE_CHARGE, sisanya otomatis kerugian toko), atau
-- lebih dengan alasan tertentu (OVERAGE_EXPLAINED). Tidak mengubah/membatalkan approval
-- SO asli — murni lapisan pencatatan tindak lanjut di atasnya.

CREATE TABLE IF NOT EXISTS "petshop"."so_variance_resolutions" (
  "id" serial PRIMARY KEY,
  "so_item_id" integer NOT NULL REFERENCES "petshop"."stock_opname_items"("id"),
  "so_id" integer NOT NULL REFERENCES "petshop"."stock_opnames"("id"),
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "product_id" integer NOT NULL REFERENCES "petshop"."products"("id"),
  "disposition" varchar(20) NOT NULL,
  "variance_qty" integer NOT NULL,
  "variance_cost_value" integer NOT NULL,
  "employee_charged_total" integer NOT NULL DEFAULT 0,
  "note" text NOT NULL,
  "stock_adjustment_id" integer REFERENCES "petshop"."stock_adjustments"("id"),
  "resolved_by_id" integer NOT NULL REFERENCES "petshop"."users"("id"),
  "resolved_at" timestamp NOT NULL DEFAULT now(),
  "voided_at" timestamp,
  "voided_by" integer REFERENCES "petshop"."users"("id"),
  "void_reason" varchar(255),
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Maksimal satu resolusi AKTIF per item — resolusi baru boleh dibuat lagi setelah yang
-- lama di-void.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_so_variance_resolutions_item_active"
  ON "petshop"."so_variance_resolutions" ("so_item_id")
  WHERE "voided_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_so_variance_resolutions_branch_resolved"
  ON "petshop"."so_variance_resolutions" ("branch_id", "resolved_at");

CREATE INDEX IF NOT EXISTS "idx_so_variance_resolutions_disposition"
  ON "petshop"."so_variance_resolutions" ("disposition");

-- employee_name adalah sumber kebenaran (bebas teks): daftar `users` adalah daftar akun
-- login, bukan daftar lengkap seluruh karyawan toko. employee_id cuma link opsional kalau
-- kebetulan cocok dengan user aktif.
CREATE TABLE IF NOT EXISTS "petshop"."so_resolution_employee_charges" (
  "id" serial PRIMARY KEY,
  "resolution_id" integer NOT NULL REFERENCES "petshop"."so_variance_resolutions"("id"),
  "employee_name" varchar(150) NOT NULL,
  "employee_id" integer REFERENCES "petshop"."users"("id"),
  "amount" integer NOT NULL,
  "note" varchar(255),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_so_resolution_employee_charges_resolution"
  ON "petshop"."so_resolution_employee_charges" ("resolution_id");

CREATE INDEX IF NOT EXISTS "idx_so_resolution_employee_charges_name"
  ON "petshop"."so_resolution_employee_charges" (lower("employee_name"));
