### Added
- **Produk bisa ditandai sebagai Jasa (tanpa stok).** Di form produk Back Office ada pilihan **Jenis**: Barang atau Jasa Grooming. Hanya Owner/GM yang boleh mengubahnya, dan setiap perubahan jenis tercatat di jejak audit.
  - Empat produk grooming (Kumplit, Kutu/Jamur, Premium, Sehat) langsung ditandai jasa oleh rilis ini. Hotel Cat belum diubah.
  - Barang yang masih punya sisa stok tidak bisa dijadikan jasa sampai stoknya dibereskan.

### Changed
- **Menjual jasa tidak lagi memotong stok.** Nota tetap tercatat sebagai penjualan seperti biasa (uang, shift, dan laporan penjualan tidak berubah), tetapi stok tidak menjadi minus dan tidak muncul catatan utang stok baru. Modal jasa dicatat nol.
  - Membatalkan nota atau meretur baris jasa hanya mengembalikan uangnya — stok tidak bergerak.
  - Nota grooming lama (sebelum rilis ini) tidak diubah; bila dibatalkan, stoknya tetap dikembalikan seperti dulu. Stok minus dan utang stok lama dibiarkan apa adanya.
  - Di layar kasir, produk jasa menampilkan "Jasa — tanpa stok" sebagai ganti peringatan stok kosong.
- **Baris jasa tidak bisa diubah lewat Koreksi nota.** Baris barang pada nota yang sama tetap bisa dikoreksi. Untuk jasa gunakan batal nota atau retur.
- **Produk jasa tidak bisa masuk dokumen stok.** Jasa tidak muncul di pilihan PO, PO Internal/transfer, Bulk Sale, stock opname, penyesuaian stok, barang rusak, retur supplier, dan katalog portal pesanan; bila tetap dikirim, server menolaknya dengan pesan yang jelas.
