-- Asal shift: dibuka dari POS oleh kasir, atau dibuka otomatis oleh backoffice.
--
-- Bulk sale wajib menempel ke shift OPEN di cabang transaksi (transactions.shift_id NOT NULL).
-- Untuk Internal PO, cabang transaksinya adalah cabang pengirim — yaitu Gudang, yang tidak
-- pernah menjalankan shift kasir. Akibatnya setiap bulk sale dari Gudang selalu ditolak
-- "Tidak ada shift aktif untuk cabang transaksi".
--
-- Sekarang API bulk sale membuka sendiri shift untuk cabang itu bila belum ada, dan menandainya
-- BACKOFFICE. Penanda ini dipakai agar laporan/settlement bisa membedakannya dari shift kasir:
-- shift backoffice tidak punya modal awal dan tidak ditunggu setoran kasirnya.
--
-- Shift lama semuanya berasal dari POS, jadi default 'POS' sudah benar untuk backfill.

ALTER TABLE "petshop"."shifts" ADD COLUMN IF NOT EXISTS "origin" varchar(20) DEFAULT 'POS' NOT NULL;
