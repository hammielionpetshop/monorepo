### Added

- **Retur ke Supplier** — dokumen baru (nomor `RS-YYYYMMDD-XXXX`) untuk barang yang sudah diterima lalu dikembalikan ke supplier (kadaluarsa, rusak, salah kirim). Bisa diajukan dari POS (Produk → Retur ke Supplier) dan Back Office (Pembelian → Retur ke Supplier). PO asal dipilih dari daftar PO supplier itu (boleh tanpa PO); qty dibatasi sisa yang diterima di PO tersebut. Penjelasan alasan wajib, foto per barang opsional.
- Persetujuan retur oleh Owner/GM di **Permintaan Persetujuan** (antrean "Retur ke Supplier", ikut dihitung di angka menu). Saat disetujui: stok keluar FIFO, tagihan PO asal dipotong (tercatat di riwayat bayar dengan metode RETUR), kelebihannya — atau seluruh nilai retur tanpa PO — masuk **Saldo Supplier**. Retur tanpa PO memakai modal terakhir dan harganya bisa diubah penyetuju. Penolakan wajib beralasan.
- **Saldo Supplier** tampil di Hutang Supplier, dan bisa dipakai lewat pilihan "Bayar dari Saldo Supplier" di jendela Catat Pembayaran (juga dari detail PO).
- Cetak dokumen retur (A4) untuk diserahkan ke supplier/sopir, dari POS maupun Back Office.
- Mutasi Stok & Laporan Stok: jenis mutasi baru "Retur ke Supplier".

### Changed

- Barang Rusak: pilihan tindak lanjut "Retur ke Supplier" dihapus — retur ke supplier sekarang lewat dokumennya sendiri supaya tagihan ikut dipotong dan tidak tercatat dobel.

### Fixed

- Mutasi Stok menampilkan laporan Barang Rusak yang masih menunggu atau sudah ditolak sebagai stok keluar, padahal stoknya tidak pernah dipotong. Sekarang hanya yang disetujui, pada jam disetujui.
- Laba Rugi ikut mengurangi laba dengan laporan Barang Rusak yang ditolak/menunggu. Sekarang hanya yang disetujui (sama dengan laporan rincian barang rusak).
