-- Batalkan Retur Supplier Luar yang sudah disetujui (RI3b, docs/work/backlog/2026-10-11-retur-internal.md).
-- Dokumen tidak dihapus: status jadi CANCELLED dan pembatal, waktu, serta alasannya dicatat di sini.
-- Status baru lain (WITHDRAWN = pengajuan ditarik pengaju) memakai kolom resolved_* yang sudah ada.
ALTER TABLE "petshop"."supplier_returns"
  ADD COLUMN IF NOT EXISTS "cancelled_by_id" integer REFERENCES "petshop"."users"("id");
--> statement-breakpoint
ALTER TABLE "petshop"."supplier_returns"
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "petshop"."supplier_returns"
  ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
