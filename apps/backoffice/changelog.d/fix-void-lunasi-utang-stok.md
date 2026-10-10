### Fixed
- **Barang yang kembali karena nota dibatalkan (void) kini melunasi utang stok produk itu lebih dulu.** Sebelumnya barang yang kembali selalu masuk utuh sebagai batch baru, sehingga utang stok yang terbuka tetap menggantung dan Ringkasan Stok menampilkan stok lebih besar dari kenyataan.
  - Kasus nyata: nota 3 SAK diajukan void, lalu nota pengganti 2 SAK dibuat sebelum void disetujui (stok saat itu 0, jadi tercatat utang 2 SAK). Setelah void disetujui, Ringkasan Stok menampilkan 3 SAK padahal stok sebenarnya 1 SAK. Sekarang 3 SAK yang kembali melunasi utang 2 SAK, sisanya 1 SAK masuk batch.
  - Void nota yang dulu terjual melebihi stok kini juga melunasi utang stok milik nota itu sendiri, alih-alih menambah batch yang barangnya tidak pernah ada.
  - Modal penjualan yang utangnya dilunasi disesuaikan ke modal asli nota yang di-void. Pelunasan tercatat dengan sumber `VOID_REVERSAL` dan nomor nota yang di-void.
  - Penerimaan PO dari supplier tidak berubah. Retur, transfer internal, dan koreksi nota belum ikut melunasi utang stok.
  - Data lama yang sudah terlanjur tidak cocok tidak ikut diperbaiki; dibereskan lewat Stock Opname.
