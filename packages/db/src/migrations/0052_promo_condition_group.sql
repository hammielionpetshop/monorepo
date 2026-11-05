-- Kelompok campur syarat promo (keputusan owner 2026-11-05): beberapa barang syarat dengan
-- group_no yang sama dihitung bersama — mis. pasir 10 L semua aroma, minimal 3 pcs campur.
-- Semua anggota satu kelompok memakai min_qty dan satuan yang sama (diperiksa mesin promo).
-- NULL = barang syarat biasa (perilaku lama, tiap barang wajib memenuhi jumlah minimalnya sendiri).
ALTER TABLE "petshop"."promo_conditions" ADD COLUMN IF NOT EXISTS "group_no" integer;
