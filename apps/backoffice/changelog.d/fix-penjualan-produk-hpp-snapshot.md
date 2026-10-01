### Fixed

- **HPP di Laporan Penjualan per Produk kini memakai HPP FIFO yang tercatat saat jual**, sama dengan Laporan Laba Rugi. Sebelumnya HPP dihitung ulang dari modal master hari ini (Manajemen Harga), sehingga ikut basi saat harga beli naik dan modal master belum diperbarui — contoh: ACTIVE -2 Toko Pusat 30/09 tampil HPP Rp 11.000 (modal master Rp 5.500/KG) padahal HPP FIFO-nya Rp 12.166 (Rp 6.083/KG). Modal master kini hanya dipakai bila HPP saat jual kosong. Koreksi HPP (pelunasan utang stok, perbaikan audit) sekarang ikut terlihat di laporan ini.
  - Total HPP periode lama bisa bergeser. Contoh September 2026: Gudang turun ±Rp 47 juta, Toko Pusat naik ±Rp 6 juta — angkanya kini sama dengan Laba Rugi.

### Changed

- **Kolom Harga Master di Laporan Penjualan per Produk kini mengikuti tier harga nota** (Retail/Reseller/Grosir), bukan selalu harga Retail. Penjualan reseller tidak lagi tampak "di bawah harga master". Header kolom Harga Realisasi, Harga Master, dan HPP diberi keterangan saat kursor diarahkan; kolom di ekspor CSV berganti nama jadi "Harga Master sesuai Tier per Satuan (IDR)".
