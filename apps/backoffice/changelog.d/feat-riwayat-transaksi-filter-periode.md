### Added

- Riwayat Transaksi punya tombol pintas periode (Hari Ini, Kemarin, Minggu Ini, Bulan Ini) di atas filter. Menekannya langsung mengisi rentang tanggal, mengembalikan daftar ke halaman 1, dan memuat ulang hasilnya — sama seperti di Laporan Penjualan per Produk.

### Changed

- Preset periode dipindahkan ke `lib/date-ranges.ts` dan dipakai bersama oleh Riwayat Transaksi, Laporan Penjualan per Produk, Laba Rugi, serta Barang Rusak, supaya label dan perhitungan rentangnya tidak lagi bercabang di tiap halaman.
