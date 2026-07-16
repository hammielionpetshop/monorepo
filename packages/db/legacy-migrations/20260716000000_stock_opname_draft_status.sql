-- Status DRAFT untuk stock opname yang masih dihitung di POS.
--
-- SO Besar dibuat dari backoffice tanpa item, lalu kasir mengisi hitungannya lewat POS.
-- Sebelumnya SO itu langsung berstatus PENDING sehingga nangkring di daftar persetujuan
-- tertulis "0 item", dan kalau ditekan Setujui pasti gagal (SO_HAS_NO_ITEMS).
--
-- Tidak ada DDL: kolom `status` sudah varchar(20), DRAFT hanya nilai baru.
-- Migrasi ini hanya membenahi data lama.

-- SO yang PENDING tapi belum punya item sama sekali = belum dihitung → DRAFT.
-- Dibatasi type FULL: SO Harian dibuat berikut itemnya, jadi PENDING tanpa item
-- pada SO Harian bukan "belum dihitung" melainkan anomali — jangan disentuh di sini.
UPDATE petshop.stock_opnames so
SET status = 'DRAFT'
WHERE so.status = 'PENDING'
  AND so.type = 'FULL'
  AND NOT EXISTS (
    SELECT 1 FROM petshop.stock_opname_items soi WHERE soi.so_id = so.id
  );
