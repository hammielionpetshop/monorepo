<!-- tayang: 2026-11-06 02:15 -->
### Added

- Laporan Bongkaran: langkah pertama kini memilih **asal barang**. **Barang datang dulu** (PO belum dibuat) → saat laporan disimpan, **Draft PO otomatis dibuat di kasir** beserta foto surat jalannya; kantor tinggal memeriksa, mengisi harga, menyetujui, lalu menerima barang. **Dari PO yang ada** → barang dan jumlah terisi dari PO; jumlah yang berbeda ditandai **Selisih dengan PO**.
- Rincian laporan punya kotak **PO di kasir**: nomor PO, status kirim, tombol **Kirim ulang ke kasir** bila gagal, dan **Setujui buat Draft PO** (Pemilik/GM) untuk laporan tanpa surat jalan.

### Changed

- Berat per satuan kini **satu sumber di Master Produk kasir**: Laporan Bongkaran dan layar Berat per Satuan membaca dari kasir, dan berat yang diisi/diubah di HRIS disimpan ke kasir (riwayat perubahan tetap di HRIS).
- Jumlah barang dari daftar produk kasir wajib bilangan bulat (PO kasir memakai jumlah bulat). Barang lain tetap diisi kg.
- Koreksi atau pembatalan laporan ikut memperbarui/membatalkan Draft PO selama masih Draft; bila PO sudah disetujui kantor, PO diberi tanda "Bongkaran berubah, periksa".
