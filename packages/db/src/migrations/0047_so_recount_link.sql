-- Dokumen "Hitung Ulang" SO Besar: verifikasi pasca-persetujuan yang tertaut ke SO induk.
--
-- Saat owner ragu pada hasil SO Besar yang sudah disetujui, ia membuat dokumen hitung ulang
-- (SO Besar baru, nomor SOR-...) yang menunjuk ke SO induk lewat kolom ini. NULL = SO biasa;
-- terisi = dokumen hitung ulang. Nilainya dikecualikan dari ringkasan nilai selisih di laporan
-- supaya tidak terjumlah sebagai kehilangan baru — ini koreksi salah hitung, bukan kerugian baru.
--
-- Lihat docs/work/specs/2026-10-21-so-hitung-ulang-design.md.

ALTER TABLE "petshop"."stock_opnames"
  ADD COLUMN IF NOT EXISTS "recount_of_so_id" integer REFERENCES "petshop"."stock_opnames"("id");

CREATE INDEX IF NOT EXISTS "idx_stock_opnames_recount_of"
  ON "petshop"."stock_opnames" ("recount_of_so_id")
  WHERE "recount_of_so_id" IS NOT NULL;
