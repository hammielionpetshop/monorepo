-- Grup paket promo untuk retur utuh (P4a, docs/work/specs/2026-10-12-promo-otomatis-design.md
-- bagian "Keputusan owner 2026-10-18 — Beli X gratis Y & bundling"). Satu kali pakai promo paket
-- (beli X gratis Y / bundling) menandai baris syarat + baris hadiahnya dengan nomor yang sama per
-- nota, supaya retur hanya boleh satu paket utuh. NULL = baris bukan bagian paket (returnya biasa).
ALTER TABLE "petshop"."transaction_items" ADD COLUMN IF NOT EXISTS "promo_package_no" integer;
