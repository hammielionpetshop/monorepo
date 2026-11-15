<!-- tayang: 2026-11-05 23:30 -->
### Added

- **Logistik › Terima Uang**: Finance memeriksa uang trip truk dan antar sendiri **per nota**, dikelompokkan per trip lalu per toko. Tiap nota dipilih **Cocok** atau **Tidak cocok** (ketik jumlah yang benar-benar diterima + catatan). Tab Belum diperiksa (lebih dari 3 hari ditandai merah), Sudah diperiksa, dan Selisih; saringan Semua / Truk / Antar sendiri. Kepala Gudang dan pemegang Uang dari Toko hanya melihat.
- Toko yang membayar sebagian untuk beberapa nota: Finance membagi uangnya per nota sesuai ikatan uang dari driver (saran awal nota paling lama dulu). Lunas cash / transfer dibagi otomatis sesuai tagihan tiap nota saat Terkirim.
- **Selisih**: tunai kurang = **kurang serah** atas nama driver (kenek tidak) atau PJ antar sendiri; ia, Pemilik, dan GM diberi tahu. Ini bahan Potongan Lain HR, gaji tidak dipotong otomatis. Transfer yang tidak masuk bukan tanggung jawab driver dan tetap jadi piutang toko. Uang lebih dari laporan dicatat sebagai lebih serah.
- **Tanda pelunasan POS** per nota yang sudah diperiksa: ✅ sudah masuk POS, ⚠️ baru sebagian, ⏳ belum (merah lebih dari 3 hari), dibaca langsung dari piutang kasir. Tombol Piutang di BO membuka halaman pelanggan. Lunasi uang trip di BO dengan **Bayar per nota**, bukan bayar gabungan.
- Kartu Beranda untuk Finance, Pemilik, dan GM: uang toko belum diperiksa, dan nota yang sudah diperiksa tetapi belum masuk POS.
- Pengaturan **Terima Uang mulai tanggal** (isi awal 5 November 2026).

### Changed

- Cara bayar yang sudah diperiksa di Terima Uang tidak bisa dikoreksi lagi (truk maupun antar sendiri). Batalkan pemeriksaannya dulu: alasan wajib; pemeriksanya sendiri dalam 7 hari, Pemilik / GM kapan saja. Pemeriksaan yang dibatalkan tetap tersimpan.
