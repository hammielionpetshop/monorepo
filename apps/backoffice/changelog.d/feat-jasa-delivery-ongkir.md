### Added
- **Mesin delivery (antar-jemput) untuk grooming — belum ada layarnya di kasir.** Nota grooming boleh membawa satu baris ongkos kirim dengan nama pengantar dan alamat. Alamat wajib, tersalin ke data pelanggan, dan boleh dilengkapi di kunjungan berikutnya.
  - Satu nota paling banyak satu delivery. Delivery selesai saat kucing terakhir di nota itu diserahkan.
  - Nota dibatalkan atau baris ongkir diretur → delivery ikut batal; bila returnya dibatalkan, delivery pulih.
- **Groomer & Pengantar dalam satu daftar.** Di Pengaturan, tiap nama bisa ditandai Groomer (memandikan), Pengantar (antar-jemput), atau keduanya. Nama yang sudah ada tetap sebagai groomer.

### Changed
- **Ongkos kirim sekarang jasa (tanpa stok).** Menjual ongkir tidak lagi membuat stok minus atau catatan utang stok. Ongkir tetap bisa dijual dari tab Kasir untuk antar barang.
- **Harga ongkir menjadi Rp 1.000 per satuan; besar ongkir diisi lewat qty** (contoh: qty 15 = Rp 15.000). Tiga tarif lama (25.000 / 15.000 / 10.000) tidak dipakai lagi. Perubahan harga ini tercatat di jejak audit; nota lama tidak berubah.
- **Pencarian pemilik/kucing lewat nomor HP** hanya mencocokkan nomor bila yang diketik memang nomor — angka di dalam nama tidak lagi ikut dicocokkan ke nomor HP orang lain.
