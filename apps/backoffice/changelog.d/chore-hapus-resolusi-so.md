### Removed
- **Fitur Resolusi Selisih SO dihapus.** Urusan keuangan dari selisih SO (kerugian toko, tagihan ke karyawan) sudah ditangani sistem lain. Mulai sekarang, hasil SO cukup menampilkan nilai selisihnya saja.
  - Menu **Resolusi Selisih SO** dan halaman `/inventory/stock-opname/resolusi` dihapus, beserta endpoint API untuk membuat, membatalkan, dan melihat antrean resolusi.
  - Tab **Resolusi Selisih** di Laporan Hasil Stock Opname dihapus. Tab Rekap SO dan Produk Bermasalah tetap ada, begitu juga ringkasan Nilai Selisih (minus/plus).
  - Kolom **Resolusi** di halaman detail SO dihapus.
  - Permission `stock_opname.resolve` tidak lagi di-seed.
  - Data resolusi yang sudah tercatat tidak dihapus. Tabel `so_variance_resolutions` dan `so_resolution_employee_charges` tetap ada sebagai arsip. Koreksi stok dari resolusi "ditemukan" yang sudah terjadi juga tetap berlaku.
