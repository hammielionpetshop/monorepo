-- Supplier aktif/nonaktif (RI1, docs/work/backlog/2026-10-11-retur-internal.md). Supplier tidak
-- pernah dihapus kalau sudah punya riwayat — cukup dinonaktifkan supaya tidak muncul di pilihan
-- dokumen BARU (PO baru, Retur Supplier Luar). Dokumen lama tetap menampilkan namanya.
ALTER TABLE "petshop"."suppliers"
  ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint

-- Data bawaan sistem lama yang bukan supplier luar (keputusan owner 2026-10-11, lihat
-- docs/glosarium-bisnis.md): "Gudang" (pasokan Gudang kini lewat PO Internal/IBT), "Repack"
-- (dulu pemecahan SAK→PCS), "Return" (dulu kumpulan barang retur).
UPDATE "petshop"."suppliers"
SET "is_active" = false
WHERE lower(trim("name")) IN ('gudang', 'repack', 'return');
