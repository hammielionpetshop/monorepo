-- Retur memotong piutang pelanggan.
--
-- Sebelumnya `processRetur` hanya menulis returns/return_items, mengembalikan stok, dan
-- menulis audit log. `customer_debts` tidak pernah disentuh sama sekali — sehingga pelanggan
-- kredit yang mengembalikan barang tetap ditagih penuh atas barang yang sudah dia kembalikan.
--
-- Void dan koreksi transaksi sudah lama menangani ini (void-service menandai hutangnya VOIDED,
-- transaction-edit-service menghitung ulang total/sisanya). Retur satu-satunya yang terlewat,
-- padahal koreksi transaksi justru MENGARAHKAN ke retur begitu shift ditutup
-- ("Shift sudah ditutup ... Gunakan retur untuk penyesuaian").
--
-- Kenapa kolomnya perlu disimpan, bukan dihitung ulang saat pembatalan retur: antara retur
-- diproses dan retur dibatalkan, hutangnya bisa saja sudah menerima pembayaran, sudah dipotong
-- retur lain, atau transaksinya sudah di-void. Menghitung ulang "berapa yang tadi dipotong"
-- dari keadaan sekarang akan menebak, dan tebakan yang salah di sini artinya angka piutang
-- pelanggan yang salah. Yang dicatat adalah angka yang BENAR-BENAR dipotong saat itu.
--
-- Nilainya selalu <= total_refund_amount. Selisihnya (refund yang tidak menemui sisa hutang)
-- adalah uang tunai yang harus dikembalikan ke pelanggan secara manual — sama seperti perilaku
-- retur tunai selama ini, dan memang tidak dicatat di tabel ini.
--
-- Baris lama di-backfill 0, bukan ditebak dari nilai retur: retur-retur itu memang tidak pernah
-- memotong hutang apa pun, jadi 0 adalah catatan yang jujur tentang apa yang terjadi. Piutang
-- yang terlanjur kelebihan tagih karenanya harus dikoreksi manual — daftarnya bisa dicari lewat
-- retur yang transaksinya punya baris di customer_debts.

ALTER TABLE "petshop"."returns"
  ADD COLUMN IF NOT EXISTS "debt_reduction_amount" integer DEFAULT 0 NOT NULL;
