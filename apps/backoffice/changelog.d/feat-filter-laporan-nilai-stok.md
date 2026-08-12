### Added

- Laporan Nilai Stok FIFO kini punya filter: cari nama/SKU produk, cabang, kategori, brand, nilai minimum, sertakan produk nonaktif, dan pilihan urutan (cabang, nilai terbesar/terkecil, stok terbanyak, nama A–Z). Filter tersimpan di URL sehingga bisa di-bookmark dan dibagikan.
- Kolom Kategori dan Brand di tabel laporan nilai stok dan di hasil Export CSV-nya.

### Changed

- Tombol Export CSV laporan nilai stok mengikuti filter yang sedang aktif, bukan lagi selalu mengekspor seluruh produk.
- Header laporan nilai stok menampilkan jumlah produk unik dan jumlah baris (produk × cabang), serta penanda "(terfilter)" saat filter aktif.

### Fixed

- Sisa stok di Laporan Nilai Stok FIFO dan di kartu "Nilai Stok Saat Ini" pada Laporan Penjualan per Produk tidak lagi dikalikan rasio satuan. `product_stock_batches.qty_remaining` memang sudah disimpan dalam satuan dasar — kolom `uom_id` di tabel itu cuma jejak audit satuan penerimaan — sehingga mengalikannya lagi adalah konversi dobel. Akibatnya batch yang diterima dalam satuan besar tampil berlipat: 25 SAK terbaca 625 padahal 25. Angka laporan kini cocok dengan Penyesuaian Stok.
- Konversi stok ke satuan dasar di daftar produk Penyesuaian Stok memaksa rasio 1 untuk baris bersatuan dasar, tidak lagi memercayai baris `product_uom_conversions` yang bisa saja rusak.
